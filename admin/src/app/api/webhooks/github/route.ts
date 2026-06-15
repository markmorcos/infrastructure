import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { invalidate, invalidatePrefix } from "@/lib/cache";
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

  // Only fan out on real state transitions, not every webhook GitHub sends:
  //   workflow_run  → requested (scheduled) / completed
  //   workflow_job  → queued / in_progress (running) / completed
  // This skips noise (e.g. run in_progress, job waiting) so open builds pages
  // refresh once per meaningful change instead of on incidental deliveries.
  const RUN_ACTIONS = new Set(["requested", "completed"]);
  const JOB_ACTIONS = new Set(["queued", "in_progress", "completed"]);

  if (event === "workflow_run" || event === "workflow_job") {
    let runId: number | undefined;
    let action = "";
    try {
      const body = JSON.parse(raw);
      action = body?.action ?? "";
      runId = body?.workflow_run?.id ?? body?.workflow_job?.run_id;
    } catch {
      // ignore parse errors
    }

    const relevant =
      event === "workflow_run" ? RUN_ACTIONS.has(action) : JOB_ACTIONS.has(action);
    if (relevant) {
      await invalidatePrefix("builds"); // global list + every editor variant
      if (runId) await invalidate(`jobs:${runId}`);
      await publishBuildsChanged(runId);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
