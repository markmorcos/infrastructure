import { NextRequest, NextResponse } from "next/server";
import { listDeployRuns } from "@/lib/github";
import { cached } from "@/lib/cache";

// Cached ~20s so the page's 8s polling (and reloads) share one GitHub fetch.
// ?fresh=1 bypasses the cache.
const TTL_MS = 20_000;

export async function GET(req: NextRequest) {
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const runs = await cached("builds", TTL_MS, () => listDeployRuns(50), fresh);
    return NextResponse.json({ runs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to list builds" }, { status: 500 });
  }
}
