-- Converge to a `projects` registry, from either a legacy `deployments` table
-- or a fresh database. Idempotent: re-applying on every deploy is a no-op.

-- 1. Legacy rename (only when `deployments` exists and `projects` doesn't yet).
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'deployments')
     AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') THEN
    ALTER TABLE deployments RENAME TO projects;
    ALTER INDEX IF EXISTS idx_deployments_token RENAME TO idx_projects_token;
    ALTER TRIGGER trigger_update_timestamp ON projects
      RENAME TO trigger_projects_update_timestamp;
  END IF;
END $$;

-- 2. Fresh-install fallback + column extensions.
CREATE TABLE IF NOT EXISTS projects (
  project_name TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS repo TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS namespace TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS config_files JSONB;

CREATE INDEX IF NOT EXISTS idx_projects_token ON projects(token);

-- 3. updated_at trigger (idempotent).
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_projects_update_timestamp ON projects;
CREATE TRIGGER trigger_projects_update_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
