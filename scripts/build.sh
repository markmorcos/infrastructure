#!/bin/bash
set -euo pipefail

CONFIG_FILE=${CONFIG_FILE:-"client/deployment.yaml"}
DEPLOYMENT_VERSION=${DEPLOYMENT_VERSION:-latest}

NAMESPACE=$(yq -r .namespace "$CONFIG_FILE")
SERVICE_COUNT=$(yq '.services | length' "$CONFIG_FILE")

resolve_build_arg() {
  local svc_idx=$1
  local arg_idx=$2

  local arg_name
  arg_name=$(yq -r ".services[$svc_idx].buildArgs[$arg_idx].name" "$CONFIG_FILE")

  local inline_value
  inline_value=$(yq -r ".services[$svc_idx].buildArgs[$arg_idx].value // \"\"" "$CONFIG_FILE")
  if [ -n "$inline_value" ] && [ "$inline_value" != "null" ]; then
    printf '%s=%s' "$arg_name" "$inline_value"
    return 0
  fi

  local secret_name secret_key value
  secret_name=$(yq -r ".services[$svc_idx].buildArgs[$arg_idx].valueFrom.secretKeyRef.name // \"\"" "$CONFIG_FILE")
  secret_key=$(yq -r ".services[$svc_idx].buildArgs[$arg_idx].valueFrom.secretKeyRef.key // \"\"" "$CONFIG_FILE")
  if [ -z "$secret_name" ] || [ -z "$secret_key" ]; then
    echo "❌ buildArgs[$arg_idx] for service[$svc_idx] has neither value nor valueFrom.secretKeyRef" >&2
    return 1
  fi
  value=$(kubectl -n "$NAMESPACE" get secret "$secret_name" -o jsonpath="{.data.$secret_key}" | base64 -d)
  if [ -z "$value" ]; then
    echo "❌ secret $NAMESPACE/$secret_name#$secret_key resolved to empty" >&2
    return 1
  fi
  printf '%s=%s' "$arg_name" "$value"
}

for i in $(seq 0 $((SERVICE_COUNT - 1))); do
  if [[ $(yq -r ".services[$i].image" "$CONFIG_FILE") != ghcr.io/* ]]; then
    continue
  fi


  IMAGE_NAME=$(yq -r ".services[$i].image" "$CONFIG_FILE")
  SERVICE_CONTEXT="client/$(yq -r ".services[$i].context // \".\"" "$CONFIG_FILE")"
  DOCKERFILE_PATH="${SERVICE_CONTEXT}/$(yq -r ".services[$i].dockerfile // \"Dockerfile\"" "$CONFIG_FILE")"

  build_arg_flags=()
  BUILD_ARG_COUNT=$(yq -r ".services[$i].buildArgs | length // 0" "$CONFIG_FILE")
  if [ "$BUILD_ARG_COUNT" != "null" ] && [ "$BUILD_ARG_COUNT" -gt 0 ]; then
    for j in $(seq 0 $((BUILD_ARG_COUNT - 1))); do
      pair=$(resolve_build_arg "$i" "$j")
      build_arg_flags+=(--build-arg "$pair")
    done
  fi


  echo "🔨 Building $IMAGE_NAME:${NAMESPACE}-${DEPLOYMENT_VERSION}"

  docker build \
    -t ${IMAGE_NAME}:${NAMESPACE}-${DEPLOYMENT_VERSION} \
    -t ${IMAGE_NAME}:${NAMESPACE}-latest \
    -f ${DOCKERFILE_PATH} \
    "${build_arg_flags[@]}" \
    ${SERVICE_CONTEXT}

  docker push ${IMAGE_NAME}:${NAMESPACE}-${DEPLOYMENT_VERSION}
  docker push ${IMAGE_NAME}:${NAMESPACE}-latest

  echo "✅ Done building and pushing $IMAGE_NAME"
done
