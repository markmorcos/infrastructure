#!/bin/bash
set -euo pipefail

CONFIG_FILE=${CONFIG_FILE:-"client/deployment.yaml"}
DEPLOYMENT_VERSION=${DEPLOYMENT_VERSION:-latest}

SERVICE_COUNT=$(yq '.services | length' "$CONFIG_FILE")

for i in $(seq 0 $((SERVICE_COUNT - 1))); do
  if [[ $(yq -r ".services[$i].image" "$CONFIG_FILE") != ghcr.io/* ]]; then
    continue
  fi


  IMAGE_NAME=$(yq -r ".services[$i].image" "$CONFIG_FILE")
  SERVICE_CONTEXT="client/$(yq -r ".services[$i].context // \".\"" "$CONFIG_FILE")"

  echo "🔨 Building $IMAGE_NAME:$DEPLOYMENT_VERSION"

  docker build \
    -t ${IMAGE_NAME}:${DEPLOYMENT_VERSION} \
    -f ${SERVICE_CONTEXT}/Dockerfile \
    ${SERVICE_CONTEXT}

  docker push ${IMAGE_NAME}:${DEPLOYMENT_VERSION}
  
  echo "✅ Done building and pushing $IMAGE_NAME"
done
