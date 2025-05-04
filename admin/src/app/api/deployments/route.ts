import { NextRequest, NextResponse } from "next/server";
// @ts-expect-error: No types for 'pg' in this project
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface DatabaseDeployment {
  project_name: string;
  repository_name: string;
  config: string;
  token: string;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT project_name, repository_name, config, token, created_at, updated_at FROM deployments ORDER BY created_at DESC`
    );
    const deployments = rows.map((row: DatabaseDeployment) => ({
      projectName: row.project_name,
      repositoryName: row.repository_name,
      config: row.config,
      token: row.token,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    return NextResponse.json(deployments);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch deployments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectName, repositoryName, config, token } = body;
    const { rows } = await pool.query(
      `INSERT INTO deployments (project_name, repository_name, config, token) VALUES ($1, $2, $3, $4) RETURNING project_name, repository_name, config, token, created_at, updated_at`,
      [projectName, repositoryName, config, token]
    );
    const deployment = {
      projectName: rows[0].project_name,
      repositoryName: rows[0].repository_name,
      config: rows[0].config,
      token: rows[0].token,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at,
    };
    return NextResponse.json(deployment, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create deployment" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectName, config } = body;
    const { rows } = await pool.query(
      `UPDATE deployments SET config = $2, updated_at = NOW() WHERE project_name = $1 RETURNING project_name, repository_name, config, token, created_at, updated_at`,
      [projectName, config]
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
    return NextResponse.json(deployment, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to update deployment" },
      { status: 500 }
    );
  }
}
