#!/bin/bash
set -euo pipefail

# Provision a single-node OpenSearch on the host, with data under /mnt/data/opensearch.
# Target: the m720q homelab node. Idempotent — safe to re-run.
#
# Env overrides:
#   OS_DATA   (default /mnt/data/opensearch)   data path
#   OS_HEAP   (default 2g)                      JVM heap (-Xms/-Xmx)
#   OS_MAJOR  (default 2.x)                     apt repo channel
#   OPENSEARCH_INITIAL_ADMIN_PASSWORD           admin pw (generated if unset, on first install)

OS_DATA=${OS_DATA:-/mnt/data/opensearch}
OS_HEAP=${OS_HEAP:-2g}
OS_MAJOR=${OS_MAJOR:-2.x}

log() { printf "%s - %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$1"; }

# 1. Kernel settings OpenSearch requires (it refuses to start without max_map_count).
log "Configuring sysctl (vm.max_map_count, swappiness)"
printf 'vm.max_map_count=262144\nvm.swappiness=1\n' | sudo tee /etc/sysctl.d/99-opensearch.conf >/dev/null
sudo sysctl --system >/dev/null

# 2. apt repository.
if [ ! -f /etc/apt/sources.list.d/opensearch-2.x.list ]; then
  log "Adding OpenSearch apt repository"
  curl -fsSL https://artifacts.opensearch.org/publickeys/opensearch.pgp \
    | sudo gpg --dearmor --batch --yes -o /usr/share/keyrings/opensearch-keyring
  echo "deb [signed-by=/usr/share/keyrings/opensearch-keyring] https://artifacts.opensearch.org/releases/bundle/opensearch/${OS_MAJOR}/apt stable main" \
    | sudo tee /etc/apt/sources.list.d/opensearch-2.x.list >/dev/null
fi

# 3. Data directory.
sudo mkdir -p "$OS_DATA"

# 4. Install (only if absent). 2.12+ requires a STRONG, non-dictionary admin password
#    or the post-install demo-config step fails.
if ! dpkg -s opensearch >/dev/null 2>&1; then
  OS_PW=${OPENSEARCH_INITIAL_ADMIN_PASSWORD:-$(tr -dc 'A-Za-z0-9@#%^*' </dev/urandom | head -c 20)}
  log "Installing opensearch"
  sudo apt-get update
  sudo env OPENSEARCH_INITIAL_ADMIN_PASSWORD="$OS_PW" apt-get install -y opensearch
  log "SAVE THIS admin password: $OS_PW"
fi

# 5. Config: pin data/log paths, bind all interfaces (so k3s pods reach it), single node.
#    Comment any pre-existing active keys, then append a managed block once.
CFG=/etc/opensearch/opensearch.yml
MARKER="# --- managed by setup-opensearch.sh ---"
if ! grep -qF "$MARKER" "$CFG"; then
  log "Writing OpenSearch config block"
  for key in path.data path.logs network.host discovery.type; do
    sudo sed -i "s|^[[:space:]]*${key}[[:space:]]*:.*|# &|" "$CFG"
  done
  cat <<EOF | sudo tee -a "$CFG" >/dev/null

$MARKER
path.data: $OS_DATA
path.logs: /var/log/opensearch
network.host: 0.0.0.0
discovery.type: single-node
EOF
fi

# 6. Heap (drop-in keeps it separate from the packaged jvm.options).
printf -- "-Xms%s\n-Xmx%s\n" "$OS_HEAP" "$OS_HEAP" \
  | sudo tee /etc/opensearch/jvm.options.d/heap.options >/dev/null

# 7. Ownership + start.
sudo chown -R opensearch:opensearch "$OS_DATA"
sudo systemctl daemon-reload
sudo systemctl enable --now opensearch

# 8. Wait for the API, then apply a zero-replica template — on one node a default
#    replica stays unassigned and the cluster sits at yellow. Best-effort.
log "Waiting for OpenSearch on :9200"
for _ in $(seq 1 30); do
  curl -ks https://localhost:9200 >/dev/null 2>&1 && break
  curl -s  http://localhost:9200  >/dev/null 2>&1 && break
  sleep 2
done

SCHEME=http; AUTH=()
if ! curl -s http://localhost:9200 >/dev/null 2>&1; then
  SCHEME=https; AUTH=(-k -u "admin:${OS_PW:-admin}")
fi
curl -s "${AUTH[@]}" -X PUT "$SCHEME://localhost:9200/_index_template/zero-replicas" \
  -H 'Content-Type: application/json' \
  -d '{"index_patterns":["*"],"template":{"settings":{"number_of_replicas":0}}}' >/dev/null 2>&1 \
  && log "Applied zero-replica index template" \
  || log "Skipped zero-replica template (apply manually if needed)"

log "OpenSearch ready."
