package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
)

var keyRe = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)

func validKey(s string) bool { return keyRe.MatchString(s) }

func validFeatureType(t string) bool {
	switch t {
	case featureBoolean, featureString, featureNumber, featureJSON:
		return true
	}
	return false
}

func defaultForType(t string) json.RawMessage {
	switch t {
	case featureBoolean:
		return json.RawMessage("false")
	case featureString:
		return json.RawMessage(`""`)
	case featureNumber:
		return json.RawMessage("0")
	default:
		return json.RawMessage("null")
	}
}

func validStatus(s string) bool {
	switch s {
	case statusDraft, statusRunning, statusStopped:
		return true
	}
	return false
}

// projectFromPath resolves the {project} path value, writing a 404/500 and
// returning ok=false when it cannot.
func (s *Server) projectFromPath(w http.ResponseWriter, r *http.Request) (Project, bool) {
	p, err := s.store.GetProject(r.Context(), r.PathValue("project"))
	if errors.Is(err, errNotFound) {
		http.Error(w, "project not found", http.StatusNotFound)
		return p, false
	}
	if err != nil {
		log.Printf("get project: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return p, false
	}
	return p, true
}

func (s *Server) apiListProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := s.store.ListProjects(r.Context())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (s *Server) apiCreateProject(w http.ResponseWriter, r *http.Request) {
	var body struct{ Key, Name string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if !validKey(body.Key) {
		http.Error(w, "key must match [a-z0-9_-]", http.StatusBadRequest)
		return
	}
	if body.Name == "" {
		body.Name = body.Key
	}
	p, env, sdkKey, err := s.provisionProject(r.Context(), body.Key, body.Name)
	if err != nil {
		log.Printf("create project: %v", err)
		http.Error(w, "could not create project (key may already exist)", http.StatusConflict)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"project":     p,
		"environment": env,
		"sdkKey":      sdkKey,
	})
}

func (s *Server) apiGetProject(w http.ResponseWriter, r *http.Request) {
	p, ok := s.projectFromPath(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	envs, _ := s.store.ListEnvironments(ctx, p.ID)
	keys, _ := s.store.ListSDKKeys(ctx, p.ID)
	feats, _ := s.store.ListFeatures(ctx, p.ID)
	exps, _ := s.store.ListExperiments(ctx, p.ID)
	writeJSON(w, http.StatusOK, map[string]any{
		"project":      p,
		"environments": envs,
		"sdkKeys":      keys,
		"features":     feats,
		"experiments":  exps,
	})
}

func (s *Server) apiCreateEnv(w http.ResponseWriter, r *http.Request) {
	p, ok := s.projectFromPath(w, r)
	if !ok {
		return
	}
	var body struct{ Key, Name string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if !validKey(body.Key) {
		http.Error(w, "key must match [a-z0-9_-]", http.StatusBadRequest)
		return
	}
	if body.Name == "" {
		body.Name = body.Key
	}
	env, sdkKey, err := s.provisionEnvironment(r.Context(), p.ID, body.Key, body.Name)
	if err != nil {
		http.Error(w, "could not create environment (key may already exist)", http.StatusConflict)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"environment": env, "sdkKey": sdkKey})
}

func (s *Server) apiCreateFeature(w http.ResponseWriter, r *http.Request) {
	p, ok := s.projectFromPath(w, r)
	if !ok {
		return
	}
	var body struct {
		Key         string          `json:"key"`
		Type        string          `json:"type"`
		Description string          `json:"description"`
		Default     json.RawMessage `json:"default"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if !validKey(body.Key) || !validFeatureType(body.Type) {
		http.Error(w, "valid key and type (boolean|string|number|json) required", http.StatusBadRequest)
		return
	}
	if len(body.Default) == 0 {
		body.Default = defaultForType(body.Type)
	}
	f, err := s.store.CreateFeature(r.Context(), p.ID, body.Key, body.Type, body.Description, body.Default)
	if err != nil {
		http.Error(w, "could not create feature (key may already exist)", http.StatusConflict)
		return
	}
	writeJSON(w, http.StatusCreated, f)
}

func (s *Server) apiSetFeatureValue(w http.ResponseWriter, r *http.Request) {
	p, ok := s.projectFromPath(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	feat, err := s.store.GetFeature(ctx, p.ID, r.PathValue("feature"))
	if errors.Is(err, errNotFound) {
		http.Error(w, "feature not found", http.StatusNotFound)
		return
	}
	env, err := s.store.GetEnvironment(ctx, p.ID, r.PathValue("env"))
	if errors.Is(err, errNotFound) {
		http.Error(w, "environment not found", http.StatusNotFound)
		return
	}
	var body struct {
		Enabled bool            `json:"enabled"`
		Value   json.RawMessage `json:"value"`
		Rollout int             `json:"rollout"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if body.Rollout < 0 || body.Rollout > 100 {
		http.Error(w, "rollout must be 0..100", http.StatusBadRequest)
		return
	}
	if len(body.Value) == 0 {
		body.Value = defaultForType(feat.Type)
	}
	if err := s.store.UpsertFeatureValue(ctx, feat.ID, env.ID, body.Enabled, body.Value, body.Rollout); err != nil {
		http.Error(w, "could not set value", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type experimentBody struct {
	Name     string    `json:"name"`
	Status   string    `json:"status"`
	Metric   string    `json:"metric"`
	Control  string    `json:"control"`
	Variants []Variant `json:"variants"`
}

func validateExperiment(b experimentBody) (string, bool) {
	if b.Metric == "" {
		return "metric is required", false
	}
	if len(b.Variants) < 2 {
		return "at least two variants are required", false
	}
	seen := map[string]bool{}
	for _, v := range b.Variants {
		if !validKey(v.Key) {
			return "variant key must match [a-z0-9_-]", false
		}
		if v.Weight < 0 {
			return "variant weight must be >= 0", false
		}
		seen[v.Key] = true
	}
	if !seen[b.Control] {
		return "control must be one of the variants", false
	}
	if b.Status != "" && !validStatus(b.Status) {
		return "status must be draft|running|stopped", false
	}
	return "", true
}

func (s *Server) apiCreateExperiment(w http.ResponseWriter, r *http.Request) {
	p, ok := s.projectFromPath(w, r)
	if !ok {
		return
	}
	var body struct {
		Key string `json:"key"`
		experimentBody
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if !validKey(body.Key) {
		http.Error(w, "key must match [a-z0-9_-]", http.StatusBadRequest)
		return
	}
	if msg, ok := validateExperiment(body.experimentBody); !ok {
		http.Error(w, msg, http.StatusBadRequest)
		return
	}
	if body.Status == "" {
		body.Status = statusDraft
	}
	exp := Experiment{
		ProjectID: p.ID, Key: body.Key, Name: body.Name, Status: body.Status,
		Metric: body.Metric, Control: body.Control, Variants: body.Variants,
	}
	created, err := s.store.CreateExperiment(r.Context(), exp)
	if err != nil {
		http.Error(w, "could not create experiment (key may already exist)", http.StatusConflict)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) apiUpdateExperiment(w http.ResponseWriter, r *http.Request) {
	p, ok := s.projectFromPath(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	exp, err := s.store.GetExperiment(ctx, p.ID, r.PathValue("exp"))
	if errors.Is(err, errNotFound) {
		http.Error(w, "experiment not found", http.StatusNotFound)
		return
	}
	var body experimentBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if msg, ok := validateExperiment(body); !ok {
		http.Error(w, msg, http.StatusBadRequest)
		return
	}
	exp.Name, exp.Status, exp.Metric, exp.Control, exp.Variants = body.Name, body.Status, body.Metric, body.Control, body.Variants
	if exp.Status == "" {
		exp.Status = statusDraft
	}
	if err := s.store.UpdateExperiment(ctx, exp); err != nil {
		http.Error(w, "could not update experiment", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, exp)
}

func (s *Server) apiResults(w http.ResponseWriter, r *http.Request) {
	p, ok := s.projectFromPath(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	exp, err := s.store.GetExperiment(ctx, p.ID, r.PathValue("exp"))
	if errors.Is(err, errNotFound) {
		http.Error(w, "experiment not found", http.StatusNotFound)
		return
	}
	envID := ""
	if envKey := r.URL.Query().Get("environment"); envKey != "" {
		env, err := s.store.GetEnvironment(ctx, p.ID, envKey)
		if errors.Is(err, errNotFound) {
			http.Error(w, "environment not found", http.StatusNotFound)
			return
		}
		envID = env.ID
	}
	stats, err := s.store.Stats(ctx, p.ID, exp.Key, envID, exp.Metric)
	if err != nil {
		http.Error(w, "could not compute results", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, buildResults(exp, exp.Metric, stats))
}
