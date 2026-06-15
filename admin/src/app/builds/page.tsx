"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonClass, Card, Spinner, Callout } from "@/components/ui";

interface DeployRun {
  id: number;
  project: string;
  title: string;
  event: string;
  status: string;
  conclusion: string | null;
  runNumber: number;
  createdAt: string;
  updatedAt: string;
  url: string;
}
interface RunJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  url: string;
  startedAt: string | null;
  completedAt: string | null;
}

type Filter = "all" | "running" | "failed" | "success";

function runUi(status: string, conclusion: string | null) {
  if (status === "pending" || status === "waiting")
    return { label: "pending", color: "var(--cp-idle)", icon: "schedule", spin: false };
  if (status !== "completed")
    return { label: status === "queued" ? "queued" : "running", color: "var(--cp-warn)", icon: "progress_activity", spin: true };
  switch (conclusion) {
    case "success":
      return { label: "success", color: "var(--cp-ok)", icon: "check_circle", spin: false };
    case "failure":
      return { label: "failed", color: "var(--cp-err)", icon: "cancel", spin: false };
    case "cancelled":
      return { label: "cancelled", color: "var(--cp-idle)", icon: "do_not_disturb_on", spin: false };
    case "skipped":
      return { label: "skipped", color: "var(--cp-idle)", icon: "remove_circle", spin: false };
    default:
      return { label: conclusion || "done", color: "var(--cp-dormant)", icon: "help", spin: false };
  }
}

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function dur(a: string, b: string): string {
  const s = Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

export default function BuildsPage() {
  const [runs, setRuns] = useState<DeployRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Record<number, RunJob[]>>({});
  const [busy, setBusy] = useState<Record<number, boolean>>({});

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/builds");
      if (!res.ok) throw new Error("Failed to load builds");
      const d = await res.json();
      setRuns(d.runs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const fetchJobs = useCallback(async (id: number) => {
    const res = await fetch(`/api/admin/builds/${id}`);
    if (res.ok) {
      const d = await res.json();
      setJobs((j) => ({ ...j, [id]: d.jobs }));
    }
  }, []);

  // Latest open run id, read inside the SSE handler without re-subscribing.
  const openRef = useRef<number | null>(null);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    fetchRuns().finally(() => setLoading(false));
    // Live updates via SSE (GitHub webhooks). Each event refreshes the runs
    // list and, if a run is expanded, its jobs too (so an in-flight job like
    // "merge" updates without re-opening). A slow 60s poll backstops dropped
    // webhooks. Event data is "changed" or "changed:<runId>".
    const es = new EventSource("/api/admin/builds/stream");
    es.onmessage = (e) => {
      if (!e.data.startsWith("changed")) return;
      fetchRuns();
      const openId = openRef.current;
      if (openId != null) {
        const changedId = Number(e.data.split(":")[1]);
        if (!changedId || changedId === openId) fetchJobs(openId);
      }
    };
    const backstop = setInterval(() => {
      fetchRuns();
      if (openRef.current != null) fetchJobs(openRef.current);
    }, 60000);
    return () => {
      es.close();
      clearInterval(backstop);
    };
  }, [fetchRuns, fetchJobs]);

  const summary = useMemo(() => {
    const running = runs.filter((r) => r.status !== "completed").length;
    const failed = runs.filter((r) => r.status === "completed" && r.conclusion === "failure").length;
    const success = runs.filter((r) => r.status === "completed" && r.conclusion === "success").length;
    return { running, failed, success };
  }, [runs]);

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter((r) => {
      if (filter === "running" && r.status === "completed") return false;
      if (filter === "failed" && !(r.status === "completed" && r.conclusion === "failure")) return false;
      if (filter === "success" && !(r.status === "completed" && r.conclusion === "success")) return false;
      if (q && !r.project.toLowerCase().includes(q) && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [runs, filter, query]);

  const toggle = async (id: number) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    if (!jobs[id]) await fetchJobs(id);
  };

  const rerun = async (id: number, mode: "failed" | "all") => {
    setBusy((b) => ({ ...b, [id]: true }));
    await fetch(`/api/admin/builds/${id}/rerun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    setTimeout(() => {
      fetchRuns();
      setBusy((b) => ({ ...b, [id]: false }));
    }, 1500);
  };

  if (loading)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "80px 28px", fontFamily: "var(--cp-mono)", color: "var(--md-sys-color-on-surface-variant)" }}>
        <Spinner />
        loading builds…
      </div>
    );

  const filters: { id: Filter; label: string; count: number; dot?: string }[] = [
    { id: "all", label: "all", count: runs.length },
    { id: "running", label: "running", count: summary.running, dot: "var(--cp-warn)" },
    { id: "failed", label: "failed", count: summary.failed, dot: "var(--cp-err)" },
    { id: "success", label: "success", count: summary.success, dot: "var(--cp-ok)" },
  ];

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6">
      {error && (
        <Callout icon="error" className="mb-4 border-0">{error}</Callout>
      )}

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
              <span style={{ opacity: 0.8 }}>{f.count}</span>
            </button>
          );
        })}
        <div className="hidden flex-1 md:block" />
        <div className="order-1 flex h-[38px] w-full items-center gap-[10px] rounded-full px-[14px] md:order-none md:w-[280px]" style={{ background: "var(--md-sys-color-surface-container-high)" }}>
          <span className="msym" style={{ fontSize: 19, color: "var(--md-sys-color-on-surface-variant)" }}>search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search project…" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: "var(--md-sys-color-on-surface)", fontFamily: "var(--cp-mono)", fontSize: 12.5 }} />
        </div>
      </div>

      {view.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 0", fontFamily: "var(--cp-mono)", color: "var(--md-sys-color-on-surface-variant)" }}>
          <span className="msym" style={{ fontSize: 40, opacity: 0.5 }}>history</span>
          <div style={{ marginTop: 12, fontSize: 13 }}>no runs match this view</div>
        </div>
      ) : (
        <Card pad={false} style={{ overflow: "hidden" }}>
          <div className="overflow-x-auto">
          <div className="min-w-[660px]">
          {view.map((r) => {
            const ui = runUi(r.status, r.conclusion);
            const isOpen = open === r.id;
            const failed = r.status === "completed" && r.conclusion === "failure";
            return (
              <div key={r.id} style={{ borderBottom: "1px solid var(--md-sys-color-outline-variant)" }}>
                <div className="cp-row-hover" onClick={() => toggle(r.id)} style={{ display: "grid", gridTemplateColumns: "20px 1.3fr 0.8fr 1fr 0.7fr 150px", gap: 14, padding: "13px 18px", alignItems: "center", cursor: "pointer" }}>
                  <span className="msym" style={{ fontSize: 18, color: ui.color, animation: ui.spin ? "cpSpin 1s linear infinite" : "none" }}>{ui.icon}</span>
                  <span style={{ fontFamily: "var(--cp-mono)", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.project || "—"}</span>
                  <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11.5, color: ui.color }}>{ui.label}</span>
                  <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>#{r.runNumber} · {r.event}</span>
                  <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-outline)" }}>{r.status === "completed" ? dur(r.createdAt, r.updatedAt) : ago(r.createdAt)}</span>
                  <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {failed && (
                      <Button variant="ghost" onClick={(e) => { e.stopPropagation(); rerun(r.id, "failed"); }} className="h-[28px]! px-[10px]! text-[11px]!">
                        <span className="msym" style={{ fontSize: 14, animation: busy[r.id] ? "cpSpin 1s linear infinite" : "none" }}>replay</span>re-run
                      </Button>
                    )}
                    <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={buttonClass("soft", "md", "w-[28px] h-[28px]! !px-0")} title="open on GitHub">
                      <span className="msym" style={{ fontSize: 15 }}>open_in_new</span>
                    </a>
                  </span>
                </div>
                {isOpen && (
                  <div style={{ padding: "4px 18px 16px 52px", background: "var(--md-sys-color-surface-container-lowest)" }}>
                    {!jobs[r.id] ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
                        <Spinner className="w-[14px] h-[14px]" />loading jobs…
                      </div>
                    ) : (
                      <>
                        {jobs[r.id].map((j) => {
                          const jui = runUi(j.status, j.conclusion);
                          return (
                            <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontFamily: "var(--cp-mono)", fontSize: 12, opacity: j.status === "pending" ? 0.5 : 1 }}>
                              <span className="msym" style={{ fontSize: 15, color: jui.color, animation: jui.spin ? "cpSpin 1s linear infinite" : "none" }}>{jui.icon}</span>
                              <span style={{ flex: 1 }}>{j.name}</span>
                              <span style={{ color: jui.color, fontSize: 11 }}>{jui.label}</span>
                              <span style={{ color: "var(--md-sys-color-outline)", fontSize: 10.5 }}>{j.startedAt && j.completedAt ? dur(j.startedAt, j.completedAt) : ""}</span>
                              {j.url ? (
                                <a href={j.url} target="_blank" rel="noreferrer" style={{ color: "var(--md-sys-color-on-surface-variant)", display: "inline-flex" }}><span className="msym" style={{ fontSize: 14 }}>open_in_new</span></a>
                              ) : (
                                <span style={{ width: 14 }} />
                              )}
                            </div>
                          );
                        })}
                        {r.status === "completed" && (
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <Button variant="ghost" onClick={() => rerun(r.id, "failed")} className="h-[30px]! !px-3 text-[11px]!">
                              <span className="msym" style={{ fontSize: 14 }}>replay</span>re-run failed
                            </Button>
                            <Button variant="soft" onClick={() => rerun(r.id, "all")} className="h-[30px]! !px-3 text-[11px]!">
                              <span className="msym" style={{ fontSize: 14 }}>restart_alt</span>re-run all
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>
          </div>
        </Card>
      )}
    </div>
  );
}
