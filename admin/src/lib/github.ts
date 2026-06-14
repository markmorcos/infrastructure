import { Octokit } from "@octokit/rest";
import _sodium from "libsodium-wrappers";

export const GITHUB_OWNER = "markmorcos";

let _octokit: Octokit | null = null;
export function octokit(): Octokit {
  if (!_octokit) _octokit = new Octokit({ auth: process.env.GITHUB_PAT });
  return _octokit;
}

// Accepts "owner/name" or a bare "name" (defaults owner to GITHUB_OWNER).
export function parseRepo(repo: string): { owner: string; repo: string } {
  const [a, b] = repo.split("/");
  return b ? { owner: a, repo: b } : { owner: GITHUB_OWNER, repo: a };
}

export interface RepoSecretInfo {
  name: string;
  updatedAt: string;
}

export async function listRepoSecrets(repoFull: string): Promise<RepoSecretInfo[]> {
  const { owner, repo } = parseRepo(repoFull);
  const res = await octokit().rest.actions.listRepoSecrets({
    owner,
    repo,
    per_page: 100,
  });
  return res.data.secrets.map((s) => ({ name: s.name, updatedAt: s.updated_at }));
}

// Encrypt with the repo's libsodium public key and upsert the Actions secret.
export async function putRepoSecret(
  repoFull: string,
  name: string,
  value: string
): Promise<void> {
  const { owner, repo } = parseRepo(repoFull);
  const { data: key } = await octokit().rest.actions.getRepoPublicKey({ owner, repo });

  await _sodium.ready;
  const sodium = _sodium;
  const keyBin = sodium.from_base64(key.key, sodium.base64_variants.ORIGINAL);
  const valueBin = sodium.from_string(value);
  const encrypted = sodium.to_base64(
    sodium.crypto_box_seal(valueBin, keyBin),
    sodium.base64_variants.ORIGINAL
  );

  await octokit().rest.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: name,
    encrypted_value: encrypted,
    key_id: key.key_id,
  });
}

function statusOf(e: unknown): number | undefined {
  return (e as { status?: number })?.status;
}

export async function repoExists(repoFull: string): Promise<boolean> {
  const { owner, repo } = parseRepo(repoFull);
  try {
    await octokit().rest.repos.get({ owner, repo });
    return true;
  } catch (e) {
    if (statusOf(e) === 404) return false;
    throw e;
  }
}

// Create a repo under the authenticated user (markmorcos). auto_init gives it a
// default branch so files can be committed immediately.
export async function createRepo(name: string, isPrivate = true): Promise<void> {
  await octokit().rest.repos.createForAuthenticatedUser({
    name,
    private: isPrivate,
    auto_init: true,
  });
}

// Create a file only if it doesn't already exist (never clobber existing scaffold).
export async function createFileIfAbsent(
  repoFull: string,
  path: string,
  content: string,
  message: string
): Promise<"created" | "exists"> {
  const { owner, repo } = parseRepo(repoFull);
  try {
    await octokit().rest.repos.getContent({ owner, repo, path });
    return "exists";
  } catch (e) {
    if (statusOf(e) !== 404) throw e;
  }
  await octokit().rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
  });
  return "created";
}

// Register `deploy-<project>` in the infrastructure deploy-app.yaml
// repository_dispatch types list. Idempotent: skips if already present.
export async function registerDispatchType(
  project: string
): Promise<"registered" | "exists"> {
  const owner = GITHUB_OWNER;
  const repo = "infrastructure";
  const path = ".github/workflows/deploy-app.yaml";

  const res = await octokit().rest.repos.getContent({ owner, repo, path });
  const file = res.data as { content?: string; sha: string };
  const current = Buffer.from(file.content ?? "", "base64").toString("utf-8");

  const entry = `      - deploy-${project}`;
  if (current.split("\n").some((l) => l.trimEnd() === entry)) {
    return "exists";
  }

  const updated = current.replace(/(\n {4}types:\n)/, `$1${entry}\n`);
  if (updated === current) {
    throw new Error("could not locate repository_dispatch types block");
  }

  await octokit().rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `ci: register deploy-${project} dispatch type`,
    content: Buffer.from(updated, "utf-8").toString("base64"),
    sha: file.sha,
  });
  return "registered";
}

// ---- GitHub Actions: deploy-app runs (the actual build/deploy pipeline) ----

const INFRA_REPO = "infrastructure";
const DEPLOY_WORKFLOW = "deploy-app.yaml";

export interface DeployRun {
  id: number;
  project: string;
  title: string;
  event: string;
  status: string;
  conclusion: string | null;
  runNumber: number;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface RunJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  url: string;
  startedAt: string | null;
  completedAt: string | null;
}

export async function listDeployRuns(perPage = 50): Promise<DeployRun[]> {
  const res = await octokit().rest.actions.listWorkflowRuns({
    owner: GITHUB_OWNER,
    repo: INFRA_REPO,
    workflow_id: DEPLOY_WORKFLOW,
    per_page: perPage,
  });
  return res.data.workflow_runs.map((r) => {
    const title = (r as { display_title?: string }).display_title || r.name || "";
    return {
      id: r.id,
      project: title.replace(/^deploy-/, ""),
      title,
      event: r.event,
      status: r.status || "",
      conclusion: r.conclusion ?? null,
      runNumber: r.run_number,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      url: r.html_url,
    };
  });
}

export async function listRunJobs(runId: number): Promise<RunJob[]> {
  const res = await octokit().rest.actions.listJobsForWorkflowRun({
    owner: GITHUB_OWNER,
    repo: INFRA_REPO,
    run_id: runId,
    per_page: 50,
  });
  return res.data.jobs.map((j) => ({
    id: j.id,
    name: j.name,
    status: j.status,
    conclusion: j.conclusion ?? null,
    url: j.html_url ?? "",
    startedAt: j.started_at ?? null,
    completedAt: j.completed_at ?? null,
  }));
}

export async function reRunFailedJobs(runId: number): Promise<void> {
  await octokit().rest.actions.reRunWorkflowFailedJobs({
    owner: GITHUB_OWNER,
    repo: INFRA_REPO,
    run_id: runId,
  });
}

export async function reRunRun(runId: number): Promise<void> {
  await octokit().rest.actions.reRunWorkflow({
    owner: GITHUB_OWNER,
    repo: INFRA_REPO,
    run_id: runId,
  });
}
