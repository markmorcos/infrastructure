import { NextRequest, NextResponse } from "next/server";
import { checkKey } from "@/lib/cms/onboard";

// Public subdomain availability check for the onboarding wizard.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export async function GET(req: NextRequest) {
  const key = (req.nextUrl.searchParams.get("key") ?? "").trim().toLowerCase();
  const result = await checkKey(key);
  return NextResponse.json(result, { status: 200, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
