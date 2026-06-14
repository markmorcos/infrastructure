import { NextRequest, NextResponse } from "next/server";
import { listRunJobs } from "@/lib/github";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const jobs = await listRunJobs(Number(runId));
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load run jobs" }, { status: 500 });
  }
}
