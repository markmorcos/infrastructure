#!/usr/bin/env bash
# Bring a freshly-flashed Pi from zero to a running monitoring stack.
# Idempotent: safe to re-run. Run from inside the monitoring/ directory.
set -euo pipefail
cd "$(dirname "$0")"

# --- Pi 5 page-size guard ----------------------------------------------------
# A 16K-page kernel breaks Tailscale's (and other) Go binaries.
if [ "$(getconf PAGESIZE)" = "16384" ]; then
  echo "ERROR: 16K page size detected. Add 'kernel=kernel8.img' to" >&2
  echo "       /boot/firmware/config.txt and reboot before continuing." >&2
  exit 1
fi

# --- Docker ------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo ">> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
  echo ">> Docker installed. You may need to log out/in for the group change."
fi

# --- Tailscale (warn only) ---------------------------------------------------
if ! command -v tailscale >/dev/null 2>&1; then
  echo "WARN: tailscale not found — join the tailnet or the dashboard won't be reachable." >&2
elif ! tailscale status >/dev/null 2>&1; then
  echo "WARN: tailscale is installed but not up. Run: sudo tailscale up" >&2
fi

# --- Secrets -----------------------------------------------------------------
if [ ! -f .env ]; then
  echo "ERROR: .env missing. Run: cp .env.example .env && \$EDITOR .env" >&2
  exit 1
fi
if ! grep -q '^CF_API_TOKEN=.\+' .env; then
  echo "ERROR: CF_API_TOKEN is empty in .env." >&2
  exit 1
fi

# --- Bring it up -------------------------------------------------------------
echo ">> Starting monitoring stack..."
docker compose up -d --build

pi_ip="$(tailscale ip -4 2>/dev/null || echo '<Pi Tailscale IP>')"
echo ">> Done."
echo ">> Ensure a PUBLIC Cloudflare A record exists: status.morcos.tech -> ${pi_ip}"
echo ">> Then open https://status.morcos.tech from any tailnet device."
