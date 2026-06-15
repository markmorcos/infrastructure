import { NextRequest, NextResponse } from "next/server";
import {
  dirtySections,
  getSiteByKey,
  lastPublishedAt,
  listSections,
} from "@/lib/cms/admin";

// Dashboard status, supporting the /cms/[site] view (cms/ui.go uiSite computes
// the same dirty map + last-published label server-side). Returns the site, its
// sections, the dirty (draft != published) flags keyed sectionID -> locale, and
// the last publish time. Admin-only via middleware (under /api/cms, not v1).

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  try {
    const site = await getSiteByKey(siteKey);
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    const [sections, dirty, lastPublished] = await Promise.all([
      listSections(site.id),
      dirtySections(site.id),
      lastPublishedAt(site.id),
    ]);
    return NextResponse.json(
      { site, sections, dirty, lastPublished },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
