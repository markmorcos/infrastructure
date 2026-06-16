import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getSiteByKey, siteBundle } from "@/lib/cms/db";

// Studio renderer bundle: everything one site render needs (meta, preset,
// theme overrides, settings, pages with content, assets) in a single call. The
// multi-tenant renderer fetches this server-side per request. Published content
// is public; ?draft=1 previews drafts and requires admin auth (editor preview).

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
} as const;

async function adminAuthed(req: NextRequest): Promise<boolean> {
  const candidates: string[] = [];
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) candidates.push(auth.slice(7));
  const xAdmin = req.headers.get("x-admin-token");
  if (xAdmin) candidates.push(xAdmin);
  const cookie = req.cookies.get("token")?.value;
  if (cookie) candidates.push(cookie);

  for (const token of candidates) {
    try {
      const { payload } = await jwtVerify(token, secret);
      if (payload.role === "admin") return true;
    } catch {
      // try the next candidate
    }
  }
  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  try {
    const site = await getSiteByKey(siteKey);
    if (!site) {
      return NextResponse.json(
        { error: "not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const draft = req.nextUrl.searchParams.get("draft") === "1";
    if (draft && !(await adminAuthed(req))) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    let locale = req.nextUrl.searchParams.get("locale") ?? "";
    if (locale === "") locale = site.defaultLocale;
    if (!site.locales.includes(locale)) {
      return NextResponse.json(
        { error: "unknown locale" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const bundle = await siteBundle(site, locale, draft);

    const headers: Record<string, string> = { ...CORS_HEADERS };
    if (!draft && bundle.publishedAt) {
      const etag = `"${bundle.publishedAt}"`;
      headers["ETag"] = etag;
      headers["Cache-Control"] = "no-cache";
      if (req.headers.get("if-none-match") === etag) {
        return new NextResponse(null, { status: 304, headers });
      }
    }

    return NextResponse.json(bundle, { status: 200, headers });
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
