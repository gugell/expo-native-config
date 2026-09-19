#!/bin/bash
set -euo pipefail

# Exercises scripts/release.sh on both paths with a stubbed pnpm, so nothing is
# published, committed or tagged.
#
# The real release path and the dry-run path differ in one way that matters:
# the `offline` and `flags` arrays are EMPTY on a real release. Under `set -u`,
# bash 3.2 (what macOS ships) treats expanding an empty array as an unbound
# variable, so a script verified only with --dry-run can still fail on the day
# it is used for real. That happened; this is the check.

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
stub="$(mktemp -d)"
trap 'rm -rf "$stub"' EXIT

cat > "$stub/pnpm" <<'STUB'
#!/bin/bash
for arg in "$@"; do
  if [ "$arg" = "--release-version" ]; then echo "9.9.9"; exit 0; fi
done
exit 0
STUB
chmod +x "$stub/pnpm"

run() {
  local label="$1"
  shift
  local output
  if ! output="$(PATH="$stub:$PATH" GITHUB_TOKEN=stub bash "$root/scripts/release.sh" "$@" 2>&1)"; then
    echo "release.sh failed on the $label path:" >&2
    echo "$output" >&2
    exit 1
  fi
  case "$output" in
  *"Releasing version 9.9.9"*) ;;
  *)
    echo "release.sh did not resolve a version on the $label path:" >&2
    echo "$output" >&2
    exit 1
    ;;
  esac
  echo "  $label path ok"
}

run "release (empty flag arrays)" --no-increment
run "dry-run (populated flag arrays)" --dry-run
run "explicit increment" minor
echo "release.sh runs on every path."
