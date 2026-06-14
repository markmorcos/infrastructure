export interface RepoSecret {
  name: string;
  updatedAt: string;
}
export interface K8sSecret {
  name: string;
  type: string;
  keys: string[];
}
export type Source<T> = { ok: true; secrets: T[] } | { ok: false; error: string };

export interface Project {
  projectName: string;
  repo: string | null;
  namespace: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  jwt: { sub: string | null; valid: boolean } | null;
  github: Source<RepoSecret>;
  k8s: Source<K8sSecret>;
}

export interface Runtime {
  desired: number;
  ready: number;
  status: "healthy" | "progressing" | "degraded" | "down" | "none";
  pods: { name: string; phase: string; ready: boolean; restarts: number; reason: string }[];
}

export type Status = "healthy" | "attention" | "dormant" | "disabled";

export const REQUIRED_SECRETS = ["INFRASTRUCTURE_PAT", "DEPLOYMENT_TOKEN"];

export function ghHas(p: Project, name: string): boolean {
  return p.github.ok && p.github.secrets.some((s) => s.name === name);
}
export function tokenValid(p: Project): boolean {
  return !!p.jwt?.valid;
}

// Required-secret state is only meaningful when a repo exists and is readable.
// No repo (or unreadable) => "unknown" (neutral), never a red "missing".
export type ReqState = "ok" | "missing" | "unknown";
export function reqState(p: Project, name: string): ReqState {
  if (!p.repo || !p.github.ok) return "unknown";
  return ghHas(p, name) ? "ok" : "missing";
}

export function issuesOf(p: Project): string[] {
  const out: string[] = [];
  if (p.namespace && !tokenValid(p)) {
    out.push(`Deployment token sub=${p.jwt?.sub ?? "?"} is invalid`);
  }
  for (const n of REQUIRED_SECRETS) {
    if (reqState(p, n) === "missing") out.push(`Missing required secret ${n}`);
  }
  return out;
}

// A project "needs attention" iff it has a real, actionable problem — so the
// card's issue strip and the fleet summary always agree.
export function computeStatus(p: Project): Status {
  if (!p.enabled) return "disabled";
  if (issuesOf(p).length > 0) return "attention";
  if (!p.namespace) return "dormant";
  return "healthy";
}

export const STATUS_META: Record<
  Status,
  { label: string; color: string; dim: string }
> = {
  healthy: { label: "healthy", color: "var(--cp-ok)", dim: "var(--cp-ok-dim)" },
  attention: { label: "needs attention", color: "var(--cp-err)", dim: "var(--cp-err-dim)" },
  dormant: { label: "not deployed", color: "var(--cp-dormant)", dim: "var(--cp-dormant-dim)" },
  disabled: { label: "disabled", color: "var(--cp-idle)", dim: "var(--cp-idle-dim)" },
};

export const SORT_KEY: Record<Status, number> = {
  attention: 0,
  healthy: 1,
  dormant: 2,
  disabled: 3,
};

export function ghCount(p: Project): number {
  return p.github.ok ? p.github.secrets.length : 0;
}
export function keyCount(p: Project): number {
  return p.k8s.ok ? p.k8s.secrets.reduce((n, s) => n + s.keys.length, 0) : 0;
}
