import { NextRequest, NextResponse } from "next/server";
import { restoreStatus } from "@/lib/backups";

// Poll a restore Job's phase + logs.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ job: string }> }
) {
  const { job } = await params;
  try {
    return NextResponse.json(await restoreStatus(job), { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "could not read restore status" }, { status: 500 });
  }
}
