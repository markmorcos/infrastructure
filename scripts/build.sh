#!/bin/bash
set -euo pipefail

REPOSITORY_PATH=${REPOSITORY_PATH:-.}

docker build \
  -t markmorcos/${PROJECT_NAME}:${DEPLOYMENT_VERSION} \
  -t markmorcos/${PROJECT_NAME}:latest \
  -f ${REPOSITORY_PATH}/Dockerfile \
  ${REPOSITORY_PATH}

docker push markmorcos/${PROJECT_NAME}:${DEPLOYMENT_VERSION}
docker push markmorcos/${PROJECT_NAME}:latest
