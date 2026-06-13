import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { upsertNamespaceSecret } from "@/lib/k8s";

// Create/update a Kubernetes secret in the project's namespace.
// Body: { secretName: string, data: Record<string,string> }
export async function PUT(
  req: NextRequest,
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
      return NextResponse.json(
        { error: "Project has no namespace set" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const secretName: string | undefined = body.secretName;
    const data: Record<string, string> | undefined = body.data;
    if (!secretName || !data || Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "secretName and non-empty data are required" },
        { status: 400 }
      );
    }

    await upsertNamespaceSecret(namespace, secretName, data);
    return NextResponse.json({
      namespace,
      secretName,
      keys: Object.keys(data),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to write Kubernetes secret" },
      { status: 500 }
    );
  }
}
