import Redis from "ioredis";

// Redis pub/sub fan-out for "builds changed" events. The GitHub webhook handler
// publishes; each open SSE stream subscribes and pushes to its browser. Redis
// (not an in-process emitter) so it works even if admin scales to >1 replica.
//
// Requires the admin Redis user to have channel access. In Redis 7, channels
// are a separate ACL axis from commands/keys and default to deny, so even a
// full `+@all ~*` user needs an explicit grant. The admin user is provisioned
// with `allcommands allkeys allchannels` (&*), persisted via ACL SAVE.

const CHANNEL = "events:builds";

let _pub: Redis | null = null;
let pubDisabled = false;
function pub(): Redis | null {
  if (pubDisabled) return null;
  if (!_pub) {
    const url = process.env.REDIS_ADMIN_URL;
    if (!url) {
      pubDisabled = true;
      return null;
    }
    _pub = new Redis(url); // default offline queue so a publish before the
    _pub.on("error", () => {}); // connection is ready still goes through
  }
  return _pub;
}

// publishBuildsChanged fans out a change. The optional runId lets subscribers
// know which run transitioned, so an open builds page can refetch just that
// run's jobs instead of guessing. Empty string means "list changed, run unknown".
export async function publishBuildsChanged(runId?: number): Promise<void> {
  try {
    await pub()?.publish(CHANNEL, runId ? String(runId) : "");
  } catch {
    // best-effort
  }
}

// subscribeBuildsChanged opens a dedicated subscriber connection and invokes
// onChange(runId) on each event (runId is "" when unknown). Returns a cleanup
// function.
export function subscribeBuildsChanged(onChange: (runId: string) => void): () => void {
  const url = process.env.REDIS_ADMIN_URL;
  if (!url) return () => {};
  const sub = new Redis(url, { maxRetriesPerRequest: null });
  sub.on("error", () => {});
  sub.subscribe(CHANNEL).catch(() => {});
  sub.on("message", (ch, msg) => {
    if (ch === CHANNEL) onChange(msg ?? "");
  });
  return () => {
    try {
      sub.disconnect();
    } catch {
      // ignore
    }
  };
}
