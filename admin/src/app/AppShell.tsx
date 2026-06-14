"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "./auth/AuthProvider";

const BARE_ROUTES = ["/", "/login"];

function pageMeta(pathname: string): { title: string; sub: string } {
  if (pathname === "/projects")
    return { title: "Fleet", sub: "every project, key, and token" };
  if (pathname.startsWith("/projects/provision"))
    return { title: "Provision", sub: "stand up a new project" };
  if (pathname.startsWith("/projects/edit/"))
    return {
      title: "Project",
      sub: decodeURIComponent(pathname.split("/").pop() || ""),
    };
  return { title: "Control Plane", sub: "" };
}

export function Brand({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 9,
        background: "var(--md-sys-color-primary-container)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        border: "1px solid rgba(91,214,208,.25)",
      }}
    >
      <span
        className="msym fill"
        style={{ fontSize: Math.round(size * 0.6), color: "var(--md-sys-color-primary)" }}
      >
        lan
      </span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const meta = pageMeta(pathname);
  const onProvision = pathname.startsWith("/projects/provision");

  const navItems = [
    {
      href: "/projects",
      icon: "grid_view",
      label: "fleet",
      active: pathname === "/projects" || pathname.startsWith("/projects/edit"),
    },
    {
      href: "/projects/provision",
      icon: "add_circle",
      label: "provision",
      active: onProvision,
    },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 262,
          flexShrink: 0,
          background: "var(--md-sys-color-surface-container-low)",
          borderRight: "1px solid var(--md-sys-color-outline-variant)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 11, padding: "20px 18px 18px" }}
        >
          <Brand />
          <span
            style={{
              fontFamily: "var(--cp-mono)",
              fontSize: 13,
              letterSpacing: ".1em",
              fontWeight: 600,
            }}
          >
            CONTROL<span style={{ color: "var(--md-sys-color-primary)" }}>·</span>PLANE
          </span>
        </Link>

        <div style={{ padding: "6px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
          {navItems.map((n) => (
            <Link key={n.href} href={n.href} className={`cp-nav-item ${n.active ? "active" : ""}`}>
              <span className="msym" style={{ fontSize: 19 }}>
                {n.icon}
              </span>
              <span style={{ flex: 1 }}>{n.label}</span>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: "auto", padding: 14 }}>
          <button onClick={logout} className="cp-nav-item">
            <span className="msym" style={{ fontSize: 19 }}>
              logout
            </span>
            log out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            height: 68,
            padding: "0 28px",
            borderBottom: "1px solid var(--md-sys-color-outline-variant)",
            position: "sticky",
            top: 0,
            background: "rgba(12,15,19,.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 20,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 19, fontWeight: 500, letterSpacing: "-.2px" }}>
              {meta.title}
            </span>
            {meta.sub && (
              <span
                style={{
                  fontFamily: "var(--cp-mono)",
                  fontSize: 11,
                  color: "var(--md-sys-color-on-surface-variant)",
                  letterSpacing: ".04em",
                }}
              >
                {meta.sub}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {!onProvision && (
            <Link
              href="/projects/provision"
              className="cp-btn-primary"
              style={{ height: 42, padding: "0 18px", fontSize: 12.5 }}
            >
              <span className="msym" style={{ fontSize: 18 }}>
                add
              </span>
              provision
            </Link>
          )}
          <button
            onClick={logout}
            title="log out"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "var(--md-sys-color-tertiary-container)",
              color: "var(--md-sys-color-on-tertiary-container)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--cp-mono)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              flexShrink: 0,
            }}
          >
            MM
          </button>
        </header>
        {children}
      </main>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_ROUTES.includes(pathname);
  return <AuthProvider>{bare ? children : <Shell>{children}</Shell>}</AuthProvider>;
}
