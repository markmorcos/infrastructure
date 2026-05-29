#!/usr/bin/env bash
#
# One-shot migration of namespaced k3s resources from the Pi cluster to this
# (M720q) cluster. Run ON the M720q. Requires Tailscale SSH to the Pi and jq.
#
# It copies user namespaces and their deployments/statefulsets/services/
# ingress/configmaps/secrets/etc., stripping cluster-specific fields so they
# apply cleanly to a fresh cluster. It does NOT touch kube-system, PVCs, pods,
# replicasets or jobs (transient/regenerated).
#
#   ./migrate-k8s.sh            # apply for real
#   DRY_RUN=1 ./migrate-k8s.sh  # preview (server-side dry run, changes nothing)
#
# Override the Pi's hostname if it isn't "pi":  PI_HOST=raspberrypi ./migrate-k8s.sh

set -euo pipefail

PI_HOST="${PI_HOST:-pi}"
SRC="/tmp/pi-kubeconfig.yaml"
APPLY_ARGS=(); [[ -n "${DRY_RUN:-}" ]] && APPLY_ARGS=(--dry-run=server)

log() { printf '\033[1;34m[migrate-k8s]\033[0m %s\n' "$*"; }

command -v jq >/dev/null || { echo "jq required"; exit 1; }

# --- Pull the Pi's kubeconfig and point it at the Pi over Tailscale ----------
log "Fetching Pi kubeconfig from ${PI_HOST}..."
if ! scp "${PI_HOST}:/etc/rancher/k3s/k3s.yaml" "$SRC" 2>/dev/null; then
  # kubeconfig not world-readable on the Pi — fall back to sudo over ssh
  ssh "${PI_HOST}" sudo cat /etc/rancher/k3s/k3s.yaml > "$SRC"
fi
sed -i "s#https://127.0.0.1:6443#https://${PI_HOST}:6443#" "$SRC"

src() { KUBECONFIG="$SRC" kubectl "$@"; }   # Pi cluster
dst() { k3s kubectl "$@"; }                 # this (M720q) cluster

# --- Kinds to migrate (namespaced; no pods/rs/jobs/pvc) ----------------------
KINDS="configmap,secret,serviceaccount,role,rolebinding,networkpolicy,deployment,statefulset,daemonset,service,ingress,cronjob,horizontalpodautoscaler"

# --- jq cleanup: drop instance/cluster-specific + auto-created objects --------
CLEAN='
  .items |= map(
    del(.metadata.uid, .metadata.resourceVersion, .metadata.generation,
        .metadata.creationTimestamp, .metadata.managedFields,
        .metadata.ownerReferences, .status,
        .metadata.annotations["kubectl.kubernetes.io/last-applied-configuration"],
        .metadata.annotations["deployment.kubernetes.io/revision"],
        .spec.clusterIP, .spec.clusterIPs)
  )
  | .items |= map(select((.kind=="Secret"         and .type=="kubernetes.io/service-account-token") | not))
  | .items |= map(select((.kind=="ServiceAccount" and .metadata.name=="default")                    | not))
  | .items |= map(select((.kind=="ConfigMap"      and .metadata.name=="kube-root-ca.crt")           | not))
'

# --- Migrate, namespace by namespace -----------------------------------------
NSS=$(src get ns -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' \
        | grep -vE '^(kube-system|kube-public|kube-node-lease|default)$' || true)

[[ -n "$NSS" ]] || { log "No user namespaces found on ${PI_HOST}."; exit 0; }

for ns in $NSS; do
  log "namespace: $ns"
  dst create namespace "$ns" --dry-run=client -o yaml | dst apply "${APPLY_ARGS[@]}" -f -
  src get $KINDS -n "$ns" -o json | jq "$CLEAN" | dst apply "${APPLY_ARGS[@]}" -n "$ns" -f -
done

log "Done. Review with:  k3s kubectl get deploy,svc,ingress -A"
