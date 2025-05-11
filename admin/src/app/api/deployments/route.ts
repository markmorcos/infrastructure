import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface DatabaseDeployment {
  project_name: string;
  token: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT project_name, token, enabled, created_at, updated_at FROM deployments ORDER BY created_at DESC`
    );
    const deployments = rows.map((row: DatabaseDeployment) => ({
      projectName: row.project_name,
      token: row.token,
      enabled: row.enabled,
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
    const { projectName, token } = body;
    const { rows } = await pool.query(
      `INSERT INTO deployments (project_name, token) VALUES ($1, $2) RETURNING project_name, token, created_at, updated_at`,
      [projectName, token]
    );
    const deployment = {
      projectName: rows[0].project_name,
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
    const { projectName, token, enabled } = body;
    const { rows } = await pool.query(
      `UPDATE deployments SET token = $2, enabled = $3, updated_at = NOW() WHERE project_name = $1 RETURNING project_name, token, enabled, created_at, updated_at`,
      [projectName, token, enabled]
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }
    const deployment = {
      projectName: rows[0].project_name,
      token: rows[0].token,
      enabled: rows[0].enabled,
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

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectName } = body;
    await pool.query(`DELETE FROM deployments WHERE project_name = $1`, [
      projectName,
    ]);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete deployment" },
      { status: 500 }
    );
  }
}
