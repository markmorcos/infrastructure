import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    // Only return safe user info
    const { userId, email, role } = payload as {
      userId: string;
      email: string;
      role: string;
    };
    return NextResponse.json({ id: userId, email, role });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
