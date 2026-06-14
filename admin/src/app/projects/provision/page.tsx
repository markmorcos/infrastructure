"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { STACK_LIST } from "@/lib/templates";

interface Step {
  step: string;
  status: string;
  detail?: string;
}
interface Result {
  projectName: string;
  repo: string;
  ok: boolean;
  steps: Step[];
}

const OK = ["created", "exists", "set", "registered", "updated"];

export default function ProvisionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [namespace, setNamespace] = useState("");
  const [stack, setStack] = useState(STACK_LIST[0].id);
  const [port, setPort] = useState(String(STACK_LIST[0].defaultPort));
  const [ingressHost, setIngressHost] = useState("");
  const [env, setEnv] = useState<{ name: string; value: string }[]>([]);
  const [isPrivate, setIsPrivate] = useState(true);
  const [running, setRunning] = useState(false);
  const [shown, setShown] = useState<Step[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = () => new Date().toISOString().slice(11, 19);

  const pickStack = (id: string) => {
    setStack(id);
    const s = STACK_LIST.find((x) => x.id === id);
    if (s) setPort(String(s.defaultPort));
  };

  const provision = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setShown([]);
    try {
      const res = await fetch("/api/projects/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: name,
          repo: repo || undefined,
          namespace: namespace || undefined,
          stack,
          port: Number(port) || undefined,
          ingressHost: ingressHost || undefined,
          env: env.filter((e) => e.name),
          private: isPrivate,
        }),
      });
      const d = await res.json();
      if (res.status >= 400 && d.error) {
        setError(d.error);
        setRunning(false);
        return;
      }
      // stream the steps in one-by-one for a live build-log feel
      for (let i = 0; i < d.steps.length; i++) {
        await new Promise((r) => setTimeout(r, 420));
        setShown((s) => [...s, d.steps[i]]);
      }
      setRunning(false);
      setResult(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRunning(false);
    }
  };

  const headerDot = error
    ? "var(--cp-err)"
    : running
    ? "var(--cp-warn)"
    : result
    ? "var(--cp-ok)"
    : "var(--md-sys-color-outline)";

  return (
    <div className="grid grid-cols-1 items-start gap-[14px] px-[14px] pb-12 pt-4 md:grid-cols-[380px_1fr] md:gap-[18px] md:px-7 md:pb-[60px] md:pt-6">
      {/* FORM */}
      <div className="cp-card static p-4 md:sticky md:top-[90px] md:p-[22px]">
        <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--md-sys-color-on-surface-variant)", marginBottom: 18 }}>{"// NEW PROJECT"}</div>
        {[
          { label: "NAME", value: name, set: setName, ph: "my-new-app" },
          { label: "REPOSITORY", value: repo, set: setRepo, ph: name ? `markmorcos/${name}` : "markmorcos/my-new-app" },
          { label: "NAMESPACE", value: namespace, set: setNamespace, ph: name || "my-new-app" },
        ].map((f) => (
          <div key={f.label} style={{ marginBottom: 16 }}>
            <label className="cp-label">{f.label}</label>
            <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} className="cp-input" style={{ marginTop: 7 }} />
          </div>
        ))}

        <div style={{ marginBottom: 16 }}>
          <label className="cp-label">STACK</label>
          <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
            {STACK_LIST.map((s) => {
              const active = stack === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => pickStack(s.id)}
                  style={{
                    flex: "1 1 45%",
                    height: 38,
                    borderRadius: 9,
                    cursor: "pointer",
                    fontFamily: "var(--cp-mono)",
                    fontSize: 12,
                    border: "1px solid " + (active ? "var(--md-sys-color-primary)" : "var(--md-sys-color-outline-variant)"),
                    background: active ? "var(--md-sys-color-primary-container)" : "var(--md-sys-color-surface-container)",
                    color: active ? "var(--md-sys-color-on-primary-container)" : "var(--md-sys-color-on-surface-variant)",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 110 }}>
            <label className="cp-label">PORT</label>
            <input value={port} onChange={(e) => setPort(e.target.value)} className="cp-input" style={{ marginTop: 7 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="cp-label">INGRESS HOST</label>
            <input value={ingressHost} onChange={(e) => setIngressHost(e.target.value)} placeholder={name ? `${name}.morcos.tech` : "my-new-app.morcos.tech"} className="cp-input" style={{ marginTop: 7 }} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
            <label className="cp-label">ENV</label>
            <button onClick={() => setEnv((e) => [...e, { name: "", value: "" }])} className="cp-btn-ghost" style={{ height: 24, padding: "0 8px", fontSize: 10.5 }}>
              <span className="msym" style={{ fontSize: 13 }}>add</span>add
            </button>
          </div>
          {env.map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input value={row.name} onChange={(e) => setEnv((arr) => arr.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} placeholder="KEY" className="cp-input" style={{ height: 38 }} />
              <input value={row.value} onChange={(e) => setEnv((arr) => arr.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} placeholder="value" className="cp-input" style={{ height: 38 }} />
              <button onClick={() => setEnv((arr) => arr.filter((_, j) => j !== i))} className="cp-btn-soft" style={{ width: 38, height: 38, padding: 0 }}>
                <span className="msym" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "var(--md-sys-color-surface-container)", border: "1px solid var(--md-sys-color-outline-variant)" }}>
          <div style={{ fontFamily: "var(--cp-mono)", fontSize: 12.5 }}>private repository</div>
          <button
            onClick={() => setIsPrivate((v) => !v)}
            style={{ width: 40, height: 24, borderRadius: 9999, border: "none", cursor: "pointer", padding: 2, background: isPrivate ? "var(--md-sys-color-primary)" : "var(--md-sys-color-surface-container-highest)", display: "flex", justifyContent: isPrivate ? "flex-end" : "flex-start", alignItems: "center" }}
          >
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: isPrivate ? "var(--md-sys-color-on-primary)" : "var(--md-sys-color-outline)" }} />
          </button>
        </div>
        <button onClick={provision} disabled={running || !name} className="cp-btn-primary" style={{ width: "100%", height: 46, marginTop: 18, fontSize: 13 }}>
          <span className="msym" style={{ fontSize: 18, animation: running ? "cpSpin 1s linear infinite" : "none" }}>{running ? "progress_activity" : "rocket_launch"}</span>
          {running ? "provisioning…" : "provision"}
        </button>
      </div>

      {/* BUILD LOG */}
      <div className="cp-card" style={{ background: "var(--md-sys-color-surface-container-lowest)", overflow: "hidden", minHeight: 440, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderBottom: "1px solid var(--md-sys-color-outline-variant)", background: "var(--md-sys-color-surface-container-low)" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: headerDot }} />
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, letterSpacing: ".06em", color: "var(--md-sys-color-on-surface-variant)" }}>
            build log{name ? ` · ${name}` : ""}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-outline)" }}>
            {running ? "running" : result ? "done" : error ? "error" : "idle"}
          </span>
        </div>
        <div style={{ flex: 1, padding: "16px 18px", fontFamily: "var(--cp-mono)", fontSize: 12.5, lineHeight: 1.5, overflow: "auto" }}>
          {shown.length === 0 && !running && !error && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 340, color: "var(--md-sys-color-outline)", textAlign: "center" }}>
              <span className="msym" style={{ fontSize: 40, opacity: 0.6, marginBottom: 14 }}>terminal</span>
              <div>fill in the form and run a provision —</div>
              <div>each step will land here, live.</div>
            </div>
          )}
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--cp-err)" }}>
              <span className="msym" style={{ fontSize: 16 }}>error</span>{error}
            </div>
          )}
          {shown.map((s, i) => {
            const ok = OK.includes(s.status);
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "5px 0", animation: "cpLogIn .28s cubic-bezier(.2,0,0,1) both" }}>
                <span style={{ color: "var(--md-sys-color-outline)", flexShrink: 0, fontSize: 11, paddingTop: 1 }}>{now()}</span>
                <span className="msym" style={{ fontSize: 16, flexShrink: 0, color: ok ? "var(--cp-ok)" : "var(--cp-err)" }}>{ok ? "check" : "error"}</span>
                <span style={{ color: "var(--md-sys-color-on-surface)", flex: 1 }}>{s.step}</span>
                <span style={{ fontFamily: "var(--cp-mono)", fontSize: 10.5, padding: "2px 9px", borderRadius: 6, flexShrink: 0, background: ok ? "var(--cp-ok-dim)" : "var(--cp-err-dim)", color: ok ? "var(--cp-ok)" : "var(--cp-err)" }}>
                  {s.status}{s.detail ? `: ${s.detail}` : ""}
                </span>
              </div>
            );
          })}
          {running && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
              <span style={{ width: 8, height: 15, background: "var(--md-sys-color-primary)", animation: "cpBlink 1s step-end infinite", display: "inline-block" }} />
            </div>
          )}
          {result && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, padding: "14px 16px", borderRadius: 12, background: result.ok ? "var(--cp-ok-dim)" : "var(--cp-err-dim)", border: "1px solid " + (result.ok ? "rgba(70,224,160,.25)" : "rgba(255,122,107,.25)"), animation: "cpFade .4s both" }}>
              <span className="msym fill" style={{ fontSize: 22, color: result.ok ? "var(--cp-ok)" : "var(--cp-err)" }}>{result.ok ? "task_alt" : "report"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--cp-mono)", fontSize: 13, color: result.ok ? "var(--cp-ok)" : "var(--cp-err)", fontWeight: 600 }}>{result.projectName} {result.ok ? "provisioned" : "completed with errors"}</div>
                <div style={{ fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)", marginTop: 2 }}>repo + secrets + CI scaffold</div>
              </div>
              <button onClick={() => router.push("/projects")} className="cp-btn-primary" style={{ height: 36, padding: "0 16px", fontSize: 12 }}>view fleet</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
