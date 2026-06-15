import { NextRequest, NextResponse } from "next/server";
import { listRunJobs } from "@/lib/github";
import { cached } from "@/lib/cache";
import { requireRunAccess } from "@/lib/buildsAccess";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const guard = await requireRunAccess(req, Number(runId));
  if ("error" in guard) return guard.error;
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const jobs = await cached(`jobs:${runId}`, 12_000, () => listRunJobs(Number(runId)), fresh);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load run jobs" }, { status: 500 });
  }
}
