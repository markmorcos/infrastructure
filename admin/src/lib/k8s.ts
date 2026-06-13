import {
  KubeConfig,
  CoreV1Api,
  ApiException,
} from "@kubernetes/client-node";

let _core: CoreV1Api | null = null;
function core(): CoreV1Api {
  if (!_core) {
    const kc = new KubeConfig();
    kc.loadFromCluster();
    _core = kc.makeApiClient(CoreV1Api);
  }
  return _core;
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
