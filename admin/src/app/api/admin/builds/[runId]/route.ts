import { NextRequest, NextResponse } from "next/server";
import { listRunJobs } from "@/lib/github";
import { cached } from "@/lib/cache";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const jobs = await cached(`jobs:${runId}`, 12_000, () => listRunJobs(Number(runId)), fresh);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load run jobs" }, { status: 500 });
  }
}
