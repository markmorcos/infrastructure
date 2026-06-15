import { NextRequest, NextResponse } from "next/server";
import { uploadsEnabled } from "@/lib/cms/storage";
import { requireSiteAccess } from "@/lib/cms/authz";

// Reports whether S3 uploads are configured, so the assets page can disable the
// upload form with a notice (cms/ui.go uiAssets passes UploadsEnabled to the
// template). Node runtime because the storage module pulls in the minio SDK.

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;
  return NextResponse.json({ uploadsEnabled: uploadsEnabled() }, { status: 200 });
}
