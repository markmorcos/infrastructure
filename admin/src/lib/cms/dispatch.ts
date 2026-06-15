// GitHub repository_dispatch trigger, ported from cms/publish.go. Best-effort:
// publish always succeeds; this only reports whether the site's CI rebuild was
// triggered. Empty GITHUB_TOKEN (or missing repo/event) disables dispatch.

import type { Site } from "./db";

// dispatch fires a repository_dispatch event so the site's CI rebuilds it with
// the freshly published content. Returns true on success, false (logged) on any
// failure — the caller surfaces a warning instead of failing the publish.
export async function dispatch(site: Site): Promise<boolean> {
  if (!site.githubRepo || !site.dispatchEvent) {
    console.error(
      `publish ${site.key}: dispatch: site has no github_repo/dispatch_event configured`
    );
    return false;
  }
  // The global PAT (GITHUB_PAT, repo+workflow scope) covers repository_dispatch;
  // fall back to GITHUB_TOKEN for parity with the old Go service.
  const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
  if (!token) {
    console.error(`publish ${site.key}: dispatch: no GITHUB_PAT/GITHUB_TOKEN configured`);
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(
      `https://api.github.com/repos/${site.githubRepo}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: site.dispatchEvent,
          client_payload: { site: site.key },
        }),
        signal: controller.signal,
      }
    );
    // GitHub returns 204 No Content on success.
    if (res.status !== 204) {
      console.error(
        `publish ${site.key}: dispatch: github dispatch: unexpected status ${res.status}`
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error(`publish ${site.key}: dispatch: ${(e as Error).message}`);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
