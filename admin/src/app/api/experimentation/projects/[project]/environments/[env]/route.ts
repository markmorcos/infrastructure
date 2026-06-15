import { NextRequest } from "next/server";
import {
  getProject,
  getEnvironment,
  renameEnvironment,
  deleteEnvironment,
} from "@/lib/experimentation/admin";
import { json, noContent, text } from "../../../../_http";

type Ctx = { params: Promise<{ project: string; env: string }> };

// PATCH  rename environment
// DELETE delete environment (clears events)

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { project, env } = await params;
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return text("invalid json", 400);
  }
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const e = await getEnvironment(p.id, env);
    if (!e) return text("environment not found", 404);
    const name = (body.name ?? "").trim() || e.key;
    await renameEnvironment(e.id, name);
    return json({ ...e, name });
  } catch (e) {
    console.error(e);
    return text("could not update environment", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { project, env } = await params;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const e = await getEnvironment(p.id, env);
    if (!e) return text("environment not found", 404);
    await deleteEnvironment(e.id);
    return noContent();
  } catch (e) {
    console.error(e);
    return text("could not delete environment", 500);
  }
}
