import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cmsPool as pool } from "@/lib/db";

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
