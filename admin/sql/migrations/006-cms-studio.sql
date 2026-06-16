-- Studio multi-tenant renderer. A cms.site becomes "studio-rendered" the moment
-- it has a preset_id: the studio app serves any site with one, while sites
-- without (e.g. repo-per-site like portfolio) are untouched. The preset itself
-- (palette, fonts, layout, placeholder copy) lives as code in the studio
-- renderer; the DB stores only the assignment plus per-site deviations:
--   theme_overrides — token nudges that stay within the preset
--   settings        — "config later" data (cal.com link, embed url, socials)
-- Idempotent.
SET search_path TO cms, public;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS preset_id       TEXT,
  ADD COLUMN IF NOT EXISTS theme_overrides JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS settings        JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_sites_preset ON sites(preset_id);
