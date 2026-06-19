-- Per-tenant API tokens for the CMS-as-a-service auth model. Replaces the single
-- CMS_SERVICE_SECRET: each consumer app (tenant, e.g. practa) gets one or more
-- tokens, stored as a sha256 hash, revocable per row. Idempotent (re-run safe).

CREATE TABLE IF NOT EXISTS cms.api_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant       text NOT NULL,
  token_hash   text NOT NULL UNIQUE,
  scopes       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_active
  ON cms.api_tokens (token_hash) WHERE revoked_at IS NULL;
