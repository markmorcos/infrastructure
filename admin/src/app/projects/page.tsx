"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Project,
  Runtime,
  Status,
  STATUS_META,
  SORT_KEY,
  REQUIRED_SECRETS,
  computeStatus,
  reqState,
  tokenValid,
  issuesOf,
  ghCount,
  keyCount,
} from "./status";

type Filter = "all" | Status;

export default function FleetPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [runtime, setRuntime] = useState<Record<string, Runtime>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [rotating, setRotating] = useState<Record<string, boolean>>({});

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/admin/projects");
    if (!res.ok) {
      setError("Failed to load projects");
      return;
    }
    setProjects(await res.json());
  }, []);

  const fetchRuntime = useCallback(async () => {
    const res = await fetch("/api/admin/runtime");
    if (res.ok) setRuntime(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([fetchProjects(), fetchRuntime()]).finally(() => setLoading(false));
    const t = setInterval(fetchRuntime, 10000);
    return () => clearInterval(t);
  }, [fetchProjects, fetchRuntime]);

  const decorated = useMemo(
    () => projects.map((p) => ({ p, status: computeStatus(p) })),
    [projects]
  );

  const summary = useMemo(() => {
    const by = (s: Status) => decorated.filter((d) => d.status === s).length;
    const tokensOk = projects.filter((p) => tokenValid(p)).length;
    return {
      total: projects.length,
      healthy: by("healthy"),
      attention: by("attention"),
      dormant: by("dormant"),
      disabled: by("disabled"),
      deployed: projects.filter((p) => p.namespace).length,
      tokensOk,
      keyTotal: projects.reduce((n, p) => n + keyCount(p), 0),
    };
  }, [decorated, projects]);

  const segs = useMemo(
    () =>
      decorated
        .slice()
        .sort((a, b) => SORT_KEY[a.status] - SORT_KEY[b.status])
        .map((d) => STATUS_META[d.status].color),
    [decorated]
  );

  const view_ = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decorated
      .filter((d) => filter === "all" || d.status === filter)
      .filter(
        (d) =>
          !q ||
          d.p.projectName.toLowerCase().includes(q) ||
          (d.p.repo || "").toLowerCase().includes(q) ||
          (d.p.namespace || "").toLowerCase().includes(q)
      )
      .sort(
        (a, b) =>
          SORT_KEY[a.status] - SORT_KEY[b.status] ||
          a.p.projectName.localeCompare(b.p.projectName)
      );
  }, [decorated, filter, query]);

  const rotate = async (name: string) => {
    setRotating((r) => ({ ...r, [name]: true }));
    const res = await fetch(`/api/admin/projects/${encodeURIComponent(name)}/rotate`, {
      method: "POST",
    });
    if (res.ok) await fetchProjects();
    setRotating((r) => ({ ...r, [name]: false }));
  };

  const toggle = async (p: Project) => {
    await fetch(`/api/admin/projects/${encodeURIComponent(p.projectName)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !p.enabled }),
    });
    fetchProjects();
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete project ${name}?`)) return;
    await fetch(`/api/admin/projects/${encodeURIComponent(name)}`, { method: "DELETE" });
    fetchProjects();
  };

  if (loading)
    return (
      <div style={loadingStyle}>
        <span className="cp-spinner" />
        loading fleet…
      </div>
    );

  const statCards: { id: Filter; label: string; icon: string; color: string; value: number }[] = [
    { id: "healthy", label: "healthy", icon: "check_circle", color: "var(--cp-ok)", value: summary.healthy },
    { id: "attention", label: "needs attention", icon: "error", color: "var(--cp-err)", value: summary.attention },
    { id: "dormant", label: "not deployed", icon: "cloud_off", color: "var(--cp-dormant)", value: summary.dormant },
    { id: "all", label: "tokens valid", icon: "verified", color: "var(--md-sys-color-primary)", value: summary.tokensOk },
  ];

  const filters: { id: Filter; label: string; count: number; dot?: string }[] = [
    { id: "all", label: "all", count: summary.total },
    { id: "healthy", label: "healthy", count: summary.healthy, dot: "var(--cp-ok)" },
    { id: "attention", label: "needs attention", count: summary.attention, dot: "var(--cp-err)" },
    { id: "dormant", label: "not deployed", count: summary.dormant, dot: "var(--cp-dormant)" },
    { id: "disabled", label: "disabled", count: summary.disabled, dot: "var(--cp-idle)" },
  ];

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6">
      {error && (
        <div style={{ ...calloutErr, marginBottom: 16 }}>
          <span className="msym" style={{ fontSize: 16 }}>error</span>
          {error}
        </div>
      )}

      {/* FLEET SUMMARY */}
      <div className="mb-[22px] grid grid-cols-2 gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="cp-card col-span-2 md:col-span-1" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "var(--cp-mono)", fontSize: 38, fontWeight: 600, lineHeight: 1 }}>
              {summary.total}
            </span>
            <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
              projects tracked
            </span>
          </div>
          <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", gap: 2, marginTop: 16 }}>
            {segs.map((c, i) => (
              <span key={i} style={{ flex: 1, background: c, borderRadius: 2 }} />
            ))}
          </div>
          <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)", marginTop: 11 }}>
            {summary.deployed} deployed · {summary.keyTotal} secret keys managed
          </div>
        </div>
        {statCards.map((st) => (
          <button
            key={st.label}
            onClick={() => setFilter(st.id)}
            className="cp-card cp-card-hover"
            style={{ padding: 16, textAlign: "left" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="msym fill" style={{ fontSize: 20, color: st.color }}>{st.icon}</span>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />
            </div>
            <div style={{ fontFamily: "var(--cp-mono)", fontSize: 30, fontWeight: 600, marginTop: 14, lineHeight: 1, color: st.color }}>
              {st.value}
            </div>
            <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)", letterSpacing: ".04em", marginTop: 5 }}>
              {st.label}
            </div>
          </button>
        ))}
      </div>

      {/* CONTROLS */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 34,
                padding: "0 13px",
                borderRadius: 9999,
                cursor: "pointer",
                fontFamily: "var(--cp-mono)",
                fontSize: 12,
                border: "1px solid " + (active ? "var(--md-sys-color-primary)" : "var(--md-sys-color-outline-variant)"),
                background: active ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-container-low)",
                color: active ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface-variant)",
              }}
            >
              {f.dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: f.dot }} />}
              {f.label}
              <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, opacity: 0.8 }}>{f.count}</span>
            </button>
          );
        })}
        <div className="hidden flex-1 md:block" />
        <div className="order-1 w-full md:order-none md:w-[300px]" style={searchBox}>
          <span className="msym" style={{ fontSize: 19, color: "var(--md-sys-color-on-surface-variant)" }}>search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search projects, repos, namespaces…"
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--md-sys-color-on-surface)", fontFamily: "var(--cp-mono)", fontSize: 12.5 }}
          />
        </div>
        <div style={{ display: "flex", background: "var(--md-sys-color-surface-container)", border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: 9999, padding: 3 }}>
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                width: 34,
                height: 30,
                borderRadius: 9999,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: view === v ? "var(--md-sys-color-primary)" : "transparent",
                color: view === v ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-on-surface-variant)",
              }}
            >
              <span className="msym" style={{ fontSize: 18 }}>{v === "grid" ? "grid_view" : "view_list"}</span>
            </button>
          ))}
        </div>
      </div>

      {view_.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 0", fontFamily: "var(--cp-mono)", color: "var(--md-sys-color-on-surface-variant)" }}>
          <span className="msym" style={{ fontSize: 40, opacity: 0.5 }}>search_off</span>
          <div style={{ marginTop: 12, fontSize: 13 }}>no projects match this view</div>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
          {view_.map(({ p, status }) => (
            <Card
              key={p.projectName}
              p={p}
              status={status}
              runtime={p.namespace ? runtime[p.namespace] : undefined}
              rotating={!!rotating[p.projectName]}
              onOpen={() => router.push(`/projects/edit/${encodeURIComponent(p.projectName)}`)}
              onRotate={() => rotate(p.projectName)}
              onToggle={() => toggle(p)}
              onDelete={() => remove(p.projectName)}
            />
          ))}
        </div>
      ) : (
        <Table
          rows={view_}
          rotating={rotating}
          onOpen={(n) => router.push(`/projects/edit/${encodeURIComponent(n)}`)}
          onRotate={rotate}
        />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: Status }) {
  return (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: "50%",
        flexShrink: 0,
        background: STATUS_META[status].color,
        animation: status === "healthy" ? "cpPulse 2.6s ease-in-out infinite" : "none",
      }}
    />
  );
}

const RUNTIME_UI: Record<Runtime["status"], { color: string; dim: string; icon: string }> = {
  healthy: { color: "var(--cp-ok)", dim: "var(--cp-ok-dim)", icon: "bolt" },
  progressing: { color: "var(--cp-warn)", dim: "var(--cp-warn-dim)", icon: "pending" },
  degraded: { color: "var(--cp-err)", dim: "var(--cp-err-dim)", icon: "error" },
  down: { color: "var(--cp-err)", dim: "var(--cp-err-dim)", icon: "cancel" },
  none: { color: "var(--cp-dormant)", dim: "var(--cp-dormant-dim)", icon: "cloud_off" },
};

function RuntimeChip({ r }: { r?: Runtime }) {
  if (!r || r.status === "none") return null;
  const ui = RUNTIME_UI[r.status];
  const restarts = r.pods.reduce((n, p) => n + p.restarts, 0);
  const bad = r.pods.find((p) => p.reason);
  const text = bad ? bad.reason : `${r.ready}/${r.desired} ready${restarts ? ` · ${restarts}↻` : ""}`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 10px", borderRadius: 7, background: ui.dim, fontFamily: "var(--cp-mono)", fontSize: 11, color: ui.color }}>
      <span className="msym" style={{ fontSize: 14, animation: r.status === "progressing" ? "cpSpin 1.4s linear infinite" : "none" }}>{ui.icon}</span>
      {text}
    </span>
  );
}

function Card({
  p,
  status,
  runtime,
  rotating,
  onOpen,
  onRotate,
  onToggle,
  onDelete,
}: {
  p: Project;
  status: Status;
  runtime?: Runtime;
  rotating: boolean;
  onOpen: () => void;
  onRotate: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[status];
  const issues = issuesOf(p);
  const valid = tokenValid(p);
  const deployed = !!p.namespace;
  const stop = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div onClick={onOpen} className="cp-card cp-card-hover" style={{ position: "relative", overflow: "hidden" }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: meta.color }} />
      <div style={{ padding: "15px 16px 14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusDot status={status} />
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.projectName}
          </span>
          <Switch on={p.enabled} onClick={(e) => stop(e, onToggle)} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 11, fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", minWidth: 0 }}>
          <span className="msym" style={{ fontSize: 15 }}>commit</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.repo || "no repo"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
          <Chip
            icon={deployed ? "lan" : "cloud_off"}
            text={deployed ? `ns:${p.namespace}` : "not deployed"}
            color={deployed ? undefined : "var(--cp-dormant)"}
          />
          <Chip
            icon={valid ? "verified" : "gpp_bad"}
            text={`sub=${p.jwt?.sub ?? "?"}`}
            color={valid ? "var(--cp-ok)" : "var(--cp-err)"}
            tinted={valid ? "var(--cp-ok-dim)" : "var(--cp-err-dim)"}
          />
          <RuntimeChip r={runtime} />
        </div>
      </div>

      {issues.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 8px 18px", background: "var(--cp-err-dim)", borderTop: "1px solid rgba(255,122,107,.16)" }}>
          <span className="msym" style={{ fontSize: 15, color: "var(--cp-err)" }}>priority_high</span>
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11.5, color: "var(--cp-err)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {issues[0]}
          </span>
          {issues.length > 1 && (
            <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-err)", opacity: 0.7 }}>+{issues.length - 1}</span>
          )}
        </div>
      )}

      <div style={{ padding: "13px 16px 13px 18px", borderTop: "1px solid var(--md-sys-color-outline-variant)" }}>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {REQUIRED_SECRETS.map((n) => {
            const st = reqState(p, n);
            const c =
              st === "ok"
                ? { fg: "var(--cp-ok)", bg: "var(--cp-ok-dim)", bd: "rgba(70,224,160,.22)", icon: "check" }
                : st === "missing"
                ? { fg: "var(--cp-err)", bg: "var(--cp-err-dim)", bd: "rgba(255,122,107,.22)", icon: "close" }
                : { fg: "var(--md-sys-color-on-surface-variant)", bg: "var(--md-sys-color-surface-container)", bd: "var(--md-sys-color-outline-variant)", icon: "remove" };
            return (
              <div
                key={n}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  height: 26,
                  padding: "0 9px",
                  borderRadius: 7,
                  background: c.bg,
                  border: "1px solid " + c.bd,
                }}
              >
                <span className="msym" style={{ fontSize: 14, color: c.fg }}>{c.icon}</span>
                <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: c.fg }}>
                  {n === "INFRASTRUCTURE_PAT" ? "PAT" : "DEPLOY"}
                </span>
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>
            <span title="GitHub secrets" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span className="msym" style={{ fontSize: 14 }}>key</span>
              {ghCount(p)}
            </span>
            <span title="K8s secret keys" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span className="msym" style={{ fontSize: 14 }}>deployed_code</span>
              {keyCount(p)}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 12, gap: 8 }}>
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-outline)", flex: 1 }}>
            upd {new Date(p.updatedAt).toISOString().slice(0, 16).replace("T", " ")}
          </span>
          <button onClick={(e) => stop(e, onRotate)} className="cp-btn-ghost" style={{ height: 30, padding: "0 12px", fontSize: 11 }}>
            <span className="msym" style={{ fontSize: 14, animation: rotating ? "cpSpin 1s linear infinite" : "none" }}>autorenew</span>
            {rotating ? "rotating" : "rotate"}
          </button>
          <button onClick={(e) => stop(e, onDelete)} className="cp-btn-soft" style={{ height: 30, width: 30, padding: 0 }} title="delete">
            <span className="msym" style={{ fontSize: 16 }}>delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Table({
  rows,
  rotating,
  onOpen,
  onRotate,
}: {
  rows: { p: Project; status: Status }[];
  rotating: Record<string, boolean>;
  onOpen: (n: string) => void;
  onRotate: (n: string) => void;
}) {
  const cols = "18px 1.4fr 1.6fr 1fr 1.3fr 90px 110px";
  return (
    <div className="cp-card" style={{ overflow: "hidden" }}>
      <div className="overflow-x-auto">
      <div className="min-w-[760px]">
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 14, padding: "12px 18px", borderBottom: "1px solid var(--md-sys-color-outline-variant)", fontFamily: "var(--cp-mono)", fontSize: 10.5, letterSpacing: ".08em", color: "var(--md-sys-color-on-surface-variant)" }}>
        <span /><span>PROJECT</span><span>REPO</span><span>NAMESPACE</span><span>TOKEN</span><span>SECRETS</span>
        <span style={{ textAlign: "right" }}>ACTIONS</span>
      </div>
      {rows.map(({ p, status }) => {
        const valid = tokenValid(p);
        return (
          <div
            key={p.projectName}
            onClick={() => onOpen(p.projectName)}
            className="cp-row-hover"
            style={{ display: "grid", gridTemplateColumns: cols, gap: 14, padding: "13px 18px", borderBottom: "1px solid var(--md-sys-color-outline-variant)", alignItems: "center", cursor: "pointer" }}
          >
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: STATUS_META[status].color }} />
            <span style={{ fontFamily: "var(--cp-mono)", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.projectName}</span>
            <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.repo || "—"}</span>
            <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: p.namespace ? "var(--md-sys-color-on-surface)" : "var(--cp-dormant)" }}>{p.namespace || "not deployed"}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--cp-mono)", fontSize: 11.5, color: valid ? "var(--cp-ok)" : "var(--cp-err)" }}>
              <span className="msym" style={{ fontSize: 14 }}>{valid ? "verified" : "gpp_bad"}</span>
              sub={p.jwt?.sub ?? "?"}
            </span>
            <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11.5, color: "var(--md-sys-color-on-surface-variant)" }}>{ghCount(p)}gh · {keyCount(p)}k</span>
            <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                onClick={(e) => { e.stopPropagation(); onRotate(p.projectName); }}
                className="cp-btn-ghost"
                style={{ width: 30, height: 30, padding: 0, borderRadius: 8 }}
                title="rotate token"
              >
                <span className="msym" style={{ fontSize: 16, animation: rotating[p.projectName] ? "cpSpin 1s linear infinite" : "none" }}>autorenew</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); onOpen(p.projectName); }} className="cp-btn-soft" style={{ width: 30, height: 30, padding: 0, borderRadius: 8 }} title="edit">
                <span className="msym" style={{ fontSize: 16 }}>edit</span>
              </button>
            </span>
          </div>
        );
      })}
      </div>
      </div>
    </div>
  );
}

function Chip({ icon, text, color, tinted }: { icon: string; text: string; color?: string; tinted?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 26,
        padding: "0 10px",
        borderRadius: 7,
        background: tinted || "var(--md-sys-color-surface-container)",
        border: "1px solid " + (tinted ? "transparent" : "var(--md-sys-color-outline-variant)"),
        fontFamily: "var(--cp-mono)",
        fontSize: 11,
        color: color || "var(--md-sys-color-on-surface)",
      }}
    >
      <span className="msym" style={{ fontSize: 14 }}>{icon}</span>
      {text}
    </span>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      title="toggle deploys"
      style={{
        width: 38,
        height: 22,
        borderRadius: 9999,
        border: "none",
        cursor: "pointer",
        padding: 2,
        flexShrink: 0,
        background: on ? "var(--md-sys-color-primary)" : "var(--md-sys-color-surface-container-highest)",
        transition: "background .18s",
        display: "flex",
        justifyContent: on ? "flex-end" : "flex-start",
        alignItems: "center",
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: on ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-outline)" }} />
    </button>
  );
}

const loadingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "80px 28px",
  fontFamily: "var(--cp-mono)",
  fontSize: 13,
  color: "var(--md-sys-color-on-surface-variant)",
};
const searchBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  height: 38,
  padding: "0 14px",
  borderRadius: 9999,
  background: "var(--md-sys-color-surface-container-high)",
};
const calloutErr: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "11px 14px",
  borderRadius: 12,
  background: "var(--cp-err-dim)",
  border: "1px solid rgba(255,122,107,.22)",
  color: "var(--cp-err)",
  fontFamily: "var(--cp-mono)",
  fontSize: 12.5,
};
