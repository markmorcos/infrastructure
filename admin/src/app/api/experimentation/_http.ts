import { NextResponse } from "next/server";

// Shared helpers for the experimentation admin API routes. These routes live
// outside /api/experimentation/v1, so the app's session middleware already
// gates them to admins — no auth logic here.

// isDuplicateKey reports whether a pg error is a unique-violation (SQLSTATE
// 23505), which the Go service maps to 409 Conflict.
export function isDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
}

export function text(body: string, status: number): NextResponse {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

export const noContent = () => new NextResponse(null, { status: 204 });
