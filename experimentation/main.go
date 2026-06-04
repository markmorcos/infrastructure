// Command experimentation is a tiny from-scratch A/B/C experimentation service:
// deterministic variant assignment, event tracking, and frequentist results
// (two-proportion z-test) over a single Postgres table — plus an embedded
// dashboard. It is the lightweight stand-in for GrowthBook for the Datebloom
// (datewithmark.com) Sunset/Midnight/Linen experiment.
package main

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

//go:embed web/index.html
var webFS embed.FS

// Server wires the HTTP handlers to the event store and the experiment config.
type Server struct {
	store       *Store
	experiments map[string]Experiment
}

func main() {
	port := getenv("PORT", "8080")
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(10)
	db.SetConnMaxIdleTime(5 * time.Minute)

	store := &Store{db: db}
	migrateCtx, cancelMigrate := context.WithTimeout(context.Background(), 15*time.Second)
	if err := store.Migrate(migrateCtx); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	cancelMigrate()

	srv := &Server{store: store, experiments: defaultExperiments()}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", srv.handleHealth)
	mux.HandleFunc("/api/assign", srv.withCORS(srv.handleAssign))
	mux.HandleFunc("/api/track", srv.withCORS(srv.handleTrack))
	mux.HandleFunc("/api/results", srv.withCORS(srv.handleResults))
	mux.HandleFunc("/", srv.handleDashboard)

	httpSrv := &http.Server{
		Addr:              ":" + port,
		Handler:           logRequests(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("experimentation listening on :%s", port)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serve: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
	_ = db.Close()
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

// handleAssign returns the deterministic variant for a device. It is a pure
// read (no write): the caller fires the "exposure" event via /api/track.
func (s *Server) handleAssign(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	device := r.URL.Query().Get("device")
	if device == "" {
		http.Error(w, "device is required", http.StatusBadRequest)
		return
	}
	exp, ok := s.experiments[r.URL.Query().Get("experiment")]
	if !ok {
		http.Error(w, "unknown experiment", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"experiment": exp.Key,
		"variant":    exp.Assign(device),
	})
}

type trackRequest struct {
	Experiment string `json:"experiment"`
	Variant    string `json:"variant"`
	Device     string `json:"device"`
	Event      string `json:"event"`
}

// handleTrack records one exposure or conversion event.
func (s *Server) handleTrack(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req trackRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.Device == "" || req.Variant == "" || req.Event == "" {
		http.Error(w, "device, variant and event are required", http.StatusBadRequest)
		return
	}
	if _, ok := s.experiments[req.Experiment]; !ok {
		http.Error(w, "unknown experiment", http.StatusNotFound)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if err := s.store.Track(ctx, req.Experiment, req.Variant, req.Device, req.Event); err != nil {
		log.Printf("track error: %v", err)
		http.Error(w, "could not record event", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleResults computes conversion rates and significance for an experiment.
func (s *Server) handleResults(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	exp, ok := s.experiments[r.URL.Query().Get("experiment")]
	if !ok {
		http.Error(w, "unknown experiment", http.StatusNotFound)
		return
	}
	metric := r.URL.Query().Get("metric")
	if metric == "" {
		metric = exp.Metric
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	stats, err := s.store.Stats(ctx, exp.Key, metric)
	if err != nil {
		log.Printf("stats error: %v", err)
		http.Error(w, "could not compute results", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, buildResults(exp, metric, stats))
}

// handleDashboard serves the embedded single-page results dashboard.
func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	b, err := webFS.ReadFile("web/index.html")
	if err != nil {
		http.Error(w, "dashboard unavailable", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(b)
}

// withCORS allows the browser app (datewithmark.com) to call the API
// cross-origin. The endpoints are public and non-credentialed, so "*" is fine.
func (s *Server) withCORS(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h(w, r)
	}
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
