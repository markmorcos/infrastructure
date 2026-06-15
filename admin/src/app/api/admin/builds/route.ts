import { NextResponse } from "next/server";
import { listDeployRuns } from "@/lib/github";

export async function GET() {
  try {
    const runs = await listDeployRuns(50);
    return NextResponse.json({ runs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to list builds" }, { status: 500 });
  }
}
