CREATE TABLE IF NOT EXISTS deployments (
  project_name TEXT PRIMARY KEY,
  repository_name TEXT NOT NULL,
  config JSONB NOT NULL,
  token TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deployments_token
  ON deployments(token);

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_timestamp
BEFORE UPDATE ON deployments
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
