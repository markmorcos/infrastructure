import { NextRequest, NextResponse } from "next/server";
import { listUsers, createUser } from "@/lib/users";

// Users & Access admin API. Admin-only via src/middleware.ts (under /api/admin).

export async function GET() {
  try {
    return NextResponse.json(await listUsers(), { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }
  try {
    // Admin-only control plane: every user is an admin.
    const id = await createUser(body.email, body.password, "admin");
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    // Most likely a duplicate email (users.email is UNIQUE).
    console.error(error);
    return NextResponse.json(
      { error: "could not create user (email already in use?)" },
      { status: 409 }
    );
  }
}
