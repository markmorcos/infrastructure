import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { dispatchRollback } from "@/lib/github";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectName: string }> }
) {
  const { projectName } = await params;
  try {
    const { rows } = await pool.query(
      `SELECT namespace FROM projects WHERE project_name = $1`,
      [projectName]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const namespace: string | null = rows[0].namespace;
    if (!namespace) {
      return NextResponse.json({ error: "Project has no namespace" }, { status: 400 });
    }
    await dispatchRollback(projectName, namespace);
    return NextResponse.json({ ok: true, namespace });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rollback dispatch failed" },
      { status: 500 }
    );
  }
}
