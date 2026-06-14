"use client";

import React from "react";
import Link from "next/link";
import { Brand } from "../AppShell";

interface Props {
  title: string;
  sub: string;
  cta: string;
  loading: boolean;
  error: string | null;
  email: string;
  password: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  swapText?: string;
  swapHref?: string;
  swapLabel?: string;
}

export default function AuthScreen(p: Props) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1.1fr 1fr", background: "var(--md-sys-color-surface)" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 40, background: "radial-gradient(100% 80% at 20% 10%, #11231f 0%, #0A0D11 60%)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(var(--md-sys-color-outline-variant) 1px,transparent 1px),linear-gradient(90deg,var(--md-sys-color-outline-variant) 1px,transparent 1px)", backgroundSize: "38px 38px", opacity: 0.3 }} />
        <Link href="/" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <Brand size={34} />
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 14, letterSpacing: ".12em", fontWeight: 600 }}>
            CONTROL<span style={{ color: "var(--md-sys-color-primary)" }}>·</span>PLANE
          </span>
        </Link>
        <div style={{ position: "relative" }}>
          <div style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-primary)", letterSpacing: ".1em", marginBottom: 14 }}>{"// FLEET STATUS"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, fontFamily: "var(--cp-mono)", fontSize: 12.5, color: "var(--md-sys-color-on-surface-variant)" }}>
            {[
              { c: "var(--cp-ok)", t: "projects healthy" },
              { c: "var(--cp-err)", t: "tokens needing rotation" },
              { c: "var(--cp-dormant)", t: "not deployed" },
              { c: "var(--md-sys-color-primary)", t: "secrets under management" },
            ].map((r) => (
              <div key={r.t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.c }} />
                {r.t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", fontFamily: "var(--cp-mono)", fontSize: 11, color: "var(--md-sys-color-outline)" }}>self-hosted · k3s · single-tenant</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <form onSubmit={p.onSubmit} style={{ width: "100%", maxWidth: 360 }}>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: "-.4px" }}>{p.title}</h2>
          <p style={{ margin: "8px 0 30px", fontSize: 14, color: "var(--md-sys-color-on-surface-variant)" }}>{p.sub}</p>

          <label className="cp-label">EMAIL</label>
          <input type="email" value={p.email} onChange={(e) => p.setEmail(e.target.value)} placeholder="you@domain.tech" required className="cp-input" style={{ height: 46, margin: "8px 0 18px" }} />

          <label className="cp-label">PASSWORD</label>
          <input type="password" value={p.password} onChange={(e) => p.setPassword(e.target.value)} placeholder="••••••••" required className="cp-input" style={{ height: 46, margin: "8px 0 26px" }} />

          {p.error && (
            <div style={{ marginBottom: 16, fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--cp-err)", display: "flex", alignItems: "center", gap: 8 }}>
              <span className="msym" style={{ fontSize: 15 }}>error</span>{p.error}
            </div>
          )}

          <button type="submit" disabled={p.loading} className="cp-btn-primary" style={{ width: "100%", height: 48, fontSize: 14 }}>
            {p.loading ? "…" : p.cta}
          </button>

          {p.swapHref && (
            <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", fontFamily: "var(--cp-mono)" }}>
              {p.swapText} <Link href={p.swapHref} style={{ color: "var(--md-sys-color-primary)" }}>{p.swapLabel}</Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
