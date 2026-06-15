import {
  KubeConfig,
  CoreV1Api,
  AppsV1Api,
  ApiException,
} from "@kubernetes/client-node";

let _kc: KubeConfig | null = null;
function kc(): KubeConfig {
  if (!_kc) {
    _kc = new KubeConfig();
    _kc.loadFromCluster();
  }
  return _kc;
}

let _core: CoreV1Api | null = null;
function core(): CoreV1Api {
  if (!_core) _core = kc().makeApiClient(CoreV1Api);
  return _core;
}

let _apps: AppsV1Api | null = null;
function apps(): AppsV1Api {
  if (!_apps) _apps = kc().makeApiClient(AppsV1Api);
  return _apps;
}

function isNotFound(e: unknown): boolean {
  return e instanceof ApiException && e.code === 404;
}

export interface K8sSecretInfo {
  name: string;
  type: string;
  keys: string[];
}

// Inventory only — returns secret names + key names per namespace. Values are
// never read back (masked in the UI per the control-plane key-display policy).
export async function listNamespaceSecrets(namespace: string): Promise<K8sSecretInfo[]> {
  const res = await core().listNamespacedSecret({ namespace });
  return (res.items ?? [])
    .filter(
      (s) =>
        s.type !== "kubernetes.io/service-account-token" &&
        !s.type?.startsWith("helm.sh/")
    )
    .map((s) => ({
      name: s.metadata?.name ?? "",
      type: s.type ?? "Opaque",
      keys: Object.keys(s.data ?? {}),
    }));
}

// Create the namespace if it does not already exist (needed when provisioning
// data/secrets before the app's first Helm deploy creates the namespace).
export async function ensureNamespace(name: string): Promise<"created" | "exists"> {
  const api = core();
  try {
    await api.readNamespace({ name });
    return "exists";
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await api.createNamespace({ body: { metadata: { name } } });
    return "created";
  }
}

function b64(v: string): string {
  return Buffer.from(v, "utf-8").toString("base64");
}

// Create or update a secret in `namespace`, merging the provided keys into any
// existing data (existing keys not in `data` are preserved). Values are never
// read back to the caller.
export async function upsertNamespaceSecret(
  namespace: string,
  name: string,
  data: Record<string, string>
): Promise<void> {
  const api = core();
  const encoded: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) encoded[k] = b64(v);

  try {
    const existing = await api.readNamespacedSecret({ namespace, name });
    await api.replaceNamespacedSecret({
      namespace,
      name,
      body: {
        metadata: {
          name,
          namespace,
          resourceVersion: existing.metadata?.resourceVersion,
        },
        type: existing.type ?? "Opaque",
        data: { ...(existing.data ?? {}), ...encoded },
      },
    });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await api.createNamespacedSecret({
      namespace,
      body: {
        metadata: { name, namespace },
        type: "Opaque",
        data: encoded,
      },
    });
  }
}

// ---- live runtime health (across all namespaces in one batch) ----

export type RuntimeStatus = "healthy" | "progressing" | "degraded" | "down" | "none";

export interface PodInfo {
  name: string;
  phase: string;
  ready: boolean;
  restarts: number;
  reason: string;
}
export interface Runtime {
  desired: number;
  ready: number;
  status: RuntimeStatus;
  pods: PodInfo[];
}

export async function getAllRuntime(): Promise<Record<string, Runtime>> {
  const [deps, pods] = await Promise.all([
    apps().listDeploymentForAllNamespaces(),
    core().listPodForAllNamespaces(),
  ]);

  const out: Record<string, Runtime> = {};
  const ensure = (ns: string): Runtime =>
    (out[ns] ??= { desired: 0, ready: 0, status: "none", pods: [] });

  for (const d of deps.items ?? []) {
    const ns = d.metadata?.namespace;
    if (!ns) continue;
    const r = ensure(ns);
    r.desired += d.spec?.replicas ?? 0;
    r.ready += d.status?.readyReplicas ?? 0;
  }

  for (const p of pods.items ?? []) {
    const ns = p.metadata?.namespace;
    if (!ns || !(ns in out)) continue; // only namespaces that have a deployment
    const cs = p.status?.containerStatuses ?? [];
    const waiting = cs.map((c) => c.state?.waiting?.reason).find(Boolean);
    ensure(ns).pods.push({
      name: p.metadata?.name ?? "",
      phase: p.status?.phase ?? "",
      ready: cs.length > 0 && cs.every((c) => c.ready),
      restarts: cs.reduce((n, c) => n + (c.restartCount ?? 0), 0),
      reason: waiting ?? "",
    });
  }

  for (const r of Object.values(out)) {
    const bad = r.pods.some(
      (p) => p.reason === "CrashLoopBackOff" || p.reason === "ImagePullBackOff" || p.reason === "ErrImagePull" || p.phase === "Failed"
    );
    if (r.desired === 0) r.status = "none";
    else if (bad) r.status = "degraded";
    else if (r.ready === 0) r.status = "down";
    else if (r.ready < r.desired) r.status = "progressing";
    else r.status = "healthy";
  }

  return out;
}
