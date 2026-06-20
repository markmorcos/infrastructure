import { NextRequest, NextResponse } from "next/server";
import {
  getSiteByKey,
  getProjectByKey,
  siteContent,
  maxPublishedAt,
} from "@/lib/cms/db";
import { draftAuthorized } from "@/lib/cms/authz";
import { assembleDict } from "@/lib/cms/dict";
import { verifyToken, bearer } from "@/lib/cms/tokens";

// Public content API, ported from cms/main.go handleContent. Serves the
// assembled content dictionary for one locale of one site. Published content is
// public; ?draft=1 previews drafts and requires admin/owner auth (or a
// site-scoped preview token carried by the renderer).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  try {
    // Optional ?project=<key> scopes the lookup to that project; the no-query
    // case relies on getSiteByKey's transitional global fallback.
    const projectKey = req.nextUrl.searchParams.get("project");
    const project = projectKey ? await getProjectByKey(projectKey) : null;
    const site = await getSiteByKey(siteKey, { projectId: project?.id ?? null });
    if (!site) {
      return NextResponse.json(
        { error: "not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const draft = req.nextUrl.searchParams.get("draft") === "1";
    if (draft) {
      // A valid per-tenant API token authorizes draft reads (the consumer app,
      // e.g. practa, has done its own ownership check). Fall back to the legacy
      // owner/admin/preview-token path during cutover.
      const tenant = await verifyToken(bearer(req.headers.get("authorization")));
      if (!tenant && !draftAuthorized(req, site)) {
        return NextResponse.json(
          { error: "unauthorized" },
          { status: 401, headers: CORS_HEADERS }
        );
      }
    }

    let locale = req.nextUrl.searchParams.get("locale") ?? "";
    if (locale === "") locale = site.defaultLocale;
    if (!site.locales.includes(locale)) {
      return NextResponse.json(
        { error: "unknown locale" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { sections, content } = await siteContent(site.id, draft);
    const publishedAt = await maxPublishedAt(site.id);

    const headers: Record<string, string> = { ...CORS_HEADERS };
    if (!draft && publishedAt) {
      const etag = `"${publishedAt}"`;
      headers["ETag"] = etag;
      headers["Cache-Control"] = "no-cache";
      if (req.headers.get("if-none-match") === etag) {
        return new NextResponse(null, { status: 304, headers });
      }
    }

    return NextResponse.json(
      {
        site: site.key,
        name: site.name,
        locale,
        locales: site.locales,
        publishedAt,
        content: assembleDict(sections, content, locale),
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "internal error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
