-- Contact submissions REMOVED from the CMS. They now live in practa's own DB
-- (practa's /api/contact writes there + sends the email). This migration drops
-- the old cms.contacts table. Idempotent — re-run every deploy.
SET search_path TO cms, public;

DROP TABLE IF EXISTS contacts;
