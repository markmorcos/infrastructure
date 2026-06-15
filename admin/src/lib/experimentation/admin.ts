import { randomBytes } from "crypto";
import { expPool as pool } from "@/lib/db";
import type { PoolClient } from "pg";
import { erfc, twoProportionZ } from "./stats";

// Admin/CRUD query layer for the experimentation console, ported from the Go
// service's store.go + service.go + results.go. Everything here is admin-only
// (gated by the app's session middleware) and writes to the `experimentation`
// schema via expPool.

// ---- ids / keys ----

function newId(): string {
  return randomBytes(16).toString("hex");
}

export function genSdkKey(): string {
  return "sdk_" + randomBytes(24).toString("hex");
}

// ---- validation (mirrors adminapi.go) ----

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function validKey(s: string): boolean {
  return KEY_RE.test(s);
}

export const FEATURE_TYPES = ["boolean", "string", "number", "json"] as const;
export type FeatureType = (typeof FEATURE_TYPES)[number];

export function validFeatureType(t: string): t is FeatureType {
  return (FEATURE_TYPES as readonly string[]).includes(t);
}

export const STATUSES = ["draft", "running", "stopped"] as const;
export type Status = (typeof STATUSES)[number];

export function validStatus(s: string): s is Status {
  return (STATUSES as readonly string[]).includes(s);
}

// defaultForType returns the JSON default for a freshly created flag/value.
export function defaultForType(t: string): unknown {
  switch (t) {
    case "boolean":
      return false;
    case "string":
      return "";
    case "number":
      return 0;
    default:
      return null;
  }
}

// ---- types ----

export type Project = {
  id: string;
  key: string;
  name: string;
  createdAt: string;
};

export type Environment = {
  id: string;
  key: string;
  name: string;
};

export type SdkKey = {
  key: string;
  environment: string;
};

export type Feature = {
  id: string;
  key: string;
  type: string;
  description: string;
  default: unknown;
};

export type FeatureValue = {
  environment: string;
  enabled: boolean;
  value: unknown;
  rollout: number;
};

export type Variant = {
  key: string;
  weight: number;
};

export type Experiment = {
  id: string;
  key: string;
  name: string;
  status: string;
  metric: string;
  control: string;
  variants: Variant[];
};

// ---- projects ----

export async function listProjects(): Promise<Project[]> {
  const { rows } = await pool.query(
    `SELECT id, key, name, created_at FROM projects ORDER BY created_at`
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    createdAt: r.created_at,
  }));
}

export async function getProject(key: string): Promise<Project | null> {
  const { rows } = await pool.query(
    `SELECT id, key, name, created_at FROM projects WHERE key = $1`,
    [key]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, key: r.key, name: r.name, createdAt: r.created_at };
}

async function createProjectRow(
  client: PoolClient,
  key: string,
  name: string
): Promise<Project> {
  const id = newId();
  const { rows } = await client.query(
    `INSERT INTO projects (id, key, name) VALUES ($1,$2,$3) RETURNING created_at`,
    [id, key, name]
  );
  return { id, key, name, createdAt: rows[0].created_at };
}

async function createEnvironmentRow(
  client: PoolClient,
  projectId: string,
  key: string,
  name: string
): Promise<Environment> {
  const id = newId();
  await client.query(
    `INSERT INTO environments (id, project_id, key, name) VALUES ($1,$2,$3,$4)`,
    [id, projectId, key, name]
  );
  return { id, key, name };
}

async function createSdkKeyRow(
  client: PoolClient,
  projectId: string,
  envId: string
): Promise<string> {
  const key = genSdkKey();
  await client.query(
    `INSERT INTO sdk_keys (id, key, project_id, environment_id) VALUES ($1,$2,$3,$4)`,
    [newId(), key, projectId, envId]
  );
  return key;
}

// provisionProject creates a project + a default "production" environment + an
// SDK key for it (service.go provisionProject).
export async function provisionProject(
  key: string,
  name: string
): Promise<{ project: Project; environment: Environment; sdkKey: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const project = await createProjectRow(client, key, name);
    const environment = await createEnvironmentRow(
      client,
      project.id,
      "production",
      "Production"
    );
    const sdkKey = await createSdkKeyRow(client, project.id, environment.id);
    await client.query("COMMIT");
    return { project, environment, sdkKey };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function renameProject(id: string, name: string): Promise<void> {
  await pool.query(`UPDATE projects SET name=$2 WHERE id=$1`, [id, name]);
}

// deleteProject removes a project (cascades children) and clears its events,
// which have no FK (store.go DeleteProject).
export async function deleteProject(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM experiment_events WHERE project_id=$1`, [id]);
    await client.query(`DELETE FROM projects WHERE id=$1`, [id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ---- environments ----

export async function listEnvironments(
  projectId: string
): Promise<Environment[]> {
  const { rows } = await pool.query(
    `SELECT id, key, name FROM environments WHERE project_id = $1 ORDER BY created_at`,
    [projectId]
  );
  return rows.map((r) => ({ id: r.id, key: r.key, name: r.name }));
}

export async function getEnvironment(
  projectId: string,
  key: string
): Promise<Environment | null> {
  const { rows } = await pool.query(
    `SELECT id, key, name FROM environments WHERE project_id = $1 AND key = $2`,
    [projectId, key]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, key: r.key, name: r.name };
}

// provisionEnvironment creates an environment + an SDK key for it.
export async function provisionEnvironment(
  projectId: string,
  key: string,
  name: string
): Promise<{ environment: Environment; sdkKey: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const environment = await createEnvironmentRow(client, projectId, key, name);
    const sdkKey = await createSdkKeyRow(client, projectId, environment.id);
    await client.query("COMMIT");
    return { environment, sdkKey };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function renameEnvironment(
  id: string,
  name: string
): Promise<void> {
  await pool.query(`UPDATE environments SET name=$2 WHERE id=$1`, [id, name]);
}

// deleteEnvironment removes an environment (cascades sdk keys + values) and
// clears its events, which have no FK (store.go DeleteEnvironment).
export async function deleteEnvironment(id: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM experiment_events WHERE environment_id=$1`,
      [id]
    );
    await client.query(`DELETE FROM environments WHERE id=$1`, [id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ---- sdk keys ----

export async function listSdkKeys(projectId: string): Promise<SdkKey[]> {
  const { rows } = await pool.query(
    `SELECT k.key, e.key AS environment
     FROM sdk_keys k JOIN environments e ON e.id = k.environment_id
     WHERE k.project_id = $1
     ORDER BY k.created_at`,
    [projectId]
  );
  return rows.map((r) => ({ key: r.key, environment: r.environment }));
}

// ---- features ----

export async function listFeatures(projectId: string): Promise<Feature[]> {
  const { rows } = await pool.query(
    `SELECT id, key, type, description, default_value
     FROM features WHERE project_id = $1 ORDER BY key`,
    [projectId]
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    type: r.type,
    description: r.description,
    default: r.default_value,
  }));
}

export async function getFeature(
  projectId: string,
  key: string
): Promise<Feature | null> {
  const { rows } = await pool.query(
    `SELECT id, key, type, description, default_value
     FROM features WHERE project_id = $1 AND key = $2`,
    [projectId, key]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    key: r.key,
    type: r.type,
    description: r.description,
    default: r.default_value,
  };
}

export async function createFeature(
  projectId: string,
  key: string,
  type: string,
  description: string,
  def: unknown
): Promise<Feature> {
  const id = newId();
  await pool.query(
    `INSERT INTO features (id, project_id, key, type, description, default_value)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, projectId, key, type, description, JSON.stringify(def)]
  );
  return { id, key, type, description, default: def };
}

export async function updateFeature(
  id: string,
  description: string,
  def: unknown
): Promise<void> {
  await pool.query(
    `UPDATE features SET description=$2, default_value=$3 WHERE id=$1`,
    [id, description, JSON.stringify(def)]
  );
}

export async function deleteFeature(id: string): Promise<void> {
  await pool.query(`DELETE FROM features WHERE id=$1`, [id]);
}

export async function listFeatureValues(
  featureId: string
): Promise<FeatureValue[]> {
  const { rows } = await pool.query(
    `SELECT e.key AS environment, fv.enabled, fv.value, fv.rollout
     FROM feature_values fv JOIN environments e ON e.id = fv.environment_id
     WHERE fv.feature_id = $1
     ORDER BY e.created_at`,
    [featureId]
  );
  return rows.map((r) => ({
    environment: r.environment,
    enabled: r.enabled,
    value: r.value,
    rollout: r.rollout,
  }));
}

export async function upsertFeatureValue(
  featureId: string,
  envId: string,
  enabled: boolean,
  value: unknown,
  rollout: number
): Promise<void> {
  await pool.query(
    `INSERT INTO feature_values (id, feature_id, environment_id, enabled, value, rollout, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (feature_id, environment_id)
     DO UPDATE SET enabled = EXCLUDED.enabled, value = EXCLUDED.value, rollout = EXCLUDED.rollout, updated_at = now()`,
    [newId(), featureId, envId, enabled, JSON.stringify(value), rollout]
  );
}

export async function deleteFeatureValue(
  featureId: string,
  envId: string
): Promise<void> {
  await pool.query(
    `DELETE FROM feature_values WHERE feature_id=$1 AND environment_id=$2`,
    [featureId, envId]
  );
}

// ---- experiments ----

async function loadVariants(
  client: { query: PoolClient["query"] },
  experimentId: string
): Promise<Variant[]> {
  const { rows } = await client.query(
    `SELECT key, weight FROM experiment_variants WHERE experiment_id=$1 ORDER BY position`,
    [experimentId]
  );
  return rows.map((r) => ({ key: r.key, weight: r.weight }));
}

export async function listExperiments(
  projectId: string
): Promise<Experiment[]> {
  const { rows } = await pool.query(
    `SELECT id, key, name, status, metric, control
     FROM experiments WHERE project_id=$1 ORDER BY created_at`,
    [projectId]
  );
  const out: Experiment[] = [];
  for (const r of rows) {
    out.push({
      id: r.id,
      key: r.key,
      name: r.name,
      status: r.status,
      metric: r.metric,
      control: r.control,
      variants: await loadVariants(pool, r.id),
    });
  }
  return out;
}

export async function getExperiment(
  projectId: string,
  key: string
): Promise<Experiment | null> {
  const { rows } = await pool.query(
    `SELECT id, key, name, status, metric, control
     FROM experiments WHERE project_id=$1 AND key=$2`,
    [projectId, key]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    status: r.status,
    metric: r.metric,
    control: r.control,
    variants: await loadVariants(pool, r.id),
  };
}

export type ExperimentInput = {
  key: string;
  name: string;
  status: string;
  metric: string;
  control: string;
  variants: Variant[];
};

export async function createExperiment(
  projectId: string,
  input: ExperimentInput
): Promise<Experiment> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = newId();
    await client.query(
      `INSERT INTO experiments (id, project_id, key, name, status, metric, control)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, projectId, input.key, input.name, input.status, input.metric, input.control]
    );
    for (let i = 0; i < input.variants.length; i++) {
      const v = input.variants[i];
      await client.query(
        `INSERT INTO experiment_variants (id, experiment_id, key, weight, position)
         VALUES ($1,$2,$3,$4,$5)`,
        [newId(), id, v.key, v.weight, i]
      );
    }
    await client.query("COMMIT");
    return {
      id,
      key: input.key,
      name: input.name,
      status: input.status,
      metric: input.metric,
      control: input.control,
      variants: input.variants,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// updateExperiment updates fields and replaces variants (store.go).
export async function updateExperiment(
  id: string,
  input: ExperimentInput
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE experiments SET name=$2, status=$3, metric=$4, control=$5 WHERE id=$1`,
      [id, input.name, input.status, input.metric, input.control]
    );
    await client.query(
      `DELETE FROM experiment_variants WHERE experiment_id=$1`,
      [id]
    );
    for (let i = 0; i < input.variants.length; i++) {
      const v = input.variants[i];
      await client.query(
        `INSERT INTO experiment_variants (id, experiment_id, key, weight, position)
         VALUES ($1,$2,$3,$4,$5)`,
        [newId(), id, v.key, v.weight, i]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// deleteExperiment removes the experiment (cascades variants) and clears events
// keyed by experiment_key (store.go DeleteExperiment).
export async function deleteExperiment(
  id: string,
  projectId: string,
  key: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM experiment_events WHERE project_id=$1 AND experiment_key=$2`,
      [projectId, key]
    );
    await client.query(`DELETE FROM experiments WHERE id=$1`, [id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ---- results ----

export type VariantStat = {
  variant: string;
  exposures: number;
  conversions: number;
};

// stats returns distinct-device exposure/conversion counts per variant
// (store.go Stats). When envId is empty results span all environments.
export async function stats(
  projectId: string,
  expKey: string,
  envId: string,
  metric: string
): Promise<Map<string, VariantStat>> {
  const { rows } = await pool.query(
    `SELECT variant,
            COUNT(DISTINCT device_id) FILTER (WHERE event = 'exposure') AS exposures,
            COUNT(DISTINCT device_id) FILTER (WHERE event = $3)         AS conversions
     FROM experiment_events
     WHERE project_id = $1 AND experiment_key = $2
       AND ($4 = '' OR environment_id = $4)
     GROUP BY variant`,
    [projectId, expKey, metric, envId]
  );
  const out = new Map<string, VariantStat>();
  for (const r of rows) {
    out.set(r.variant, {
      variant: r.variant,
      exposures: Number(r.exposures),
      conversions: Number(r.conversions),
    });
  }
  return out;
}

export type VariantResult = {
  variant: string;
  exposures: number;
  conversions: number;
  rate: number;
  isControl: boolean;
  upliftVsControl: number;
  z: number;
  pValue: number;
  significant: boolean;
};

export type Results = {
  experiment: string;
  metric: string;
  control: string;
  updatedAt: string;
  variants: VariantResult[];
};

const SIGNIFICANCE_THRESHOLD = 0.05;

function conversionRate(conv: number, exposed: number): number {
  return exposed === 0 ? 0 : conv / exposed;
}

// buildResults turns raw per-variant counts into rates + significance, testing
// every non-control variant against control (results.go buildResults).
export function buildResults(
  exp: Experiment,
  metric: string,
  st: Map<string, VariantStat>
): Results {
  const ctrl = st.get(exp.control) ?? {
    variant: exp.control,
    exposures: 0,
    conversions: 0,
  };
  const ctrlRate = conversionRate(ctrl.conversions, ctrl.exposures);

  const variants: VariantResult[] = exp.variants.map((v) => {
    const s = st.get(v.key) ?? {
      variant: v.key,
      exposures: 0,
      conversions: 0,
    };
    const rate = conversionRate(s.conversions, s.exposures);
    const isControl = v.key === exp.control;
    const vr: VariantResult = {
      variant: v.key,
      exposures: s.exposures,
      conversions: s.conversions,
      rate,
      isControl,
      upliftVsControl: 0,
      z: 0,
      pValue: 0,
      significant: false,
    };
    if (!isControl) {
      if (ctrlRate > 0) {
        vr.upliftVsControl = (rate - ctrlRate) / ctrlRate;
      }
      const { z, p } = twoProportionZ(
        s.conversions,
        s.exposures,
        ctrl.conversions,
        ctrl.exposures
      );
      vr.z = z;
      vr.pValue = p;
      vr.significant = p < SIGNIFICANCE_THRESHOLD;
    }
    return vr;
  });

  return {
    experiment: exp.key,
    metric,
    control: exp.control,
    updatedAt: new Date().toISOString(),
    variants,
  };
}

// validateExperiment mirrors adminapi.go validateExperiment. Returns an error
// message, or null when valid.
export function validateExperiment(b: {
  metric: string;
  control: string;
  variants: Variant[];
  status: string;
}): string | null {
  if (!b.metric) return "metric is required";
  if (b.variants.length < 2) return "at least two variants are required";
  const seen = new Set<string>();
  for (const v of b.variants) {
    if (!validKey(v.key)) return "variant key must match [a-z0-9_-]";
    if (v.weight < 0) return "variant weight must be >= 0";
    seen.add(v.key);
  }
  if (!seen.has(b.control)) return "control must be one of the variants";
  if (b.status !== "" && !validStatus(b.status))
    return "status must be draft|running|stopped";
  return null;
}

// erfc re-exported so route handlers/tests can reach it through one module.
export { erfc };
