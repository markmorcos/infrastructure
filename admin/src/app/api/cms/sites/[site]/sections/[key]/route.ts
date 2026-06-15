import { NextRequest, NextResponse } from "next/server";
import {
  getSiteByKey,
  getSection,
  updateSection,
  deleteSection,
  SectionError,
} from "@/lib/cms/admin";
import { requireSiteAccess } from "@/lib/cms/authz";

// One section's schema: read (GET), edit (PATCH), remove (DELETE). The section
// key is immutable (it keys stored content). Owner-or-admin via requireSiteAccess.

async function resolve(siteKey: string, sectionKey: string) {
  const site = await getSiteByKey(siteKey);
  if (!site) return { error: NextResponse.json({ error: "site not found" }, { status: 404 }) };
  const section = await getSection(site.id, sectionKey);
  if (!section)
    return { error: NextResponse.json({ error: "section not found" }, { status: 404 }) };
  return { site, section };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ site: string; key: string }> }
) {
  const { site: siteKey, key } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;
  const r = await resolve(siteKey, key);
  if ("error" in r) return r.error;
  return NextResponse.json(r.section, { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ site: string; key: string }> }
) {
  const { site: siteKey, key } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;
  const r = await resolve(siteKey, key);
  if ("error" in r) return r.error;

  let body: {
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
  try {
    const section = await updateSection(r.section.id, {
      title: body.title || r.section.title,
      pageGroup: body.pageGroup,
      localized: body.localized,
      flatten: body.flatten,
      fields: (body.fields as never) ?? [],
    });
    return NextResponse.json(section, { status: 200 });
  } catch (error) {
    if (error instanceof SectionError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ site: string; key: string }> }
) {
  const { site: siteKey, key } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;
  const r = await resolve(siteKey, key);
  if ("error" in r) return r.error;
  try {
    await deleteSection(r.section.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
