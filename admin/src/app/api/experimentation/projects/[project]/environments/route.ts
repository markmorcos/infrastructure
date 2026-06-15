import { NextRequest } from "next/server";
import {
  getProject,
  provisionEnvironment,
  validKey,
} from "@/lib/experimentation/admin";
import { isDuplicateKey, json, text } from "../../../_http";

type Ctx = { params: Promise<{ project: string }> };

// POST create environment (+ sdk key)

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
    return text("key must match [a-z0-9_-]", 400);
  }
  const name = (body.name ?? "").trim() || key;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const result = await provisionEnvironment(p.id, key, name);
    return json(result, 201);
  } catch (e) {
    if (isDuplicateKey(e)) {
      return text("could not create environment (key may already exist)", 409);
    }
    console.error(e);
    return text("internal error", 500);
  }
}
