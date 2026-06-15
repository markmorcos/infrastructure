import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

// Routes restricted to admins. The control-plane APIs (projects/builds/runtime)
// live under /api/admin/*; the experimentation console is admin-only too.
// Editors are confined to /api/cms/* (with per-site ownership enforced in those
// handlers); other authenticated routes only need a valid session.
const ADMIN_PREFIXES = ["/api/admin", "/api/experimentation"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public, unauthenticated endpoints:
  // - /api/auth/* (login/register/logout/me)
  // - /api/verify (machine endpoint authed by the deployment token in its body)
  // - /api/<app>/v1/* (the public surfaces — CMS content + experimentation SDK;
  //   public by design. The CMS content route does its own admin check for
  //   ?draft=1.) Admin/console APIs live at /api/<app>/... without /v1 and stay
  //   session-gated.
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/verify" ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/cms/v1") ||
    pathname.startsWith("/api/experimentation/v1")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (
      ADMIN_PREFIXES.some((p) => pathname.startsWith(p)) &&
      payload.role !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
