import Redis from "ioredis";

// Redis pub/sub fan-out for "builds changed" events. GitHub webhooks publish;
// the SSE stream subscribes and pushes to open builds pages. Redis (not an
// in-process emitter) so it survives restarts and works if admin ever scales.

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
    _pub = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
    _pub.on("error", () => {});
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

// subscribeBuildsChanged opens a dedicated subscriber connection and calls
// onChange on each event. Returns a cleanup function (close the connection).
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
