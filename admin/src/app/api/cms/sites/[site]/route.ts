import { NextRequest, NextResponse } from "next/server";
import { deleteSite, getSiteByKey, updateSite, updateSiteSettings } from "@/lib/cms/admin";
import { requireSiteAccess, requireAdmin } from "@/lib/cms/authz";

// Admin single-site routes, ported from cms/adminapi.go apiGetSite /
// apiUpdateSite / apiDeleteSite. PATCH edits name/githubRepo/dispatchEvent and
// shallow-merges an optional `settings` patch (contactEmail, brandColor, …);
// key/locales/defaultLocale are immutable.

// Settings keys a site owner (non-admin) may edit. Anything else in a settings
// patch from a non-admin is dropped (admins may set any key).
const OWNER_SETTINGS = ["contactEmail", "brandColor"] as const;

function pickKeys(
  obj: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

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
  // Owner-or-admin: infra fields (name/repo/dispatch) stay admin-only below, but
  // a site's owner may edit their own presentation settings.
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;
  const isAdminUser = access.user.role === "admin";
  try {
    const site = await getSiteByKey(siteKey);
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    let body: {
      name?: string;
      githubRepo?: string;
      dispatchEvent?: string;
      settings?: Record<string, unknown>;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    let updated = site;
    // Infra fields are admin-only; empty values fall back to the current value.
    if (isAdminUser) {
      updated = await updateSite(
        site.id,
        body.name || site.name,
        body.githubRepo || site.githubRepo,
        body.dispatchEvent || site.dispatchEvent
      );
    }
    // Shallow-merge per-site settings. Admins may set any key; owners are limited
    // to presentation settings they're allowed to manage.
    if (
      body.settings &&
      typeof body.settings === "object" &&
      !Array.isArray(body.settings)
    ) {
      const patch = isAdminUser
        ? body.settings
        : pickKeys(body.settings, OWNER_SETTINGS);
      if (Object.keys(patch).length > 0) {
        updated = await updateSiteSettings(site.id, patch);
      }
    }
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
