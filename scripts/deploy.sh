#!/bin/bash
set -euo pipefail

log() {
  printf "%s - %s\\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

get_secret() {
  local name=$1
  local key=$2
  kubectl -n infrastructure get secret "$name" -o json |
    jq -r ".data[\"$key\"]" |
    base64 --decode
}

get_database_credentials() {
  readonly DB_NAME=$(get_secret "database-secrets" "DATABASE")
  readonly DB_USER=$(get_secret "database-secrets" "USER")
  readonly DB_PASS=$(get_secret "database-secrets" "PASSWORD")
  readonly DB_HOST=$(get_secret "database-secrets" "HOST")
  readonly DB_PORT=$(get_secret "database-secrets" "PORT")
}

require_deployment_token() {
  [[ -n "${DEPLOYMENT_TOKEN:-}" ]] || {
    log "❌ DEPLOYMENT_TOKEN environment variable is required"
    exit 1
  }
}

get_deployment_info() {
  require_deployment_token
  get_database_credentials

  local query
  query="SELECT row_to_json(d) FROM (SELECT * FROM deployments WHERE token = '$DEPLOYMENT_TOKEN') d;"

  local result
  result=$(PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -t -c "$query" | tr -d '[:space:]')

  [[ -n "$result" ]] || {
    log "❌ Deployment not found"
    exit 1
  }

  if [[ "$(jq -r '.enabled' <<< "$result")" != "true" ]]; then
    log "❌ Deployment is not enabled"
    exit 1
  fi

  echo "$result"
}

run_command() {
  log "▶️  ${*}"
  if ! output=$("$@" 2>&1); then
    log "❌ $output"
    return 1
  fi
  echo "$output"
}

deploy_with_helm() {
  local name=$1
  local yaml=$2

  run_command helm upgrade --install "$name" \
    oci://registry-1.docker.io/markmorcos/base-chart \
    --version "$(yq -r .chartVersion <<< "$yaml")" \
    -f - \
    -n "$name" \
    --create-namespace <<< "$yaml"
}

main() {
  log "🔑 Checking for DEPLOYMENT_TOKEN environment variable"
  require_deployment_token

  local json
  log "🔍 Getting deployment info"
  json=$(get_deployment_info)

  local name config
  name=$(jq -r .project_name <<< "$json")
  config=$(jq -r .config <<< "$json" | yq -P)

  log "🚀 Starting deployment for $name"
  deploy_with_helm "$name" "$config"
  log "✅ Deployment of $name completed"
}

main
