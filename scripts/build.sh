#!/bin/bash
set -euo pipefail

CONFIG_FILE=${CONFIG_FILE:-"client/deployment.yaml"}
DEPLOYMENT_VERSION=${DEPLOYMENT_VERSION:-latest}
# Build for both node architectures (amd64 = M720q, arm64 = Pi agent) so pods
# schedule anywhere. Override with PLATFORMS=linux/amd64 once the Pi is gone.
PLATFORMS=${PLATFORMS:-linux/amd64,linux/arm64}

NAMESPACE=$(yq -r .namespace "$CONFIG_FILE")
SERVICE_COUNT=$(yq '.services | length' "$CONFIG_FILE")

# A multi-arch build needs the docker-container driver (the default "docker"
# driver can't do multi-platform). Create it once; reuse thereafter.
docker buildx inspect multiarch >/dev/null 2>&1 \
  || docker buildx create --name multiarch --driver docker-container --use >/dev/null
docker buildx use multiarch

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


  echo "🔨 Building $IMAGE_NAME:${NAMESPACE}-${DEPLOYMENT_VERSION} for ${PLATFORMS}"

  # buildx builds + pushes the multi-arch manifest in one step (a multi-platform
  # image can't live in the local docker store, so --push replaces docker push).
  docker buildx build \
    --platform "${PLATFORMS}" \
    -t ${IMAGE_NAME}:${NAMESPACE}-${DEPLOYMENT_VERSION} \
    -t ${IMAGE_NAME}:${NAMESPACE}-latest \
    -f ${DOCKERFILE_PATH} \
    "${build_arg_flags[@]}" \
    --push \
    ${SERVICE_CONTEXT}

  echo "✅ Done building and pushing $IMAGE_NAME"
done
