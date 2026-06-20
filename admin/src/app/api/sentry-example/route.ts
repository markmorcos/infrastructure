import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

// Server-side Sentry verification. Gated to dev / NEXT_PUBLIC_SENTRY_DEBUG=1.
export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SENTRY_DEBUG !== "1") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  Sentry.captureException(new Error("Sentry backend test (infrastructure)"));
  await Sentry.flush(2000);
  return NextResponse.json({ sent: true });
}
