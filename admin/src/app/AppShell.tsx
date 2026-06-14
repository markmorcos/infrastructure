"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { useIsMobile } from "@/lib/useMediaQuery";

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
  if (pathname.startsWith("/builds"))
    return { title: "Builds", sub: "deploy pipeline runs" };
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
  const mobile = useIsMobile();
  const [drawer, setDrawer] = useState(false);

  // close the drawer whenever the route changes
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  // lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (mobile && drawer) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobile, drawer]);

  const navItems = [
    {
      href: "/projects",
      icon: "grid_view",
      label: "fleet",
      active: pathname === "/projects" || pathname.startsWith("/projects/edit"),
    },
    {
      href: "/builds",
      icon: "manage_history",
      label: "builds",
      active: pathname.startsWith("/builds"),
    },
    {
      href: "/projects/provision",
      icon: "add_circle",
      label: "provision",
      active: onProvision,
    },
  ];

  const asideStyle: React.CSSProperties = mobile
    ? {
        width: "min(82vw, 290px)",
        background: "var(--md-sys-color-surface-container-low)",
        borderRight: "1px solid var(--md-sys-color-outline-variant)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100dvh",
        zIndex: 60,
        transform: drawer ? "translateX(0)" : "translateX(-105%)",
        transition: "transform .24s cubic-bezier(.2,0,0,1)",
        boxShadow: drawer ? "0 0 40px -8px rgba(0,0,0,.6)" : "none",
      }
    : {
        width: 262,
        flexShrink: 0,
        background: "var(--md-sys-color-surface-container-low)",
        borderRight: "1px solid var(--md-sys-color-outline-variant)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
      };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {mobile && drawer && (
        <div
          onClick={() => setDrawer(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.55)",
            zIndex: 55,
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        />
      )}
      <aside style={asideStyle}>
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
            gap: mobile ? 12 : 18,
            height: 68,
            padding: mobile ? "0 14px" : "0 28px",
            borderBottom: "1px solid var(--md-sys-color-outline-variant)",
            position: "sticky",
            top: 0,
            background: "rgba(12,15,19,.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 20,
          }}
        >
          {mobile && (
            <button
              onClick={() => setDrawer(true)}
              aria-label="open menu"
              className="cp-btn-soft"
              style={{ width: 40, height: 40, padding: 0, flexShrink: 0, borderRadius: 10 }}
            >
              <span className="msym" style={{ fontSize: 22 }}>
                menu
              </span>
            </button>
          )}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span
              style={{
                fontSize: 19,
                fontWeight: 500,
                letterSpacing: "-.2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {meta.title}
            </span>
            {meta.sub && !mobile && (
              <span
                style={{
                  fontFamily: "var(--cp-mono)",
                  fontSize: 11,
                  color: "var(--md-sys-color-on-surface-variant)",
                  letterSpacing: ".04em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
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
              style={{
                height: 42,
                padding: mobile ? 0 : "0 18px",
                width: mobile ? 42 : undefined,
                fontSize: 12.5,
                flexShrink: 0,
              }}
              aria-label="provision"
            >
              <span className="msym" style={{ fontSize: 18 }}>
                add
              </span>
              {!mobile && "provision"}
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
