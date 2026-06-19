-- 010-analytics.sql — first-party, privacy-first web analytics.
-- Idempotent (re-applied every deploy). Requires the timescaledb extension to be
-- available on the server and already created in this database by a superuser;
-- the IF NOT EXISTS below is a no-op when it's present (the migrate Job runs as a
-- non-superuser app role, which can't create it but can use it).
--
-- One raw events hypertable. Pageviews + custom funnel events. No cookies, no raw
-- IP: visitor_id is a daily-rotating salted hash, so visitors can't be linked
-- across days. Dashboards aggregate on read (fast at our scale); continuous
-- aggregates can be layered on later if volume warrants.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS analytics_events (
  ts            timestamptz NOT NULL DEFAULT now(),
  site_key      text        NOT NULL,
  name          text        NOT NULL,                 -- 'pageview' | 'signup' | 'publish' | 'paid' | ...
  path          text        NOT NULL DEFAULT '/',
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  country       char(2),                              -- v2 (geoip); nullable for now
  browser       text,
  os            text,
  device        text,                                 -- 'desktop' | 'mobile' | 'tablet'
  visitor_id    text        NOT NULL,
  props         jsonb
);

-- Time-partitioned hypertable (7-day chunks).
SELECT create_hypertable(
  'analytics_events', 'ts',
  chunk_time_interval => interval '7 days',
  if_not_exists => TRUE
);

-- Per-tenant time scans (dashboard) + per-event-type scans (funnel).
CREATE INDEX IF NOT EXISTS analytics_events_site_ts
  ON analytics_events (site_key, ts DESC);
CREATE INDEX IF NOT EXISTS analytics_events_site_name_ts
  ON analytics_events (site_key, name, ts DESC);

-- Compress chunks older than 30 days; drop raw events after 365 days (retention).
ALTER TABLE analytics_events SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'site_key',
  timescaledb.compress_orderby   = 'ts DESC'
);
SELECT add_compression_policy('analytics_events', interval '30 days', if_not_exists => TRUE);
SELECT add_retention_policy('analytics_events', interval '365 days', if_not_exists => TRUE);
