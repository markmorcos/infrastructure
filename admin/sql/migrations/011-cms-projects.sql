-- 011-cms-projects.sql — optional projects that scope site-key uniqueness.
-- Idempotent (re-applied every deploy, in filename order). Lives in the `cms`
-- schema alongside 004-cms.sql.
--
-- Why: cms.sites.key was globally UNIQUE, but practa creates a CMS site per
-- tenant subdomain (e.g. "mark"). If the founder also has an unrelated CMS site
-- "mark", they collide. Fix: optional projects; uniqueness is scoped to
-- (project_id, key). A NULL project_id keeps today's global namespace (the
-- founder's console sites); practa lives in its own `practa` project, so its
-- per-tenant sites can reuse keys that also exist globally.
SET search_path TO cms, public;

CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_sites_project_id ON sites(project_id);

-- The practa project. The CMS authenticates practa with a per-tenant token
-- whose tenant is 'practa'; service.ts resolves that to this project so practa's
-- writes only ever touch proj_practa sites.
INSERT INTO projects (id, key, name)
VALUES ('proj_practa', 'practa', 'practa')
ON CONFLICT (key) DO NOTHING;

-- Drop the global UNIQUE(key) so the same key can exist in different projects.
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_key_key;

-- Scoped uniqueness: unique per (project_id, key) for project-owned sites, and
-- unique key among the NULL-project (global) sites. Two partial indexes because
-- Postgres treats NULLs as distinct in a normal UNIQUE constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sites_project_key
  ON sites(project_id, key) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sites_null_project_key
  ON sites(key) WHERE project_id IS NULL;

-- Backfill: assign existing studio-rendered sites (no GitHub repo / dispatch
-- event — practa's signature) to the practa project. Idempotent: only touches
-- rows still unassigned. Keys were globally unique pre-migration, so moving them
-- into proj_practa can never collide with another proj_practa key.
--
-- VERIFY this studio-site heuristic matches practa's actual tenants before
-- deploy; replace with an explicit WHERE key IN (...) allow-list if unsure.
UPDATE sites
  SET project_id = 'proj_practa'
  WHERE project_id IS NULL
    AND github_repo = ''
    AND dispatch_event = '';
