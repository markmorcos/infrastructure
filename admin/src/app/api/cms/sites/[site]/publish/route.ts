import { NextRequest, NextResponse } from "next/server";
import { getSiteByKey, publishSite } from "@/lib/cms/admin";

// Admin publish, ported from cms/adminapi.go apiPublish. Copies drafts to
// published in a txn + snapshots, then best-effort fires the GitHub rebuild.
// Content publishes even when dispatch fails; `dispatched` reports the outcome.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  try {
    const site = await getSiteByKey(siteKey);
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    const dispatched = await publishSite(site);
    return NextResponse.json(
      { published: true, dispatched },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
