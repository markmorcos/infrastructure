-- Contact form submissions for studio-rendered sites. The practa renderer's
-- contact form posts here (via its own /api/contact proxy, which injects the
-- trusted site key from the request Host). Storage is the source of truth;
-- Brevo email is best-effort (the `emailed` flag records whether it went out).
-- Idempotent.
SET search_path TO cms, public;

CREATE TABLE IF NOT EXISTS contacts (
  id          BIGSERIAL PRIMARY KEY,
  site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL,
  locale      TEXT NOT NULL DEFAULT '',
  ip          TEXT NOT NULL DEFAULT '',
  user_agent  TEXT NOT NULL DEFAULT '',
  emailed     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup for the per-site inbox view and the per-IP rate-limit window.
CREATE INDEX IF NOT EXISTS idx_contacts_site ON contacts(site_id, created_at DESC);
