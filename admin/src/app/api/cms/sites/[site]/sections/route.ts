import { NextRequest, NextResponse } from "next/server";
import { getSiteByKey, listSections } from "@/lib/cms/admin";
import { requireSiteAccess } from "@/lib/cms/authz";

// Admin sections list, ported from cms/adminapi.go apiListSections. Sections are
// code-owned (lib/cms/seed.ts) — read-only over the API, no CRUD.

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
    const sections = await listSections(site.id);
    return NextResponse.json(sections, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
