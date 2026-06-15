import { NextResponse } from "next/server";
import { uploadsEnabled } from "@/lib/cms/storage";

// Reports whether S3 uploads are configured, so the assets page can disable the
// upload form with a notice (cms/ui.go uiAssets passes UploadsEnabled to the
// template). Node runtime because the storage module pulls in the minio SDK.

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ uploadsEnabled: uploadsEnabled() }, { status: 200 });
}
