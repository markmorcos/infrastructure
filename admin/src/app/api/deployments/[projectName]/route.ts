import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectName: string }> }
) {
  const { projectName } = await params;
  if (!projectName) {
    return NextResponse.json(
      { error: "Deployment not found" },
      { status: 404 }
    );
  }

  try {
    const { rows } = await pool.query(
      `SELECT project_name, repository_name, config, token, created_at, updated_at FROM deployments WHERE project_name = $1`,
      [projectName]
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }
    const deployment = {
      projectName: rows[0].project_name,
      repositoryName: rows[0].repository_name,
      config: rows[0].config,
      token: rows[0].token,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at,
    };
    return NextResponse.json(deployment);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch deployment" },
      { status: 500 }
    );
  }
}
