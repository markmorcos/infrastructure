import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyToken, bearer } from "@/lib/cms/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// First-party analytics ingest. Called server-to-server by the practa renderer's
// collector with the tenant's API token (same token used for the CMS API). The
// site is taken from the token, never the body. The renderer enriches the event
// at the edge (visitor_id = daily-salted hash, UA fields) so no raw IP ever
// reaches here. One row per pageview / funnel event.

const s = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

export async function POST(req: NextRequest) {
  const tenant = await verifyToken(bearer(req.headers.get("authorization")));
  if (!tenant) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const name = s(body.name, 64);
  const visitorId = s(body.visitorId ?? body.visitor_id, 64);
  if (!name || !visitorId) {
    return NextResponse.json({ error: "name and visitorId required" }, { status: 422 });
  }

  const props = body.props && typeof body.props === "object" ? body.props : null;

  try {
    await pool.query(
      `INSERT INTO analytics_events
         (site_key, name, path, referrer_host, utm_source, utm_medium, utm_campaign,
          country, browser, os, device, visitor_id, props)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        tenant,
        name,
        s(body.path, 1024) ?? "/",
        s(body.referrer ?? body.referrer_host, 255),
        s(body.utmSource ?? body.utm_source, 128),
        s(body.utmMedium ?? body.utm_medium, 128),
        s(body.utmCampaign ?? body.utm_campaign, 128),
        s(body.country, 2),
        s(body.browser, 64),
        s(body.os, 64),
        s(body.device, 16),
        visitorId,
        props ? JSON.stringify(props) : null,
      ]
    );
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("analytics ingest failed", e);
    return NextResponse.json({ error: "ingest failed" }, { status: 500 });
  }
}
