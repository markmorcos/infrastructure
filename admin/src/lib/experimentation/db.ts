import { expPool as pool } from "@/lib/db";

// Typed query layer for the public SDK endpoints, ported from the Go service's
// store.go. Only the read paths the SDK needs (resolve key, evaluate features,
// list running experiments) plus event insertion live here; the admin surface
// is out of scope.

export type ResolvedKey = {
  projectId: string;
  projectKey: string;
  environmentId: string;
  environmentKey: string;
};

// resolveSdkKey maps a client SDK key to its project + environment, or null when
// the key is unknown. JOINs sdk_keys -> projects -> environments.
export async function resolveSdkKey(key: string): Promise<ResolvedKey | null> {
  const { rows } = await pool.query(
    `SELECT k.project_id, p.key AS project_key, k.environment_id, e.key AS environment_key
     FROM sdk_keys k
     JOIN projects p ON p.id = k.project_id
     JOIN environments e ON e.id = k.environment_id
     WHERE k.key = $1`,
    [key]
  );
  if (rows.length === 0) {
    return null;
  }
  const r = rows[0];
  return {
    projectId: r.project_id,
    projectKey: r.project_key,
    environmentId: r.environment_id,
    environmentKey: r.environment_key,
  };
}

// FeatureEval pairs a feature with its (optional) per-environment value. value
// is null when the feature is unset in the environment. JSONB columns are
// already parsed into JS values by the pg driver, so default_value/value are
// raw JSON (e.g. literal `true`, not `"true"`).
export type FeatureEval = {
  key: string;
  type: string;
  default_value: unknown;
  value: unknown;
  enabled: boolean;
  rollout: number;
};

// featuresForEval returns every feature in a project together with its value in
// the given environment (null when unset), ordered by feature key.
export async function featuresForEval(
  projectId: string,
  envId: string
): Promise<FeatureEval[]> {
  const { rows } = await pool.query(
    `SELECT f.key, f.type, f.default_value,
            fv.enabled, fv.value, fv.rollout
     FROM features f
     LEFT JOIN feature_values fv
       ON fv.feature_id = f.id AND fv.environment_id = $2
     WHERE f.project_id = $1
     ORDER BY f.key`,
    [projectId, envId]
  );
  return rows.map((r) => ({
    key: r.key,
    type: r.type,
    default_value: r.default_value,
    // When the LEFT JOIN misses, enabled is SQL NULL -> JS null; normalise the
    // whole value side to null so evalFeature falls back to the default.
    value: r.enabled === null ? null : r.value,
    enabled: r.enabled === null ? false : r.enabled,
    rollout: r.rollout === null ? 0 : r.rollout,
  }));
}

export type ExperimentVariant = { key: string; weight: number; position: number };

export type RunningExperiment = {
  key: string;
  control: string;
  variants: ExperimentVariant[];
};

// runningExperiments returns the project's experiments with status 'running'
// (in created_at order), each with its variants ordered by position.
export async function runningExperiments(
  projectId: string
): Promise<RunningExperiment[]> {
  const { rows: exps } = await pool.query(
    `SELECT id, key, control
     FROM experiments
     WHERE project_id = $1 AND status = 'running'
     ORDER BY created_at`,
    [projectId]
  );
  if (exps.length === 0) {
    return [];
  }
  const ids = exps.map((e) => e.id);
  const { rows: vars } = await pool.query(
    `SELECT experiment_id, key, weight, position
     FROM experiment_variants
     WHERE experiment_id = ANY($1::text[])
     ORDER BY position`,
    [ids]
  );
  const byExp = new Map<string, ExperimentVariant[]>();
  for (const v of vars) {
    const list = byExp.get(v.experiment_id) ?? [];
    list.push({ key: v.key, weight: v.weight, position: v.position });
    byExp.set(v.experiment_id, list);
  }
  return exps.map((e) => ({
    key: e.key,
    control: e.control,
    variants: byExp.get(e.id) ?? [],
  }));
}

export type InsertEventInput = {
  projectId: string;
  environmentId: string;
  experimentKey: string;
  variant: string;
  deviceId: string;
  event: string;
};

// insertEvent records one exposure or conversion event.
export async function insertEvent(input: InsertEventInput): Promise<void> {
  await pool.query(
    `INSERT INTO experiment_events
       (project_id, environment_id, experiment_key, variant, device_id, event)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.projectId,
      input.environmentId,
      input.experimentKey,
      input.variant,
      input.deviceId,
      input.event,
    ]
  );
}
