import { NextRequest } from "next/server";
import {
  getProject,
  getFeature,
  updateFeature,
  deleteFeature,
} from "@/lib/experimentation/admin";
import { json, noContent, text } from "../../../../_http";

type Ctx = { params: Promise<{ project: string; feature: string }> };

// PATCH  edit description + default
// DELETE delete feature

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { project, feature } = await params;
  let body: { description?: string; default?: unknown };
  try {
    body = await req.json();
  } catch {
    return text("invalid json", 400);
  }
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const f = await getFeature(p.id, feature);
    if (!f) return text("feature not found", 404);
    const def = body.default === undefined ? f.default : body.default;
    const description = (body.description ?? "").trim();
    await updateFeature(f.id, description, def);
    return json({ ...f, description, default: def });
  } catch (e) {
    console.error(e);
    return text("could not update feature", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { project, feature } = await params;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const f = await getFeature(p.id, feature);
    if (!f) return text("feature not found", 404);
    await deleteFeature(f.id);
    return noContent();
  } catch (e) {
    console.error(e);
    return text("could not delete feature", 500);
  }
}
