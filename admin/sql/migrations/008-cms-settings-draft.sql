-- Draftable site settings. `settings` holds the live/published config the public
-- renderer reads; `settings_draft` is the owner's working copy. Editing writes
-- the draft, Publish promotes draft -> settings, and the renderer can preview the
-- draft via ?draft=1. Mirrors the draft/published split that section content
-- already has. Idempotent.
SET search_path TO cms, public;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS settings_draft JSONB NOT NULL DEFAULT '{}';

-- One-time backfill so existing sites start with draft == published. Guarded so
-- re-running the migration (every deploy) never clobbers real draft edits: only
-- seed when the draft is still empty but published settings exist.
UPDATE sites
   SET settings_draft = settings
 WHERE settings_draft = '{}'::jsonb
   AND settings <> '{}'::jsonb;
