import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cmsPool as pool } from "@/lib/db";
import type { Site } from "./db";

const PREVIEW_TTL = "20m";
const INVITE_TTL = "3d";

// signInviteToken / verifyInviteToken back the onboarding set-password flow: a
// newly-spawned owner is created with a random (locked) password and emailed a
// link carrying this token; set-password verifies it and sets their password.
export function signInviteToken(userId: number, email: string): string {
  return jwt.sign({ kind: "invite", userId, email }, process.env.JWT_SECRET as string, {
    expiresIn: INVITE_TTL,
  });
}

export function verifyInviteToken(token: string): { userId: number; email: string } | null {
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET as string) as {
      kind?: string;
      userId?: number | string;
      email?: string;
    };
    if (p.kind !== "invite" || p.userId === undefined || !p.email) return null;
    return { userId: Number(p.userId), email: p.email };
  } catch {
    return null;
  }
}

// Authorization helpers for the CMS console. The session JWT carries the role;
// per-site ownership is resolved against the DB (sites.owner_user_id) on every
// request, so reassigning/revoking a site takes effect without re-login.

export interface SessionUser {
  userId: number;
  email: string;
  role: string;
}

export function getSessionUser(req: NextRequest): SessionUser | null {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: number | string;
      email: string;
      role: string;
    };
    return { userId: Number(p.userId), email: p.email, role: p.role };
  } catch {
    return null;
  }
}

export function isAdmin(u: SessionUser | null): boolean {
  return !!u && u.role === "admin";
}

type Guard = { user: SessionUser } | { error: NextResponse };

// requireAdmin gates an admin-only handler. Returns the user, or a response to
// return as-is (401 unauthenticated / 403 non-admin).
export function requireAdmin(req: NextRequest): Guard {
  const user = getSessionUser(req);
  if (!user)
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (user.role !== "admin")
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}

// signPreviewToken mints a short-lived, site-scoped token the renderer carries
// (as a Bearer) to read draft content/settings via ?draft=1. Issued only after
// requireSiteAccess passes, so only an admin or the site's owner can obtain one.
export function signPreviewToken(siteKey: string): string {
  return jwt.sign({ kind: "preview", site: siteKey }, process.env.JWT_SECRET as string, {
    expiresIn: PREVIEW_TTL,
  });
}

// draftAuthorized reports whether the request may read this site's draft data,
// via (a) an admin/owner session cookie, or (b) a Bearer token that is either an
// admin/owner JWT or a preview token scoped to this site. Backs the ?draft=1 gate.
export function draftAuthorized(req: NextRequest, site: Site): boolean {
  const sessionAllows = (u: { role?: string; userId?: number } | null) =>
    !!u &&
    (u.role === "admin" ||
      (site.ownerUserId !== null && Number(u.userId) === site.ownerUserId));

  if (sessionAllows(getSessionUser(req))) return true;

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const candidates = [bearer, req.headers.get("x-admin-token")].filter(Boolean) as string[];
  for (const tok of candidates) {
    try {
      const p = jwt.verify(tok, process.env.JWT_SECRET as string) as {
        kind?: string;
        site?: string;
        role?: string;
        userId?: number | string;
      };
      if (p.role === "admin") return true;
      if (p.kind === "preview" && p.site === site.key) return true;
      if (
        p.userId !== undefined &&
        site.ownerUserId !== null &&
        Number(p.userId) === site.ownerUserId
      )
        return true;
    } catch {
      // try the next candidate
    }
  }
  return false;
}

// requireSiteAccess gates a per-site CMS handler: admins always pass; an editor
// passes only if they own the site (sites.owner_user_id === their id).
export async function requireSiteAccess(
  req: NextRequest,
  siteKey: string
): Promise<Guard> {
  const user = getSessionUser(req);
  if (!user)
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (user.role === "admin") return { user };

  const { rows } = await pool.query(
    `SELECT owner_user_id FROM sites WHERE key = $1`,
    [siteKey]
  );
  if (rows.length === 0)
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  if (Number(rows[0].owner_user_id) === user.userId) return { user };
  return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
}
