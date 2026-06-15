import Redis from "ioredis";

// Redis pub/sub fan-out for "builds changed" events. The GitHub webhook handler
// publishes; each open SSE stream subscribes and pushes to its browser. Redis
// (not an in-process emitter) so it works even if admin scales to >1 replica.
//
// Requires the admin Redis user to have channel access: `ACL SETUSER admin
// &events:*` (granted + persisted via ACL SAVE).

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

export async function publishBuildsChanged(): Promise<void> {
  try {
    await pub()?.publish(CHANNEL, String(Date.now()));
  } catch {
    // best-effort
  }
}

// subscribeBuildsChanged opens a dedicated subscriber connection and invokes
// onChange on each event. Returns a cleanup function.
export function subscribeBuildsChanged(onChange: () => void): () => void {
  const url = process.env.REDIS_ADMIN_URL;
  if (!url) return () => {};
  const sub = new Redis(url, { maxRetriesPerRequest: null });
  sub.on("error", () => {});
  sub.subscribe(CHANNEL).catch(() => {});
  sub.on("message", (ch) => {
    if (ch === CHANNEL) onChange();
  });
  return () => {
    try {
      sub.disconnect();
    } catch {
      // ignore
    }
  };
}
