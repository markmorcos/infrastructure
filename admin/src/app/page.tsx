"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./AppShell";
import { useAuth } from "./auth/AuthProvider";

interface App {
  label: string;
  icon: string;
  href: string;
  soon?: boolean;
  // Reverse-proxied outside the Next app (e.g. Plausible at /analytics) → needs
  // a full navigation, not client-side routing.
  hard?: boolean;
}

const APPS: App[] = [
  { label: "Projects", icon: "grid_view", href: "/projects" },
  { label: "Builds", icon: "manage_history", href: "/builds" },
  { label: "Provision", icon: "rocket_launch", href: "/projects/provision" },
  { label: "CMS", icon: "article", href: "/cms" },
  { label: "Experimentation", icon: "science", href: "/experimentation" },
  { label: "Analytics", icon: "bar_chart_4_bars", href: "/analytics", hard: true },
  { label: "Users", icon: "group", href: "/users" },
  { label: "Backups", icon: "cloud_sync", href: "/backups" },
];

function Tile({ app }: { app: App }) {
  const inner = (
    <>
      <div className="os-tile">
        <span
          className="msym"
          style={{ fontSize: 44, color: app.soon ? "var(--md-sys-color-on-surface-variant)" : "var(--md-sys-color-primary)" }}
        >
          {app.icon}
        </span>
        {app.soon && <span className="os-tile-badge">soon</span>}
      </div>
      <span className="os-label">{app.label}</span>
    </>
  );
  if (app.soon) return <div className="os-app os-soon">{inner}</div>;
  if (app.hard)
    return (
      <a href={app.href} className="os-app">
        {inner}
      </a>
    );
  return (
    <Link href={app.href} className="os-app">
      {inner}
    </Link>
  );
}

export default function HomePage() {
  const { logout, isAdmin, user } = useAuth();
  const router = useRouter();
  const [clock, setClock] = useState("");

  // The OS launcher is admin-only; editors go straight to their CMS.
  useEffect(() => {
    if (user && !isAdmin) router.replace("/cms");
  }, [user, isAdmin, router]);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, []);

  if (user && !isAdmin) return null;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "radial-gradient(120% 90% at 50% -10%, #10211f 0%, #0C0F13 55%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(var(--md-sys-color-outline-variant) 1px,transparent 1px),linear-gradient(90deg,var(--md-sys-color-outline-variant) 1px,transparent 1px)",
          backgroundSize: "46px 46px",
          opacity: 0.3,
          maskImage: "radial-gradient(90% 70% at 50% 35%,#000 0%,transparent 80%)",
          WebkitMaskImage: "radial-gradient(90% 70% at 50% 35%,#000 0%,transparent 80%)",
        }}
      />

      {/* menu bar */}
      <header
        className="px-[14px] md:px-7"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
          borderBottom: "1px solid var(--md-sys-color-outline-variant)",
          background: "rgba(12,15,19,.5)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Brand size={26} />
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12.5, letterSpacing: ".12em", fontWeight: 600 }}>
            CONTROL<span style={{ color: "var(--md-sys-color-primary)" }}>·</span>PLANE
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: "var(--cp-mono)", fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>{clock}</span>
          <button onClick={logout} className="cp-btn-ghost" style={{ height: 30, padding: "0 12px", fontSize: 11.5 }}>
            <span className="msym" style={{ fontSize: 15 }}>logout</span>log out
          </button>
        </div>
      </header>

      {/* desktop */}
      <div
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          gap: 36,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-.5px" }}>Admin OS</div>
          <div style={{ fontFamily: "var(--cp-mono)", fontSize: 12.5, color: "var(--md-sys-color-on-surface-variant)", marginTop: 6 }}>
            everything on your infra, one surface
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-9 sm:grid-cols-3 md:grid-cols-5 md:gap-x-11">
          {APPS.map((a) => (
            <Tile key={a.label} app={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
