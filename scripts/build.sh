#!/bin/bash
set -euo pipefail

projectName=$1
deploymentVersion=$2
repositoryPath=${3:-.}

docker build \
  -t markmorcos/${projectName}:${deploymentVersion} \
  -t markmorcos/${projectName}:latest \
  -f ${repositoryPath}/Dockerfile \
  ${repositoryPath}

docker push markmorcos/${projectName}:${deploymentVersion}
docker push markmorcos/${projectName}:latest
