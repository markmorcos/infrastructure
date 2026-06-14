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
import { deployWorkflow } from "@/lib/scaffold";
import { getStack, deploymentYaml, StackOpts } from "@/lib/templates";

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

  const stack = getStack(body.stack || "nextjs");
  if (!stack) {
    return NextResponse.json({ error: "unknown stack" }, { status: 400 });
  }

  const repo: string = body.repo || `${GITHUB_OWNER}/${projectName}`;
  const namespace: string = body.namespace || projectName;
  const configFile = "deployment.yaml";
  const isPrivate: boolean = body.private !== false;
  const repoName = repo.includes("/") ? repo.split("/")[1] : repo;

  const opts: StackOpts = {
    project: projectName,
    namespace,
    port: Number(body.port) || stack.defaultPort,
    ingressHost: body.ingressHost || `${projectName}.morcos.tech`,
    env: Array.isArray(body.env)
      ? body.env.filter((e: { name?: string }) => e && e.name)
      : [],
  };

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

  // 2. Secrets (must exist before the deploy workflow runs)
  await run("secret:INFRASTRUCTURE_PAT", async () => {
    await putRepoSecret(repo, "INFRASTRUCTURE_PAT", process.env.GITHUB_PAT as string);
    return "set";
  });
  await run("secret:DEPLOYMENT_TOKEN", async () => {
    await putRepoSecret(repo, "DEPLOYMENT_TOKEN", token);
    return "set";
  });

  // 3. Scaffold the app + deployment config FIRST (so the build has something
  //    to build), then register the dispatch type, then commit the workflow
  //    LAST — that final push is what triggers the (now buildable) auto-deploy.
  await run("scaffold:deployment.yaml", () =>
    createFileIfAbsent(repo, configFile, deploymentYaml(opts, stack.ingress), "chore: add deployment config")
  );
  for (const [path, content] of Object.entries(stack.files(opts))) {
    await run(`scaffold:${path}`, () =>
      createFileIfAbsent(repo, path, content, `chore: scaffold ${path}`)
    );
  }

  // 4. Register dispatch type in infrastructure (before the workflow fires)
  await run("dispatch-type", () => registerDispatchType(projectName));

  // 5. Workflow last — triggers the auto-deploy
  await run("scaffold:workflow", () =>
    createFileIfAbsent(
      repo,
      `.github/workflows/deploy-${projectName}.yaml`,
      deployWorkflow(projectName, repo, configFile),
      `ci: add deploy-${projectName} workflow`
    )
  );

  // 6. Upsert DB row
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
