-- Per-site ownership for editor RBAC. owner_user_id NULL = admin-only site;
-- a non-admin (editor) may only access sites they own. Idempotent.
SET search_path TO cms, public;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sites_owner ON sites(owner_user_id);
