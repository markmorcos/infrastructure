import { NextRequest, NextResponse } from "next/server";
import { createRestore, type BackupKind } from "@/lib/backups";

// Spawn a restore Job. DESTRUCTIVE — requires explicit { confirm: true }.

const RESTORABLE: BackupKind[] = ["postgres", "mongo", "minio"];

export async function POST(req: NextRequest) {
  let body: { kind?: string; key?: string; name?: string; confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: "confirmation required" }, { status: 400 });
  }
  if (!body.kind || !RESTORABLE.includes(body.kind as BackupKind)) {
    return NextResponse.json({ error: "unsupported restore kind" }, { status: 400 });
  }
  if (!body.key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }
  try {
    const job = await createRestore(body.kind as BackupKind, body.key, body.name ?? "");
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "could not start restore" }, { status: 500 });
  }
}
