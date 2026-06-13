"use client";

import Link from "next/link";
import { AuthProvider, useAuth } from "./auth/AuthProvider";

function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#brandGrad)" />
      <path d="M16 7l8 4.5-8 4.5-8-4.5L16 7z" fill="#fff" fillOpacity="0.95" />
      <path
        d="M8 16l8 4.5 8-4.5"
        stroke="#fff"
        strokeWidth="1.8"
        fill="none"
        strokeOpacity="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 20.5l8 4.5 8-4.5"
        stroke="#fff"
        strokeWidth="1.8"
        fill="none"
        strokeOpacity="0.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TopBar() {
  const { isAuthenticated, isAdmin, logout } = useAuth();
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <BrandMark />
        <span className="brand-name">Control Plane</span>
      </Link>
      <nav className="topnav">
        {isAuthenticated && isAdmin && <Link href="/projects">Projects</Link>}
        {isAuthenticated && (
          <button className="nav-logout" onClick={logout}>
            Logout
          </button>
        )}
      </nav>
    </header>
  );
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TopBar />
      <main className="app-main">{children}</main>
    </AuthProvider>
  );
}
