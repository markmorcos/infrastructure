import { NextRequest, NextResponse } from "next/server";
import { getSiteByKey, importDict, ImportError } from "@/lib/cms/admin";
import { requireSiteAccess } from "@/lib/cms/authz";

// Admin content import, ported from cms/adminapi.go apiImport. Accepts a full
// {locale: dict} payload, explodes it into per-section objects (erroring on
// unknown locales or top-level keys), and writes both draft and published.

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
    let payload: Record<string, Record<string, unknown>>;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    try {
      await importDict(site, payload);
    } catch (e) {
      if (e instanceof ImportError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }
    return NextResponse.json({ imported: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
