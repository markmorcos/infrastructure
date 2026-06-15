import { NextRequest, NextResponse } from "next/server";
import { getAsset, getSiteByKey } from "@/lib/cms/admin";
import { deleteAsset } from "@/lib/cms/storage";
import { requireSiteAccess } from "@/lib/cms/authz";

// Admin asset delete, ported from cms/adminapi.go apiDeleteAsset. Removes the
// MinIO object (best-effort) then the DB row. Node runtime for the minio SDK.

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ site: string; id: string }> }
) {
  const { site: siteKey, id } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;
  try {
    const site = await getSiteByKey(siteKey);
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    const asset = await getAsset(site.id, id);
    if (!asset) {
      return NextResponse.json({ error: "asset not found" }, { status: 404 });
    }
    await deleteAsset(asset);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
