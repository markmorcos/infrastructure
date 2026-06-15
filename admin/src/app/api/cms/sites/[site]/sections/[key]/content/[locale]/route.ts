import { NextRequest, NextResponse } from "next/server";
import {
  getDraft,
  getSection,
  getSiteByKey,
  localeAll,
  upsertDraft,
  type Section,
  type Site,
} from "@/lib/cms/admin";
import { requireSiteAccess } from "@/lib/cms/authz";

// Admin draft get/save for one (section, locale), ported from cms/adminapi.go
// apiGetDraft / apiPutDraft. The PUT body is a clean JSON object (we drop the Go
// server's form-name protocol); the UI is responsible for producing the correct
// stored JSON shapes from the schema.

// sectionLocale validates the {locale} path value against the site, allowing "*"
// only for non-localized sections and requiring it for them (cms/adminapi.go
// sectionLocale). Returns the resolved locale or an error response.
function resolveLocale(
  site: Site,
  section: Section,
  locale: string
): { locale: string } | { error: NextResponse } {
  if (!section.localized) {
    if (locale !== localeAll) {
      return {
        error: NextResponse.json(
          { error: `section is not localized; use locale ${localeAll}` },
          { status: 400 }
        ),
      };
    }
    return { locale: localeAll };
  }
  if (!site.locales.includes(locale)) {
    return {
      error: NextResponse.json({ error: "unknown locale" }, { status: 400 }),
    };
  }
  return { locale };
}

async function resolve(
  siteKey: string,
  sectionKey: string,
  rawLocale: string
):
  | Promise<
      | { site: Site; section: Section; locale: string }
      | { error: NextResponse }
    > {
  const site = await getSiteByKey(siteKey);
  if (!site) {
    return { error: NextResponse.json({ error: "site not found" }, { status: 404 }) };
  }
  const section = await getSection(site.id, sectionKey);
  if (!section) {
    return {
      error: NextResponse.json({ error: "section not found" }, { status: 404 }),
    };
  }
  const res = resolveLocale(site, section, rawLocale);
  if ("error" in res) return res;
  return { site, section, locale: res.locale };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ site: string; key: string; locale: string }> }
) {
  const { site: siteKey, key, locale: rawLocale } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;
  try {
    const r = await resolve(siteKey, key, decodeURIComponent(rawLocale));
    if ("error" in r) return r.error;
    const draft = await getDraft(r.section.id, r.locale);
    return NextResponse.json(
      { section: r.section.key, locale: r.locale, draft },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ site: string; key: string; locale: string }> }
) {
  const { site: siteKey, key, locale: rawLocale } = await params;
  const access = await requireSiteAccess(req, siteKey);
  if ("error" in access) return access.error;
  try {
    const r = await resolve(siteKey, key, decodeURIComponent(rawLocale));
    if ("error" in r) return r.error;

    let obj: unknown;
    try {
      obj = await req.json();
    } catch {
      return NextResponse.json(
        { error: "body must be a JSON object" },
        { status: 400 }
      );
    }
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return NextResponse.json(
        { error: "body must be a JSON object" },
        { status: 400 }
      );
    }
    const draft = obj as Record<string, unknown>;
    await upsertDraft(r.section.id, r.locale, draft);
    return NextResponse.json(
      { section: r.section.key, locale: r.locale, draft },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
