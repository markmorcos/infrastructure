import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { decodeDeploymentToken } from "@/lib/jwt";

// Machine endpoint for the deploy pipeline: authenticated by the deployment
// token itself (verified server-side), NOT by a session cookie — so it is
// exempt from the auth middleware. Returns whether the token's project is
// enabled in the registry. Never returns secrets.
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    const { sub, valid } = decodeDeploymentToken(token);
    if (!valid || !sub) {
      return NextResponse.json({ valid: false, project: sub, enabled: null });
    }

    const { rows } = await pool.query(
      `SELECT enabled FROM projects WHERE project_name = $1`,
      [sub]
    );
    return NextResponse.json({
      valid: true,
      project: sub,
      found: rows.length > 0,
      enabled: rows.length > 0 ? rows[0].enabled : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "verify failed" }, { status: 500 });
  }
}
