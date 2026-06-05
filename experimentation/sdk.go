package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
)

// configResponse is what a client SDK fetches: every evaluated flag plus a
// variant assignment for each running experiment, for one device.
type configResponse struct {
	Project     string                     `json:"project"`
	Environment string                     `json:"environment"`
	Features    map[string]json.RawMessage `json:"features"`
	Experiments map[string]assignment      `json:"experiments"`
}

type assignment struct {
	Variant string `json:"variant"`
}

// handleConfig: GET /api/v1/config?key=<sdkKey>&device=<id>
func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	device := r.URL.Query().Get("device")
	if key == "" || device == "" {
		http.Error(w, "key and device are required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	rk, err := s.store.ResolveSDKKey(ctx, key)
	if errors.Is(err, errNotFound) {
		http.Error(w, "invalid sdk key", http.StatusUnauthorized)
		return
	}
	if err != nil {
		log.Printf("resolve key: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	feats, err := s.store.FeaturesForEval(ctx, rk.ProjectID, rk.EnvironmentID)
	if err != nil {
		log.Printf("features: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	exps, err := s.store.RunningExperiments(ctx, rk.ProjectID)
	if err != nil {
		log.Printf("experiments: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	resp := configResponse{
		Project:     rk.ProjectKey,
		Environment: rk.Environment,
		Features:    make(map[string]json.RawMessage, len(feats)),
		Experiments: make(map[string]assignment, len(exps)),
	}
	for _, fe := range feats {
		resp.Features[fe.Feature.Key] = evalFeature(fe.Feature, fe.Value, device)
	}
	for _, e := range exps {
		resp.Experiments[e.Key] = assignment{Variant: assignVariant(e, device)}
	}
	writeJSON(w, http.StatusOK, resp)
}

type trackRequest struct {
	Key        string `json:"key"`
	Device     string `json:"device"`
	Experiment string `json:"experiment"`
	Variant    string `json:"variant"`
	Event      string `json:"event"`
}

// handleTrack: POST /api/v1/track — record an exposure or conversion.
func (s *Server) handleTrack(w http.ResponseWriter, r *http.Request) {
	var req trackRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.Key == "" || req.Device == "" || req.Experiment == "" || req.Variant == "" || req.Event == "" {
		http.Error(w, "key, device, experiment, variant and event are required", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	rk, err := s.store.ResolveSDKKey(ctx, req.Key)
	if errors.Is(err, errNotFound) {
		http.Error(w, "invalid sdk key", http.StatusUnauthorized)
		return
	}
	if err != nil {
		log.Printf("resolve key: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.store.Track(ctx, rk.ProjectID, rk.EnvironmentID, req.Experiment, req.Variant, req.Device, req.Event); err != nil {
		log.Printf("track: %v", err)
		http.Error(w, "could not record event", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
