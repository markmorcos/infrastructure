import { cmsPool as pool } from "@/lib/db";
import bcrypt from "bcrypt";

// User management for the control plane. Uses cmsPool (search_path cms,public)
// so a single query can join public.users to cms.sites for ownership. Passwords
// are bcrypt-hashed, matching the login route.

export interface ManagedUser {
  id: number;
  email: string;
  role: string;
  createdAt: Date;
  ownedSites: string[];
}

const BCRYPT_ROUNDS = 10;

export async function listUsers(): Promise<ManagedUser[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.role, u.created_at,
            COALESCE(array_remove(array_agg(s.key), NULL), '{}') AS owned_sites
     FROM users u
     LEFT JOIN sites s ON s.owner_user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at`
  );
  return rows.map((r) => ({
    id: Number(r.id),
    email: r.email,
    role: r.role,
    createdAt: r.created_at,
    ownedSites: r.owned_sites as string[],
  }));
}

export async function createUser(
  email: string,
  password: string,
  role: string
): Promise<number> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id`,
    [email, hash, role]
  );
  return Number(rows[0].id);
}

export async function updateUser(
  id: number,
  fields: { role?: string; password?: string }
): Promise<void> {
  if (fields.role) {
    await pool.query(`UPDATE users SET role = $2 WHERE id = $1`, [id, fields.role]);
  }
  if (fields.password) {
    const hash = await bcrypt.hash(fields.password, BCRYPT_ROUNDS);
    await pool.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, hash]);
  }
}

export async function deleteUser(id: number): Promise<void> {
  // sites.owner_user_id is ON DELETE SET NULL, so owned sites revert to admin-only.
  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
}

// setOwnedSites makes `userId` the owner of exactly `siteKeys`: it claims those
// sites and releases any others this user previously owned.
export async function setOwnedSites(
  userId: number,
  siteKeys: string[]
): Promise<void> {
  await pool.query(
    `UPDATE sites SET owner_user_id = NULL
     WHERE owner_user_id = $1 AND key <> ALL($2::text[])`,
    [userId, siteKeys]
  );
  if (siteKeys.length) {
    await pool.query(
      `UPDATE sites SET owner_user_id = $1 WHERE key = ANY($2::text[])`,
      [userId, siteKeys]
    );
  }
}
