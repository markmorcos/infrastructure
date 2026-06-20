"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Select, Spinner, Callout } from "@/components/ui";

interface Summary {
  site: string | null;
  days: number;
  kpis: { pageviews: number; visitors: number };
  timeseries: { day: string; pageviews: number; visitors: number }[];
  topPages: { path: string; pageviews: number; visitors: number }[];
  topReferrers: { referrer_host: string; visitors: number }[];
  topCountries: { country: string; visitors: number }[];
  funnel: { signup: number; publish: number; paid: number };
  sites: { site_key: string; pageviews: number }[];
}

const nf = (n: number) => new Intl.NumberFormat().format(n);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
// ISO alpha-2 → flag emoji (regional indicators).
const flag = (cc: string) => cc.length === 2 ? cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0))) : "";

const label: React.CSSProperties = {
  fontFamily: "var(--cp-mono)", fontSize: 11, letterSpacing: ".1em",
  color: "var(--md-sys-color-on-surface-variant)",
};

export default function AnalyticsPage() {
  const [site, setSite] = useState<string>("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams({ days: String(days) });
      if (site) qs.set("site", site);
      const res = await fetch(`/api/admin/analytics?${qs}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "failed to load");
      setData(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }, [site, days]);
  useEffect(() => { load(); }, [load]);

  const maxPv = data ? Math.max(1, ...data.timeseries.map((d) => d.pageviews)) : 1;

  return (
    <div className="px-[14px] py-5 md:px-7 md:py-7" style={{ maxWidth: 1000 }}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select value={site} onChange={(e) => setSite(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">All tenants</option>
          {data?.sites.map((s) => (
            <option key={s.site_key} value={s.site_key}>{s.site_key} ({nf(s.pageviews)})</option>
          ))}
        </Select>
        <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} style={{ maxWidth: 140 }}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
        {loading && <Spinner />}
      </div>

      {err && <Callout tone="err" icon="error">{err}</Callout>}

      {data && (
        <div className="flex flex-col gap-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Visitors" value={nf(data.kpis.visitors)} />
            <Kpi label="Pageviews" value={nf(data.kpis.pageviews)} />
            <Kpi label="Views / visitor" value={data.kpis.visitors ? (data.kpis.pageviews / data.kpis.visitors).toFixed(1) : "0"} />
            <Kpi label="Tenants" value={nf(data.sites.length)} />
          </div>

          {/* Timeseries */}
          <Card>
            <div style={label} className="mb-3">{`// PAGEVIEWS`}</div>
            {data.timeseries.length === 0 ? (
              <Empty />
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120, overflow: "hidden" }}>
                {data.timeseries.map((d) => (
                  <div key={d.day} title={`${d.day}: ${d.pageviews} views, ${d.visitors} visitors`}
                    style={{
                      flex: 1, minWidth: 0,
                      height: `${Math.max(2, (d.pageviews / maxPv) * 100)}%`,
                      background: "var(--md-sys-color-primary)", borderRadius: "3px 3px 0 0", opacity: 0.85,
                    }} />
                ))}
              </div>
            )}
          </Card>

          {/* Funnel */}
          <Card>
            <div style={label} className="mb-3">{`// FUNNEL — signup → publish → paid`}</div>
            <div className="grid grid-cols-3 gap-3">
              <Funnel step="Signup" value={data.funnel.signup} base={data.funnel.signup} />
              <Funnel step="Publish" value={data.funnel.publish} base={data.funnel.signup} />
              <Funnel step="Paid" value={data.funnel.paid} base={data.funnel.signup} />
            </div>
          </Card>

          {/* Tables */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <TopTable title="TOP PAGES" rows={data.topPages.map((p) => ({ k: p.path, v: p.pageviews }))} unit="views" />
            <TopTable title="TOP REFERRERS" rows={data.topReferrers.map((r) => ({ k: r.referrer_host, v: r.visitors }))} unit="visitors" empty="Direct / none" />
            <TopTable title="TOP COUNTRIES" rows={data.topCountries.map((c) => ({ k: `${flag(c.country)} ${c.country}`, v: c.visitors }))} unit="visitors" empty="No country data yet" />
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label: l, value }: { label: string; value: string }) {
  return (
    <Card>
      <div style={label}>{l.toUpperCase()}</div>
      <div style={{ fontSize: 28, fontWeight: 500, marginTop: 6 }}>{value}</div>
    </Card>
  );
}

function Funnel({ step, value, base }: { step: string; value: number; base: number }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>{step}</div>
      <div style={{ fontSize: 24, fontWeight: 500, marginTop: 2 }}>{nf(value)}</div>
      <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>
        {base > 0 ? `${pct(value, base)}% of signups` : "—"}
      </div>
    </div>
  );
}

function TopTable({ title, rows, unit, empty }: { title: string; rows: { k: string; v: number }[]; unit: string; empty?: string }) {
  return (
    <Card>
      <div style={label} className="mb-3">{`// ${title}`}</div>
      {rows.length === 0 ? (
        <Empty text={empty} />
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center gap-3" style={{ fontSize: 13.5 }}>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.k}</span>
              <span style={{ fontFamily: "var(--cp-mono)", color: "var(--md-sys-color-on-surface-variant)" }}>{nf(r.v)} {unit}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Empty({ text = "No data yet" }: { text?: string }) {
  return <div style={{ fontFamily: "var(--cp-mono)", fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>{text}</div>;
}
