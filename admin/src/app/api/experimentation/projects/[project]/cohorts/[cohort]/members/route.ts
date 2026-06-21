import { NextRequest } from "next/server";
import {
  getProject,
  getCohort,
  listCohortMembers,
  addCohortMember,
  removeCohortMember,
} from "@/lib/experimentation/admin";
import { json, noContent, text } from "../../../../../_http";

type Ctx = { params: Promise<{ project: string; cohort: string }> };

// GET    list members
// POST   add member    { entity_id }
// DELETE remove member { entity_id }

async function resolve(project: string, cohort: string) {
  const p = await getProject(project);
  if (!p) return { error: text("project not found", 404) };
  const c = await getCohort(p.id, cohort);
  if (!c) return { error: text("cohort not found", 404) };
  return { cohort: c };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { project, cohort } = await params;
  try {
    const r = await resolve(project, cohort);
    if ("error" in r) return r.error;
    return json(await listCohortMembers(r.cohort.id));
  } catch (e) {
    console.error(e);
    return text("internal error", 500);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { project, cohort } = await params;
  let body: { entity_id?: string };
  try {
    body = await req.json();
  } catch {
    return text("invalid json", 400);
  }
  const entityId = (body.entity_id ?? "").trim();
  if (!entityId) return text("entity_id required", 400);
  try {
    const r = await resolve(project, cohort);
    if ("error" in r) return r.error;
    await addCohortMember(r.cohort.id, entityId);
    return noContent();
  } catch (e) {
    console.error(e);
    return text("could not add member", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { project, cohort } = await params;
  let body: { entity_id?: string };
  try {
    body = await req.json();
  } catch {
    return text("invalid json", 400);
  }
  const entityId = (body.entity_id ?? "").trim();
  if (!entityId) return text("entity_id required", 400);
  try {
    const r = await resolve(project, cohort);
    if ("error" in r) return r.error;
    await removeCohortMember(r.cohort.id, entityId);
    return noContent();
  } catch (e) {
    console.error(e);
    return text("could not remove member", 500);
  }
}
