import { pool } from "@/lib/db";

// Shared on-read aggregation over analytics_events. Used by both the admin global
// dashboard (/api/admin/analytics) and the per-tenant, token-authed stats API
// (/api/analytics/stats) so the two return identical shapes.

export interface AnalyticsSummary {
  kpis: { pageviews: number; visitors: number };
  timeseries: { day: string; pageviews: number; visitors: number }[];
  topPages: { path: string; pageviews: number; visitors: number }[];
  topReferrers: { referrer_host: string; visitors: number }[];
  topCountries: { country: string; visitors: number }[];
  // Tenant-meaningful conversion: distinct visitors who submitted the contact
  // form. (The practa business funnel — signup/publish/paid — is admin-only and
  // lives in the admin route, not here, so it's never exposed to tenants.)
  enquiries: number;
}

// summarize aggregates events for an optional site (null = all tenants) over a
// trailing day window.
export async function summarize(site: string | null, days: number): Promise<AnalyticsSummary> {
  const params = [days, site];
  const scope = "ts >= now() - ($1 || ' days')::interval AND ($2::text IS NULL OR site_key = $2)";
  const pv = `${scope} AND name = 'pageview'`;

  const [kpis, series, pages, referrers, countries, enquiries] = await Promise.all([
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
      // Hide internal/debug paths (/__*) from Top Pages.
      `SELECT path, count(*)::int AS pageviews, count(DISTINCT visitor_id)::int AS visitors
         FROM analytics_events WHERE ${pv} AND path NOT LIKE '/__%'
        GROUP BY path ORDER BY pageviews DESC LIMIT 10`,
      params
    ),
    pool.query(
      `SELECT referrer_host, count(DISTINCT visitor_id)::int AS visitors
         FROM analytics_events WHERE ${pv} AND referrer_host IS NOT NULL
        GROUP BY referrer_host ORDER BY visitors DESC LIMIT 10`,
      params
    ),
    pool.query(
      `SELECT country, count(DISTINCT visitor_id)::int AS visitors
         FROM analytics_events WHERE ${pv} AND country IS NOT NULL
        GROUP BY country ORDER BY visitors DESC LIMIT 10`,
      params
    ),
    pool.query(
      `SELECT count(DISTINCT visitor_id)::int AS n
         FROM analytics_events WHERE ${scope} AND name = 'enquiry'`,
      params
    ),
  ]);

  return {
    kpis: kpis.rows[0] ?? { pageviews: 0, visitors: 0 },
    timeseries: series.rows,
    topPages: pages.rows,
    topReferrers: referrers.rows,
    topCountries: countries.rows,
    enquiries: enquiries.rows[0]?.n ?? 0,
  };
}

// businessFunnel is the PRACTA-level tenant lifecycle (signup→publish→paid),
// counted as distinct sites. Admin-only — never returned to a tenant.
export async function businessFunnel(days: number): Promise<{ signup: number; publish: number; paid: number }> {
  const { rows } = await pool.query(
    `SELECT name, count(DISTINCT visitor_id)::int AS sites
       FROM analytics_events
      WHERE ts >= now() - ($1 || ' days')::interval AND name IN ('signup','publish','paid')
      GROUP BY name`,
    [days]
  );
  const m = Object.fromEntries(rows.map((r) => [r.name, r.sites]));
  return { signup: m.signup ?? 0, publish: m.publish ?? 0, paid: m.paid ?? 0 };
}

// clampDays parses + bounds the ?days window (1..365, default 30).
export function clampDays(raw: string | null): number {
  return Math.min(Math.max(parseInt(raw || "30", 10) || 30, 1), 365);
}
