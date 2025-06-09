#!/bin/bash
set -euo pipefail

CONFIG_FILE=${CONFIG_FILE:-"deployment.yaml"}
DEPLOYMENT_VERSION=${DEPLOYMENT_VERSION:-latest}

SERVICE_COUNT=$(yq '.services | length' "$CONFIG_FILE")

for i in $(seq 0 $((SERVICE_COUNT - 1))); do
  IMAGE_NAME=$(yq -r ".services[$i].image" "$CONFIG_FILE")
  SERVICE_CONTEXT=$(yq -r ".services[$i].context // \".\"" "$CONFIG_FILE")

  echo "🔨 Building $IMAGE_NAME:$DEPLOYMENT_VERSION"

  docker build \
    -t ${IMAGE_NAME}:${DEPLOYMENT_VERSION} \
    -t ${IMAGE_NAME}:latest \
    -f ${SERVICE_CONTEXT}/Dockerfile \
    ${SERVICE_CONTEXT}

  docker push ${IMAGE_NAME}:${DEPLOYMENT_VERSION}
  docker push ${IMAGE_NAME}:latest
  
  echo "✅ Done building and pushing $IMAGE_NAME"
done
