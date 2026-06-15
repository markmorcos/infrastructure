import { Pool } from "pg";
import { randomBytes } from "crypto";

// Strict identifier guard: lowercase start, then lowercase/digits/hyphen, <=63
// chars (Postgres identifier limit). Since DDL identifiers cannot be bound as
// parameters, every db/role name is validated against this before it is ever
// interpolated into SQL — this is the SQL-injection boundary.
const IDENT_RE = /^[a-z][a-z0-9-]{0,62}$/;

export function assertSafeIdentifier(name: string): void {
  if (!IDENT_RE.test(name)) {
    throw new Error(`unsafe identifier ${JSON.stringify(name)} (must match ${IDENT_RE})`);
  }
}

function quoteIdent(name: string): string {
  assertSafeIdentifier(name);
  return `"${name}"`;
}

// Derive a maintenance connection (same host/creds, the `postgres` database)
// from the admin's own DATABASE_URL. The admin role must have CREATEDB +
// CREATEROLE for this to work.
function maintenanceUrl(): URL {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set");
  const u = new URL(base);
  u.pathname = "/postgres";
  return u;
}

export interface PostgresProvisionResult {
  status: "created" | "exists";
  // Per-app connection string. SENSITIVE — persist only as a k8s secret; never
  // log it or return it to an API client.
  connectionString: string;
}

// Idempotently create a dedicated database + least-privilege login role for
// `project` (db-per-app). The role password is rotated on every run so the
// stored secret and the live role stay in sync.
export async function provisionPostgres(project: string): Promise<PostgresProvisionResult> {
  assertSafeIdentifier(project);
  const db = project;
  const role = project;
  // hex => [0-9a-f] only, so it is safe to inline as a SQL string literal.
  const password = randomBytes(24).toString("hex");

  const maint = maintenanceUrl();
  const admin = new Pool({ connectionString: maint.toString() });
  let created = false;
  try {
    const existingRole = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role]);
    if (existingRole.rowCount) {
      await admin.query(`ALTER ROLE ${quoteIdent(role)} WITH LOGIN PASSWORD '${password}'`);
    } else {
      await admin.query(`CREATE ROLE ${quoteIdent(role)} WITH LOGIN PASSWORD '${password}'`);
      created = true;
    }

    const existingDb = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
    if (!existingDb.rowCount) {
      // CREATE DATABASE cannot run inside a transaction; node-postgres sends
      // simple queries unwrapped, so this is fine.
      await admin.query(`CREATE DATABASE ${quoteIdent(db)} OWNER ${quoteIdent(role)}`);
      created = true;
    }
    await admin.query(`GRANT ALL PRIVILEGES ON DATABASE ${quoteIdent(db)} TO ${quoteIdent(role)}`);
  } finally {
    await admin.end();
  }

  // PG15+ revoked CREATE on `public` from non-owners — grant it inside the new
  // database so the app can run its migrations.
  const inDbUrl = maintenanceUrl();
  inDbUrl.pathname = `/${db}`;
  const inDb = new Pool({ connectionString: inDbUrl.toString() });
  try {
    await inDb.query(`GRANT ALL ON SCHEMA public TO ${quoteIdent(role)}`);
  } finally {
    await inDb.end();
  }

  const conn = `postgresql://${encodeURIComponent(role)}:${encodeURIComponent(password)}@${maint.host}/${db}`;
  return { status: created ? "created" : "exists", connectionString: conn };
}
