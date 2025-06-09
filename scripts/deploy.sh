#!/bin/bash
set -euo pipefail

# Script to deploy applications using Helm charts
# This script handles:
# - Deployment token verification
# - Secret management
# - Helm chart deployment
# - Error handling and logging

# Logging function with timestamp
log() {
  printf "%s - %s\\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

# Base64url encode
base64url_encode() {
  local input=${1:-}
  if [ -z "$input" ]; then
    return 1
  fi
  local result
  result=$(echo -n "$input" | base64 | tr -d '=' | tr '/+' '_-')
  echo -n "$result"
}

# Base64url decode
base64url_decode() {
  local input=${1:-}
  if [ -z "$input" ]; then
    return 1
  fi
  local padding=$((4 - (${#input} % 4)))
  if [ $padding -ne 4 ]; then
    input="${input}${padding}="
  fi
  local result
  result=$(echo -n "$input" | tr '_-' '/+' | base64 -d)
  echo -n "$result"
}

# Verify JWT token
verify_jwt() {
  local token=$1
  local secret=$2

  # Split token into parts
  IFS='.' read -r -a parts <<< "$token"
  if [ ${#parts[@]} -ne 3 ]; then
    log "❌ Invalid token format"
    return 1
  fi

  # Decode header and verify algorithm
  local header
  header=$(base64url_decode "${parts[0]}")
  if ! echo "$header" | jq -e '.alg == "HS256"' >/dev/null; then
    log "❌ Only HS256 algorithm is supported"
    return 1
  fi

  # Create signature
  local message="${parts[0]}.${parts[1]}"
  local signature
  # Use hex output and convert to binary before base64 encoding
  signature=$(echo -n "$message" | openssl dgst -sha256 -hmac "$secret" | cut -d' ' -f2 | xxd -r -p | base64 | tr -d '=' | tr '/+' '_-')
  if [ $? -ne 0 ]; then
    log "❌ Failed to create signature"
    return 1
  fi

  # Compare signatures
  if [ "$signature" != "${parts[2]}" ]; then
    log "❌ Invalid signature"
    return 1
  fi

  # Decode and return payload
  local payload
  payload=$(base64url_decode "${parts[1]}")
  echo -n "$payload"
}

# Retrieve a secret from Kubernetes
# Args:
#   $1: Secret name
#   $2: Secret key
get_secret() {
  local name=$1
  local key=$2
  kubectl -n infrastructure get secret "$name" -o json |
    jq -r ".data[\"$key\"]" |
    base64 --decode
}

# Check if deployment token is set
require_deployment_token() {
  [[ -n "${DEPLOYMENT_TOKEN:-}" ]] || {
    log "❌ DEPLOYMENT_TOKEN environment variable is required"
    exit 1
  }
}

# Verify deployment token against database and JWT
verify_deployment_token() {
  require_deployment_token

  command -v openssl >/dev/null || {
    log "❌ openssl is not installed or not in PATH"
    exit 1
  }

  command -v jq >/dev/null || {
    log "❌ jq is not installed or not in PATH"
    exit 1
  }

  local jwt_secret
  readonly jwt_secret=$(get_secret "jwt-secret" "JWT_SECRET")
  verify_jwt "$DEPLOYMENT_TOKEN" "$jwt_secret"
}

# Execute a command with proper error handling
run_command() {
  log "▶️  ${*}"
  if ! output=$("$@" 2>&1); then
    log "❌ $output"
    return 1
  fi
  echo "$output"
}

# Main deployment function
main() {
  local dry_run=false

  # Parse command line arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dry-run)
        dry_run=true
        shift
        ;;
      *)
        log "❌ Unknown option: $1"
        exit 1
        ;;
    esac
  done

  log "🔑 Checking for DEPLOYMENT_TOKEN environment variable"
  require_deployment_token

  log "🔍 Verifying deployment token"
  verify_deployment_token

  project=$(yq -r .project "$CONFIG_FILE")
  version=$(yq -r .version "$CONFIG_FILE")

  log "🚀 Starting deployment for $project"
  
  local helm_args=(
    helm upgrade --install "$project"
    oci://ghcr.io/markmorcos/infrastructure
    --version "$version"
    -f "$CONFIG_FILE"
    -n "$project"
    --create-namespace
  )

  if [[ "$dry_run" == "true" ]]; then
    helm_args+=("--dry-run")
  fi

  if run_command "${helm_args[@]}"; then
    log "✅ Deployment of $project completed"
  else
    log "❌ Deployment of $project failed"
    exit 1
  fi
}

main "$@"
