import { NextRequest, NextResponse } from "next/server";
import { serialize } from "cookie";
import jwt from "jsonwebtoken";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { Pool } from "pg";
import {
  OIDC_ENABLED,
  OIDC_TOKEN,
  OIDC_JWKS,
  OIDC_ISSUER,
  OIDC_CLIENT_ID,
  OIDC_REDIRECT_URI,
} from "@/lib/oidc";

export const runtime = "nodejs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWKS = createRemoteJWKSet(new URL(OIDC_JWKS));

// OIDC callback: exchange the code (PKCE, no client secret), verify the ID token
// against Zitadel's JWKS, map to an admin user, and mint the SAME `token` session
// cookie the password login issues (so nothing downstream changes).
export async function GET(req: NextRequest) {
  if (!OIDC_ENABLED) {
    return NextResponse.json({ error: "oidc disabled" }, { status: 404 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const verifier = req.cookies.get("oidc_verifier")?.value;
  const expectedState = req.cookies.get("oidc_state")?.value;

  if (!code || !state || !verifier || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "invalid oidc callback" }, { status: 400 });
  }

  // Exchange the authorization code for tokens.
  const tokRes = await fetch(OIDC_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: OIDC_REDIRECT_URI,
      client_id: OIDC_CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (!tokRes.ok) {
    return NextResponse.json({ error: "token exchange failed" }, { status: 401 });
  }
  const tokens = (await tokRes.json()) as { id_token?: string };
  if (!tokens.id_token) {
    return NextResponse.json({ error: "no id_token" }, { status: 401 });
  }

  // Verify the ID token (signature, issuer, audience) against Zitadel's JWKS.
  let email = "";
  try {
    const { payload } = await jwtVerify(tokens.id_token, JWKS, {
      issuer: OIDC_ISSUER,
      audience: OIDC_CLIENT_ID,
    });
    email = typeof payload.email === "string" ? payload.email : "";
  } catch {
    return NextResponse.json({ error: "id_token verification failed" }, { status: 401 });
  }

  // Map the verified identity to an admin user. Behind the flag with a single admin
  // this resolves to the seeded admin; proper Zitadel role/grant mapping comes at the
  // cutover. Match by email when present, else fall back to the seeded admin (id 1).
  let userId = 1;
  let role = "admin";
  let userEmail = email || "admin@zitadel";
  if (email) {
    const { rows } = await pool.query(
      `SELECT id, email, role FROM users WHERE email = $1`,
      [email]
    );
    if (rows.length) {
      userId = rows[0].id;
      role = rows[0].role;
      userEmail = rows[0].email;
    }
  }

  const token = jwt.sign(
    { userId, email: userEmail, role },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

  // Relative Location so the browser resolves it against the public host
  // (admin.morcos.tech). Using new URL("/", req.url) would resolve against the
  // container's internal origin (localhost:3000) behind the proxy.
  const headers = new Headers();
  headers.append("Location", "/");
  headers.append(
    "Set-Cookie",
    serialize("token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  );
  // Clear the one-shot PKCE cookies.
  const clear = { path: "/", maxAge: 0 };
  headers.append("Set-Cookie", serialize("oidc_verifier", "", clear));
  headers.append("Set-Cookie", serialize("oidc_state", "", clear));
  return new Response(null, { status: 302, headers });
}
