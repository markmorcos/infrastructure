#!/usr/bin/env bash
#
# infrastructure node bootstrap — idempotent bootstrap for Pi 5 / M720q nodes
#
# Quick start:
#   1. Create /etc/infrastructure/bootstrap/.env with your secrets (see .env.example)
#   2. curl -fsSL https://raw.githubusercontent.com/markmorcos/infrastructure/main/bootstrap/run.sh | sudo bash
#
# Or pass config inline:
#   curl -fsSL <url> | sudo K3S_ROLE=agent K3S_URL=... K3S_TOKEN=... CF_API_TOKEN=... bash
#
# Re-running is always safe.
#
# Pi 5 caveat: if the Tailscale CLI segfaults, you may be on the 16K-page kernel.
# Check `getconf PAGESIZE`; if 16384 and you hit Go-runtime crashes, add
# `kernel=kernel8.img` to /boot/firmware/config.txt and reboot.

set -euo pipefail

# === Constants — edit REPO_RAW_URL to point at your fork ======================
REPO_RAW_URL="${REPO_RAW_URL:-https://raw.githubusercontent.com/markmorcos/infrastructure/main/bootstrap}"
CONFIG_FILE="${CONFIG_FILE:-/etc/infrastructure/bootstrap/.env}"

# === Logging ==================================================================
log()  { printf '\033[1;34m[bootstrap]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[bootstrap]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[bootstrap]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo)."
command -v apt-get >/dev/null 2>&1 || die "This script targets Debian/Ubuntu."

# === Load config ==============================================================
if [[ -f "$CONFIG_FILE" ]]; then
  log "Loading $CONFIG_FILE"
  set -a; # shellcheck disable=SC1090
  source "$CONFIG_FILE"; set +a
fi

# Toggles
INSTALL_SYSCTL_FORWARD="${INSTALL_SYSCTL_FORWARD:-1}"
INSTALL_TAILSCALE="${INSTALL_TAILSCALE:-1}"
INSTALL_K3S="${INSTALL_K3S:-1}"
INSTALL_CF_DDNS="${INSTALL_CF_DDNS:-1}"
INSTALL_K3S_CLEANUP="${INSTALL_K3S_CLEANUP:-1}"
INSTALL_MINIO="${INSTALL_MINIO:-0}"
INSTALL_DNSMASQ="${INSTALL_DNSMASQ:-0}"

# Tailscale
TAILSCALE_AUTHKEY="${TAILSCALE_AUTHKEY:-}"
TAILSCALE_ADVERTISE_EXIT_NODE="${TAILSCALE_ADVERTISE_EXIT_NODE:-1}"
TAILSCALE_AUTO_UPDATE="${TAILSCALE_AUTO_UPDATE:-1}"
TAILSCALE_ACCEPT_DNS="${TAILSCALE_ACCEPT_DNS:-1}"
TAILSCALE_SSH="${TAILSCALE_SSH:-1}"
TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-$(hostname)}"

# k3s
K3S_ROLE="${K3S_ROLE:-agent}"
K3S_URL="${K3S_URL:-}"
K3S_TOKEN="${K3S_TOKEN:-}"
K3S_VERSION="${K3S_VERSION:-v1.32.3+k3s1}"
K3S_DISABLE="${K3S_DISABLE:-traefik}"

# Cloudflare DDNS (anchor-record pattern: DDNS updates ONE A record;
# all app domains are CNAMEs to it)
CF_API_TOKEN="${CF_API_TOKEN:-}"
CF_ANCHOR_RECORD="${CF_ANCHOR_RECORD:-}"
CF_ANCHOR_PROXIED="${CF_ANCHOR_PROXIED:-false}"
CF_DDNS_INTERVAL="${CF_DDNS_INTERVAL:-5min}"

# MinIO (single-node, on whichever host owns the data volume)
MINIO_ROOT_USER="${MINIO_ROOT_USER:-}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-}"
MINIO_VOLUMES="${MINIO_VOLUMES:-/mnt/data}"
MINIO_OPTS="${MINIO_OPTS:---address 0.0.0.0:9000 --console-address 0.0.0.0:9001}"
MINIO_BROWSER_REDIRECT_URL="${MINIO_BROWSER_REDIRECT_URL:-}"
MINIO_SERVER_URL="${MINIO_SERVER_URL:-}"
MINIO_VERSION="${MINIO_VERSION:-}"

# dnsmasq (internal service-catalog DNS — runs on the data host)
DNSMASQ_DOMAIN="${DNSMASQ_DOMAIN:-morcos.lan}"

# === Phase 0: base packages ===================================================
log "Installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates jq gnupg dnsutils >/dev/null

# === Phase 1: sysctl IP forwarding ============================================
if [[ "$INSTALL_SYSCTL_FORWARD" == "1" ]]; then
  log "Configuring IP forwarding (tailscale exit-node + k3s)..."
  cat > /etc/sysctl.d/99-tailscale.conf <<'EOF'
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
EOF
  sysctl -p /etc/sysctl.d/99-tailscale.conf >/dev/null
fi

# === Phase 2: Tailscale =======================================================
if [[ "$INSTALL_TAILSCALE" == "1" ]]; then
  if command -v tailscale >/dev/null 2>&1; then
    log "Tailscale already installed: $(tailscale version 2>/dev/null | head -n1 || echo unknown)"
  else
    log "Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
  fi

  # Translate 1/0 toggles into the boolean strings the CLI wants
  TS_ACCEPT_DNS=$([[ "$TAILSCALE_ACCEPT_DNS" == "1" ]] && echo true || echo false)
  TS_EXIT=$(    [[ "$TAILSCALE_ADVERTISE_EXIT_NODE" == "1" ]] && echo true || echo false)
  TS_AUTOUP=$(  [[ "$TAILSCALE_AUTO_UPDATE" == "1" ]]         && echo true || echo false)
  TS_SSH=$(     [[ "$TAILSCALE_SSH" == "1" ]]                 && echo true || echo false)

  if tailscale status --json 2>/dev/null | jq -e '.BackendState=="Running"' >/dev/null 2>&1; then
    log "Tailscale already running — reconciling prefs..."
    # Idempotently apply current pref settings, so re-runs match config changes
    tailscale set \
      --accept-dns="$TS_ACCEPT_DNS" \
      --accept-routes=false \
      --advertise-exit-node="$TS_EXIT" \
      --auto-update="$TS_AUTOUP" \
      --ssh="$TS_SSH" \
      --hostname="$TAILSCALE_HOSTNAME"
  else
    TS_FLAGS=(
      --accept-dns="$TS_ACCEPT_DNS"
      --accept-routes=false
      --hostname="$TAILSCALE_HOSTNAME"
    )
    [[ "$TAILSCALE_ADVERTISE_EXIT_NODE" == "1" ]] && TS_FLAGS+=(--advertise-exit-node)
    [[ "$TAILSCALE_SSH" == "1" ]]                 && TS_FLAGS+=(--ssh)

    if [[ -n "$TAILSCALE_AUTHKEY" ]]; then
      log "Bringing tailscale up with authkey..."
      tailscale up --authkey="$TAILSCALE_AUTHKEY" "${TS_FLAGS[@]}"
      # --auto-update is a `set` flag only, apply after up succeeds
      tailscale set --auto-update="$TS_AUTOUP"
    else
      warn "TAILSCALE_AUTHKEY not set. Authenticate manually:"
      warn "  sudo tailscale up ${TS_FLAGS[*]}"
      warn "Then: sudo tailscale set --auto-update=$TS_AUTOUP"
    fi
  fi
fi

# === Phase 3: k3s =============================================================
if [[ "$INSTALL_K3S" == "1" ]]; then
  # Key off the role-specific unit so a server↔agent role switch is detected
  # (a leftover unit from the other role must not mask a missing install).
  K3S_UNIT=$([[ "$K3S_ROLE" == "agent" ]] && echo k3s-agent || echo k3s)
  if systemctl list-unit-files 2>/dev/null | grep -qE "^${K3S_UNIT}\.service"; then
    log "k3s already installed: $(k3s --version 2>/dev/null | head -n1 || echo unknown)"
    # Installed != running — start it if a previous run left it stopped/failed.
    systemctl is-active --quiet "$K3S_UNIT" || {
      log "k3s installed but not running — starting $K3S_UNIT..."
      systemctl enable --now "$K3S_UNIT"
    }
  else
    log "Installing k3s $K3S_VERSION ($K3S_ROLE)..."
    if [[ "$K3S_ROLE" == "agent" ]]; then
      [[ -n "$K3S_URL"   ]] || die "K3S_URL required for agent"
      [[ -n "$K3S_TOKEN" ]] || die "K3S_TOKEN required for agent"
      curl -sfL https://get.k3s.io | \
        INSTALL_K3S_VERSION="$K3S_VERSION" \
        K3S_URL="$K3S_URL" K3S_TOKEN="$K3S_TOKEN" \
        sh -
    else
      # Server: write config.yaml with tls-san for hostname + Tailscale IP,
      # plus a world-readable kubeconfig (homelab convenience; Tailscale SSH
      # gates shell access anyway, so the file perms aren't the real boundary)
      install -d -m 0755 /etc/rancher/k3s
      TS_IP=$(tailscale ip -4 2>/dev/null | head -n1 || true)
      {
        echo "write-kubeconfig-mode: \"0644\""
        echo "tls-san:"
        echo "  - $(hostname)"
        [[ -n "$TS_IP" ]] && echo "  - $TS_IP"
      } > /etc/rancher/k3s/config.yaml

      curl -sfL https://get.k3s.io | \
        INSTALL_K3S_VERSION="$K3S_VERSION" \
        INSTALL_K3S_EXEC="server --disable=$K3S_DISABLE" \
        sh -
    fi
  fi
fi

# === Phase 4: Cloudflare DDNS (anchor-record pattern) =========================
# Architecture: one A record (CF_ANCHOR_RECORD, e.g. "morcos.tech" or
# "home.morcos.tech") tracks the public IP. Every app domain is a CNAME to
# that anchor in Cloudflare. DDNS touches one record per run; app records
# auto-follow via CNAME.
if [[ "$INSTALL_CF_DDNS" == "1" ]]; then
  log "Setting up Cloudflare DDNS (anchor: ${CF_ANCHOR_RECORD:-<unset>})..."
  install -d -m 0755 /etc/infrastructure/bootstrap
  install -d -m 0755 /usr/local/lib/infrastructure

  ENV_FILE=/etc/infrastructure/bootstrap/cloudflare-ddns.env
  if [[ -n "$CF_API_TOKEN" && -n "$CF_ANCHOR_RECORD" ]]; then
    umask 077
    cat > "$ENV_FILE" <<EOF
CF_API_TOKEN=$CF_API_TOKEN
CF_ANCHOR_RECORD=$CF_ANCHOR_RECORD
CF_ANCHOR_PROXIED=$CF_ANCHOR_PROXIED
EOF
    umask 022
  elif [[ ! -f "$ENV_FILE" ]]; then
    warn "CF_API_TOKEN and/or CF_ANCHOR_RECORD not set — DDNS will fail until configured."
  fi

  cat > /usr/local/lib/infrastructure/cloudflare-ddns.sh <<'SCRIPT'
#!/usr/bin/env bash
# Cloudflare DDNS — anchor record pattern.
# Updates ONE A record. All app records should be CNAMEs to this anchor.
set -euo pipefail

# shellcheck disable=SC1091
source /etc/infrastructure/bootstrap/cloudflare-ddns.env

API="https://api.cloudflare.com/client/v4"

IP=$(curl -fsS --max-time 10 https://ipv4.icanhazip.com)
[[ "$IP" =~ ^[0-9.]+$ ]] || { echo "❌ Bad public IP: $IP"; exit 1; }

# Find the zone by walking up labels from most-specific to least-specific.
# Handles both apex anchors ("morcos.tech") and subdomain anchors ("home.morcos.tech").
ZONE_ID=""
candidate="$CF_ANCHOR_RECORD"
while [[ -n "$candidate" ]]; do
  ZONE_ID=$(curl -fsS -H "Authorization: Bearer $CF_API_TOKEN" \
    "$API/zones?name=$candidate" | jq -r '.result[0].id // empty')
  [[ -n "$ZONE_ID" ]] && break
  [[ "$candidate" == *.* ]] || break
  candidate="${candidate#*.}"
done
[[ -n "$ZONE_ID" ]] || { echo "❌ No Cloudflare zone matches $CF_ANCHOR_RECORD"; exit 1; }

REC_DATA=$(curl -fsS -H "Authorization: Bearer $CF_API_TOKEN" \
  "$API/zones/$ZONE_ID/dns_records?name=$CF_ANCHOR_RECORD&type=A")
REC_ID=$(echo "$REC_DATA" | jq -r '.result[0].id // empty')
REC_IP=$(echo "$REC_DATA" | jq -r '.result[0].content // empty')

if [[ -z "$REC_ID" ]]; then
  echo "❌ Anchor A record not found: $CF_ANCHOR_RECORD"
  echo "   Create it in Cloudflare (A record, value = any IP — DDNS will fix it), then re-run."
  exit 1
fi

if [[ "$IP" == "$REC_IP" ]]; then
  echo "✅ $CF_ANCHOR_RECORD unchanged ($IP)"
  exit 0
fi

curl -fsS -X PUT \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"A\",\"name\":\"$CF_ANCHOR_RECORD\",\"content\":\"$IP\",\"ttl\":1,\"proxied\":${CF_ANCHOR_PROXIED:-false}}" \
  "$API/zones/$ZONE_ID/dns_records/$REC_ID" | jq -e '.success' >/dev/null

echo "🌐 $CF_ANCHOR_RECORD: $REC_IP → $IP"
SCRIPT
  chmod 0755 /usr/local/lib/infrastructure/cloudflare-ddns.sh

  cat > /etc/systemd/system/cloudflare-ddns.service <<'EOF'
[Unit]
Description=Cloudflare DDNS update (anchor record)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/lib/infrastructure/cloudflare-ddns.sh

[Install]
WantedBy=network-online.target
EOF

  cat > /etc/systemd/system/cloudflare-ddns.timer <<EOF
[Unit]
Description=Cloudflare DDNS periodic check

[Timer]
OnBootSec=30s
OnUnitActiveSec=$CF_DDNS_INTERVAL
Persistent=true
RandomizedDelaySec=30s

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now cloudflare-ddns.service cloudflare-ddns.timer
fi

# === Phase 5: k3s cleanup =====================================================
if [[ "$INSTALL_K3S_CLEANUP" == "1" && "$INSTALL_K3S" == "1" ]]; then
  log "Setting up k3s cleanup..."
  install -d -m 0755 /usr/local/lib/infrastructure

  cat > /usr/local/lib/infrastructure/k3s-cleanup.sh <<'SCRIPT'
#!/usr/bin/env bash
set -uo pipefail

# Remove containerd images not currently in use by any running container.
comm -23 \
  <(k3s crictl images -o json | jq -r '.images[].id' | sort) \
  <(k3s crictl ps -o json    | jq -r '.containers[].imageRef' | sort) |
while read -r img; do
  [[ -z "$img" ]] && continue
  echo "🧹 Removing unused image $img"
  k3s crictl rmi "$img" || echo "❌ Failed to remove $img"
done

# ReplicaSet GC (only on server — agent has no kubeconfig)
if [[ -f /etc/rancher/k3s/k3s.yaml ]]; then
  export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
  kubectl get rs -A --no-headers 2>/dev/null \
    | awk '$3==0 && $4==0 && $5==0 {print $1, $2}' \
    | while read -r ns rs; do
        echo "🧹 Deleting unused ReplicaSet $rs in $ns"
        kubectl -n "$ns" delete rs "$rs"
      done
fi
SCRIPT
  chmod 0755 /usr/local/lib/infrastructure/k3s-cleanup.sh

  cat > /etc/systemd/system/k3s-cleanup.service <<'EOF'
[Unit]
Description=k3s image and ReplicaSet cleanup
After=k3s.service k3s-agent.service

[Service]
Type=oneshot
ExecStart=/usr/local/lib/infrastructure/k3s-cleanup.sh
EOF

  cat > /etc/systemd/system/k3s-cleanup.timer <<'EOF'
[Unit]
Description=Daily k3s cleanup

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=30min

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now k3s-cleanup.timer
fi

# === Phase 6: MinIO (optional, runs on whichever host owns the data volume) ==
if [[ "$INSTALL_MINIO" == "1" ]]; then
  log "Setting up MinIO..."
  [[ -n "$MINIO_ROOT_USER"     ]] || die "MINIO_ROOT_USER required when INSTALL_MINIO=1"
  [[ -n "$MINIO_ROOT_PASSWORD" ]] || die "MINIO_ROOT_PASSWORD required when INSTALL_MINIO=1"

  getent group  minio-user >/dev/null || groupadd -r minio-user
  getent passwd minio-user >/dev/null || useradd -r -g minio-user -s /sbin/nologin -d /var/lib/minio minio-user

  if [[ ! -x /usr/local/bin/minio ]]; then
    ARCH=$(dpkg --print-architecture)   # amd64 | arm64
    MINIO_DL="https://dl.min.io/server/minio/release/linux-${ARCH}/minio"
    [[ -n "$MINIO_VERSION" ]] && MINIO_DL="https://dl.min.io/server/minio/release/linux-${ARCH}/archive/minio.${MINIO_VERSION}"

    log "Downloading MinIO ($ARCH)..."
    curl -fsSL "$MINIO_DL" -o /usr/local/bin/minio.tmp
    EXPECTED=$(curl -fsSL "${MINIO_DL}.sha256sum" | awk '{print $1}')
    ACTUAL=$(sha256sum /usr/local/bin/minio.tmp | awk '{print $1}')
    if [[ "$EXPECTED" != "$ACTUAL" ]]; then
      rm -f /usr/local/bin/minio.tmp
      die "MinIO checksum mismatch (expected $EXPECTED, got $ACTUAL)"
    fi
    chmod +x /usr/local/bin/minio.tmp
    mv /usr/local/bin/minio.tmp /usr/local/bin/minio
  else
    log "MinIO binary already in place"
  fi

  umask 077
  cat > /etc/default/minio <<EOF
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD="$MINIO_ROOT_PASSWORD"
MINIO_BROWSER_REDIRECT_URL="$MINIO_BROWSER_REDIRECT_URL"
MINIO_SERVER_URL="$MINIO_SERVER_URL"
MINIO_VOLUMES="$MINIO_VOLUMES"
MINIO_OPTS="$MINIO_OPTS"
MINIO_BROWSER_LICENSE=accept
EOF
  chown root:minio-user /etc/default/minio
  chmod 0640 /etc/default/minio
  umask 022

  cat > /etc/systemd/system/minio.service <<'EOF'
[Unit]
Description=MinIO
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target
AssertFileIsExecutable=/usr/local/bin/minio

[Service]
Type=notify
WorkingDirectory=/usr/local
User=minio-user
Group=minio-user
ProtectProc=invisible
EnvironmentFile=-/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_OPTS $MINIO_VOLUMES
Restart=always
LimitNOFILE=1048576
MemoryAccounting=no
TasksMax=infinity
TimeoutSec=infinity
OOMScoreAdjust=-1000
SendSIGKILL=no

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now minio
fi

# === Phase 7: dnsmasq (split-DNS authority for internal service catalog) ======
if [[ "$INSTALL_DNSMASQ" == "1" ]]; then
  log "Installing and configuring dnsmasq for *.${DNSMASQ_DOMAIN}..."
  apt-get install -y -qq dnsmasq >/dev/null

  # Skip resolvconf integration — we don't want dnsmasq registering itself as
  # the system resolver; Tailscale's split-DNS handles the routing for us.
  # Also silences the "Unit dbus-org.freedesktop.network1.service not found"
  # error on Ubuntu Desktop (which runs NetworkManager, not systemd-networkd).
  if ! grep -q '^RESOLVCONF=no' /etc/default/dnsmasq 2>/dev/null; then
    echo 'RESOLVCONF=no' >> /etc/default/dnsmasq
  fi

  # systemd-resolved often holds port 53 — free it before dnsmasq tries to bind
  if systemctl is-active --quiet systemd-resolved 2>/dev/null; then
    if ! grep -q '^DNSStubListener=no' /etc/systemd/resolved.conf 2>/dev/null; then
      log "Disabling systemd-resolved's port-53 stub listener..."
      if grep -qE '^\s*#?\s*DNSStubListener' /etc/systemd/resolved.conf 2>/dev/null; then
        sed -i 's/^\s*#\?\s*DNSStubListener=.*/DNSStubListener=no/' /etc/systemd/resolved.conf
      else
        echo 'DNSStubListener=no' >> /etc/systemd/resolved.conf
      fi
      systemctl restart systemd-resolved
      sleep 1   # give it a beat to fully release the port
    fi
  fi

  CONF_FILE="/etc/dnsmasq.d/${DNSMASQ_DOMAIN}.conf"
  HOSTS_FILE="/etc/infrastructure/dnsmasq/${DNSMASQ_DOMAIN}.hosts"
  install -d -m 0755 /etc/infrastructure/dnsmasq

  cat > "$CONF_FILE" <<EOF
# Authoritative split-DNS for the *.${DNSMASQ_DOMAIN} zone.
# Records live in ${HOSTS_FILE} — edit there, then \`systemctl reload dnsmasq\`.

# Bind to tailscale interface + loopback (dynamic so dnsmasq survives ts restart)
interface=tailscale0
interface=lo
bind-dynamic

# We are authoritative ONLY for ${DNSMASQ_DOMAIN}. Don't read /etc/hosts or
# /etc/resolv.conf — Tailscale handles non-matching queries via fallback.
no-hosts
no-resolv
local=/${DNSMASQ_DOMAIN}/

addn-hosts=${HOSTS_FILE}

# Uncomment to debug
# log-queries
EOF

  # Only write a starter hosts file if one isn't already there — never clobber
  # local edits. Edit ${HOSTS_FILE} directly to add/move records.
  if [[ ! -f "$HOSTS_FILE" ]]; then
    TS_IP=$(tailscale ip -4 2>/dev/null | head -n1 || echo "100.0.0.0")
    log "Writing starter hosts file: $HOSTS_FILE (using $TS_IP)"
    cat > "$HOSTS_FILE" <<EOF
# Internal service catalog — resolved on this host's tailscale interface.
# Format: <IP> <fqdn> [aliases...]
# To migrate a service: edit the IP for that line, then:
#   sudo systemctl reload dnsmasq
${TS_IP} postgres.${DNSMASQ_DOMAIN} postgres
${TS_IP} mongo.${DNSMASQ_DOMAIN}    mongo
${TS_IP} redis.${DNSMASQ_DOMAIN}    redis
${TS_IP} minio.${DNSMASQ_DOMAIN}    minio
EOF
  else
    log "Hosts file $HOSTS_FILE already exists — leaving local edits intact"
  fi

  systemctl enable dnsmasq
  systemctl restart dnsmasq

  # Quick sanity check
  if dig +short +time=2 +tries=1 "postgres.${DNSMASQ_DOMAIN}" @127.0.0.1 2>/dev/null | grep -q '^[0-9]'; then
    log "dnsmasq is answering for *.${DNSMASQ_DOMAIN}"
  else
    warn "dnsmasq did not answer locally yet — check 'systemctl status dnsmasq' and 'journalctl -u dnsmasq'"
  fi

  log "Next: in Tailscale admin → DNS → Nameservers → Add Custom"
  log "      nameserver IP = $(tailscale ip -4 2>/dev/null | head -n1 || echo '<this host tailscale IP>')"
  log "      Restrict to search domain = ${DNSMASQ_DOMAIN}"
fi

# === Done =====================================================================
log "Bootstrap complete."
echo
systemctl list-timers --no-pager 2>/dev/null | grep -E 'cloudflare-ddns|k3s-cleanup' || true
echo
log "Tip: keep secrets in /etc/infrastructure/bootstrap/.env (chmod 0600) so re-runs need no env vars."
