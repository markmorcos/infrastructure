"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Project,
  Runtime,
  STATUS_META,
  computeStatus,
  tokenValid,
  issuesOf,
} from "../../status";

interface BuildRow {
  id: number;
  project: string;
  status: string;
  conclusion: string | null;
  runNumber: number;
  createdAt: string;
  url: string;
}

function buildUi(status: string, conclusion: string | null) {
  if (status !== "completed") return { color: "var(--cp-warn)", icon: "progress_activity", spin: true, label: "running" };
  if (conclusion === "success") return { color: "var(--cp-ok)", icon: "check_circle", spin: false, label: "success" };
  if (conclusion === "failure") return { color: "var(--cp-err)", icon: "cancel", spin: false, label: "failed" };
  return { color: "var(--cp-idle)", icon: "do_not_disturb_on", spin: false, label: conclusion || "done" };
}

const RT_UI: Record<Runtime["status"], { color: string; icon: string; label: string }> = {
  healthy: { color: "var(--cp-ok)", icon: "bolt", label: "healthy" },
  progressing: { color: "var(--cp-warn)", icon: "pending", label: "progressing" },
  degraded: { color: "var(--cp-err)", icon: "error", label: "degraded" },
  down: { color: "var(--cp-err)", icon: "cancel", label: "down" },
  none: { color: "var(--cp-dormant)", icon: "cloud_off", label: "not running" },
};

export default function DetailPage() {
  const params = useParams();
  const router = useRouter();
  const name = decodeURIComponent(params.projectName as string);

  const [project, setProject] = useState<Project | null>(null);
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [namespace, setNamespace] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [secretName, setSecretName] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [secretMsg, setSecretMsg] = useState<string | null>(null);
  const [builds, setBuilds] = useState<BuildRow[]>([]);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [rollMsg, setRollMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [listRes, oneRes, buildsRes, rtRes] = await Promise.all([
      fetch("/api/admin/projects"),
      fetch(`/api/admin/projects/${encodeURIComponent(name)}`),
      fetch("/api/admin/builds"),
      fetch("/api/admin/runtime"),
    ]);
    const list: Project[] = await listRes.json();
    const p = list.find((x) => x.projectName === name) || null;
    setProject(p);
    if (p) {
      setRepo(p.repo ?? "");
      setNamespace(p.namespace ?? "");
      setEnabled(p.enabled);
    }
    if (oneRes.ok) {
      const one = await oneRes.json();
      setToken(one.token ?? "");
    }
    if (buildsRes.ok) {
      const d = await buildsRes.json();
      setBuilds((d.runs as BuildRow[]).filter((r) => r.project === name).slice(0, 5));
    }
    if (rtRes.ok && p?.namespace) {
      const m: Record<string, Runtime> = await rtRes.json();
      setRuntime(m[p.namespace] ?? null);
    }
  }, [name]);

  const rollback = async () => {
    if (!confirm(`Roll back ${name} to the previous Helm revision?`)) return;
    setRollMsg(null);
    const res = await fetch(`/api/admin/projects/${encodeURIComponent(name)}/rollback`, { method: "POST" });
    const d = await res.json();
    setRollMsg(res.ok ? "rollback dispatched — watch it in Builds/Actions" : d.error || "rollback failed");
  };

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setMsg(null);
    const res = await fetch(`/api/admin/projects/${encodeURIComponent(name)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo, namespace, enabled, token }),
    });
    setMsg(res.ok ? "saved" : "save failed");
    load();
  };

  const rotate = async () => {
    setRotating(true);
    setMsg(null);
    const res = await fetch(`/api/admin/projects/${encodeURIComponent(name)}/rotate`, { method: "POST" });
    const d = await res.json();
    setRotating(false);
    setMsg(res.ok ? (d.pushedToRepo ? "rotated + pushed to repo" : "rotated (db only)") : d.error || "rotate failed");
    load();
  };

  const setK8s = async () => {
    setSecretMsg(null);
    const res = await fetch(`/api/admin/projects/${encodeURIComponent(name)}/k8s-secrets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secretName, data: { [secretKey]: secretValue } }),
    });
    const d = await res.json();
    setSecretMsg(res.ok ? `set ${secretKey} in ${d.secretName}` : d.error || "failed");
    if (res.ok) {
      setSecretValue("");
      load();
    }
  };

  if (!project)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "80px 28px", fontFamily: "var(--cp-mono)", color: "var(--md-sys-color-on-surface-variant)" }}>
        <span className="cp-spinner" />
        loading…
      </div>
    );

  const status = computeStatus(project);
  const meta = STATUS_META[status];
  const valid = tokenValid(project);
  const issues = issuesOf(project);
  const deployed = !!project.namespace;

  return (
    <div className="px-[14px] pb-12 pt-4 md:px-7 md:pb-[60px] md:pt-6" style={{ maxWidth: 1080 }}>
      <button onClick={() => router.push("/projects")} className="cp-btn-ghost" style={{ height: 34, padding: "0 14px 0 10px", fontSize: 12, marginBottom: 20 }}>
        <span className="msym" style={{ fontSize: 17 }}>arrow_back</span>fleet
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ width: 13, height: 13, borderRadius: "50%", flexShrink: 0, background: meta.color, animation: status === "healthy" ? "cpPulse 2.6s ease-in-out infinite" : "none" }} />
        <h2 className="text-[21px] md:text-[26px]" style={{ margin: 0, fontFamily: "var(--cp-mono)", fontWeight: 600, letterSpacing: ".01em", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{project.projectName}</h2>
        <span style={{ display: "inline-flex", alignItems: "center", height: 26, padding: "0 12px", borderRadius: 9999, background: meta.dim, color: meta.color, fontFamily: "var(--cp-mono)", fontSize: 11.5 }}>{meta.label}</span>
      </div>

      {issues.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "16px 0 4px", padding: "13px 16px", borderRadius: 12, background: "var(--cp-err-dim)", border: "1px solid rgba(255,122,107,.2)" }}>
          {issues.map((iss) => (
            <div key={iss} style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--cp-mono)", fontSize: 12.5, color: "var(--cp-err)" }}>
              <span className="msym" style={{ fontSize: 16 }}>error</span>{iss}
            </div>
          ))}
        </div>
      )}

      {runtime && runtime.status !== "none" && (
        <div className="cp-card" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="msym" style={{ fontSize: 18, color: RT_UI[runtime.status].color, animation: runtime.status === "progressing" ? "cpSpin 1.4s linear infinite" : "none" }}>{RT_UI[runtime.status].icon}</span>
              <SectionLabel inline>RUNTIME · {runtime.ready}/{runtime.desired} ready · {RT_UI[runtime.status].label}</SectionLabel>
            </div>
            <button onClick={rollback} className="cp-btn-ghost" style={{ height: 30, padding: "0 12px", fontSize: 11 }}>
              <span className="msym" style={{ fontSize: 15 }}>undo</span>rollback
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {runtime.pods.map((pod) => (
              <div key={pod.name} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--cp-mono)", fontSize: 12, padding: "5px 0" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: pod.ready ? "var(--cp-ok)" : pod.reason ? "var(--cp-err)" : "var(--cp-warn)" }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pod.name}</span>
                {pod.reason && <span style={{ color: "var(--cp-err)", fontSize: 11 }}>{pod.reason}</span>}
                <span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 11 }}>{pod.phase}</span>
                {pod.restarts > 0 && <span style={{ color: "var(--cp-warn)", fontSize: 11 }}>{pod.restarts}↻</span>}
              </div>
            ))}
          </div>
          {rollMsg && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-ok)", marginTop: 10 }}>{rollMsg}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16, marginTop: 20 }}>
        {/* METADATA */}
        <div className="cp-card" style={{ padding: 20 }}>
          <SectionLabel>{"// METADATA"}</SectionLabel>
          <Field label="REPOSITORY">
            <input value={repo} onChange={(e) => setRepo(e.target.value)} className="cp-input" placeholder="markmorcos/my-app" />
          </Field>
          <Field label="NAMESPACE">
            <input value={namespace} onChange={(e) => setNamespace(e.target.value)} className="cp-input" placeholder="(not deployed)" />
          </Field>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "var(--md-sys-color-surface-container)", border: "1px solid var(--md-sys-color-outline-variant)" }}>
            <div>
              <div style={{ fontFamily: "var(--cp-mono)", fontSize: 12.5 }}>deploys enabled</div>
              <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-on-surface-variant)", marginTop: 2 }}>disabled blocks all deploys</div>
            </div>
            <Switch on={enabled} onClick={() => setEnabled((v) => !v)} />
          </div>
          <button onClick={save} className="cp-btn-primary" style={{ width: "100%", height: 44, marginTop: 18, fontSize: 13 }}>save changes</button>
          {msg && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-ok)", marginTop: 10, textAlign: "center" }}>{msg}</div>}
        </div>

        {/* TOKEN */}
        <div className="cp-card" style={{ padding: 20, display: "flex", flexDirection: "column" }}>
          <SectionLabel>{"// DEPLOYMENT TOKEN"}</SectionLabel>
          <div style={{ border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: 12, padding: 16, background: "var(--md-sys-color-surface-container-lowest)" }}>
            <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-on-surface-variant)", marginBottom: 8 }}>decoded JWT payload</div>
            <div style={{ fontFamily: "var(--cp-mono)", fontSize: 12.5, lineHeight: 1.7 }}>
              {"{ "}
              <span style={{ color: "var(--md-sys-color-primary)" }}>&quot;sub&quot;</span>: &quot;{project.jwt?.sub ?? "?"}&quot;,{" "}
              <span style={{ color: "var(--md-sys-color-primary)" }}>&quot;valid&quot;</span>:{" "}
              <span style={{ color: valid ? "var(--cp-ok)" : "var(--cp-err)" }}>{valid ? "true" : "false"}</span>
              {" }"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 13, borderTop: "1px solid var(--md-sys-color-outline-variant)" }}>
              <span className="msym fill" style={{ fontSize: 18, color: valid ? "var(--cp-ok)" : "var(--cp-err)" }}>{valid ? "verified_user" : "gpp_bad"}</span>
              <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12.5, color: valid ? "var(--cp-ok)" : "var(--cp-err)" }}>{valid ? "token signature valid" : "token rejected — sub mismatch"}</span>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 14 }} />
          <button onClick={rotate} className={valid ? "cp-btn-tonal" : "cp-btn-primary"} style={{ width: "100%", height: 46, fontSize: 13 }}>
            <span className="msym" style={{ fontSize: 18, animation: rotating ? "cpSpin 1s linear infinite" : "none" }}>autorenew</span>
            {rotating ? "rotating…" : "rotate token"}
          </button>
          <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-outline)", marginTop: 10, textAlign: "center" }}>
            re-mints the token and pushes it to the repo&apos;s actions secrets
          </div>
        </div>
      </div>

      {/* SECRETS */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16, marginTop: 16 }}>
        <div className="cp-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span className="msym" style={{ fontSize: 17, color: "var(--md-sys-color-on-surface-variant)" }}>key</span>
            <SectionLabel inline>GITHUB SECRETS · {project.repo || "no repo"}</SectionLabel>
          </div>
          {project.github.ok ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {project.github.secrets.length === 0 && <Empty icon="key_off" text="no secrets" />}
              {project.github.secrets.map((g) => {
                const req = ["INFRASTRUCTURE_PAT", "DEPLOYMENT_TOKEN"].includes(g.name);
                return (
                  <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 10, background: "var(--md-sys-color-surface-container)", border: "1px solid var(--md-sys-color-outline-variant)" }}>
                    <span className="msym fill" style={{ fontSize: 16, color: "var(--cp-ok)" }}>check_circle</span>
                    <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                    {req && <span style={{ fontFamily: "var(--cp-mono)", fontSize: 9.5, letterSpacing: ".06em", padding: "2px 7px", borderRadius: 5, background: "var(--md-sys-color-surface-container-highest)", color: "var(--md-sys-color-on-surface-variant)" }}>REQ</span>}
                    <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-outline)" }}>{g.updatedAt.slice(0, 10)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty icon="link_off" text={project.github.error} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 13, fontFamily: "var(--cp-mono)", fontSize: 10.5, color: "var(--md-sys-color-outline)" }}>
            <span className="msym" style={{ fontSize: 14 }}>lock</span>values are never exposed — names &amp; timestamps only
          </div>
        </div>

        <div className="cp-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span className="msym" style={{ fontSize: 17, color: "var(--md-sys-color-on-surface-variant)" }}>deployed_code</span>
            <SectionLabel inline>KUBERNETES SECRETS</SectionLabel>
          </div>
          {deployed && project.k8s.ok ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {project.k8s.secrets.length === 0 && <Empty icon="folder_off" text="no secrets" />}
                {project.k8s.secrets.map((grp) => (
                  <div key={grp.name} style={{ border: "1px solid var(--md-sys-color-outline-variant)", borderRadius: 11, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", background: "var(--md-sys-color-surface-container)" }}>
                      <span className="msym" style={{ fontSize: 14, color: "var(--md-sys-color-primary)" }}>folder_open</span>
                      <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, fontWeight: 600 }}>{grp.name}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "11px 12px" }}>
                      {grp.keys.map((k) => (
                        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 8, background: "var(--md-sys-color-surface-container-lowest)", border: "1px solid var(--md-sys-color-outline-variant)", fontFamily: "var(--cp-mono)", fontSize: 11 }}>
                          <span>{k}</span>
                          <span style={{ color: "var(--md-sys-color-outline)", letterSpacing: 1 }}>••••••</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--md-sys-color-outline-variant)" }}>
                <div style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, letterSpacing: ".06em", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 10 }}>SET / ROTATE A KEY</div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  <input value={secretName} onChange={(e) => setSecretName(e.target.value)} placeholder="secret-name" className="cp-input" style={{ height: 40, flex: "1 1 120px", minWidth: 0 }} />
                  <input value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="KEY" className="cp-input" style={{ height: 40, flex: "1 1 90px", minWidth: 0 }} />
                  <input type="password" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} placeholder="value" className="cp-input" style={{ height: 40, flex: "1 1 120px", minWidth: 0 }} />
                  <button onClick={setK8s} className="cp-btn-tonal basis-full md:basis-auto" style={{ height: 40, padding: "0 16px", fontSize: 12, flexGrow: 0, flexShrink: 0 }}>set</button>
                </div>
                {secretMsg && <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--cp-ok)", marginTop: 8 }}>{secretMsg}</div>}
              </div>
            </>
          ) : (
            <Empty icon="cloud_off" text="no namespace — not deployed" big />
          )}
        </div>
      </div>

      <div className="cp-card" style={{ padding: 20, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="msym" style={{ fontSize: 17, color: "var(--md-sys-color-on-surface-variant)" }}>manage_history</span>
            <SectionLabel inline>RECENT BUILDS</SectionLabel>
          </div>
          <Link href="/builds" className="cp-btn-ghost" style={{ height: 28, padding: "0 12px", fontSize: 11 }}>
            all builds<span className="msym" style={{ fontSize: 14 }}>arrow_forward</span>
          </Link>
        </div>
        {builds.length === 0 ? (
          <Empty icon="history" text="no builds yet" />
        ) : (
          builds.map((b) => {
            const ui = buildUi(b.status, b.conclusion);
            return (
              <a key={b.id} href={b.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontFamily: "var(--cp-mono)", fontSize: 12 }}>
                <span className="msym" style={{ fontSize: 16, color: ui.color, animation: ui.spin ? "cpSpin 1s linear infinite" : "none" }}>{ui.icon}</span>
                <span style={{ flex: 1, color: ui.color }}>{ui.label}</span>
                <span style={{ color: "var(--md-sys-color-on-surface-variant)" }}>#{b.runNumber}</span>
                <span style={{ color: "var(--md-sys-color-outline)" }}>{new Date(b.createdAt).toLocaleString()}</span>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--md-sys-color-on-surface-variant)", marginBottom: inline ? 0 : 16 }}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="cp-label">{label}</label>
      <div style={{ marginTop: 7 }}>{children}</div>
    </div>
  );
}

function Empty({ icon, text, big }: { icon: string; text: string; big?: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: big ? "30px 0" : "16px 0", fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
      <span className="msym" style={{ fontSize: big ? 32 : 22, opacity: 0.5, display: "block", marginBottom: 8 }}>{icon}</span>
      {text}
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ width: 40, height: 24, borderRadius: 9999, border: "none", cursor: "pointer", padding: 2, flexShrink: 0, background: on ? "var(--md-sys-color-primary)" : "var(--md-sys-color-surface-container-highest)", display: "flex", justifyContent: on ? "flex-end" : "flex-start", alignItems: "center", transition: "background .18s" }}
    >
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: on ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-outline)" }} />
    </button>
  );
}
