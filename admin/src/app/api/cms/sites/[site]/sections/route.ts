import { NextRequest, NextResponse } from "next/server";
import {
  getSiteByKey,
  getSection,
  listSections,
  createSection,
  SectionError,
} from "@/lib/cms/admin";
import { requireSiteAccess } from "@/lib/cms/authz";

// Admin sections: list (GET) and create (POST). A site's content structure is
// authored here — owner-or-admin via requireSiteAccess.

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

export async function POST(
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
    let body: {
      key?: string;
      title?: string;
      pageGroup?: string;
      localized?: boolean;
      flatten?: boolean;
      fields?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    if (!body.key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }
    if (await getSection(site.id, body.key)) {
      return NextResponse.json(
        { error: "a section with that key already exists" },
        { status: 409 }
      );
    }
    const section = await createSection(site.id, {
      key: body.key,
      title: body.title || body.key,
      pageGroup: body.pageGroup,
      localized: body.localized,
      flatten: body.flatten,
      fields: (body.fields as never) ?? [],
    });
    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    if (error instanceof SectionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
