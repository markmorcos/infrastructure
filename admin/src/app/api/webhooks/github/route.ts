import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { invalidate } from "@/lib/cache";
import { publishBuildsChanged } from "@/lib/events";

// GitHub webhook receiver (middleware-exempt — authed by the HMAC signature).
// On workflow_run / workflow_job events it drops the builds cache and fans out
// a "changed" event so open builds pages refresh live.

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhooks not configured" }, { status: 503 });
  }

  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const event = req.headers.get("x-github-event") ?? "";
  const raw = await req.text();

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  if (event === "workflow_run" || event === "workflow_job") {
    let runId: number | undefined;
    try {
      const body = JSON.parse(raw);
      runId = body?.workflow_run?.id ?? body?.workflow_job?.run_id;
    } catch {
      // ignore parse errors
    }
    await invalidate("builds");
    if (runId) await invalidate(`jobs:${runId}`);
    await publishBuildsChanged();
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
