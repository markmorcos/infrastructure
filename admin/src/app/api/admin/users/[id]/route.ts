import { NextRequest, NextResponse } from "next/server";
import { updateUser, deleteUser, setOwnedSites } from "@/lib/users";
import { getSessionUser } from "@/lib/cms/authz";

// Single-user admin API. Admin-only via src/middleware.ts (under /api/admin).
// Guards against self-lockout: you can't delete or demote your own account.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uid = Number(id);
  const me = getSessionUser(req);
  let body: { role?: string; password?: string; ownedSites?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const role =
    body.role === "admin" ? "admin" : body.role === "editor" ? "editor" : undefined;
  if (me && me.userId === uid && role === "editor") {
    return NextResponse.json(
      { error: "you cannot demote your own admin account" },
      { status: 400 }
    );
  }
  try {
    await updateUser(uid, { role, password: body.password });
    if (Array.isArray(body.ownedSites)) {
      await setOwnedSites(
        uid,
        body.ownedSites.filter((s): s is string => typeof s === "string")
      );
    }
    return NextResponse.json({ updated: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uid = Number(id);
  const me = getSessionUser(req);
  if (me && me.userId === uid) {
    return NextResponse.json(
      { error: "you cannot delete your own account" },
      { status: 400 }
    );
  }
  try {
    await deleteUser(uid);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
