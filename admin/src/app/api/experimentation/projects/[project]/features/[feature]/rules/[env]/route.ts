import { NextRequest } from "next/server";
import {
  getProject,
  getFeature,
  getEnvironment,
  getCohort,
  listCohorts,
  listFeatureRules,
  setFeatureRules,
  type FeatureRule,
} from "@/lib/experimentation/admin";
import { json, noContent, text } from "../../../../../../_http";

type Ctx = {
  params: Promise<{ project: string; feature: string; env: string }>;
};

// GET list targeting rules for a feature in an environment
// PUT replace-all targeting rules (ordered)

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { project, feature, env } = await params;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const f = await getFeature(p.id, feature);
    if (!f) return text("feature not found", 404);
    const e = await getEnvironment(p.id, env);
    if (!e) return text("environment not found", 404);
    return json(await listFeatureRules(f.id, e.id));
  } catch (err) {
    console.error(err);
    return text("internal error", 500);
  }
}

type RuleInput = {
  cohortId?: string | null;
  entityId?: string | null;
  // accept snake_case too so the body matches the API style elsewhere
  cohort_id?: string | null;
  entity_id?: string | null;
  enabled?: boolean;
  value?: unknown;
};

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { project, feature, env } = await params;
  let body: { rules?: RuleInput[] };
  try {
    body = await req.json();
  } catch {
    return text("invalid json", 400);
  }
  const inputs = Array.isArray(body.rules) ? body.rules : [];
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const f = await getFeature(p.id, feature);
    if (!f) return text("feature not found", 404);
    const e = await getEnvironment(p.id, env);
    if (!e) return text("environment not found", 404);

    // Validate + normalise: each rule must reference a cohort OR an entity id.
    // Cohort references are resolved against this project (by cohort id OR key).
    const projectCohorts = await listCohorts(p.id);
    const cohortIds = new Set(projectCohorts.map((c) => c.id));
    const rules: FeatureRule[] = [];
    for (const r of inputs) {
      const cohortRef = (r.cohortId ?? r.cohort_id ?? null) || null;
      const entityId = ((r.entityId ?? r.entity_id ?? null) || null) as
        | string
        | null;
      let cohortId: string | null = null;
      if (cohortRef) {
        // The console sends cohort ids; accept a cohort key as a fallback.
        cohortId = cohortIds.has(cohortRef)
          ? cohortRef
          : (await getCohort(p.id, cohortRef))?.id ?? null;
        if (!cohortId) return text(`unknown cohort: ${cohortRef}`, 400);
      }
      if (!cohortId && !entityId) {
        return text("each rule needs a cohort or an entity id", 400);
      }
      rules.push({
        cohortId,
        entityId: cohortId ? null : entityId,
        enabled: r.enabled ?? true,
        value: r.value,
      });
    }

    await setFeatureRules(f.id, e.id, rules);
    return noContent();
  } catch (err) {
    console.error(err);
    return text("could not set rules", 500);
  }
}
