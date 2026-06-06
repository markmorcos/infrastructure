//go:build e2e

package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"html/template"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

// newTestServer migrates and truncates the shared database, then serves the real
// router over a local httptest server so tests exercise routing, auth, handlers,
// the store and live SQL end to end.
func newTestServer(t *testing.T) string {
	t.Helper()
	if testDSN == "" {
		t.Skip("no test database (install postgres, or set TEST_DATABASE_URL)")
	}
	db, err := openDB(testDSN)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := migrate(ctx, db); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	resetDB(t, db)

	tmpl := template.Must(template.New("").Funcs(uiFuncs()).ParseFS(templatesFS, "web/templates/*.html"))
	srv := &Server{store: &Store{db: db}, auth: authConfig{token: testAdminToken}, tmpl: tmpl}
	ts := httptest.NewServer(srv.routes())
	t.Cleanup(func() { ts.Close(); db.Close() })
	return ts.URL
}

func resetDB(t *testing.T, db *sql.DB) {
	t.Helper()
	_, err := db.Exec(`TRUNCATE projects, environments, sdk_keys, features,
		feature_values, experiments, experiment_variants, experiment_events
		RESTART IDENTITY CASCADE`)
	if err != nil {
		t.Fatalf("reset db: %v", err)
	}
}

// ---- admin JSON API helpers ----

func apiDo(t *testing.T, base, method, path string, body any) *http.Response {
	t.Helper()
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, base+path, r)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+testAdminToken)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func mustStatus(t *testing.T, resp *http.Response, want int) {
	t.Helper()
	if resp.StatusCode != want {
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("%s %s: got %d, want %d\n%s", resp.Request.Method, resp.Request.URL.Path, resp.StatusCode, want, b)
	}
}

func decode(t *testing.T, resp *http.Response, v any) {
	t.Helper()
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(v); err != nil {
		t.Fatalf("decode %s: %v", resp.Request.URL.Path, err)
	}
}

// TestE2EAdminLifecycle drives the full create→use→update→delete lifecycle of
// every resource through the admin JSON API and the public SDK endpoints.
func TestE2EAdminLifecycle(t *testing.T) {
	base := newTestServer(t)

	// --- create project (auto-provisions production env + SDK key) ---
	var created struct {
		Project     Project     `json:"project"`
		Environment Environment `json:"environment"`
		SDKKey      string      `json:"sdkKey"`
	}
	resp := apiDo(t, base, "POST", "/api/admin/projects", map[string]string{"key": "acme", "name": "Acme"})
	mustStatus(t, resp, http.StatusCreated)
	decode(t, resp, &created)
	if created.SDKKey == "" || created.Environment.Key != "production" {
		t.Fatalf("unexpected create response: %+v", created)
	}
	prodKey := created.SDKKey

	// --- get project: production env should be listed ---
	var got struct {
		Environments []Environment `json:"environments"`
	}
	resp = apiDo(t, base, "GET", "/api/admin/projects/acme", nil)
	mustStatus(t, resp, http.StatusOK)
	decode(t, resp, &got)
	if len(got.Environments) != 1 || got.Environments[0].Key != "production" {
		t.Fatalf("expected one production env, got %+v", got.Environments)
	}

	// --- create a second environment ---
	resp = apiDo(t, base, "POST", "/api/admin/projects/acme/environments", map[string]string{"key": "staging", "name": "Staging"})
	mustStatus(t, resp, http.StatusCreated)

	// --- create a boolean feature and enable it at 100% in production ---
	resp = apiDo(t, base, "POST", "/api/admin/projects/acme/features",
		map[string]any{"key": "new_flow", "type": "boolean", "description": "the new flow", "default": false})
	mustStatus(t, resp, http.StatusCreated)
	resp = apiDo(t, base, "PUT", "/api/admin/projects/acme/features/new_flow/values/production",
		map[string]any{"enabled": true, "value": true, "rollout": 100})
	mustStatus(t, resp, http.StatusNoContent)

	// --- create a running 2-way experiment ---
	resp = apiDo(t, base, "POST", "/api/admin/projects/acme/experiments", map[string]any{
		"key": "cta_test", "name": "CTA test", "status": "running", "metric": "signup", "control": "a",
		"variants": []map[string]any{{"key": "a", "weight": 1}, {"key": "b", "weight": 1}},
	})
	mustStatus(t, resp, http.StatusCreated)

	// --- SDK config: feature evaluates true, experiment assigns a variant ---
	var cfg struct {
		Project     string                     `json:"project"`
		Environment string                     `json:"environment"`
		Features    map[string]json.RawMessage `json:"features"`
		Experiments map[string]struct {
			Variant string `json:"variant"`
		} `json:"experiments"`
	}
	resp = apiDo(t, base, "GET", "/api/v1/config?key="+prodKey+"&device=dev-1", nil)
	mustStatus(t, resp, http.StatusOK)
	decode(t, resp, &cfg)
	if string(cfg.Features["new_flow"]) != "true" {
		t.Fatalf("expected new_flow=true, got %s", cfg.Features["new_flow"])
	}
	if cfg.Experiments["cta_test"].Variant == "" {
		t.Fatalf("expected a variant assignment, got %+v", cfg.Experiments)
	}

	// --- track exposure + conversion for a batch of devices ---
	const devices = 12
	for i := 0; i < devices; i++ {
		device := "dev-" + string(rune('a'+i))
		var dc struct {
			Experiments map[string]struct {
				Variant string `json:"variant"`
			} `json:"experiments"`
		}
		resp = apiDo(t, base, "GET", "/api/v1/config?key="+prodKey+"&device="+device, nil)
		mustStatus(t, resp, http.StatusOK)
		decode(t, resp, &dc)
		variant := dc.Experiments["cta_test"].Variant
		for _, event := range []string{"exposure", "signup"} {
			resp = apiDo(t, base, "POST", "/api/v1/track", map[string]string{
				"key": prodKey, "device": device, "experiment": "cta_test", "variant": variant, "event": event,
			})
			mustStatus(t, resp, http.StatusNoContent)
		}
	}

	// --- results: every device counted once as exposure and conversion ---
	var results Results
	resp = apiDo(t, base, "GET", "/api/admin/projects/acme/experiments/cta_test/results", nil)
	mustStatus(t, resp, http.StatusOK)
	decode(t, resp, &results)
	totalExp, totalConv := 0, 0
	for _, v := range results.Variants {
		totalExp += v.Exposures
		totalConv += v.Conversions
	}
	if totalExp != devices || totalConv != devices {
		t.Fatalf("results exposures=%d conversions=%d, want %d each\n%+v", totalExp, totalConv, devices, results.Variants)
	}

	// --- updates ---
	resp = apiDo(t, base, "PATCH", "/api/admin/projects/acme", map[string]string{"name": "Acme Inc"})
	mustStatus(t, resp, http.StatusOK)
	resp = apiDo(t, base, "PATCH", "/api/admin/projects/acme/environments/staging", map[string]string{"name": "Stage"})
	mustStatus(t, resp, http.StatusOK)
	resp = apiDo(t, base, "PATCH", "/api/admin/projects/acme/features/new_flow", map[string]any{"description": "updated", "default": false})
	mustStatus(t, resp, http.StatusOK)
	resp = apiDo(t, base, "PUT", "/api/admin/projects/acme/experiments/cta_test", map[string]any{
		"name": "CTA", "status": "stopped", "metric": "signup", "control": "a",
		"variants": []map[string]any{{"key": "a", "weight": 1}, {"key": "b", "weight": 1}},
	})
	mustStatus(t, resp, http.StatusOK)

	// --- deletes (bottom-up), each verified ---
	resp = apiDo(t, base, "DELETE", "/api/admin/projects/acme/features/new_flow/values/production", nil)
	mustStatus(t, resp, http.StatusNoContent)
	resp = apiDo(t, base, "DELETE", "/api/admin/projects/acme/experiments/cta_test", nil)
	mustStatus(t, resp, http.StatusNoContent)
	resp = apiDo(t, base, "GET", "/api/admin/projects/acme/experiments/cta_test/results", nil)
	mustStatus(t, resp, http.StatusNotFound)
	resp = apiDo(t, base, "DELETE", "/api/admin/projects/acme/features/new_flow", nil)
	mustStatus(t, resp, http.StatusNoContent)
	resp = apiDo(t, base, "DELETE", "/api/admin/projects/acme/environments/staging", nil)
	mustStatus(t, resp, http.StatusNoContent)
	resp = apiDo(t, base, "DELETE", "/api/admin/projects/acme", nil)
	mustStatus(t, resp, http.StatusNoContent)
	resp = apiDo(t, base, "GET", "/api/admin/projects/acme", nil)
	mustStatus(t, resp, http.StatusNotFound)
}

// ---- UI form helpers (the path the browser uses) ----

func uiClient() *http.Client {
	return &http.Client{
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}

func uiPost(t *testing.T, hc *http.Client, base, path string, form url.Values) *http.Response {
	t.Helper()
	req, err := http.NewRequest("POST", base+path, strings.NewReader(form.Encode()))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Cookie", adminCookie+"="+testAdminToken)
	resp, err := hc.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func uiGet(t *testing.T, base, path string) (int, string) {
	t.Helper()
	req, _ := http.NewRequest("GET", base+path, nil)
	req.Header.Set("Cookie", adminCookie+"="+testAdminToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b)
}

// TestE2EUICreateFlow covers the server-rendered form flow, including the bug
// where bad input silently did nothing: invalid and duplicate keys must now
// redirect back with a visible error, while valid input creates the resource.
func TestE2EUICreateFlow(t *testing.T) {
	base := newTestServer(t)
	hc := uiClient()

	// valid project create → redirect to the project page, then it renders.
	resp := uiPost(t, hc, base, "/ui/projects", url.Values{"key": {"shopco"}, "name": {"Shop Co"}})
	mustStatus(t, resp, http.StatusSeeOther)
	if loc := resp.Header.Get("Location"); loc != "/ui/projects/shopco" {
		t.Fatalf("valid create redirected to %q, want /ui/projects/shopco", loc)
	}
	if code, body := uiGet(t, base, "/ui/projects/shopco"); code != 200 || !strings.Contains(body, "shopco") {
		t.Fatalf("project page: code=%d, contains key=%v", code, strings.Contains(body, "shopco"))
	}

	// invalid key → redirect carries an error, and nothing is created.
	resp = uiPost(t, hc, base, "/ui/projects", url.Values{"key": {"Bad Key"}, "name": {"Bad"}})
	mustStatus(t, resp, http.StatusSeeOther)
	assertErrRedirect(t, resp, "/")
	if code, _ := uiGet(t, base, "/ui/projects/Bad Key"); code != http.StatusNotFound {
		t.Fatalf("invalid project should not exist, got code %d", code)
	}

	// duplicate key → redirect carries an error.
	resp = uiPost(t, hc, base, "/ui/projects", url.Values{"key": {"shopco"}, "name": {"again"}})
	mustStatus(t, resp, http.StatusSeeOther)
	assertErrRedirect(t, resp, "/")

	// the error actually renders as a banner on the target page.
	if code, body := uiGet(t, base, "/?err=key+must+be+lowercase"); code != 200 ||
		!strings.Contains(body, `class="banner"`) || !strings.Contains(body, "key must be lowercase") {
		t.Fatalf("error banner not rendered: code=%d", code)
	}

	// invalid environment and feature keys surface errors too.
	resp = uiPost(t, hc, base, "/ui/projects/shopco/environments", url.Values{"key": {"Bad Env"}})
	mustStatus(t, resp, http.StatusSeeOther)
	assertErrRedirect(t, resp, "/ui/projects/shopco")

	resp = uiPost(t, hc, base, "/ui/projects/shopco/features", url.Values{"key": {"Bad Flag"}, "type": {"boolean"}})
	mustStatus(t, resp, http.StatusSeeOther)
	assertErrRedirect(t, resp, "/ui/projects/shopco")

	// a clean environment create still works and redirects without an error.
	resp = uiPost(t, hc, base, "/ui/projects/shopco/environments", url.Values{"key": {"staging"}, "name": {"Staging"}})
	mustStatus(t, resp, http.StatusSeeOther)
	if loc := resp.Header.Get("Location"); strings.Contains(loc, "err=") {
		t.Fatalf("valid env create carried an error: %q", loc)
	}
}

// assertErrRedirect fails unless the response redirects to path with an err query.
func assertErrRedirect(t *testing.T, resp *http.Response, path string) {
	t.Helper()
	loc := resp.Header.Get("Location")
	u, err := url.Parse(loc)
	if err != nil {
		t.Fatalf("bad Location %q: %v", loc, err)
	}
	if u.Path != path || u.Query().Get("err") == "" {
		t.Fatalf("expected redirect to %s with err=, got %q", path, loc)
	}
}
