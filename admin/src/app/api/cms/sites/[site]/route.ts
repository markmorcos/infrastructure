import { NextRequest, NextResponse } from "next/server";
import {
  deleteSite,
  getSiteByKey,
  getProjectByKey,
  isUniqueViolation,
  setSiteProject,
  updateSite,
} from "@/lib/cms/admin";
import { requireSiteAccess, requireAdmin } from "@/lib/cms/authz";

// projectIdFromQuery resolves an optional ?project=<key> into a project id (or
// null for the global namespace) so single-site console routes can scope their
// lookups. Absent query => null (global), which getSiteByKey's transitional
// fallback widens to a global key lookup.
async function projectIdFromQuery(req: NextRequest): Promise<string | null> {
  const key = req.nextUrl.searchParams.get("project");
  if (!key) return null;
  const project = await getProjectByKey(key);
  return project?.id ?? null;
}

// Admin single-site routes, ported from cms/adminapi.go apiGetSite /
// apiUpdateSite / apiDeleteSite. PATCH edits name/githubRepo/dispatchEvent (all
// admin-only); key/locales/defaultLocale are immutable. Per-site presentation
// config (brandColor/cal.com/contactEmail) now lives in practa, not the CMS.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;
  try {
    const projectId = await projectIdFromQuery(req);
    const site = await getSiteByKey(siteKey, { projectId });
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    return NextResponse.json(site, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  // Only the infra fields (name/repo/dispatch) remain editable here, and those
  // are admin-only.
  const admin = requireAdmin(req);
  if ("error" in admin) return admin.error;
  try {
    const projectId = await projectIdFromQuery(req);
    const site = await getSiteByKey(siteKey, { projectId });
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    let body: {
      name?: string;
      githubRepo?: string;
      dispatchEvent?: string;
      // Move/reassign: present (string id) moves the site to that project;
      // explicit null unassigns it (global namespace). Omitted = unchanged.
      projectId?: string | null;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    // Move/reassign is its own operation: when the body carries projectId,
    // update only the project (key uniqueness is scoped per project, so this can
    // collide — map that 23505 to a clear 409 instead of a 500).
    if (Object.prototype.hasOwnProperty.call(body, "projectId")) {
      try {
        const moved = await setSiteProject(site.id, body.projectId ?? null);
        return NextResponse.json(moved, { status: 200 });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return NextResponse.json(
            {
              error: `another site with key "${site.key}" already exists in the target project`,
            },
            { status: 409 }
          );
        }
        throw error;
      }
    }
    // Use ?? (not ||) for repo/dispatch so an explicit "" clears them — that's
    // how a site is turned into a Studio site (render-live, no GitHub deploy).
    const updated = await updateSite(
      site.id,
      body.name || site.name,
      body.githubRepo ?? site.githubRepo,
      body.dispatchEvent ?? site.dispatchEvent
    );
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  // Deleting a site is admin-only, even for the owner.
  const admin = requireAdmin(req);
  if ("error" in admin) return admin.error;
  try {
    const projectId = await projectIdFromQuery(req);
    const site = await getSiteByKey(siteKey, { projectId });
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    await deleteSite(site.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
