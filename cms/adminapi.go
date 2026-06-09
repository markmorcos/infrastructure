package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"
)

var keyRe = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)

func validKey(s string) bool { return keyRe.MatchString(s) }

// siteFromPath resolves the {site} path value, writing a 404/500 and
// returning ok=false when it cannot.
func (s *Server) siteFromPath(w http.ResponseWriter, r *http.Request) (Site, bool) {
	site, err := s.store.GetSite(r.Context(), r.PathValue("site"))
	if errors.Is(err, errNotFound) {
		http.Error(w, "site not found", http.StatusNotFound)
		return site, false
	}
	if err != nil {
		log.Printf("get site: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return site, false
	}
	return site, true
}

// sectionFromPath resolves {site}/{key} to a section.
func (s *Server) sectionFromPath(w http.ResponseWriter, r *http.Request, site Site) (Section, bool) {
	sec, err := s.store.GetSection(r.Context(), site.ID, r.PathValue("key"))
	if errors.Is(err, errNotFound) {
		http.Error(w, "section not found", http.StatusNotFound)
		return sec, false
	}
	if err != nil {
		log.Printf("get section: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return sec, false
	}
	return sec, true
}

// sectionLocale validates the {locale} path value against the site, allowing
// '*' only for non-localized sections (and requiring it for them).
func sectionLocale(w http.ResponseWriter, r *http.Request, site Site, sec Section) (string, bool) {
	locale := r.PathValue("locale")
	if !sec.Localized {
		if locale != localeAll {
			http.Error(w, "section is not localized; use locale "+localeAll, http.StatusBadRequest)
			return "", false
		}
		return localeAll, true
	}
	if !containsString(site.Locales, locale) {
		http.Error(w, "unknown locale", http.StatusBadRequest)
		return "", false
	}
	return locale, true
}

// ---- sites ----

func (s *Server) apiListSites(w http.ResponseWriter, r *http.Request) {
	sites, err := s.store.ListSites(r.Context())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, sites)
}

type siteBody struct {
	Key           string   `json:"key"`
	Name          string   `json:"name"`
	Locales       []string `json:"locales"`
	DefaultLocale string   `json:"defaultLocale"`
	GitHubRepo    string   `json:"githubRepo"`
	DispatchEvent string   `json:"dispatchEvent"`
}

func (s *Server) apiCreateSite(w http.ResponseWriter, r *http.Request) {
	var body siteBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if !validKey(body.Key) {
		http.Error(w, "invalid key", http.StatusBadRequest)
		return
	}
	if body.Name == "" {
		body.Name = body.Key
	}
	site, err := s.store.CreateSite(r.Context(), Site{
		Key: body.Key, Name: body.Name, Locales: body.Locales,
		DefaultLocale: body.DefaultLocale, GitHubRepo: body.GitHubRepo,
		DispatchEvent: body.DispatchEvent,
	})
	if err != nil {
		log.Printf("create site: %v", err)
		http.Error(w, "could not create site", http.StatusConflict)
		return
	}
	writeJSON(w, http.StatusCreated, site)
}

func (s *Server) apiGetSite(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, site)
}

func (s *Server) apiUpdateSite(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	var body siteBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if body.Name == "" {
		body.Name = site.Name
	}
	if body.GitHubRepo == "" {
		body.GitHubRepo = site.GitHubRepo
	}
	if body.DispatchEvent == "" {
		body.DispatchEvent = site.DispatchEvent
	}
	if err := s.store.UpdateSite(r.Context(), site.ID, body.Name, body.GitHubRepo, body.DispatchEvent); err != nil {
		log.Printf("update site: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	site, _ = s.store.GetSite(r.Context(), site.Key)
	writeJSON(w, http.StatusOK, site)
}

func (s *Server) apiDeleteSite(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	if err := s.store.DeleteSite(r.Context(), site.ID); err != nil {
		log.Printf("delete site: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- sections & drafts ----

func (s *Server) apiListSections(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	sections, err := s.store.ListSections(r.Context(), site.ID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, sections)
}

func (s *Server) apiGetDraft(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	sec, ok := s.sectionFromPath(w, r, site)
	if !ok {
		return
	}
	locale, ok := sectionLocale(w, r, site, sec)
	if !ok {
		return
	}
	draft, err := s.store.GetDraft(r.Context(), sec.ID, locale)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"section": sec.Key, "locale": locale, "draft": draft})
}

func (s *Server) apiPutDraft(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	sec, ok := s.sectionFromPath(w, r, site)
	if !ok {
		return
	}
	locale, ok := sectionLocale(w, r, site, sec)
	if !ok {
		return
	}
	var obj map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&obj); err != nil {
		http.Error(w, "body must be a JSON object", http.StatusBadRequest)
		return
	}
	raw, _ := json.Marshal(obj)
	if err := s.store.UpsertDraft(r.Context(), sec.ID, locale, raw); err != nil {
		log.Printf("put draft: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"section": sec.Key, "locale": locale, "draft": json.RawMessage(raw)})
}

// ---- import ----

// apiImport accepts a full {locale: dict} payload (e.g. exported from the Lea
// repo's content.ts), explodes it into per-section objects, and writes both
// draft and published so the site is immediately consistent.
func (s *Server) apiImport(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	var payload map[string]map[string]any
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	sections, err := s.store.ListSections(r.Context(), site.ID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	sectionByKey := map[string]Section{}
	for _, sec := range sections {
		sectionByKey[sec.Key] = sec
	}

	values := map[string]map[string]json.RawMessage{} // sectionID → locale → object
	put := func(sec Section, locale string, obj map[string]any) {
		raw, _ := json.Marshal(obj)
		if values[sec.ID] == nil {
			values[sec.ID] = map[string]json.RawMessage{}
		}
		values[sec.ID][locale] = raw
	}
	for locale, dict := range payload {
		if !containsString(site.Locales, locale) {
			http.Error(w, "unknown locale "+strings.TrimSpace(locale), http.StatusBadRequest)
			return
		}
		exploded, err := explodeDict(sections, dict)
		if err != nil {
			http.Error(w, "locale "+locale+": "+err.Error(), http.StatusBadRequest)
			return
		}
		for key, obj := range exploded {
			sec := sectionByKey[key]
			if !sec.Localized {
				// Non-localized sections take their value from the default
				// locale only; other locales carrying the key are ignored.
				if locale == site.DefaultLocale {
					put(sec, localeAll, obj)
				}
				continue
			}
			put(sec, locale, obj)
		}
	}
	if err := s.store.ImportContent(r.Context(), values); err != nil {
		log.Printf("import: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"imported": true})
}

// ---- publish ----

func (s *Server) apiPublish(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	dispatched, err := s.publishSite(r.Context(), site)
	if err != nil {
		log.Printf("publish: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"published": true, "dispatched": dispatched})
}

// ---- assets ----

func (s *Server) apiListAssets(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	assets, err := s.store.ListAssets(r.Context(), site.ID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, assets)
}

func (s *Server) apiUploadAsset(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	asset, err := s.uploadFromRequest(r, site)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusCreated, asset)
}

func (s *Server) apiDeleteAsset(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	asset, err := s.store.GetAsset(r.Context(), site.ID, r.PathValue("id"))
	if errors.Is(err, errNotFound) {
		http.Error(w, "asset not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.deleteAsset(r.Context(), asset); err != nil {
		log.Printf("delete asset: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
