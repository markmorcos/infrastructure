package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"strconv"
	"strings"
)

// uiFuncs are helpers available inside the templates.
func uiFuncs() template.FuncMap {
	return template.FuncMap{
		"str": func(b json.RawMessage) string { return string(b) },
		"pct": func(f float64) string { return fmt.Sprintf("%.1f%%", f*100) },
		"signedPct": func(f float64) string {
			sign := ""
			if f >= 0 {
				sign = "+"
			}
			return fmt.Sprintf("%s%.1f%%", sign, f*100)
		},
		"variantLines": func(vs []Variant) string {
			var b strings.Builder
			for _, v := range vs {
				fmt.Fprintf(&b, "%s:%d\n", v.Key, v.Weight)
			}
			return b.String()
		},
	}
}

func (s *Server) render(w http.ResponseWriter, name string, data map[string]any) {
	var buf bytes.Buffer
	if err := s.tmpl.ExecuteTemplate(&buf, name, data); err != nil {
		log.Printf("render %s: %v", name, err)
		http.Error(w, "render error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = buf.WriteTo(w)
}

func redirect(w http.ResponseWriter, r *http.Request, url string) {
	http.Redirect(w, r, url, http.StatusSeeOther)
}

// valueFromForm builds a typed JSON value from a raw form string.
func valueFromForm(typ, raw string) (json.RawMessage, error) {
	raw = strings.TrimSpace(raw)
	switch typ {
	case featureBoolean:
		if raw == "true" {
			return json.RawMessage("true"), nil
		}
		return json.RawMessage("false"), nil
	case featureString:
		b, _ := json.Marshal(raw)
		return b, nil
	case featureNumber:
		if raw == "" {
			raw = "0"
		}
		f, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid number")
		}
		b, _ := json.Marshal(f)
		return b, nil
	default: // json
		if raw == "" {
			raw = "null"
		}
		if !json.Valid([]byte(raw)) {
			return nil, fmt.Errorf("invalid json")
		}
		return json.RawMessage(raw), nil
	}
}

func parseVariants(raw string) []Variant {
	var vs []Variant
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		key := strings.TrimSpace(parts[0])
		weight := 1
		if len(parts) == 2 {
			if n, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil {
				weight = n
			}
		}
		vs = append(vs, Variant{Key: key, Weight: weight})
	}
	return vs
}

// ---- auth pages ----

func (s *Server) uiLoginForm(w http.ResponseWriter, r *http.Request) {
	if s.auth.authed(r) {
		redirect(w, r, "/")
		return
	}
	s.render(w, "login", map[string]any{"Title": "Sign in"})
}

func (s *Server) uiLogin(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	token := r.FormValue("token")
	if !s.auth.valid(token) {
		s.render(w, "login", map[string]any{"Title": "Sign in", "Error": "Invalid admin token"})
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: adminCookie, Value: token, Path: "/",
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	redirect(w, r, "/")
}

func (s *Server) uiLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: adminCookie, Value: "", Path: "/", MaxAge: -1})
	redirect(w, r, "/ui/login")
}

// ---- projects ----

func (s *Server) uiProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := s.store.ListProjects(r.Context())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	s.render(w, "projects", map[string]any{"Title": "Projects", "Projects": projects})
}

func (s *Server) uiCreateProject(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	key := strings.TrimSpace(r.FormValue("key"))
	name := strings.TrimSpace(r.FormValue("name"))
	if !validKey(key) {
		redirect(w, r, "/")
		return
	}
	if name == "" {
		name = key
	}
	if _, _, _, err := s.provisionProject(r.Context(), key, name); err != nil {
		log.Printf("ui create project: %v", err)
		redirect(w, r, "/")
		return
	}
	redirect(w, r, "/ui/projects/"+key)
}

func (s *Server) uiUpdateProject(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		name = p.Key
	}
	if err := s.store.UpdateProject(ctx, p.ID, name); err != nil {
		log.Printf("ui update project: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key)
}

func (s *Server) uiDeleteProject(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if err := s.store.DeleteProject(ctx, p); err != nil {
		log.Printf("ui delete project: %v", err)
		redirect(w, r, "/ui/projects/"+p.Key)
		return
	}
	redirect(w, r, "/")
}

// ---- environments ----

func (s *Server) uiCreateEnv(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()
	key := strings.TrimSpace(r.FormValue("key"))
	name := strings.TrimSpace(r.FormValue("name"))
	if !validKey(key) {
		redirect(w, r, "/ui/projects/"+p.Key)
		return
	}
	if name == "" {
		name = key
	}
	if _, _, err := s.provisionEnvironment(ctx, p.ID, key, name); err != nil {
		log.Printf("ui create env: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key)
}

func (s *Server) uiUpdateEnv(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	env, err := s.store.GetEnvironment(ctx, p.ID, r.PathValue("env"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		name = env.Key
	}
	if err := s.store.UpdateEnvironment(ctx, env.ID, name); err != nil {
		log.Printf("ui update env: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key)
}

func (s *Server) uiDeleteEnv(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	env, err := s.store.GetEnvironment(ctx, p.ID, r.PathValue("env"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if err := s.store.DeleteEnvironment(ctx, env); err != nil {
		log.Printf("ui delete env: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key)
}

// featureView pairs a feature with its per-environment values for display.
type featureView struct {
	Feature Feature
	Values  []FeatureValue
}

func (s *Server) uiProject(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if errors.Is(err, errNotFound) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	envs, _ := s.store.ListEnvironments(ctx, p.ID)
	keys, _ := s.store.ListSDKKeys(ctx, p.ID)
	features, _ := s.store.ListFeatures(ctx, p.ID)
	exps, _ := s.store.ListExperiments(ctx, p.ID)

	views := make([]featureView, 0, len(features))
	for _, f := range features {
		vals, _ := s.store.ListFeatureValues(ctx, f.ID)
		views = append(views, featureView{Feature: f, Values: vals})
	}

	s.render(w, "project", map[string]any{
		"Title":        p.Name,
		"Project":      p,
		"Environments": envs,
		"SDKKeys":      keys,
		"Features":     views,
		"Experiments":  exps,
	})
}

func (s *Server) uiCreateFeature(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()
	key := strings.TrimSpace(r.FormValue("key"))
	typ := r.FormValue("type")
	if !validKey(key) || !validFeatureType(typ) {
		redirect(w, r, "/ui/projects/"+p.Key)
		return
	}
	def, verr := valueFromForm(typ, r.FormValue("default"))
	if verr != nil {
		def = defaultForType(typ)
	}
	if _, err := s.store.CreateFeature(ctx, p.ID, key, typ, strings.TrimSpace(r.FormValue("description")), def); err != nil {
		log.Printf("ui create feature: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key)
}

func (s *Server) uiSetFeatureValue(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	feat, err := s.store.GetFeature(ctx, p.ID, r.PathValue("feature"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()
	env, err := s.store.GetEnvironment(ctx, p.ID, r.FormValue("environment"))
	if err != nil {
		redirect(w, r, "/ui/projects/"+p.Key)
		return
	}
	value, verr := valueFromForm(feat.Type, r.FormValue("value"))
	if verr != nil {
		value = defaultForType(feat.Type)
	}
	rollout, _ := strconv.Atoi(r.FormValue("rollout"))
	if rollout < 0 {
		rollout = 0
	} else if rollout > 100 {
		rollout = 100
	}
	enabled := r.FormValue("enabled") == "on" || r.FormValue("enabled") == "true"
	if err := s.store.UpsertFeatureValue(ctx, feat.ID, env.ID, enabled, value, rollout); err != nil {
		log.Printf("ui set value: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key)
}

func (s *Server) uiUpdateFeature(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	feat, err := s.store.GetFeature(ctx, p.ID, r.PathValue("feature"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()
	def, verr := valueFromForm(feat.Type, r.FormValue("default"))
	if verr != nil {
		def = feat.DefaultValue
	}
	if err := s.store.UpdateFeature(ctx, feat.ID, strings.TrimSpace(r.FormValue("description")), def); err != nil {
		log.Printf("ui update feature: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key)
}

func (s *Server) uiDeleteFeature(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	feat, err := s.store.GetFeature(ctx, p.ID, r.PathValue("feature"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if err := s.store.DeleteFeature(ctx, feat.ID); err != nil {
		log.Printf("ui delete feature: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key)
}

func (s *Server) uiDeleteFeatureValue(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	feat, err := s.store.GetFeature(ctx, p.ID, r.PathValue("feature"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	env, err := s.store.GetEnvironment(ctx, p.ID, r.PathValue("env"))
	if err != nil {
		redirect(w, r, "/ui/projects/"+p.Key)
		return
	}
	if err := s.store.DeleteFeatureValue(ctx, feat.ID, env.ID); err != nil {
		log.Printf("ui delete feature value: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key)
}

func (s *Server) uiCreateExperiment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()
	exp := Experiment{
		ProjectID: p.ID,
		Key:       strings.TrimSpace(r.FormValue("key")),
		Name:      strings.TrimSpace(r.FormValue("name")),
		Status:    r.FormValue("status"),
		Metric:    strings.TrimSpace(r.FormValue("metric")),
		Control:   strings.TrimSpace(r.FormValue("control")),
		Variants:  parseVariants(r.FormValue("variants")),
	}
	if exp.Status == "" {
		exp.Status = statusDraft
	}
	if !validKey(exp.Key) {
		redirect(w, r, "/ui/projects/"+p.Key)
		return
	}
	if msg, ok := validateExperiment(experimentBody{Name: exp.Name, Status: exp.Status, Metric: exp.Metric, Control: exp.Control, Variants: exp.Variants}); !ok {
		log.Printf("ui create experiment: %s", msg)
		redirect(w, r, "/ui/projects/"+p.Key)
		return
	}
	if _, err := s.store.CreateExperiment(ctx, exp); err != nil {
		log.Printf("ui create experiment: %v", err)
		redirect(w, r, "/ui/projects/"+p.Key)
		return
	}
	redirect(w, r, "/ui/projects/"+p.Key+"/experiments/"+exp.Key)
}

func (s *Server) uiUpdateExperiment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	exp, err := s.store.GetExperiment(ctx, p.ID, r.PathValue("exp"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_ = r.ParseForm()
	exp.Name = strings.TrimSpace(r.FormValue("name"))
	exp.Status = r.FormValue("status")
	exp.Metric = strings.TrimSpace(r.FormValue("metric"))
	exp.Control = strings.TrimSpace(r.FormValue("control"))
	exp.Variants = parseVariants(r.FormValue("variants"))
	if exp.Status == "" {
		exp.Status = statusDraft
	}
	if msg, ok := validateExperiment(experimentBody{Name: exp.Name, Status: exp.Status, Metric: exp.Metric, Control: exp.Control, Variants: exp.Variants}); !ok {
		log.Printf("ui update experiment: %s", msg)
		redirect(w, r, "/ui/projects/"+p.Key+"/experiments/"+exp.Key)
		return
	}
	if err := s.store.UpdateExperiment(ctx, exp); err != nil {
		log.Printf("ui update experiment: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key+"/experiments/"+exp.Key)
}

func (s *Server) uiDeleteExperiment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	exp, err := s.store.GetExperiment(ctx, p.ID, r.PathValue("exp"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if err := s.store.DeleteExperiment(ctx, exp); err != nil {
		log.Printf("ui delete experiment: %v", err)
	}
	redirect(w, r, "/ui/projects/"+p.Key)
}

func (s *Server) uiExperiment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := s.store.GetProject(ctx, r.PathValue("project"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	exp, err := s.store.GetExperiment(ctx, p.ID, r.PathValue("exp"))
	if errors.Is(err, errNotFound) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	stats, err := s.store.Stats(ctx, p.ID, exp.Key, "", exp.Metric)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	s.render(w, "experiment", map[string]any{
		"Title":      exp.Key,
		"Project":    p,
		"Experiment": exp,
		"Results":    buildResults(exp, exp.Metric, stats),
	})
}
