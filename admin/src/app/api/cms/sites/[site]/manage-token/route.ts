import { NextRequest, NextResponse } from "next/server";
import { requireSiteAccess, signManageToken } from "@/lib/cms/authz";

// Mints a short-lived, site-scoped token for the practa branding editor.
// Owner-or-admin only. The owner is sent to <key>.practa.co/api/manage with it;
// practa verifies it (service API manage.verify) and lets them edit this one
// site's config. Carries no powers beyond that site's branding.

const BASE_DOMAIN = process.env.PRACTA_BASE_DOMAIN ?? "practa.co";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;

  const token = signManageToken(siteKey);
  const url = `https://${siteKey}.${BASE_DOMAIN}/api/manage?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ token, url }, { status: 200 });
}
