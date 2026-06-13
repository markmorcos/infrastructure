import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { mintDeploymentToken } from "@/lib/jwt";
import {
  GITHUB_OWNER,
  repoExists,
  createRepo,
  putRepoSecret,
  createFileIfAbsent,
  registerDispatchType,
} from "@/lib/github";
import { deployWorkflow, deploymentYaml } from "@/lib/scaffold";

type StepStatus = "created" | "exists" | "set" | "registered" | "updated" | "error";
interface Step {
  step: string;
  status: StepStatus;
  detail?: string;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const projectName: string | undefined = body.projectName;
  if (!projectName) {
    return NextResponse.json({ error: "projectName is required" }, { status: 400 });
  }
  const repo: string = body.repo || `${GITHUB_OWNER}/${projectName}`;
  const namespace: string = body.namespace || projectName;
  const configFile: string = body.configFile || "deployment.yaml";
  const isPrivate: boolean = body.private !== false;
  const repoName = repo.includes("/") ? repo.split("/")[1] : repo;

  const steps: Step[] = [];
  const run = async (label: string, fn: () => Promise<StepStatus>) => {
    try {
      steps.push({ step: label, status: await fn() });
    } catch (e) {
      steps.push({ step: label, status: "error", detail: errMessage(e) });
    }
  };

  const token = mintDeploymentToken(projectName);

  // 1. Repo
  await run("repo", async () => {
    if (await repoExists(repo)) return "exists";
    await createRepo(repoName, isPrivate);
    return "created";
  });

  // 2. Secrets
  await run("secret:INFRASTRUCTURE_PAT", async () => {
    await putRepoSecret(repo, "INFRASTRUCTURE_PAT", process.env.GITHUB_PAT as string);
    return "set";
  });
  await run("secret:DEPLOYMENT_TOKEN", async () => {
    await putRepoSecret(repo, "DEPLOYMENT_TOKEN", token);
    return "set";
  });

  // 3. Scaffold
  await run("scaffold:workflow", () =>
    createFileIfAbsent(
      repo,
      `.github/workflows/deploy-${projectName}.yaml`,
      deployWorkflow(projectName, repo, configFile),
      `ci: add deploy-${projectName} workflow`
    )
  );
  await run("scaffold:deployment", () =>
    createFileIfAbsent(
      repo,
      configFile,
      deploymentYaml(projectName, namespace),
      "chore: add deployment config"
    )
  );

  // 4. Register dispatch type in infrastructure
  await run("dispatch-type", () => registerDispatchType(projectName));

  // 5. Upsert DB row
  await run("db", async () => {
    const { rowCount } = await pool.query(
      `INSERT INTO projects (project_name, token, repo, namespace)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_name)
       DO UPDATE SET token = $2, repo = $3, namespace = $4, updated_at = now()`,
      [projectName, token, repo, namespace]
    );
    return rowCount === 1 ? "created" : "updated";
  });

  const ok = !steps.some((s) => s.status === "error");
  return NextResponse.json(
    { projectName, repo, namespace, ok, steps },
    { status: ok ? 200 : 207 }
  );
}
