// Command cms is a small, self-hosted content management system for the
// family of morcos.tech websites: multi-site, schema-driven section forms a
// non-technical editor can use, draft/publish with a GitHub rebuild hook, and
// image uploads to MinIO — served from one Go binary over Postgres, with a
// server-rendered admin UI and a public read API the sites' builds consume.
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
	store  *Store
	auth   authConfig
	tmpl   *template.Template
	assets *assetStore // nil when S3 is not configured (uploads disabled)
	github githubConfig
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

	assets, err := newAssetStore()
	if err != nil {
		log.Printf("assets: %v (uploads disabled)", err)
	}

	srv := &Server{
		store:  &Store{db: db},
		auth:   authConfig{token: adminToken},
		tmpl:   template.Must(template.New("").Funcs(uiFuncs()).ParseFS(templatesFS, "web/templates/*.html")),
		assets: assets,
		github: githubConfig{token: os.Getenv("GITHUB_TOKEN")},
	}

	seedCtx, cancelSeed := context.WithTimeout(context.Background(), 15*time.Second)
	if err := srv.seed(seedCtx); err != nil {
		log.Printf("seed: %v", err)
	}
	cancelSeed()

	handler := logRequests(withV1CORS(srv.routes()))
	httpSrv := &http.Server{Addr: ":" + port, Handler: handler, ReadHeaderTimeout: 5 * time.Second}

	go func() {
		log.Printf("cms listening on :%s", port)
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

	// Public content API (CORS handled by withV1CORS).
	mux.HandleFunc("GET /api/v1/sites/{site}/content", s.handleContent)

	// Management JSON API (admin token).
	mux.HandleFunc("GET /api/admin/sites", a.requireAdmin(s.apiListSites))
	mux.HandleFunc("POST /api/admin/sites", a.requireAdmin(s.apiCreateSite))
	mux.HandleFunc("GET /api/admin/sites/{site}", a.requireAdmin(s.apiGetSite))
	mux.HandleFunc("PATCH /api/admin/sites/{site}", a.requireAdmin(s.apiUpdateSite))
	mux.HandleFunc("DELETE /api/admin/sites/{site}", a.requireAdmin(s.apiDeleteSite))
	mux.HandleFunc("GET /api/admin/sites/{site}/sections", a.requireAdmin(s.apiListSections))
	mux.HandleFunc("GET /api/admin/sites/{site}/sections/{key}/content/{locale}", a.requireAdmin(s.apiGetDraft))
	mux.HandleFunc("PUT /api/admin/sites/{site}/sections/{key}/content/{locale}", a.requireAdmin(s.apiPutDraft))
	mux.HandleFunc("POST /api/admin/sites/{site}/import", a.requireAdmin(s.apiImport))
	mux.HandleFunc("POST /api/admin/sites/{site}/publish", a.requireAdmin(s.apiPublish))
	mux.HandleFunc("GET /api/admin/sites/{site}/assets", a.requireAdmin(s.apiListAssets))
	mux.HandleFunc("POST /api/admin/sites/{site}/assets", a.requireAdmin(s.apiUploadAsset))
	mux.HandleFunc("DELETE /api/admin/sites/{site}/assets/{id}", a.requireAdmin(s.apiDeleteAsset))

	// Server-rendered admin UI.
	mux.HandleFunc("GET /ui/login", s.uiLoginForm)
	mux.HandleFunc("POST /ui/login", s.uiLogin)
	mux.HandleFunc("POST /ui/logout", s.uiLogout)
	mux.HandleFunc("GET /{$}", a.requireUI(s.uiSites))
	mux.HandleFunc("GET /ui/sites/{site}", a.requireUI(s.uiSite))
	mux.HandleFunc("GET /ui/sites/{site}/sections/{key}", a.requireUI(s.uiSection))
	mux.HandleFunc("POST /ui/sites/{site}/sections/{key}", a.requireUI(s.uiSaveSection))
	mux.HandleFunc("POST /ui/sites/{site}/publish", a.requireUI(s.uiPublish))
	mux.HandleFunc("GET /ui/sites/{site}/assets", a.requireUI(s.uiAssets))
	mux.HandleFunc("POST /ui/sites/{site}/assets", a.requireUI(s.uiUploadAsset))
	mux.HandleFunc("POST /ui/sites/{site}/assets/{id}/delete", a.requireUI(s.uiDeleteAsset))

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

// handleContent serves the assembled content dictionary for one locale.
// Published content is public; ?draft=1 previews drafts and needs the admin
// token.
func (s *Server) handleContent(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	draft := r.URL.Query().Get("draft") == "1"
	if draft && !s.auth.authed(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	locale := r.URL.Query().Get("locale")
	if locale == "" {
		locale = site.DefaultLocale
	}
	if !containsString(site.Locales, locale) {
		http.Error(w, "unknown locale", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	sections, err := s.store.ListSections(ctx, site.ID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	content, err := s.store.SiteContent(ctx, site.ID, draft)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	publishedAt, _ := s.store.LastPublishedAt(ctx, site.ID)

	if !draft && !publishedAt.IsZero() {
		etag := `"` + publishedAt.UTC().Format(time.RFC3339Nano) + `"`
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", "no-cache")
		if r.Header.Get("If-None-Match") == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"site":        site.Key,
		"locale":      locale,
		"publishedAt": publishedAt,
		"content":     assembleDict(sections, content, locale),
	})
}

// withV1CORS opens CORS for the public content endpoints so browser apps and
// CI builds can call them cross-origin, and short-circuits preflights.
func withV1CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/v1/") {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token")
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

func containsString(ss []string, s string) bool {
	for _, v := range ss {
		if v == s {
			return true
		}
	}
	return false
}
