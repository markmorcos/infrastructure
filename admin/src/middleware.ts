import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

// Routes restricted to admins. Other authenticated routes only require a valid
// session (e.g. /api/auth/me).
const ADMIN_PREFIXES = ["/api/projects", "/api/deployments"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth routes (login/register/logout/me) are reachable without a prior session.
  // /api/verify is a machine endpoint authenticated by the deployment token in
  // its body, not by a cookie.
  if (pathname.startsWith("/api/auth") || pathname === "/api/verify") {
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
