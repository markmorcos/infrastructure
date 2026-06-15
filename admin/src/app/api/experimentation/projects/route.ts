import { NextRequest } from "next/server";
import { listProjects, provisionProject, validKey } from "@/lib/experimentation/admin";
import { isDuplicateKey, json, text } from "../_http";

// GET  /api/experimentation/projects        list projects
// POST /api/experimentation/projects        create project (auto production env + sdk key)

export async function GET() {
  try {
    return json(await listProjects());
  } catch (e) {
    console.error(e);
    return text("internal error", 500);
  }
}

export async function POST(req: NextRequest) {
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
    const result = await provisionProject(key, name);
    return json(result, 201);
  } catch (e) {
    if (isDuplicateKey(e)) {
      return text("could not create project (key may already exist)", 409);
    }
    console.error(e);
    return text("internal error", 500);
  }
}
