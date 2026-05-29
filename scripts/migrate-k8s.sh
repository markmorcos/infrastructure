#!/usr/bin/env bash
#
# One-shot migration of namespaced k8s resources between two kube contexts.
# Run from anywhere with kubectl access to both (e.g. your laptop).
#
#   ./migrate-k8s.sh                 # apply for real
#   DRY_RUN=1 ./migrate-k8s.sh       # preview (server-side dry run)
#
# Config (env overrides):
#   SRC_CTX     source context   (default: pi)
#   DST_CTX     target context   (default: m720q)
#   EXCLUDE_NS  namespaces to skip — system + operator-managed namespaces whose
#               CRDs/cluster-scoped objects this script does NOT copy
#               (default below). Reinstall those (e.g. cert-manager) fresh.
#
# Copies namespaced objects only (configmaps, secrets, deployments, services,
# ingress, etc.). It does NOT copy CRDs, cluster-scoped objects, pods,
# replicasets, jobs or PVCs. Source cluster is read-only; nothing is deleted.

set -euo pipefail

SRC_CTX="${SRC_CTX:-pi}"
DST_CTX="${DST_CTX:-m720q}"
EXCLUDE_NS="${EXCLUDE_NS:-cert-manager ingress-nginx kube-system kube-public kube-node-lease default}"
APPLY_ARGS=(); [[ -n "${DRY_RUN:-}" ]] && APPLY_ARGS=(--dry-run=server)

log() { printf '\033[1;34m[migrate-k8s]\033[0m %s\n' "$*"; }
command -v kubectl >/dev/null || { echo "kubectl required"; exit 1; }
command -v jq      >/dev/null || { echo "jq required (brew install jq)"; exit 1; }

src() { kubectl --context "$SRC_CTX" "$@"; }
dst() { kubectl --context "$DST_CTX" "$@"; }

src get ns -o name >/dev/null 2>&1 || { echo "can't reach source context '$SRC_CTX' (kubectl config get-contexts)"; exit 1; }
dst get ns -o name >/dev/null 2>&1 || { echo "can't reach target context '$DST_CTX'"; exit 1; }

KINDS="configmap,secret,serviceaccount,role,rolebinding,networkpolicy,deployment,statefulset,daemonset,service,ingress,cronjob,horizontalpodautoscaler"

# Strip instance/cluster-specific fields + drop auto-created objects.
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

excl=$(echo "$EXCLUDE_NS" | tr ' ' '|')
NSS=$(src get ns -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | grep -vE "^(${excl})$" || true)
[[ -n "$NSS" ]] || { log "No namespaces to migrate after exclusions."; exit 0; }

log "src=$SRC_CTX  dst=$DST_CTX  ${DRY_RUN:+(DRY RUN) }"
log "migrating: $(echo $NSS | tr '\n' ' ')"
log "excluding: $EXCLUDE_NS"

for ns in $NSS; do
  log "namespace: $ns"
  # Create the namespace for real even in dry-run, otherwise the resource
  # dry-run fails with "namespace not found". Empty namespaces are harmless.
  dst create namespace "$ns" --dry-run=client -o yaml | dst apply -f -
  src get $KINDS -n "$ns" -o json | jq "$CLEAN" | dst apply "${APPLY_ARGS[@]}" -n "$ns" -f -
done

log "Done. Review:  kubectl --context $DST_CTX get deploy,svc,ingress -A"
