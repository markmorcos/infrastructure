"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  if (pathname.startsWith("/builds"))
    return { title: "Builds", sub: "deploy pipeline runs" };
  if (pathname.startsWith("/cms"))
    return { title: "CMS", sub: "sites, content, assets" };
  if (pathname.startsWith("/experimentation"))
    return { title: "Experimentation", sub: "flags, experiments, results" };
  if (pathname.startsWith("/users"))
    return { title: "Users & Access", sub: "people and site access" };
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
  const router = useRouter();
  const { logout, isAdmin, user } = useAuth();
  const meta = pageMeta(pathname);
  const onProvision = pathname.startsWith("/projects/provision");
  const [drawer, setDrawer] = useState(false);

  // Editors are confined to the CMS; bounce them off any control-plane route.
  const editorAllowed = pathname.startsWith("/cms");
  useEffect(() => {
    if (user && !isAdmin && !editorAllowed) router.replace("/cms");
  }, [user, isAdmin, editorAllowed, router]);

  // close the drawer whenever the route changes
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  // lock body scroll while the mobile drawer is open (drawer only opens on phones)
  useEffect(() => {
    if (drawer) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [drawer]);

  const adminNav = [
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
      href: "/cms",
      icon: "article",
      label: "cms",
      active: pathname.startsWith("/cms"),
    },
    {
      href: "/experimentation",
      icon: "science",
      label: "experimentation",
      active: pathname.startsWith("/experimentation"),
    },
    {
      href: "/users",
      icon: "group",
      label: "users",
      active: pathname.startsWith("/users"),
    },
    {
      href: "/projects/provision",
      icon: "add_circle",
      label: "provision",
      active: onProvision,
    },
  ];
  const editorNav = [
    {
      href: "/cms",
      icon: "article",
      label: "cms",
      active: pathname.startsWith("/cms"),
    },
  ];
  const navItems = isAdmin ? adminNav : editorNav;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {drawer && (
        <div
          onClick={() => setDrawer(false)}
          className="fixed inset-0 z-[55] md:hidden"
          style={{
            background: "rgba(0,0,0,.55)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-[60] flex h-[100dvh] w-[min(82vw,290px)] flex-col transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] md:sticky md:z-auto md:h-screen md:w-[262px] md:flex-shrink-0 md:translate-x-0 md:shadow-none ${
          drawer ? "translate-x-0 shadow-[0_0_40px_-8px_rgba(0,0,0,.6)]" : "-translate-x-[105%]"
        }`}
        style={{
          background: "var(--md-sys-color-surface-container-low)",
          borderRight: "1px solid var(--md-sys-color-outline-variant)",
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
          className="flex items-center gap-3 px-[14px] md:gap-[18px] md:px-7"
          style={{
            height: 68,
            borderBottom: "1px solid var(--md-sys-color-outline-variant)",
            position: "sticky",
            top: 0,
            background: "rgba(12,15,19,.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 20,
          }}
        >
          <button
            onClick={() => setDrawer(true)}
            aria-label="open menu"
            className="cp-btn-soft md:hidden"
            style={{ width: 40, height: 40, padding: 0, flexShrink: 0, borderRadius: 10 }}
          >
            <span className="msym" style={{ fontSize: 22 }}>
              menu
            </span>
          </button>
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
            {meta.sub && (
              <span
                className="hidden md:block"
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
          {isAdmin && !onProvision && (
            <Link
              href="/projects/provision"
              className="cp-btn-primary w-[42px] px-0 md:w-auto md:px-[18px]"
              style={{ height: 42, fontSize: 12.5, flexShrink: 0 }}
              aria-label="provision"
            >
              <span className="msym" style={{ fontSize: 18 }}>
                add
              </span>
              <span className="hidden md:inline">provision</span>
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
