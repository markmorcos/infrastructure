import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectName: string }> }
) {
  const { projectName } = await params;
  try {
    const { rows } = await pool.query(
      `SELECT project_name, repo, namespace, token, enabled, created_at, updated_at
       FROM projects WHERE project_name = $1`,
      [projectName]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const r = rows[0];
    return NextResponse.json({
      projectName: r.project_name,
      repo: r.repo,
      namespace: r.namespace,
      token: r.token,
      enabled: r.enabled,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

const EDITABLE = ["repo", "namespace", "enabled", "token"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectName: string }> }
) {
  const { projectName } = await params;
  try {
    const body = await req.json();
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const key of EDITABLE) {
      if (key in body) {
        let value = body[key];
        // Treat blank repo/namespace as unset.
        if ((key === "repo" || key === "namespace") && value === "") value = null;
        sets.push(`${key} = $${i++}`);
        values.push(value);
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
    }
    values.push(projectName);
    const { rows } = await pool.query(
      `UPDATE projects SET ${sets.join(", ")}, updated_at = now()
       WHERE project_name = $${i}
       RETURNING project_name, repo, namespace, token, enabled, created_at, updated_at`,
      values
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const r = rows[0];
    return NextResponse.json({
      projectName: r.project_name,
      repo: r.repo,
      namespace: r.namespace,
      token: r.token,
      enabled: r.enabled,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectName: string }> }
) {
  const { projectName } = await params;
  try {
    await pool.query(`DELETE FROM projects WHERE project_name = $1`, [projectName]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
