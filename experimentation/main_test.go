package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func testServer() *Server {
	return &Server{experiments: defaultExperiments()}
}

func TestHandleAssign(t *testing.T) {
	srv := testServer()

	// Happy path: 200 + deterministic variant for a known experiment.
	req := httptest.NewRequest(http.MethodGet, "/api/assign?experiment=date_flow_variant&device=abc", nil)
	rr := httptest.NewRecorder()
	srv.withCORS(srv.handleAssign)(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	if rr.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("missing CORS header")
	}
	var body map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["variant"] != defaultExperiments()["date_flow_variant"].Assign("abc") {
		t.Errorf("variant = %q, not the deterministic assignment", body["variant"])
	}

	// Missing device -> 400.
	rr = httptest.NewRecorder()
	srv.handleAssign(rr, httptest.NewRequest(http.MethodGet, "/api/assign?experiment=date_flow_variant", nil))
	if rr.Code != http.StatusBadRequest {
		t.Errorf("missing device: status = %d, want 400", rr.Code)
	}

	// Unknown experiment -> 404.
	rr = httptest.NewRecorder()
	srv.handleAssign(rr, httptest.NewRequest(http.MethodGet, "/api/assign?experiment=nope&device=abc", nil))
	if rr.Code != http.StatusNotFound {
		t.Errorf("unknown experiment: status = %d, want 404", rr.Code)
	}
}

func TestCORSPreflight(t *testing.T) {
	srv := testServer()
	rr := httptest.NewRecorder()
	srv.withCORS(srv.handleTrack)(rr, httptest.NewRequest(http.MethodOptions, "/api/track", nil))
	if rr.Code != http.StatusNoContent {
		t.Errorf("preflight: status = %d, want 204", rr.Code)
	}
}

func TestHandleDashboard(t *testing.T) {
	srv := testServer()
	rr := httptest.NewRecorder()
	srv.handleDashboard(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "text/html; charset=utf-8" {
		t.Errorf("content-type = %q", ct)
	}
}
