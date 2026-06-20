import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cmsPool as pool } from "@/lib/db";
import type { Site } from "./db";

const PREVIEW_TTL = "20m";
const MANAGE_TTL = "30m";
const INVITE_TTL = "3d";

// signManageToken / verifyManageToken back the practa branding editor: the CMS
// console mints a short-lived, site-scoped token (owner/admin only) that practa
// trusts (via the service API manage.verify) to let the owner edit that one
// site's config. Same trust model as the preview token.
export function signManageToken(siteKey: string): string {
  return jwt.sign({ kind: "manage", site: siteKey }, process.env.JWT_SECRET as string, {
    expiresIn: MANAGE_TTL,
  });
}

export function verifyManageToken(token: string): { site: string } | null {
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET as string) as { kind?: string; site?: string };
    if (p.kind !== "manage" || !p.site) return null;
    return { site: p.site };
  } catch {
    return null;
  }
}

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
// via (a) an admin session cookie, or (b) a Bearer that is an admin JWT or a
// preview token scoped to this site (the renderer carries it). Admin-only —
// there's no editor/owner tier anymore. Backs the ?draft=1 gate.
export function draftAuthorized(req: NextRequest, site: Site): boolean {
  if (getSessionUser(req)?.role === "admin") return true;

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const candidates = [bearer, req.headers.get("x-admin-token")].filter(Boolean) as string[];
  for (const tok of candidates) {
    try {
      const p = jwt.verify(tok, process.env.JWT_SECRET as string) as {
        kind?: string;
        site?: string;
        role?: string;
      };
      if (p.role === "admin") return true;
      if (p.kind === "preview" && p.site === site.key) return true;
    } catch {
      // try the next candidate
    }
  }
  return false;
}

// requireSiteAccess gates a per-site CMS handler. The control plane is admin-only
// (customer CMS moved to the practa scope), so this requires the admin role and
// just 404s unknown sites — there's no longer an editor/owner tier.
export async function requireSiteAccess(
  req: NextRequest,
  siteKey: string
): Promise<Guard> {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate;
  const { rows } = await pool.query(`SELECT 1 FROM sites WHERE key = $1`, [siteKey]);
  if (rows.length === 0)
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  return gate;
}
