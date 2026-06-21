-- 013-experimentation-cohorts.sql
-- Cohorts + per-entity targeting for the experimentation platform. Adds three
-- tables to the `experimentation` schema:
--   * cohorts          — named groups of entities, scoped to a project.
--   * cohort_members   — entity ids belonging to a cohort.
--   * feature_rules    — ordered per-(feature,environment) targeting rules that
--                        run BEFORE the rollout: a rule matches when its entity
--                        id equals the evaluating device, or when the device is a
--                        member of its cohort. First match wins.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded inserts (WHERE NOT EXISTS /
-- ON CONFLICT DO NOTHING), so it re-applies cleanly every deploy. TEXT ids match
-- the rest of the schema (see 003-experimentation).

SET search_path TO experimentation, public;

CREATE TABLE IF NOT EXISTS cohorts (
	id         TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	key        TEXT NOT NULL,
	name       TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS cohort_members (
	cohort_id  TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
	entity_id  TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (cohort_id, entity_id)
);

CREATE INDEX IF NOT EXISTS cohort_members_entity
	ON cohort_members (entity_id);

CREATE TABLE IF NOT EXISTS feature_rules (
	id             TEXT PRIMARY KEY,
	feature_id     TEXT NOT NULL REFERENCES features(id) ON DELETE CASCADE,
	environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
	position       INT NOT NULL DEFAULT 0,
	cohort_id      TEXT REFERENCES cohorts(id) ON DELETE CASCADE,
	entity_id      TEXT,
	enabled        BOOLEAN NOT NULL DEFAULT true,
	value          JSONB,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
	CHECK (cohort_id IS NOT NULL OR entity_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS feature_rules_lookup
	ON feature_rules (feature_id, environment_id, position);

-- ---- idempotent seed: put 'lea' in a 'pilot' cohort with billing ON ----
-- So practa_billing evaluates true for entity 'lea' out of the box. Every insert
-- is guarded; if the practa project / practa_billing feature is absent this is a
-- strict no-op. The target environment is the practa project's first/default
-- environment (earliest created_at) — the one its SDK key resolves to.

-- 1. the 'pilot' cohort in the practa project
INSERT INTO cohorts (id, project_id, key, name)
SELECT
	md5(random()::text || clock_timestamp()::text),
	p.id,
	'pilot',
	'Pilot'
FROM projects p
WHERE p.key = 'practa'
  AND NOT EXISTS (
	SELECT 1 FROM cohorts c WHERE c.project_id = p.id AND c.key = 'pilot'
  );

-- 2. entity 'lea' as a member of that cohort
INSERT INTO cohort_members (cohort_id, entity_id)
SELECT c.id, 'lea'
FROM cohorts c
JOIN projects p ON p.id = c.project_id
WHERE p.key = 'practa' AND c.key = 'pilot'
ON CONFLICT (cohort_id, entity_id) DO NOTHING;

-- 3. a feature_rule for practa_billing in the practa project's first env:
--    cohort=pilot, enabled=true, value=true.
INSERT INTO feature_rules (id, feature_id, environment_id, position, cohort_id, entity_id, enabled, value)
SELECT
	md5(random()::text || clock_timestamp()::text),
	f.id,
	e.id,
	0,
	c.id,
	NULL,
	true,
	'true'::jsonb
FROM projects p
JOIN features f ON f.project_id = p.id AND f.key = 'practa_billing'
JOIN cohorts c ON c.project_id = p.id AND c.key = 'pilot'
JOIN LATERAL (
	SELECT id FROM environments
	WHERE project_id = p.id
	ORDER BY created_at
	LIMIT 1
) e ON true
WHERE p.key = 'practa'
  AND NOT EXISTS (
	SELECT 1 FROM feature_rules fr
	WHERE fr.feature_id = f.id
	  AND fr.environment_id = e.id
	  AND fr.cohort_id = c.id
  );
