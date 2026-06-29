import { createHash, randomBytes } from "crypto";

// OIDC (Zitadel) login — an ALTERNATE way to establish the existing admin session
// cookie, gated by AUTH_OIDC_ENABLED. When enabled, /api/auth/oidc/start begins a
// PKCE Authorization Code flow and /api/auth/callback verifies the ID token and
// mints the same `token` cookie the password login issues — so middleware and the
// requireAdmin checks are unchanged. The password login stays the default until the
// deliberate cutover.

export const OIDC_ENABLED = process.env.AUTH_OIDC_ENABLED === "true";
export const OIDC_ISSUER = process.env.AUTH_OIDC_ISSUER ?? "https://auth.morcos.tech";
export const OIDC_CLIENT_ID = process.env.AUTH_OIDC_CLIENT_ID ?? "";
export const OIDC_REDIRECT_URI =
  process.env.AUTH_OIDC_REDIRECT_URI ?? "https://admin.morcos.tech/api/auth/callback";

// Zitadel endpoints (stable for the known issuer; avoids a discovery round-trip).
export const OIDC_AUTHORIZE = `${OIDC_ISSUER}/oauth/v2/authorize`;
export const OIDC_TOKEN = `${OIDC_ISSUER}/oauth/v2/token`;
export const OIDC_JWKS = `${OIDC_ISSUER}/oauth/v2/keys`;
export const OIDC_END_SESSION = `${OIDC_ISSUER}/oidc/v1/end_session`;

export function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function makePkce(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function randomState(): string {
  return b64url(randomBytes(16));
}
