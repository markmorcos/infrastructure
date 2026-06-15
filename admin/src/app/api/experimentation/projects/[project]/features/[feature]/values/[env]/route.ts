import { NextRequest } from "next/server";
import {
  getProject,
  getFeature,
  getEnvironment,
  upsertFeatureValue,
  deleteFeatureValue,
  defaultForType,
} from "@/lib/experimentation/admin";
import { noContent, text } from "../../../../../../_http";

type Ctx = {
  params: Promise<{ project: string; feature: string; env: string }>;
};

// PUT    set per-environment value (enabled, value, rollout) — upsert
// DELETE unset per-environment value

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { project, feature, env } = await params;
  let body: { enabled?: boolean; value?: unknown; rollout?: number };
  try {
    body = await req.json();
  } catch {
    return text("invalid json", 400);
  }
  const rollout = body.rollout ?? 0;
  if (rollout < 0 || rollout > 100) {
    return text("rollout must be 0..100", 400);
  }
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const f = await getFeature(p.id, feature);
    if (!f) return text("feature not found", 404);
    const e = await getEnvironment(p.id, env);
    if (!e) return text("environment not found", 404);
    const value =
      body.value === undefined ? defaultForType(f.type) : body.value;
    await upsertFeatureValue(f.id, e.id, body.enabled ?? false, value, rollout);
    return noContent();
  } catch (err) {
    console.error(err);
    return text("could not set value", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { project, feature, env } = await params;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const f = await getFeature(p.id, feature);
    if (!f) return text("feature not found", 404);
    const e = await getEnvironment(p.id, env);
    if (!e) return text("environment not found", 404);
    await deleteFeatureValue(f.id, e.id);
    return noContent();
  } catch (err) {
    console.error(err);
    return text("could not delete feature value", 500);
  }
}
