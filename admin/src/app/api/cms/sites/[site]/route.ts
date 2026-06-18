import { NextRequest, NextResponse } from "next/server";
import { deleteSite, getSiteByKey, updateSite } from "@/lib/cms/admin";
import { requireSiteAccess, requireAdmin } from "@/lib/cms/authz";

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
    const site = await getSiteByKey(siteKey);
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
    const site = await getSiteByKey(siteKey);
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    let body: { name?: string; githubRepo?: string; dispatchEvent?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    const updated = await updateSite(
      site.id,
      body.name || site.name,
      body.githubRepo || site.githubRepo,
      body.dispatchEvent || site.dispatchEvent
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
    const site = await getSiteByKey(siteKey);
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
