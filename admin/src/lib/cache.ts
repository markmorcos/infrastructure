// Tiny in-memory TTL cache. The admin app runs as a single replica, so a
// module-level map is a valid cross-request cache. Used to avoid hitting the
// GitHub API on every builds-page refresh (it polls every 8s).

const store = new Map<string, { at: number; value: unknown }>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  bypass = false
): Promise<T> {
  const hit = store.get(key);
  if (!bypass && hit && Date.now() - hit.at < ttlMs) {
    return hit.value as T;
  }
  const value = await load();
  store.set(key, { at: Date.now(), value });
  return value;
}

// invalidate drops any cache entry whose key equals or starts with `prefix`.
export function invalidate(prefix: string): void {
  for (const k of store.keys()) {
    if (k === prefix || k.startsWith(prefix)) store.delete(k);
  }
}
