import Redis from "ioredis";
import { randomBytes } from "crypto";

// Same SQL-injection-style boundary as the Postgres provisioner: the project
// name is interpolated into ACL rules (key/channel patterns + username), so it
// must be a strict lowercase label before it touches Redis.
const IDENT_RE = /^[a-z][a-z0-9-]{0,62}$/;

function assertSafeIdentifier(name: string): void {
  if (!IDENT_RE.test(name)) {
    throw new Error(`unsafe identifier ${JSON.stringify(name)} (must match ${IDENT_RE})`);
  }
}

export interface RedisProvisionResult {
  status: "created" | "updated";
  // Per-app connection string. SENSITIVE — persist only as a k8s secret.
  connectionString: string;
}

// Idempotently create a per-app Redis ACL user scoped to the `<project>:` key
// and channel prefix (enforced isolation — the app must prefix its keys). The
// password is rotated on every run so the stored secret stays in sync.
export async function provisionRedis(project: string): Promise<RedisProvisionResult> {
  assertSafeIdentifier(project);
  const adminUrl = process.env.REDIS_ADMIN_URL;
  if (!adminUrl) throw new Error("REDIS_ADMIN_URL is not set");
  const password = randomBytes(24).toString("hex");

  const admin = new Redis(adminUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
  let existed = false;
  try {
    await admin.connect();
    const existing = await admin.call("ACL", "GETUSER", project);
    existed = existing != null;
    // `reset` clears the user to a clean slate, then scope keys + channels to
    // the `<project>:` prefix and allow everything except dangerous commands
    // (FLUSHALL / CONFIG / DEBUG / etc.).
    await admin.call(
      "ACL", "SETUSER", project,
      "reset", "on", `>${password}`,
      `~${project}:*`, `&${project}:*`, "+@all", "-@dangerous",
    );
    // Persist across restarts: CONFIG REWRITE (users in redis.conf) or ACL SAVE
    // (separate aclfile) — exactly one applies depending on the server config.
    try { await admin.call("CONFIG", "REWRITE"); } catch { /* no-op when an aclfile is used */ }
    try { await admin.call("ACL", "SAVE"); } catch { /* no-op when no aclfile is configured */ }
  } finally {
    admin.disconnect();
  }

  const u = new URL(adminUrl);
  const conn = `redis://${encodeURIComponent(project)}:${encodeURIComponent(password)}@${u.host}`;
  return { status: existed ? "updated" : "created", connectionString: conn };
}
