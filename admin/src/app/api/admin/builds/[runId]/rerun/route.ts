import { NextRequest, NextResponse } from "next/server";
import { reRunFailedJobs, reRunRun } from "@/lib/github";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const id = Number(runId);
    if (body.mode === "all") {
      await reRunRun(id);
    } else {
      await reRunFailedJobs(id);
    }
    return NextResponse.json({ ok: true, mode: body.mode === "all" ? "all" : "failed" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Re-run failed" },
      { status: 500 }
    );
  }
}
