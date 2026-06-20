import { NextRequest, NextResponse } from "next/server";
import {
  createProject,
  isUniqueViolation,
  listProjects,
  slugify,
  validKey,
} from "@/lib/cms/admin";
import { getSessionUser, requireAdmin } from "@/lib/cms/authz";

// CMS projects collection. Projects optionally scope site-key uniqueness
// (011-cms-projects.sql). Listing is available to any console session (so the
// create-site form can populate its project selector); creating is admin-only.

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await listProjects(), { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if ("error" in admin) return admin.error;
  let body: { key?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  // Accept an explicit key, else auto-slug from the name. Validate against the
  // same key rules as sites.
  const key = (body.key?.trim() || slugify(name)).trim();
  if (!key || !validKey(key)) {
    return NextResponse.json({ error: "invalid project key" }, { status: 400 });
  }
  try {
    const project = await createProject({ key, name: name || key });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: `a project with key "${key}" already exists` },
        { status: 409 }
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "could not create project" },
      { status: 500 }
    );
  }
}
