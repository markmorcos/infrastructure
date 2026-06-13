"use client";

import Link from "next/link";
import { useAuth } from "./auth/AuthProvider";

export default function HomePage() {
  const { isAuthenticated, isAdmin } = useAuth();
  const href = isAuthenticated && isAdmin ? "/projects" : "/login";
  const label = isAuthenticated && isAdmin ? "Open Projects →" : "Sign in →";

  return (
    <div className="home">
      <div className="home-card">
        <h1>Control Plane</h1>
        <p className="page-description">
          Inventory every key and secret across your apps, mint and rotate
          deployment tokens, and provision a new project — repo, secrets, and
          pipeline — in one click.
        </p>
        <Link href={href} className="home-cta">
          {label}
        </Link>
      </div>
    </div>
  );
}
