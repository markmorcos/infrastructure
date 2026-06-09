package main

import (
	"encoding/json"
	"time"
)

// Site is the tenant boundary: one website whose content the CMS manages.
type Site struct {
	ID            string    `json:"id"`
	Key           string    `json:"key"`
	Name          string    `json:"name"`
	Locales       []string  `json:"locales"`
	DefaultLocale string    `json:"defaultLocale"`
	GitHubRepo    string    `json:"githubRepo"`    // owner/repo for repository_dispatch
	DispatchEvent string    `json:"dispatchEvent"` // event_type sent on publish
	CreatedAt     time.Time `json:"createdAt"`
}

// Field describes one editable value inside a section. The schema drives both
// the admin form rendering and form decoding, so the stored JSON always
// matches the shape the site's build expects.
type Field struct {
	Key      string  `json:"key"`
	Type     string  `json:"type"`
	Label    string  `json:"label"`
	ReadOnly bool    `json:"readOnly,omitempty"`
	Fields   []Field `json:"fields,omitempty"` // subfields for object/list
}

const (
	fieldText       = "text"
	fieldTextarea   = "textarea"
	fieldStringlist = "stringlist" // []string, one entry per line
	fieldParagraphs = "paragraphs" // []string, blank-line separated
	fieldObject     = "object"     // fixed named subfields
	fieldList       = "list"       // repeatable group of flat fields
	fieldPairs      = "pairs"      // [][2]string label/value tuples
	fieldImage      = "image"      // asset URL string
)

// localeAll is the pseudo-locale for non-localized sections (e.g. images),
// merged into every locale's assembled dictionary.
const localeAll = "*"

// Section maps to one top-level key of a site's content dictionary. Flatten
// sections spread their fields into the dictionary root instead.
type Section struct {
	ID        string  `json:"id"`
	SiteID    string  `json:"-"`
	Key       string  `json:"key"`
	Title     string  `json:"title"`
	PageGroup string  `json:"pageGroup"`
	Position  int     `json:"position"`
	Localized bool    `json:"localized"`
	Flatten   bool    `json:"flatten"`
	Fields    []Field `json:"fields"`
}

// Content is one section's value in one locale, with separate draft and
// published states.
type Content struct {
	SectionID   string          `json:"-"`
	Locale      string          `json:"locale"`
	Draft       json.RawMessage `json:"draft"`
	Published   json.RawMessage `json:"published"`
	UpdatedAt   time.Time       `json:"updatedAt"`
	PublishedAt *time.Time      `json:"publishedAt"`
}

// Asset is an uploaded file living in MinIO, addressed by a public CDN URL.
type Asset struct {
	ID          string    `json:"id"`
	SiteID      string    `json:"-"`
	ObjectKey   string    `json:"objectKey"`
	URL         string    `json:"url"`
	Filename    string    `json:"filename"`
	ContentType string    `json:"contentType"`
	SizeBytes   int64     `json:"sizeBytes"`
	CreatedAt   time.Time `json:"createdAt"`
}
