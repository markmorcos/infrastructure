import Redis from "ioredis";

// Redis-backed TTL cache (reuses REDIS_ADMIN_URL). Shared across requests and
// survives admin restarts. Every Redis call is best-effort: if Redis is
// unreachable, cached() falls through to the loader so the page never breaks.

const PREFIX = "cache:";
let _redis: Redis | null = null;
let disabled = false;

function redis(): Redis | null {
  if (disabled) return null;
  if (!_redis) {
    const url = process.env.REDIS_ADMIN_URL;
    if (!url) {
      disabled = true;
      return null;
    }
    _redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    // Swallow connection errors — callers degrade to the loader on failure.
    _redis.on("error", () => {});
  }
  return _redis;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  bypass = false
): Promise<T> {
  const r = redis();
  const k = PREFIX + key;
  if (r && !bypass) {
    try {
      const raw = await r.get(k);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // fall through to load
    }
  }
  const value = await load();
  if (r) {
    try {
      await r.set(k, JSON.stringify(value), "PX", ttlMs);
    } catch {
      // ignore cache-write failures
    }
  }
  return value;
}

// invalidate drops a cache key so the next request reloads it.
export async function invalidate(key: string): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    await r.del(PREFIX + key);
  } catch {
    // ignore
  }
}
