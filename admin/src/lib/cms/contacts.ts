import { cmsPool as pool } from "@/lib/db";

// Data layer for cms.contacts — contact-form submissions from studio-rendered
// sites (see migration 007-cms-contacts).

export interface NewContact {
  siteId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  locale: string;
  ip: string;
  userAgent: string;
}

export async function insertContact(c: NewContact): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO contacts (site_id, name, email, phone, message, locale, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [c.siteId, c.name, c.email, c.phone, c.message, c.locale, c.ip, c.userAgent]
  );
  return String(rows[0].id);
}

export async function markContactEmailed(id: string): Promise<void> {
  await pool.query(`UPDATE contacts SET emailed = true WHERE id = $1`, [id]);
}

// recentContactCount counts submissions from one IP to one site within the last
// `withinSeconds`, backing a simple DB-level rate limit (survives restarts and
// works across replicas, unlike an in-memory counter).
export async function recentContactCount(
  siteId: string,
  ip: string,
  withinSeconds: number
): Promise<number> {
  if (!ip) return 0;
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM contacts
     WHERE site_id = $1 AND ip = $2
       AND created_at > now() - make_interval(secs => $3)`,
    [siteId, ip, withinSeconds]
  );
  return rows[0].n as number;
}
