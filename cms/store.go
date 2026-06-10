package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"github.com/lib/pq"
)

// Store is the Postgres-backed repository for the whole CMS.
type Store struct {
	db *sql.DB
}

// errNotFound is returned when a lookup matches no row.
var errNotFound = errors.New("not found")

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// ---- Sites ----

func (s *Store) CreateSite(ctx context.Context, site Site) (Site, error) {
	site.ID = newID()
	if len(site.Locales) == 0 {
		site.Locales = []string{"de", "en"}
	}
	if site.DefaultLocale == "" {
		site.DefaultLocale = site.Locales[0]
	}
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO sites (id, key, name, locales, default_locale, github_repo, dispatch_event)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING created_at`,
		site.ID, site.Key, site.Name, pq.Array(site.Locales), site.DefaultLocale,
		site.GitHubRepo, site.DispatchEvent).Scan(&site.CreatedAt)
	return site, err
}

func (s *Store) GetSite(ctx context.Context, key string) (Site, error) {
	var site Site
	var locales pq.StringArray
	err := s.db.QueryRowContext(ctx,
		`SELECT id, key, name, locales, default_locale, github_repo, dispatch_event, created_at
		 FROM sites WHERE key = $1`, key).
		Scan(&site.ID, &site.Key, &site.Name, &locales, &site.DefaultLocale,
			&site.GitHubRepo, &site.DispatchEvent, &site.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return site, errNotFound
	}
	site.Locales = locales
	return site, err
}

func (s *Store) ListSites(ctx context.Context) ([]Site, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, key, name, locales, default_locale, github_repo, dispatch_event, created_at
		 FROM sites ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Site
	for rows.Next() {
		var site Site
		var locales pq.StringArray
		if err := rows.Scan(&site.ID, &site.Key, &site.Name, &locales, &site.DefaultLocale,
			&site.GitHubRepo, &site.DispatchEvent, &site.CreatedAt); err != nil {
			return nil, err
		}
		site.Locales = locales
		out = append(out, site)
	}
	return out, rows.Err()
}

func (s *Store) UpdateSite(ctx context.Context, id, name, githubRepo, dispatchEvent string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE sites SET name=$2, github_repo=$3, dispatch_event=$4 WHERE id=$1`,
		id, name, githubRepo, dispatchEvent)
	return err
}

func (s *Store) DeleteSite(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sites WHERE id=$1`, id)
	return err
}

// ---- Sections ----

// UpsertSection creates or updates a section definition by (site, key).
// Schemas are developer-owned (defined in seed.go) and refreshed on every
// boot, so deploying a schema change updates existing sites in place.
func (s *Store) UpsertSection(ctx context.Context, sec Section) error {
	schemaJSON, err := json.Marshal(sec.Fields)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO sections (id, site_id, key, title, page_group, position, localized, flatten, schema)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 ON CONFLICT (site_id, key) DO UPDATE SET
		   title=EXCLUDED.title, page_group=EXCLUDED.page_group, position=EXCLUDED.position,
		   localized=EXCLUDED.localized, flatten=EXCLUDED.flatten, schema=EXCLUDED.schema`,
		newID(), sec.SiteID, sec.Key, sec.Title, sec.PageGroup, sec.Position,
		sec.Localized, sec.Flatten, schemaJSON)
	return err
}

func scanSection(scan func(...any) error) (Section, error) {
	var sec Section
	var schemaJSON []byte
	err := scan(&sec.ID, &sec.SiteID, &sec.Key, &sec.Title, &sec.PageGroup,
		&sec.Position, &sec.Localized, &sec.Flatten, &schemaJSON)
	if err != nil {
		return sec, err
	}
	err = json.Unmarshal(schemaJSON, &sec.Fields)
	return sec, err
}

func (s *Store) ListSections(ctx context.Context, siteID string) ([]Section, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, site_id, key, title, page_group, position, localized, flatten, schema
		 FROM sections WHERE site_id = $1 ORDER BY position, key`, siteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Section
	for rows.Next() {
		sec, err := scanSection(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, sec)
	}
	return out, rows.Err()
}

func (s *Store) GetSection(ctx context.Context, siteID, key string) (Section, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, site_id, key, title, page_group, position, localized, flatten, schema
		 FROM sections WHERE site_id = $1 AND key = $2`, siteID, key)
	sec, err := scanSection(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return sec, errNotFound
	}
	return sec, err
}

// ---- Contents ----

// GetDraft returns the draft object for one section+locale, or an empty
// object when nothing has been saved yet.
func (s *Store) GetDraft(ctx context.Context, sectionID, locale string) (json.RawMessage, error) {
	var draft json.RawMessage
	err := s.db.QueryRowContext(ctx,
		`SELECT draft FROM contents WHERE section_id=$1 AND locale=$2`, sectionID, locale).Scan(&draft)
	if errors.Is(err, sql.ErrNoRows) {
		return json.RawMessage(`{}`), nil
	}
	return draft, err
}

func (s *Store) UpsertDraft(ctx context.Context, sectionID, locale string, draft json.RawMessage) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO contents (id, section_id, locale, draft)
		 VALUES ($1,$2,$3,$4)
		 ON CONFLICT (section_id, locale) DO UPDATE SET draft=EXCLUDED.draft, updated_at=now()`,
		newID(), sectionID, locale, draft)
	return err
}

// SiteContent returns all content rows of a site keyed sectionID → locale,
// either drafts or published values.
func (s *Store) SiteContent(ctx context.Context, siteID string, draft bool) (map[string]map[string]json.RawMessage, error) {
	col := "c.published"
	if draft {
		col = "c.draft"
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT c.section_id, c.locale, `+col+`
		 FROM contents c JOIN sections sec ON sec.id = c.section_id
		 WHERE sec.site_id = $1`, siteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]map[string]json.RawMessage{}
	for rows.Next() {
		var sectionID, locale string
		var value json.RawMessage
		if err := rows.Scan(&sectionID, &locale, &value); err != nil {
			return nil, err
		}
		if out[sectionID] == nil {
			out[sectionID] = map[string]json.RawMessage{}
		}
		out[sectionID][locale] = value
	}
	return out, rows.Err()
}

// DirtySections reports which section+locale pairs have unpublished changes,
// keyed sectionID → locale.
func (s *Store) DirtySections(ctx context.Context, siteID string) (map[string]map[string]bool, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT c.section_id, c.locale, (c.draft IS DISTINCT FROM c.published)
		 FROM contents c JOIN sections sec ON sec.id = c.section_id
		 WHERE sec.site_id = $1`, siteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]map[string]bool{}
	for rows.Next() {
		var sectionID, locale string
		var dirty bool
		if err := rows.Scan(&sectionID, &locale, &dirty); err != nil {
			return nil, err
		}
		if out[sectionID] == nil {
			out[sectionID] = map[string]bool{}
		}
		out[sectionID][locale] = dirty
	}
	return out, rows.Err()
}

// LastPublishedAt returns the most recent publish time across a site's
// content, or zero time when never published.
func (s *Store) LastPublishedAt(ctx context.Context, siteID string) (time.Time, error) {
	var t sql.NullTime
	err := s.db.QueryRowContext(ctx,
		`SELECT max(c.published_at) FROM contents c
		 JOIN sections sec ON sec.id = c.section_id WHERE sec.site_id = $1`, siteID).Scan(&t)
	if err != nil {
		return time.Time{}, err
	}
	return t.Time, nil
}

// PublishSite copies every draft to published in one transaction and records
// a snapshot of the published state for cheap rollback insurance. Returns the
// publish row id.
func (s *Store) PublishSite(ctx context.Context, siteID string, snapshot json.RawMessage) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx,
		`UPDATE contents SET published = draft, published_at = now()
		 WHERE section_id IN (SELECT id FROM sections WHERE site_id = $1)
		   AND draft IS DISTINCT FROM published`, siteID); err != nil {
		return 0, err
	}
	var id int64
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO publishes (site_id, snapshot) VALUES ($1,$2) RETURNING id`,
		siteID, snapshot).Scan(&id); err != nil {
		return 0, err
	}
	return id, tx.Commit()
}

func (s *Store) MarkDispatched(ctx context.Context, publishID int64) error {
	_, err := s.db.ExecContext(ctx, `UPDATE publishes SET dispatched=true WHERE id=$1`, publishID)
	return err
}

// ImportContent replaces draft and published for the given section+locale
// objects in one transaction (used by the one-off content import).
func (s *Store) ImportContent(ctx context.Context, values map[string]map[string]json.RawMessage) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	for sectionID, locales := range values {
		for locale, obj := range locales {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO contents (id, section_id, locale, draft, published, published_at)
				 VALUES ($1,$2,$3,$4,$4,now())
				 ON CONFLICT (section_id, locale) DO UPDATE SET
				   draft=EXCLUDED.draft, published=EXCLUDED.published,
				   updated_at=now(), published_at=now()`,
				newID(), sectionID, locale, obj); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

// ---- Assets ----

func (s *Store) CreateAsset(ctx context.Context, a Asset) (Asset, error) {
	a.ID = newID()
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO assets (id, site_id, object_key, url, filename, content_type, size_bytes)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING created_at`,
		a.ID, a.SiteID, a.ObjectKey, a.URL, a.Filename, a.ContentType, a.SizeBytes).Scan(&a.CreatedAt)
	return a, err
}

func (s *Store) ListAssets(ctx context.Context, siteID string) ([]Asset, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, site_id, object_key, url, filename, content_type, size_bytes, created_at
		 FROM assets WHERE site_id = $1 ORDER BY created_at DESC`, siteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Asset
	for rows.Next() {
		var a Asset
		if err := rows.Scan(&a.ID, &a.SiteID, &a.ObjectKey, &a.URL, &a.Filename,
			&a.ContentType, &a.SizeBytes, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) GetAsset(ctx context.Context, siteID, id string) (Asset, error) {
	var a Asset
	err := s.db.QueryRowContext(ctx,
		`SELECT id, site_id, object_key, url, filename, content_type, size_bytes, created_at
		 FROM assets WHERE site_id = $1 AND id = $2`, siteID, id).
		Scan(&a.ID, &a.SiteID, &a.ObjectKey, &a.URL, &a.Filename,
			&a.ContentType, &a.SizeBytes, &a.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return a, errNotFound
	}
	return a, err
}

func (s *Store) DeleteAsset(ctx context.Context, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM assets WHERE id=$1`, id)
	return err
}
