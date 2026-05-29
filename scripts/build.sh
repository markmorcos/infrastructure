#!/bin/bash
set -euo pipefail

CONFIG_FILE=${CONFIG_FILE:-"client/deployment.yaml"}
DEPLOYMENT_VERSION=${DEPLOYMENT_VERSION:-latest}
# Native per-arch builds avoid QEMU (esbuild, the Astro compiler & other Go/native
# build tools crash under emulation). CI builds each arch on its own runner with
# TAG_SUFFIX, then STAGE=merge stitches them into one manifest. Locally, leave the
# defaults for a single host-native build.
PLATFORMS=${PLATFORMS:-linux/amd64,linux/arm64}
TAG_SUFFIX=${TAG_SUFFIX:-}        # per-arch tag suffix, e.g. -amd64 / -arm64
STAGE=${STAGE:-build}             # build | merge

NAMESPACE=$(yq -r .namespace "$CONFIG_FILE")
SERVICE_COUNT=$(yq '.services | length' "$CONFIG_FILE")

if [ "$STAGE" = "build" ]; then
  # buildx --push needs the docker-container driver (the default "docker" driver
  # can't push a build result). Create it once; reuse thereafter.
  docker buildx inspect multiarch >/dev/null 2>&1 \
    || docker buildx create --name multiarch --driver docker-container --use >/dev/null
  docker buildx use multiarch
fi

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
  TAG_VER="${IMAGE_NAME}:${NAMESPACE}-${DEPLOYMENT_VERSION}"
  TAG_LATEST="${IMAGE_NAME}:${NAMESPACE}-latest"

  # STAGE=merge: combine the per-arch tags pushed by the build matrix into one
  # multi-arch manifest (registry-only op, no build, no emulation).
  if [ "$STAGE" = "merge" ]; then
    echo "🔗 Merging multi-arch manifest for $IMAGE_NAME"
    docker buildx imagetools create -t "$TAG_VER"    "${TAG_VER}-amd64"    "${TAG_VER}-arm64"
    docker buildx imagetools create -t "$TAG_LATEST" "${TAG_LATEST}-amd64" "${TAG_LATEST}-arm64"
    echo "✅ Merged $IMAGE_NAME"
    continue
  fi

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

  echo "🔨 Building ${TAG_VER}${TAG_SUFFIX} for ${PLATFORMS}"

  docker buildx build \
    --platform "${PLATFORMS}" \
    -t "${TAG_VER}${TAG_SUFFIX}" \
    -t "${TAG_LATEST}${TAG_SUFFIX}" \
    -f ${DOCKERFILE_PATH} \
    "${build_arg_flags[@]}" \
    --push \
    ${SERVICE_CONTEXT}

  echo "✅ Done building and pushing $IMAGE_NAME (${TAG_SUFFIX:-multi-arch})"
done
