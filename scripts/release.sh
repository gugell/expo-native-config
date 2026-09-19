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

# Resolve ONE version for both passes. Without this each package takes
# release-it's own default — a patch bump — while the root computes its version
# from the conventional commits, and the two disagree: packages publish 0.1.1
# while the tag says 0.2.0. Positional arguments (patch, minor, 1.2.3) are
# consumed here and replaced by the concrete version; flags still pass through.
flags=()
for argument in "$@"; do
  case "$argument" in
  -*) flags+=("$argument") ;;
  esac
done

version="$(pnpm exec release-it --release-version "$@" 2>/dev/null | tail -1)"
if [ -z "$version" ]; then
  echo "error: could not determine the next version. Pass one explicitly, e.g. 'patch' or '1.2.3'." >&2
  exit 1
fi
echo "Releasing version $version"

for package in packages/*; do
  # A directory with no manifest is not a package — a leftover build directory
  # must not be treated as one and published.
  [ -f "$package/package.json" ] || continue
  echo "Publishing '$(basename "$package")' to npm"
  (cd "$package" && pnpm exec release-it "$version" "${flags[@]}" "${offline[@]}")
done

echo "Creating the version bump commit, tag and GitHub release"
pnpm exec release-it "$version" "${flags[@]}" "${offline[@]}"

echo "Released expo-native-config."
