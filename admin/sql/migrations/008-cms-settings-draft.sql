-- Draftable settings REMOVED from the CMS. Per-site config (and its draft) now
-- lives in practa's own DB (site_config.published/draft). This migration drops
-- the old settings_draft column. Idempotent — re-run every deploy.
SET search_path TO cms, public;

ALTER TABLE sites DROP COLUMN IF EXISTS settings_draft;
