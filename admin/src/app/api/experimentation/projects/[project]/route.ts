import { NextRequest } from "next/server";
import {
  getProject,
  listEnvironments,
  listSdkKeys,
  listFeatures,
  listFeatureValues,
  listExperiments,
  listCohorts,
  listCohortMembers,
  renameProject,
  deleteProject,
} from "@/lib/experimentation/admin";
import { json, noContent, text } from "../../_http";

type Ctx = { params: Promise<{ project: string }> };

// GET    project detail (with children)
// PATCH  rename
// DELETE delete (clears events)

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { project } = await params;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const [environments, sdkKeys, features, experiments, cohorts] =
      await Promise.all([
        listEnvironments(p.id),
        listSdkKeys(p.id),
        listFeatures(p.id),
        listExperiments(p.id),
        listCohorts(p.id),
      ]);
    // The Go project page renders each feature with its per-environment values
    // (ui.go featureView). Embed those here so the console can render them in a
    // single round trip, mirroring that screen.
    const featuresWithValues = await Promise.all(
      features.map(async (f) => ({
        ...f,
        values: await listFeatureValues(f.id),
      }))
    );
    // Embed each cohort's members so the console can manage them inline.
    const cohortsWithMembers = await Promise.all(
      cohorts.map(async (c) => ({
        ...c,
        members: (await listCohortMembers(c.id)).map((m) => m.entityId),
      }))
    );
    return json({
      project: p,
      environments,
      sdkKeys,
      features: featuresWithValues,
      experiments,
      cohorts: cohortsWithMembers,
    });
  } catch (e) {
    console.error(e);
    return text("internal error", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { project } = await params;
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return text("invalid json", 400);
  }
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const name = (body.name ?? "").trim() || p.key;
    await renameProject(p.id, name);
    return json({ ...p, name });
  } catch (e) {
    console.error(e);
    return text("could not update project", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { project } = await params;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    await deleteProject(p.id);
    return noContent();
  } catch (e) {
    console.error(e);
    return text("could not delete project", 500);
  }
}
