import { NextRequest } from "next/server";
import {
  getProject,
  listCohorts,
  createCohort,
  validKey,
} from "@/lib/experimentation/admin";
import { isDuplicateKey, json, text } from "../../../_http";

type Ctx = { params: Promise<{ project: string }> };

// GET  list cohorts
// POST create cohort

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { project } = await params;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    return json(await listCohorts(p.id));
  } catch (e) {
    console.error(e);
    return text("internal error", 500);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { project } = await params;
  let body: { key?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return text("invalid json", 400);
  }
  const key = (body.key ?? "").trim();
  if (!validKey(key)) {
    return text("valid key required (a-z0-9_-)", 400);
  }
  const name = (body.name ?? "").trim() || key;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const c = await createCohort(p.id, key, name);
    return json(c, 201);
  } catch (e) {
    if (isDuplicateKey(e)) {
      return text("could not create cohort (key may already exist)", 409);
    }
    console.error(e);
    return text("internal error", 500);
  }
}
