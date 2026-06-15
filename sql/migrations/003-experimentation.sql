-- Experimentation / feature-flag platform schema, ported from the Go service's
-- db.go. Idempotent (CREATE ... IF NOT EXISTS): the live DB already has these
-- tables via the Go app, so this is a no-op there; it lets the Next.js port own
-- the schema in fresh environments. experiment_events intentionally has NO
-- foreign keys (events outlive the rows they reference) and is cleaned up
-- explicitly by the app on project/environment/experiment deletion.
--
-- Lives in its own `experimentation` schema in the consolidated infrastructure
-- DB (avoids colliding with the control-plane `public.projects` table).
CREATE SCHEMA IF NOT EXISTS experimentation;
SET search_path TO experimentation, public;

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
