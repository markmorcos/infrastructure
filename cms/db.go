package main

import (
	"context"
	"database/sql"
	"time"

	_ "github.com/lib/pq"
)

// schema is applied idempotently on every boot. A versioned migration tool is
// overkill at this size; CREATE ... IF NOT EXISTS keeps it simple and safe.
const schema = `
CREATE TABLE IF NOT EXISTS sites (
	id             TEXT PRIMARY KEY,
	key            TEXT UNIQUE NOT NULL,
	name           TEXT NOT NULL,
	locales        TEXT[] NOT NULL DEFAULT '{de,en}',
	default_locale TEXT NOT NULL DEFAULT 'de',
	github_repo    TEXT NOT NULL DEFAULT '',
	dispatch_event TEXT NOT NULL DEFAULT '',
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sections (
	id        TEXT PRIMARY KEY,
	site_id   TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
	key       TEXT NOT NULL,
	title     TEXT NOT NULL,
	page_group TEXT NOT NULL DEFAULT '',
	position  INT NOT NULL DEFAULT 0,
	localized BOOLEAN NOT NULL DEFAULT true,
	flatten   BOOLEAN NOT NULL DEFAULT false,
	schema    JSONB NOT NULL,
	UNIQUE (site_id, key)
);

CREATE TABLE IF NOT EXISTS contents (
	id           TEXT PRIMARY KEY,
	section_id   TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
	locale       TEXT NOT NULL,
	draft        JSONB NOT NULL DEFAULT '{}',
	published    JSONB,
	updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
	published_at TIMESTAMPTZ,
	UNIQUE (section_id, locale)
);

CREATE TABLE IF NOT EXISTS assets (
	id           TEXT PRIMARY KEY,
	site_id      TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
	object_key   TEXT NOT NULL,
	url          TEXT NOT NULL,
	filename     TEXT NOT NULL,
	content_type TEXT NOT NULL,
	size_bytes   BIGINT NOT NULL,
	created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publishes (
	id         BIGSERIAL PRIMARY KEY,
	site_id    TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
	snapshot   JSONB NOT NULL,
	dispatched BOOLEAN NOT NULL DEFAULT false,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`

func openDB(url string) (*sql.DB, error) {
	db, err := sql.Open("postgres", url)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)
	db.SetConnMaxIdleTime(5 * time.Minute)
	return db, nil
}

func migrate(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, schema)
	return err
}
