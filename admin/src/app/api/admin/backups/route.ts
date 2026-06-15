import { NextResponse } from "next/server";
import { listBackups, backupsConfigured } from "@/lib/backups";

// Backups list — objects in the R2 backup bucket, grouped. Admin-only (middleware).

export async function GET() {
  if (!backupsConfigured()) {
    return NextResponse.json({ error: "R2 backups not configured" }, { status: 503 });
  }
  try {
    return NextResponse.json(await listBackups(), { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "could not list backups" }, { status: 500 });
  }
}
