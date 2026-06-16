import { NextRequest, NextResponse } from "next/server";
import { requireSiteAccess, signPreviewToken } from "@/lib/cms/authz";

// Mints a short-lived, site-scoped preview token for the renderer. Owner-or-admin
// only. The token lets practa read this site's draft content/settings via
// ?draft=1; it carries no admin powers beyond previewing this one site.

const BASE_DOMAIN = process.env.PRACTA_BASE_DOMAIN ?? "practa.co";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;

  const token = signPreviewToken(siteKey);
  const url = `https://${siteKey}.${BASE_DOMAIN}/api/preview?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ token, url }, { status: 200 });
}
