#!/bin/bash
set -euo pipefail

# Release in two passes, which is how release-it expects a workspace to publish:
#
#   1. every package under packages/* publishes ITSELF to npm (git and GitHub
#      disabled in its own release-it config), and
#   2. the repository root makes one version bump commit, one tag and one
#      GitHub release for the whole workspace (npm publishing disabled).
#
# Both passes receive the same arguments, so they agree on the increment:
#   ./scripts/release.sh patch
#   ./scripts/release.sh --dry-run
#   ./scripts/release.sh --no-increment --ci --npm.skipChecks

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

dry_run=false
for argument in "$@"; do
  case "$argument" in
  --dry-run | -d) dry_run=true ;;
  esac
done

# A dry run is an offline rehearsal: it computes the next version and changelog
# from local history without contacting npm, GitHub or an upstream remote.
offline=()
if [ "$dry_run" = true ]; then
  offline=(
    --ci
    --no-npm.publish
    --npm.skipChecks
    --no-github.release
    --no-git.push
    --no-git.requireUpstream
    --no-git.requireBranch
    --no-git.requireCleanWorkingDir
  )
fi

ensure_github_token() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    return
  fi
  if [ -n "${GH_TOKEN:-}" ]; then
    export GITHUB_TOKEN="$GH_TOKEN"
    return
  fi
  if command -v gh >/dev/null 2>&1; then
    local token
    token="$(gh auth token 2>/dev/null || true)"
    if [ -n "$token" ]; then
      export GITHUB_TOKEN="$token"
      return
    fi
  fi
  echo "error: GITHUB_TOKEN is required to create the GitHub release." >&2
  echo "Run 'gh auth login', export a token with repo scope, or rehearse with --dry-run." >&2
  exit 1
}

if [ "$dry_run" = false ]; then
  ensure_github_token
fi

for package in packages/*; do
  [ -d "$package" ] || continue
  echo "Publishing '$(basename "$package")' to npm"
  (cd "$package" && pnpm exec release-it "$@" "${offline[@]}")
done

echo "Creating the version bump commit, tag and GitHub release"
pnpm exec release-it "$@" "${offline[@]}"

echo "Released expo-native-workspace."
