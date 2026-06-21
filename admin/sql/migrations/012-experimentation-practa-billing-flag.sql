-- 012-experimentation-practa-billing-flag.sql
-- Seed the `practa_billing` boolean feature flag used to gate ALL of practa.co's
-- payments UI/flow. Created with default false (and NO feature_value row) =>
-- evaluates OFF in every environment until explicitly flipped on. This is the
-- single kill-switch practa's src/lib/flags.ts -> billingEnabled() reads via the
-- public SDK endpoint GET /api/experimentation/v1/config.
--
-- Idempotent (re-applied every deploy). Guarded so it is a strict no-op in any
-- environment that does NOT have a practa experimentation project: it only
-- inserts the feature when an experimentation project keyed 'practa' exists and
-- the feature is not already present (INSERT ... SELECT ... WHERE NOT EXISTS).
-- Re-running never duplicates the row (the project_id+key UNIQUE constraint plus
-- the NOT EXISTS guard keep it safe).
--
-- CRITICAL: the flag MUST live in the exact experimentation project the founder's
-- practa SDK key (PRACTA_EXP_SDK_KEY) resolves to, or /v1/config won't return it
-- and billingEnabled() fail-safes to OFF. This migration targets the project
-- whose `key` is 'practa'. If the founder's SDK key resolves to a differently
-- keyed project, create the feature there instead via the admin console
-- ("create feature": key=practa_billing, type=boolean, default=false) or:
--   POST /api/experimentation/projects/<projectKey>/features
--        { key:'practa_billing', type:'boolean',
--          description:'Gate practa.co payments UI/flow', default:false }
--
-- To flip ON later (rollout-100 boolean kill-switch; device id is irrelevant):
--   PUT /api/experimentation/projects/<projectKey>/features/practa_billing/values/<envKey>
--       { enabled:true, value:true, rollout:100 }
--
-- The experimentation platform lives in its own schema (see 003-experimentation).

SET search_path TO experimentation, public;

INSERT INTO features (id, project_id, key, type, description, default_value)
SELECT
  md5(random()::text || clock_timestamp()::text),
  p.id,
  'practa_billing',
  'boolean',
  'Gate practa.co payments UI/flow (default OFF; flip per-env to enable)',
  'false'::jsonb
FROM projects p
WHERE p.key = 'practa'
  AND NOT EXISTS (
    SELECT 1 FROM features f
    WHERE f.project_id = p.id AND f.key = 'practa_billing'
  );
