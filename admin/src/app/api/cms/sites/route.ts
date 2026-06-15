import { NextRequest, NextResponse } from "next/server";
import { createSite, listSitesForUser, validKey } from "@/lib/cms/admin";
import { getSessionUser, requireAdmin } from "@/lib/cms/authz";

// Admin sites collection, ported from cms/adminapi.go apiListSites /
// apiCreateSite. The list is scoped to the caller (admins see all, editors see
// only the sites they own); creating a site is admin-only.

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(
      await listSitesForUser(user.role, user.userId),
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if ("error" in admin) return admin.error;
  let body: {
    key?: string;
    name?: string;
    locales?: string[];
    defaultLocale?: string;
    githubRepo?: string;
    dispatchEvent?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.key || !validKey(body.key)) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }
  try {
    const site = await createSite({
      key: body.key,
      name: body.name,
      locales: body.locales,
      defaultLocale: body.defaultLocale,
      githubRepo: body.githubRepo,
      dispatchEvent: body.dispatchEvent,
    });
    return NextResponse.json(site, { status: 201 });
  } catch (error) {
    // Duplicate key etc. — Go returns 409 here.
    console.error(error);
    return NextResponse.json(
      { error: "could not create site" },
      { status: 409 }
    );
  }
}
