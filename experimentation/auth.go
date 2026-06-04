package main

import (
	"crypto/subtle"
	"net/http"
)

const adminCookie = "admin_token"

// authConfig holds the single shared admin token that gates the management API
// and the web UI. Client SDK keys are a separate, per-project credential.
type authConfig struct {
	token string
}

func (a authConfig) valid(token string) bool {
	if a.token == "" || token == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(a.token)) == 1
}

// authed reports whether a request carries the admin token via Authorization
// header, X-Admin-Token header, or the admin cookie (used by the UI).
func (a authConfig) authed(r *http.Request) bool {
	if h := r.Header.Get("Authorization"); len(h) > 7 && h[:7] == "Bearer " && a.valid(h[7:]) {
		return true
	}
	if a.valid(r.Header.Get("X-Admin-Token")) {
		return true
	}
	if c, err := r.Cookie(adminCookie); err == nil && a.valid(c.Value) {
		return true
	}
	return false
}

// requireAdmin gates JSON API endpoints, returning 401 when unauthenticated.
func (a authConfig) requireAdmin(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !a.authed(r) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		h(w, r)
	}
}

// requireUI gates UI endpoints, redirecting to the login page when needed.
func (a authConfig) requireUI(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !a.authed(r) {
			http.Redirect(w, r, "/ui/login", http.StatusSeeOther)
			return
		}
		h(w, r)
	}
}
