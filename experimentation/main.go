// Command experimentation is a small, self-hosted feature-flag and experimentation
// platform: multi-project, multi-environment, typed flags with percentage
// rollout, and n-way experiments with frequentist results — served from one Go
// binary over Postgres, with a server-rendered admin UI and an SDK config/track
// API for clients.
package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

//go:embed web/templates/*.html
var templatesFS embed.FS

// Server holds the shared dependencies for all handlers.
type Server struct {
	store *Store
	auth  authConfig
	tmpl  *template.Template
}

func main() {
	port := getenv("PORT", "8080")
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	adminToken := os.Getenv("ADMIN_TOKEN")
	if adminToken == "" {
		log.Fatal("ADMIN_TOKEN is required")
	}

	db, err := openDB(dbURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	migrateCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	if err := migrate(migrateCtx, db); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	cancel()

	srv := &Server{
		store: &Store{db: db},
		auth:  authConfig{token: adminToken},
		tmpl:  template.Must(template.New("").Funcs(uiFuncs()).ParseFS(templatesFS, "web/templates/*.html")),
	}

	seedCtx, cancelSeed := context.WithTimeout(context.Background(), 15*time.Second)
	if err := srv.seed(seedCtx); err != nil {
		log.Printf("seed: %v", err)
	}
	cancelSeed()

	handler := logRequests(withV1CORS(srv.routes()))
	httpSrv := &http.Server{Addr: ":" + port, Handler: handler, ReadHeaderTimeout: 5 * time.Second}

	go func() {
		log.Printf("experimentation listening on :%s", port)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serve: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()
	_ = httpSrv.Shutdown(shutdownCtx)
	_ = db.Close()
}

func (s *Server) routes() *http.ServeMux {
	mux := http.NewServeMux()
	a := s.auth

	mux.HandleFunc("GET /healthz", s.handleHealth)

	// SDK (public; CORS handled by withV1CORS).
	mux.HandleFunc("GET /api/v1/config", s.handleConfig)
	mux.HandleFunc("POST /api/v1/track", s.handleTrack)

	// Management JSON API (admin token).
	mux.HandleFunc("GET /api/admin/projects", a.requireAdmin(s.apiListProjects))
	mux.HandleFunc("POST /api/admin/projects", a.requireAdmin(s.apiCreateProject))
	mux.HandleFunc("GET /api/admin/projects/{project}", a.requireAdmin(s.apiGetProject))
	mux.HandleFunc("PATCH /api/admin/projects/{project}", a.requireAdmin(s.apiUpdateProject))
	mux.HandleFunc("DELETE /api/admin/projects/{project}", a.requireAdmin(s.apiDeleteProject))
	mux.HandleFunc("POST /api/admin/projects/{project}/environments", a.requireAdmin(s.apiCreateEnv))
	mux.HandleFunc("PATCH /api/admin/projects/{project}/environments/{env}", a.requireAdmin(s.apiUpdateEnv))
	mux.HandleFunc("DELETE /api/admin/projects/{project}/environments/{env}", a.requireAdmin(s.apiDeleteEnv))
	mux.HandleFunc("POST /api/admin/projects/{project}/features", a.requireAdmin(s.apiCreateFeature))
	mux.HandleFunc("PATCH /api/admin/projects/{project}/features/{feature}", a.requireAdmin(s.apiUpdateFeature))
	mux.HandleFunc("DELETE /api/admin/projects/{project}/features/{feature}", a.requireAdmin(s.apiDeleteFeature))
	mux.HandleFunc("PUT /api/admin/projects/{project}/features/{feature}/values/{env}", a.requireAdmin(s.apiSetFeatureValue))
	mux.HandleFunc("DELETE /api/admin/projects/{project}/features/{feature}/values/{env}", a.requireAdmin(s.apiDeleteFeatureValue))
	mux.HandleFunc("POST /api/admin/projects/{project}/experiments", a.requireAdmin(s.apiCreateExperiment))
	mux.HandleFunc("PUT /api/admin/projects/{project}/experiments/{exp}", a.requireAdmin(s.apiUpdateExperiment))
	mux.HandleFunc("DELETE /api/admin/projects/{project}/experiments/{exp}", a.requireAdmin(s.apiDeleteExperiment))
	mux.HandleFunc("GET /api/admin/projects/{project}/experiments/{exp}/results", a.requireAdmin(s.apiResults))

	// Server-rendered admin UI.
	mux.HandleFunc("GET /ui/login", s.uiLoginForm)
	mux.HandleFunc("POST /ui/login", s.uiLogin)
	mux.HandleFunc("POST /ui/logout", s.uiLogout)
	mux.HandleFunc("GET /{$}", a.requireUI(s.uiProjects))
	mux.HandleFunc("POST /ui/projects", a.requireUI(s.uiCreateProject))
	mux.HandleFunc("GET /ui/projects/{project}", a.requireUI(s.uiProject))
	mux.HandleFunc("POST /ui/projects/{project}/update", a.requireUI(s.uiUpdateProject))
	mux.HandleFunc("POST /ui/projects/{project}/delete", a.requireUI(s.uiDeleteProject))
	mux.HandleFunc("POST /ui/projects/{project}/environments", a.requireUI(s.uiCreateEnv))
	mux.HandleFunc("POST /ui/projects/{project}/environments/{env}/update", a.requireUI(s.uiUpdateEnv))
	mux.HandleFunc("POST /ui/projects/{project}/environments/{env}/delete", a.requireUI(s.uiDeleteEnv))
	mux.HandleFunc("POST /ui/projects/{project}/features", a.requireUI(s.uiCreateFeature))
	mux.HandleFunc("POST /ui/projects/{project}/features/{feature}/update", a.requireUI(s.uiUpdateFeature))
	mux.HandleFunc("POST /ui/projects/{project}/features/{feature}/delete", a.requireUI(s.uiDeleteFeature))
	mux.HandleFunc("POST /ui/projects/{project}/features/{feature}/values", a.requireUI(s.uiSetFeatureValue))
	mux.HandleFunc("POST /ui/projects/{project}/features/{feature}/values/{env}/delete", a.requireUI(s.uiDeleteFeatureValue))
	mux.HandleFunc("POST /ui/projects/{project}/experiments", a.requireUI(s.uiCreateExperiment))
	mux.HandleFunc("POST /ui/projects/{project}/experiments/{exp}", a.requireUI(s.uiUpdateExperiment))
	mux.HandleFunc("POST /ui/projects/{project}/experiments/{exp}/delete", a.requireUI(s.uiDeleteExperiment))
	mux.HandleFunc("GET /ui/projects/{project}/experiments/{exp}", a.requireUI(s.uiExperiment))

	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.store.db.PingContext(ctx); err != nil {
		http.Error(w, "db unavailable", http.StatusServiceUnavailable)
		return
	}
	_, _ = w.Write([]byte("ok"))
}

// withV1CORS opens CORS for the public SDK endpoints so browser apps can call
// them cross-origin, and short-circuits preflight requests.
func withV1CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/v1/") {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
