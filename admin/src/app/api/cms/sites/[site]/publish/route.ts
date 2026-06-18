import { NextRequest, NextResponse } from "next/server";
import { getSiteByKey, publishSite } from "@/lib/cms/admin";
import { requireSiteAccess } from "@/lib/cms/authz";

// Admin publish, ported from cms/adminapi.go apiPublish. Copies drafts to
// published in a txn + snapshots, then best-effort fires the GitHub rebuild.
// Content publishes even when dispatch fails; `dispatched` reports the outcome.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;
  try {
    const site = await getSiteByKey(siteKey);
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    const dispatched = await publishSite(site);
    // "instant" = nothing to rebuild: studio (preset) sites render live via SSR,
    // and sites with no rebuild webhook configured have no CI to trigger. Only a
    // site that HAS a configured rebuild target but failed to dispatch warrants
    // the "rebuild could not be triggered" warning.
    const instant = !!site.presetId || !site.githubRepo || !site.dispatchEvent;
    return NextResponse.json(
      { published: true, dispatched, instant },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
