import { NextRequest, NextResponse } from "next/server";
import { deleteSite, getSiteByKey, updateSite } from "@/lib/cms/admin";

// Admin single-site routes, ported from cms/adminapi.go apiGetSite /
// apiUpdateSite / apiDeleteSite. PATCH edits name/githubRepo/dispatchEvent ONLY
// (key/locales/defaultLocale are immutable), matching cms/store.go UpdateSite.

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
    // Empty fields fall back to the current value (cms/adminapi.go apiUpdateSite).
    const name = body.name || site.name;
    const githubRepo = body.githubRepo || site.githubRepo;
    const dispatchEvent = body.dispatchEvent || site.dispatchEvent;
    const updated = await updateSite(site.id, name, githubRepo, dispatchEvent);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
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
