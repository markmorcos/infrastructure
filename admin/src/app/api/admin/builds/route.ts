import { NextRequest, NextResponse } from "next/server";
import { listDeployRuns, listDeployRunsForProjects } from "@/lib/github";
import { cached } from "@/lib/cache";
import { getSessionUser } from "@/lib/cms/authz";
import { allowedProjects } from "@/lib/buildsAccess";

// Cached ~20s so the page's polling (and reloads) share one GitHub fetch.
// ?fresh=1 bypasses the cache. Admins get the global top page; editors get a
// per-project over-fetch (the runs API can't filter by app, so we paginate and
// filter) cached under a key derived from their owned projects, so a busy app
// can't crowd their history out of view.
const TTL_MS = 20_000;

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const allowed = await allowedProjects(user);
    if (allowed === null) {
      const runs = await cached("builds", TTL_MS, () => listDeployRuns(50), fresh);
      return NextResponse.json({ runs });
    }
    const cacheKey = `builds:proj:${[...allowed].sort().join(",") || "none"}`;
    const runs = await cached(
      cacheKey,
      TTL_MS,
      () => listDeployRunsForProjects(allowed, { target: 50 }),
      fresh,
    );
    return NextResponse.json({ runs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to list builds" }, { status: 500 });
  }
}
