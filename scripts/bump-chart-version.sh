#!/usr/bin/env bash
#
# Bump the infrastructure Helm chart version to 0.5.0 across all app repos.
# Chart 0.5.0 tags images per namespace (<namespace>-latest), which is what
# build.sh publishes — fixing the stale `:latest` pulls.
#
# Run locally where you have GitHub access (gh CLI or SSH). It reuses repos
# already cloned under $BASE, otherwise clones them with `gh` into /tmp.
#
#   ./bump-chart-version.sh           # bump + commit in each repo (no push)
#   PUSH=1 ./bump-chart-version.sh    # also push -> triggers each app's deploy
#
# Override: OWNER, NEW_VERSION, BASE (where your repos are cloned).

set -uo pipefail

OWNER="${OWNER:-markmorcos}"
NEW_VERSION="${NEW_VERSION:-0.5.0}"
BASE="${BASE:-$HOME/code}"
REPOS=(eventlane games ma3ady pile portfolio secrets stminaconnect url-shortener)

for repo in "${REPOS[@]}"; do
  echo "=== $repo ==="
  dir="$BASE/$repo"
  if [ ! -d "$dir/.git" ]; then
    dir="/tmp/chart-bump/$repo"
    if [ ! -d "$dir/.git" ]; then
      mkdir -p /tmp/chart-bump
      gh repo clone "$OWNER/$repo" "$dir" -- --depth 1 >/dev/null 2>&1 \
        || { echo "  ⚠️  could not clone $repo — skip"; continue; }
    fi
  fi
  (
    cd "$dir" || exit 0
    git pull --quiet 2>/dev/null || true

    # Deploy config(s): top-level YAML carrying both 'version:' and 'namespace:'
    # (handles ma3ady having both prod + preview config files).
    files=""
    for c in $(grep -rlE '^namespace:' --include='*.yaml' --include='*.yml' . 2>/dev/null); do
      grep -qE '^version:' "$c" && files="$files $c"
    done
    if [ -z "$files" ]; then
      echo "  ⚠️  no deploy config found — check $repo manually"; exit 0
    fi

    changed=0
    for f in $files; do
      cur=$(grep -E '^version:' "$f" | head -1 | awk '{print $2}')
      if [ "$cur" = "$NEW_VERSION" ]; then echo "  $f already $NEW_VERSION"; continue; fi
      sed -i.bak -E "s/^version:.*/version: $NEW_VERSION/" "$f" && rm -f "$f.bak"
      echo "  $f: ${cur:-?} -> $NEW_VERSION"
      changed=1
      grep -qE '^[[:space:]]*tag:[[:space:]]*latest' "$f" \
        && echo "  ⚠️  $f pins 'tag: latest' — remove it so chart 0.5.0's <namespace>-latest default applies"
    done

    [ "$changed" = "1" ] || { echo "  (nothing to change)"; exit 0; }
    git commit -aqm "chore: bump infrastructure chart to $NEW_VERSION (per-namespace image tags)"
    if [ -n "${PUSH:-}" ]; then
      git push && echo "  ✅ pushed (deploy will trigger)"
    else
      echo "  ✅ committed locally (re-run with PUSH=1 to push)"
    fi
  )
done

echo "Done. Review the commits, then: PUSH=1 ./bump-chart-version.sh"
