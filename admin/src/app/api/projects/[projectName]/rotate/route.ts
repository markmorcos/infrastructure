import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { mintDeploymentToken } from "@/lib/jwt";
import { putRepoSecret } from "@/lib/github";

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Mint a fresh deployment token (signed with the current JWT_SECRET), store it,
// and push it to the repo's DEPLOYMENT_TOKEN Actions secret when a repo is set.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectName: string }> }
) {
  const { projectName } = await params;
  try {
    const { rows } = await pool.query(
      `SELECT repo FROM projects WHERE project_name = $1`,
      [projectName]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const repo: string | null = rows[0].repo;

    const token = mintDeploymentToken(projectName);
    await pool.query(
      `UPDATE projects SET token = $2, updated_at = now() WHERE project_name = $1`,
      [projectName, token]
    );

    let pushedToRepo = false;
    let pushError: string | null = null;
    if (repo) {
      try {
        await putRepoSecret(repo, "DEPLOYMENT_TOKEN", token);
        pushedToRepo = true;
      } catch (e) {
        pushError = errMessage(e);
      }
    }

    return NextResponse.json({
      projectName,
      rotated: true,
      repo,
      pushedToRepo,
      pushError,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to rotate token" }, { status: 500 });
  }
}
