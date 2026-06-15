import { NextRequest, NextResponse } from "next/server";
import { createSite, listSites, validKey } from "@/lib/cms/admin";

// Admin sites collection, ported from cms/adminapi.go apiListSites /
// apiCreateSite. Gated admin-only by src/middleware.ts (under /api/cms, not v1).

export async function GET() {
  try {
    return NextResponse.json(await listSites(), { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    key?: string;
    name?: string;
    locales?: string[];
    defaultLocale?: string;
    githubRepo?: string;
    dispatchEvent?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.key || !validKey(body.key)) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }
  try {
    const site = await createSite({
      key: body.key,
      name: body.name,
      locales: body.locales,
      defaultLocale: body.defaultLocale,
      githubRepo: body.githubRepo,
      dispatchEvent: body.dispatchEvent,
    });
    return NextResponse.json(site, { status: 201 });
  } catch (error) {
    // Duplicate key etc. — Go returns 409 here.
    console.error(error);
    return NextResponse.json(
      { error: "could not create site" },
      { status: 409 }
    );
  }
}
