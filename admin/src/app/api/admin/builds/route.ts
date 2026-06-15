import { NextRequest, NextResponse } from "next/server";
import { listDeployRuns } from "@/lib/github";
import { cached } from "@/lib/cache";
import { getSessionUser } from "@/lib/cms/authz";
import { allowedProjects, scopeRuns } from "@/lib/buildsAccess";

// Cached ~20s so the page's 8s polling (and reloads) share one GitHub fetch.
// The cache holds the full run list; per-request scoping to an editor's owned
// apps happens after the cache read. ?fresh=1 bypasses the cache.
const TTL_MS = 20_000;

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const runs = await cached("builds", TTL_MS, () => listDeployRuns(50), fresh);
    const scoped = scopeRuns(runs, await allowedProjects(user));
    return NextResponse.json({ runs: scoped });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to list builds" }, { status: 500 });
  }
}
