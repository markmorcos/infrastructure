import { NextRequest, NextResponse } from "next/server";
import { verifyToken, bearer } from "@/lib/cms/tokens";
import { summarize, clampDays } from "@/lib/analytics-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-tenant analytics summary for the practa owner dashboard. Token-authed (the
// CMS service token, same as ingest); the caller passes the site it resolved for
// the authenticated owner. ?site=<key> required, ?days=N (default 30).
export async function GET(req: NextRequest) {
  const authed = (await verifyToken(bearer(req.headers.get("authorization")))) !== null;
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const site = url.searchParams.get("site");
  if (!site) return NextResponse.json({ error: "site required" }, { status: 400 });
  const days = clampDays(url.searchParams.get("days"));

  try {
    const summary = await summarize(site, days);
    return NextResponse.json({ site, days, ...summary });
  } catch (e) {
    console.error("analytics stats failed", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
