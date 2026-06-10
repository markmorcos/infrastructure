package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"strings"
)

// uiFuncs are helpers available inside the templates.
func uiFuncs() template.FuncMap {
	return template.FuncMap{
		"add1": func(i int) int { return i + 1 },
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

func redirect(w http.ResponseWriter, r *http.Request, target string) {
	http.Redirect(w, r, target, http.StatusSeeOther)
}

// redirectMsg sends the user back to a page with a banner message in the
// query string, avoiding any server-side flash/session state.
func redirectMsg(w http.ResponseWriter, r *http.Request, path, param, msg string) {
	sep := "?"
	if strings.Contains(path, "?") {
		sep = "&"
	}
	http.Redirect(w, r, path+sep+param+"="+url.QueryEscape(msg), http.StatusSeeOther)
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

// ---- sites ----

func (s *Server) uiSites(w http.ResponseWriter, r *http.Request) {
	sites, err := s.store.ListSites(r.Context())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	// A single site goes straight to its dashboard — Lea never needs the list.
	if len(sites) == 1 {
		redirect(w, r, "/ui/sites/"+sites[0].Key)
		return
	}
	s.render(w, "sites", map[string]any{"Title": "Websites", "Sites": sites, "Error": r.URL.Query().Get("err")})
}

// ---- site dashboard ----

type localeStatus struct {
	Locale  string
	Label   string
	Dirty   bool
	EditURL string
}

type sectionRow struct {
	Section Section
	Locales []localeStatus
}

type groupView struct {
	Name     string
	Sections []sectionRow
}

func sectionEditURL(site Site, sec Section, locale string) string {
	return "/ui/sites/" + site.Key + "/sections/" + sec.Key + "?locale=" + url.QueryEscape(locale)
}

func (s *Server) uiSite(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	sections, err := s.store.ListSections(ctx, site.ID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	dirty, _ := s.store.DirtySections(ctx, site.ID)
	lastPublished, _ := s.store.LastPublishedAt(ctx, site.ID)

	var groups []groupView
	byName := map[string]int{}
	anyDirty := false
	for _, sec := range sections {
		row := sectionRow{Section: sec}
		if sec.Localized {
			for _, locale := range site.Locales {
				d := dirty[sec.ID][locale]
				anyDirty = anyDirty || d
				row.Locales = append(row.Locales, localeStatus{
					Locale: locale, Label: strings.ToUpper(locale), Dirty: d,
					EditURL: sectionEditURL(site, sec, locale),
				})
			}
		} else {
			d := dirty[sec.ID][localeAll]
			anyDirty = anyDirty || d
			row.Locales = append(row.Locales, localeStatus{
				Locale: localeAll, Label: "Edit", Dirty: d,
				EditURL: sectionEditURL(site, sec, localeAll),
			})
		}
		idx, seen := byName[sec.PageGroup]
		if !seen {
			byName[sec.PageGroup] = len(groups)
			groups = append(groups, groupView{Name: sec.PageGroup})
			idx = len(groups) - 1
		}
		groups[idx].Sections = append(groups[idx].Sections, row)
	}

	lastPublishedLabel := ""
	if !lastPublished.IsZero() {
		lastPublishedLabel = lastPublished.Local().Format("02.01.2006 15:04")
	}
	s.render(w, "site", map[string]any{
		"Title":         site.Name,
		"Site":          site,
		"Groups":        groups,
		"AnyDirty":      anyDirty,
		"LastPublished": lastPublishedLabel,
		"Error":         r.URL.Query().Get("err"),
		"OK":            r.URL.Query().Get("ok"),
		"Warn":          r.URL.Query().Get("warn"),
	})
}

// ---- section editing ----

// fieldView is the render-ready form model built from a section's schema and
// its current draft object.
type fieldView struct {
	Key, Label, Type, Name string
	ReadOnly               bool
	Value                  string
	Subs                   []fieldView   // object
	Items                  []itemView    // list, pairs
	Count                  int           // list, pairs
	Options                []imageOption // image
}

type itemView struct {
	Index       int
	First, Last bool
	Fields      []fieldView
}

type imageOption struct {
	URL, Label string
	Selected   bool
}

func str(v any) string {
	s, _ := v.(string)
	return s
}

func buildFieldViews(fields []Field, obj map[string]any, prefix string, assets []Asset) []fieldView {
	views := make([]fieldView, 0, len(fields))
	for _, f := range fields {
		v := fieldView{Key: f.Key, Label: f.Label, Type: f.Type, Name: prefix + f.Key, ReadOnly: f.ReadOnly}
		raw := obj[f.Key]
		switch f.Type {
		case fieldText, fieldTextarea:
			v.Value = str(raw)
		case fieldStringlist:
			v.Value = joinLines(raw)
		case fieldParagraphs:
			v.Value = joinParagraphs(raw)
		case fieldObject:
			sub, _ := raw.(map[string]any)
			v.Subs = buildFieldViews(f.Fields, sub, v.Name+".", assets)
		case fieldList:
			items, _ := raw.([]any)
			for i, it := range items {
				m, _ := it.(map[string]any)
				v.Items = append(v.Items, itemView{
					Index: i, First: i == 0, Last: i == len(items)-1,
					Fields: buildFieldViews(f.Fields, m, fmt.Sprintf("%s.%d.", v.Name, i), assets),
				})
			}
			v.Count = len(items)
		case fieldPairs:
			items, _ := raw.([]any)
			for i, it := range items {
				pair, _ := it.([]any)
				a, b := "", ""
				if len(pair) > 0 {
					a = str(pair[0])
				}
				if len(pair) > 1 {
					b = str(pair[1])
				}
				v.Items = append(v.Items, itemView{
					Index: i, First: i == 0, Last: i == len(items)-1,
					Fields: []fieldView{
						{Type: fieldText, Name: fmt.Sprintf("%s.%d.0", v.Name, i), Value: a, Label: "Label"},
						{Type: fieldText, Name: fmt.Sprintf("%s.%d.1", v.Name, i), Value: b, Label: "Value"},
					},
				})
			}
			v.Count = len(items)
		case fieldImage:
			v.Value = str(raw)
			v.Options = append(v.Options, imageOption{URL: "", Label: "— Standardbild —", Selected: v.Value == ""})
			found := false
			for _, a := range assets {
				v.Options = append(v.Options, imageOption{URL: a.URL, Label: a.Filename, Selected: a.URL == v.Value})
				found = found || a.URL == v.Value
			}
			if v.Value != "" && !found {
				v.Options = append(v.Options, imageOption{URL: v.Value, Label: v.Value, Selected: true})
			}
		}
		views = append(views, v)
	}
	return views
}

// sectionLocaleFromQuery validates ?locale= like sectionLocale does for path
// values, defaulting sensibly.
func sectionLocaleFromQuery(r *http.Request, site Site, sec Section) (string, bool) {
	locale := r.URL.Query().Get("locale")
	if !sec.Localized {
		return localeAll, true
	}
	if locale == "" {
		return site.DefaultLocale, true
	}
	return locale, containsString(site.Locales, locale)
}

func (s *Server) uiSection(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	sec, ok := s.sectionFromPath(w, r, site)
	if !ok {
		return
	}
	locale, ok := sectionLocaleFromQuery(r, site, sec)
	if !ok {
		http.Error(w, "unknown locale", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	draft, err := s.store.GetDraft(ctx, sec.ID, locale)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	var obj map[string]any
	_ = json.Unmarshal(draft, &obj)
	assets, _ := s.store.ListAssets(ctx, site.ID)

	var tabs []localeStatus
	if sec.Localized {
		dirty, _ := s.store.DirtySections(ctx, site.ID)
		for _, l := range site.Locales {
			tabs = append(tabs, localeStatus{
				Locale: l, Label: strings.ToUpper(l), Dirty: dirty[sec.ID][l],
				EditURL: sectionEditURL(site, sec, l),
			})
		}
	}

	hasImage := false
	for _, f := range sec.Fields {
		hasImage = hasImage || f.Type == fieldImage
	}

	s.render(w, "section", map[string]any{
		"Title":     sec.Title,
		"Site":      site,
		"Section":   sec,
		"Locale":    locale,
		"Tabs":      tabs,
		"Views":     buildFieldViews(sec.Fields, obj, formPrefix, assets),
		"HasImage":  hasImage,
		"PostURL":   "/ui/sites/" + site.Key + "/sections/" + sec.Key + "?locale=" + url.QueryEscape(locale),
		"UploadURL": "/ui/sites/" + site.Key + "/assets",
		"Error":     r.URL.Query().Get("err"),
		"OK":        r.URL.Query().Get("ok"),
	})
}

// uiSaveSection decodes the form against the schema and saves the draft. List
// buttons submit the same form with an __action value; the draft is saved
// first, then the action applied, so no edits are lost.
func (s *Server) uiSaveSection(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	sec, ok := s.sectionFromPath(w, r, site)
	if !ok {
		return
	}
	locale, ok := sectionLocaleFromQuery(r, site, sec)
	if !ok {
		http.Error(w, "unknown locale", http.StatusBadRequest)
		return
	}
	_ = r.ParseForm()
	obj := decodeSectionForm(sec.Fields, r.PostForm)
	action := r.PostForm.Get("__action")
	if action != "" && action != "save" {
		applyListAction(obj, sec.Fields, action)
	}
	raw, _ := json.Marshal(obj)
	back := sectionEditURL(site, sec, locale)
	if err := s.store.UpsertDraft(r.Context(), sec.ID, locale, raw); err != nil {
		log.Printf("save draft: %v", err)
		redirectMsg(w, r, back, "err", "Saving failed — please try again")
		return
	}
	if action == "" || action == "save" {
		redirectMsg(w, r, back, "ok", "Saved. Changes only appear on the website after you click Publish.")
		return
	}
	redirect(w, r, back)
}

// ---- publish ----

func (s *Server) uiPublish(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	back := "/ui/sites/" + site.Key
	dispatched, err := s.publishSite(r.Context(), site)
	if err != nil {
		log.Printf("ui publish: %v", err)
		redirectMsg(w, r, back, "err", "Publishing failed — please try again")
		return
	}
	if !dispatched {
		redirectMsg(w, r, back, "warn",
			"Content published, but the website rebuild could not be triggered — please let Mark know.")
		return
	}
	redirectMsg(w, r, back, "ok",
		"Published! The website is rebuilding and will be up to date in about 3 minutes.")
}

// ---- assets ----

func (s *Server) uiAssets(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	assets, err := s.store.ListAssets(r.Context(), site.ID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	s.render(w, "assets", map[string]any{
		"Title":          "Images",
		"Site":           site,
		"Assets":         assets,
		"UploadsEnabled": s.assets != nil,
		"Error":          r.URL.Query().Get("err"),
		"OK":             r.URL.Query().Get("ok"),
	})
}

// uiUploadAsset stores an uploaded image. When the upload form carries
// section/field/locale (the inline upload on a section page), the new image
// URL is written straight into that draft field so the editor doesn't have to
// pick it from the dropdown afterwards.
func (s *Server) uiUploadAsset(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	back := r.FormValue("back")
	if back == "" || !strings.HasPrefix(back, "/ui/") {
		back = "/ui/sites/" + site.Key + "/assets"
	}
	asset, err := s.uploadFromRequest(r, site)
	if err != nil {
		redirectMsg(w, r, back, "err", err.Error())
		return
	}

	sectionKey := r.FormValue("section")
	fieldKey := r.FormValue("field")
	locale := r.FormValue("locale")
	if sectionKey != "" && fieldKey != "" && locale != "" {
		if err := s.setDraftImage(r, site, sectionKey, fieldKey, locale, asset.URL); err != nil {
			log.Printf("upload: set draft image: %v", err)
			redirectMsg(w, r, back, "err", "Image uploaded but could not be assigned")
			return
		}
	}
	redirectMsg(w, r, back, "ok", "Image uploaded. Remember to click Publish to put it on the website.")
}

// setDraftImage writes an asset URL into one top-level image field of a
// section draft.
func (s *Server) setDraftImage(r *http.Request, site Site, sectionKey, fieldKey, locale, url string) error {
	sec, err := s.store.GetSection(r.Context(), site.ID, sectionKey)
	if err != nil {
		return err
	}
	if !sec.Localized {
		locale = localeAll
	} else if !containsString(site.Locales, locale) {
		return errors.New("unknown locale")
	}
	isImage := false
	for _, f := range sec.Fields {
		isImage = isImage || (f.Key == fieldKey && f.Type == fieldImage)
	}
	if !isImage {
		return errors.New("not an image field")
	}
	draft, err := s.store.GetDraft(r.Context(), sec.ID, locale)
	if err != nil {
		return err
	}
	var obj map[string]any
	if err := json.Unmarshal(draft, &obj); err != nil || obj == nil {
		obj = map[string]any{}
	}
	obj[fieldKey] = url
	raw, _ := json.Marshal(obj)
	return s.store.UpsertDraft(r.Context(), sec.ID, locale, raw)
}

func (s *Server) uiDeleteAsset(w http.ResponseWriter, r *http.Request) {
	site, ok := s.siteFromPath(w, r)
	if !ok {
		return
	}
	back := "/ui/sites/" + site.Key + "/assets"
	asset, err := s.store.GetAsset(r.Context(), site.ID, r.PathValue("id"))
	if errors.Is(err, errNotFound) {
		redirect(w, r, back)
		return
	}
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.deleteAsset(r.Context(), asset); err != nil {
		log.Printf("ui delete asset: %v", err)
		redirectMsg(w, r, back, "err", "Deleting failed")
		return
	}
	redirect(w, r, back)
}
