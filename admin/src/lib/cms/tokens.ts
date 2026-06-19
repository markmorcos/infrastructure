import { randomBytes, createHash } from "crypto";
import { cmsPool as pool } from "@/lib/db";

// Per-tenant API token store. Tokens are random strings shown once at creation;
// only their sha256 hash is persisted (cms.api_tokens). Auth = look up the hash
// among non-revoked rows. This is the new auth for the CMS service + content
// API, replacing the single CMS_SERVICE_SECRET.

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

// bearer extracts a "Bearer <token>" Authorization header value, or null.
export function bearer(authorization: string | null): string | null {
  if (!authorization) return null;
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() || null : null;
}

// verifyToken returns the owning tenant for a presented token (and bumps
// last_used_at), or null when the token is unknown/revoked.
export async function verifyToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  try {
    const { rows } = await pool.query(
      `UPDATE cms.api_tokens SET last_used_at = now()
         WHERE token_hash = $1 AND revoked_at IS NULL
         RETURNING tenant`,
      [hashToken(token)]
    );
    return rows.length ? (rows[0].tenant as string) : null;
  } catch {
    return null;
  }
}

// createToken issues a new token for a tenant and returns the plaintext ONCE.
export async function createToken(tenant: string, scopes: string[] | null = null): Promise<{ id: string; token: string }> {
  const token = `prac_${randomBytes(24).toString("hex")}`;
  const { rows } = await pool.query(
    `INSERT INTO cms.api_tokens (tenant, token_hash, scopes)
     VALUES ($1, $2, $3) RETURNING id`,
    [tenant, hashToken(token), scopes ? JSON.stringify(scopes) : null]
  );
  return { id: String(rows[0].id), token };
}

export async function revokeToken(id: string): Promise<void> {
  await pool.query(`UPDATE cms.api_tokens SET revoked_at = now() WHERE id = $1`, [id]);
}
