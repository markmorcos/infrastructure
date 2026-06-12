import { KubeConfig, CoreV1Api } from "@kubernetes/client-node";

let _core: CoreV1Api | null = null;
function core(): CoreV1Api {
  if (!_core) {
    const kc = new KubeConfig();
    kc.loadFromCluster();
    _core = kc.makeApiClient(CoreV1Api);
  }
  return _core;
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
