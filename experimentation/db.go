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
CREATE TABLE IF NOT EXISTS projects (
	id         TEXT PRIMARY KEY,
	key        TEXT UNIQUE NOT NULL,
	name       TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS environments (
	id         TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	key        TEXT NOT NULL,
	name       TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS sdk_keys (
	id             TEXT PRIMARY KEY,
	key            TEXT UNIQUE NOT NULL,
	project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS features (
	id            TEXT PRIMARY KEY,
	project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	key           TEXT NOT NULL,
	type          TEXT NOT NULL,
	description   TEXT NOT NULL DEFAULT '',
	default_value JSONB NOT NULL,
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS feature_values (
	id             TEXT PRIMARY KEY,
	feature_id     TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
	environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
	enabled        BOOLEAN NOT NULL DEFAULT false,
	value          JSONB NOT NULL,
	rollout        INT NOT NULL DEFAULT 100,
	updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (feature_id, environment_id)
);

CREATE TABLE IF NOT EXISTS experiments (
	id         TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	key        TEXT NOT NULL,
	name       TEXT NOT NULL DEFAULT '',
	status     TEXT NOT NULL DEFAULT 'draft',
	metric     TEXT NOT NULL,
	control    TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS experiment_variants (
	id            TEXT PRIMARY KEY,
	experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
	key           TEXT NOT NULL,
	weight        INT NOT NULL,
	position      INT NOT NULL DEFAULT 0,
	UNIQUE (experiment_id, key)
);

CREATE TABLE IF NOT EXISTS experiment_events (
	id             BIGSERIAL PRIMARY KEY,
	project_id     TEXT NOT NULL,
	environment_id TEXT NOT NULL,
	experiment_key TEXT NOT NULL,
	variant        TEXT NOT NULL,
	device_id      TEXT NOT NULL,
	event          TEXT NOT NULL,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experiment_events_lookup
	ON experiment_events (project_id, experiment_key, event, variant);
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
