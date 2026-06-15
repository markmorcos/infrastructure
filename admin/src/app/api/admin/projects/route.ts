import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { listRepoSecrets } from "@/lib/github";
import { listNamespaceSecrets } from "@/lib/k8s";
import { decodeDeploymentToken, mintDeploymentToken } from "@/lib/jwt";

type ProjectRow = {
  project_name: string;
  repo: string | null;
  namespace: string | null;
  token: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT project_name, repo, namespace, token, enabled, created_at, updated_at
       FROM projects ORDER BY created_at DESC`
    );
    const rows = result.rows as ProjectRow[];

    const projects = await Promise.all(
      rows.map(async (row) => {
        const [github, k8s] = await Promise.all([
          row.repo
            ? listRepoSecrets(row.repo)
                .then((secrets) => ({ ok: true as const, secrets }))
                .catch((e) => ({ ok: false as const, error: errMessage(e) }))
            : Promise.resolve({ ok: false as const, error: "no repo set" }),
          row.namespace
            ? listNamespaceSecrets(row.namespace)
                .then((secrets) => ({ ok: true as const, secrets }))
                .catch((e) => ({ ok: false as const, error: errMessage(e) }))
            : Promise.resolve({ ok: false as const, error: "no namespace set" }),
        ]);

        return {
          projectName: row.project_name,
          repo: row.repo,
          namespace: row.namespace,
          enabled: row.enabled,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          jwt: row.token ? decodeDeploymentToken(row.token) : null,
          github,
          k8s,
        };
      })
    );

    return NextResponse.json(projects);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectName: string | undefined = body.projectName;
    if (!projectName) {
      return NextResponse.json({ error: "projectName is required" }, { status: 400 });
    }
    const repo = body.repo || null;
    const namespace = body.namespace || null;
    const token = body.token || mintDeploymentToken(projectName);

    const { rows } = await pool.query(
      `INSERT INTO projects (project_name, token, repo, namespace)
       VALUES ($1, $2, $3, $4)
       RETURNING project_name`,
      [projectName, token, repo, namespace]
    );
    return NextResponse.json({ projectName: rows[0].project_name }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create project (name may already exist)" },
      { status: 500 }
    );
  }
}
