"use client";

import Link from "next/link";
import { useAuth } from "./auth/AuthProvider";
import { Brand } from "./AppShell";

export default function HomePage() {
  const { isAuthenticated, isAdmin } = useAuth();
  const target = isAuthenticated && isAdmin ? "/projects" : "/login";

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "radial-gradient(120% 90% at 50% -10%, #10211f 0%, #0C0F13 55%)" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(var(--md-sys-color-outline-variant) 1px,transparent 1px),linear-gradient(90deg,var(--md-sys-color-outline-variant) 1px,transparent 1px)", backgroundSize: "46px 46px", opacity: 0.35, maskImage: "radial-gradient(80% 60% at 50% 30%,#000 0%,transparent 75%)", WebkitMaskImage: "radial-gradient(80% 60% at 50% 30%,#000 0%,transparent 75%)" }} />

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "24px clamp(18px, 5vw, 36px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Brand size={34} />
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 14, letterSpacing: ".12em", fontWeight: 600 }}>
            CONTROL<span style={{ color: "var(--md-sys-color-primary)" }}>·</span>PLANE
          </span>
        </div>
        <Link href={target} className="cp-btn-ghost" style={{ height: 38, padding: "0 18px", fontSize: 13, letterSpacing: ".04em" }}>
          {isAuthenticated ? "open fleet" : "sign in"}
        </Link>
      </div>

      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 9999, border: "1px solid var(--md-sys-color-outline-variant)", background: "rgba(255,255,255,.02)", marginBottom: 28 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cp-ok)", animation: "cpPulse 2.4s ease-in-out infinite" }} />
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)", letterSpacing: ".06em" }}>single-tenant · self-hosted · k3s</span>
        </div>
        <h1 style={{ margin: 0, fontSize: "clamp(34px, 8.5vw, 64px)", lineHeight: 1.04, letterSpacing: "-1.5px", fontWeight: 500, maxWidth: "14ch" }}>
          One pane of glass for every<span style={{ color: "var(--md-sys-color-primary)" }}> key</span>.
        </h1>
        <p style={{ margin: "22px 0 0", maxWidth: "54ch", fontSize: "clamp(15px, 4vw, 17px)", lineHeight: 1.6, color: "var(--md-sys-color-on-surface-variant)" }}>
          See every secret across your homelab, rotate stale deployment tokens, and stand up a whole project in one click — without ever exposing a value.
        </p>
        <div style={{ display: "flex", gap: 14, marginTop: 38, width: "100%", justifyContent: "center", maxWidth: 360 }}>
          <Link href={target} className="cp-btn-primary" style={{ height: 50, padding: "0 28px", fontSize: 14, boxShadow: "0 8px 30px -12px rgba(91,214,208,.6)", flex: "0 1 auto" }}>
            enter control plane
            <span className="msym" style={{ fontSize: 18 }}>arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
