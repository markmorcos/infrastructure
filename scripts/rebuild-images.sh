#!/usr/bin/env bash
#
# Rebuild + push all app images as multi-arch (amd64 + arm64).
# Run from your LAPTOP — Docker Desktop ships buildx + QEMU, so no setup needed.
#
# Prereqs:
#   docker login ghcr.io                 # PAT with write:packages
#   each app repo checked out locally    # edit BUILDS below with REAL paths
#
# Faster amd64-only (if you won't schedule these on the Pi):
#   PLATFORMS=linux/amd64 ./scripts/rebuild-images.sh

set -euo pipefail
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
REG="ghcr.io/markmorcos"

# One line per image:  REPO_DIR | DOCKERFILE (rel to repo) | IMAGE | TAGS (csv) | BUILD_ARGS (optional, space-sep KEY=VAL)
# Build context = REPO_DIR. >>> EDIT paths/dockerfiles to match your repos. <<<
BUILDS=(
  "$HOME/code/eventlane     | apps/admin-web/Dockerfile | eventlane-admin-web   | latest |"
  "$HOME/code/eventlane     | apps/api/Dockerfile        | eventlane-backend-api | latest |"
  "$HOME/code/eventlane     | apps/user-web/Dockerfile   | eventlane-user-web    | latest |"
  "$HOME/code/games         | server/Dockerfile          | games-server          | latest |"
  "$HOME/code/games         | web/Dockerfile             | games-web             | latest |"
  "$HOME/code/ma3ady        | marketing/Dockerfile       | ma3ady-marketing      | latest |"
  "$HOME/code/ma3ady        | web/Dockerfile             | ma3ady-web            | ma3ady-latest,ma3ady-preview-latest |"
  "$HOME/code/pile          | Dockerfile                 | pile                  | latest |"
  "$HOME/code/portfolio     | Dockerfile                 | portfolio             | latest |"
  "$HOME/code/secrets       | Dockerfile                 | secrets               | latest |"
  "$HOME/code/stminaconnect | Dockerfile                 | stminaconnect         | latest |"
  "$HOME/code/url-shortener | Dockerfile                 | url-shortener         | latest |"
)

docker buildx inspect multiarch >/dev/null 2>&1 \
  || docker buildx create --name multiarch --driver docker-container --use >/dev/null
docker buildx use multiarch

fail=0
for entry in "${BUILDS[@]}"; do
  IFS='|' read -r repo dockerfile image tags args <<<"$entry"
  repo=$(echo "$repo" | xargs); dockerfile=$(echo "$dockerfile" | xargs)
  image=$(echo "$image" | xargs); tags=$(echo "$tags" | xargs); args=$(echo "${args:-}" | xargs)

  [[ -d "$repo" ]] || { echo "⚠️  skip $image — repo not found: $repo"; fail=1; continue; }
  [[ -f "$repo/$dockerfile" ]] || { echo "⚠️  skip $image — no $dockerfile in $repo"; fail=1; continue; }

  tflags=(); IFS=',' read -ra tl <<<"$tags"; for t in "${tl[@]}"; do tflags+=(-t "$REG/$image:$t"); done
  aflags=(); for a in $args; do aflags+=(--build-arg "$a"); done

  echo "🔨 $image  [$tags]  ($PLATFORMS)"
  docker buildx build --platform "$PLATFORMS" -f "$repo/$dockerfile" \
    "${tflags[@]}" "${aflags[@]}" --push "$repo"
  echo "✅ $image"
done

[[ $fail -eq 0 ]] && echo "✅ all images built + pushed" || { echo "⚠️  some images skipped — fix BUILDS paths"; exit 1; }
