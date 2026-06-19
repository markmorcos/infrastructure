import { NextRequest, NextResponse } from "next/server";
import { handleServiceAction, ServiceError } from "@/lib/cms/service";
import { verifyToken, bearer } from "@/lib/cms/tokens";

// minio (assets.add) + pg need the Node runtime.
export const runtime = "nodejs";

// Internal CMS service API (single shared-secret write path). Not public, not
// CORS-enabled: only in-cluster callers (the admin console, the practa product)
// with the shared secret. RPC-style: POST { action, params }.

export async function POST(req: NextRequest) {
  // Per-tenant API token only (Authorization: Bearer). The legacy shared-secret
  // accept was dropped after practa moved to tokens.
  const authed = (await verifyToken(bearer(req.headers.get("authorization")))) !== null;
  if (!authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { action?: unknown; params?: unknown };
  try {
    body = (await req.json()) as { action?: unknown; params?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (typeof body.action !== "string") {
    return NextResponse.json({ error: "missing action" }, { status: 400 });
  }
  const params =
    body.params && typeof body.params === "object"
      ? (body.params as Record<string, unknown>)
      : {};

  try {
    const result = await handleServiceAction(body.action, params);
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (e) {
    if (e instanceof ServiceError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("cms service action failed", body.action, e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
