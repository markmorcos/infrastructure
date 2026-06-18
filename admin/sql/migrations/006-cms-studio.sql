-- Studio/practa config REMOVED from the CMS. preset_id, theme_overrides and
-- settings used to mark a site studio-rendered and hold its config; that now
-- lives in practa's own DB (a site is "studio" simply when it has no
-- github_repo/dispatch_event). This migration drops them. Idempotent — re-run
-- every deploy, so it also keeps them gone.
SET search_path TO cms, public;

DROP INDEX IF EXISTS idx_sites_preset;

ALTER TABLE sites
  DROP COLUMN IF EXISTS preset_id,
  DROP COLUMN IF EXISTS theme_overrides,
  DROP COLUMN IF EXISTS settings;
