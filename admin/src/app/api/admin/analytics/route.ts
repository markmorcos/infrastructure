import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/cms/authz";
import { summarize, clampDays } from "@/lib/analytics-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only analytics summary for the global dashboard. Optional ?site=<key> to
// drill into one tenant; otherwise all tenants combined. ?days=N (default 30).
export async function GET(req: NextRequest) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const site = url.searchParams.get("site");
  const days = clampDays(url.searchParams.get("days"));

  try {
    const [summary, sites] = await Promise.all([
      summarize(site, days),
      pool.query(
        `SELECT site_key, count(*)::int AS pageviews
           FROM analytics_events
          WHERE ts >= now() - ($1 || ' days')::interval AND name = 'pageview'
          GROUP BY site_key ORDER BY pageviews DESC`,
        [days]
      ),
    ]);
    return NextResponse.json({ site: site || null, days, ...summary, sites: sites.rows });
  } catch (e) {
    console.error("analytics query failed", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
