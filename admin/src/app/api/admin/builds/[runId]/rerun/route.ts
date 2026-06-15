import { NextRequest, NextResponse } from "next/server";
import { reRunFailedJobs, reRunRun } from "@/lib/github";
import { invalidate, invalidatePrefix } from "@/lib/cache";
import { requireAdmin } from "@/lib/cms/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  // Re-running a deploy is a write action — admin-only, even though editors can
  // reach the builds subtree (middleware SCOPED_PREFIXES) to view their app.
  const guard = requireAdmin(req);
  if ("error" in guard) return guard.error;
  const { runId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const id = Number(runId);
    if (body.mode === "all") {
      await reRunRun(id);
    } else {
      await reRunFailedJobs(id);
    }
    // The run is now restarting — drop the cached list + this run's jobs so the
    // next poll shows it immediately rather than waiting out the TTL.
    await invalidatePrefix("builds");
    await invalidate(`jobs:${runId}`);
    return NextResponse.json({ ok: true, mode: body.mode === "all" ? "all" : "failed" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Re-run failed" },
      { status: 500 }
    );
  }
}
