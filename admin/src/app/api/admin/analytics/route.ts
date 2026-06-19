import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/cms/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only analytics summary for the global dashboard. Aggregates raw events on
// read (fast at our scale). Optional ?site=<key> to drill into one tenant;
// otherwise all tenants combined. ?days=N (default 30) sets the window.
export async function GET(req: NextRequest) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const url = new URL(req.url);
  const site = url.searchParams.get("site");
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10) || 30, 1), 365);

  // $1 = days window, $2 = site filter (null = all tenants)
  const params = [days, site];
  const scope = "ts >= now() - ($1 || ' days')::interval AND ($2::text IS NULL OR site_key = $2)";
  const pv = `${scope} AND name = 'pageview'`;

  try {
    const [kpis, series, pages, referrers, funnel, sites] = await Promise.all([
      pool.query(
        `SELECT count(*)::int AS pageviews, count(DISTINCT visitor_id)::int AS visitors
           FROM analytics_events WHERE ${pv}`,
        params
      ),
      pool.query(
        `SELECT to_char(date_trunc('day', ts), 'YYYY-MM-DD') AS day,
                count(*)::int AS pageviews,
                count(DISTINCT visitor_id)::int AS visitors
           FROM analytics_events WHERE ${pv}
          GROUP BY 1 ORDER BY 1`,
        params
      ),
      pool.query(
        `SELECT path,
                count(*)::int AS pageviews,
                count(DISTINCT visitor_id)::int AS visitors
           FROM analytics_events WHERE ${pv}
          GROUP BY path ORDER BY pageviews DESC LIMIT 10`,
        params
      ),
      pool.query(
        `SELECT referrer_host,
                count(DISTINCT visitor_id)::int AS visitors
           FROM analytics_events WHERE ${pv} AND referrer_host IS NOT NULL
          GROUP BY referrer_host ORDER BY visitors DESC LIMIT 10`,
        params
      ),
      pool.query(
        `SELECT name, count(DISTINCT visitor_id)::int AS visitors
           FROM analytics_events
          WHERE ${scope} AND name IN ('signup','publish','paid')
          GROUP BY name`,
        params
      ),
      pool.query(
        `SELECT site_key, count(*)::int AS pageviews
           FROM analytics_events
          WHERE ts >= now() - ($1 || ' days')::interval AND name = 'pageview'
          GROUP BY site_key ORDER BY pageviews DESC`,
        [days]
      ),
    ]);

    const funnelMap = Object.fromEntries(funnel.rows.map((r) => [r.name, r.visitors]));

    return NextResponse.json({
      site: site || null,
      days,
      kpis: kpis.rows[0] ?? { pageviews: 0, visitors: 0 },
      timeseries: series.rows,
      topPages: pages.rows,
      topReferrers: referrers.rows,
      funnel: {
        signup: funnelMap.signup ?? 0,
        publish: funnelMap.publish ?? 0,
        paid: funnelMap.paid ?? 0,
      },
      sites: sites.rows,
    });
  } catch (e) {
    console.error("analytics query failed", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
