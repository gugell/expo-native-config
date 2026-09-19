# Releasing

The npm package is `expo-native-config`; all sample apps and the repository root remain private. Publishing requires a real repository remote, npm package ownership, and release credentials or configured trusted publishing. This repository does not create those external resources.

## Before publication

Run the checks on a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm pack:check
pnpm examples:check
```

On macOS, also run `pnpm examples:check --prebuild` and `pnpm native:check` to generate all samples and compile the two simulator extension targets. Review the tarball contents and repeat relevant sample prebuilds. Record native build results separately. Confirm the public repository URL, license, support channel, package name availability, and package metadata before publishing. Never publish placeholder owner/repository metadata.

## release-it

`pnpm release` runs `scripts/release.sh`, which releases in two passes and forwards its arguments to both, so they agree on the increment:

1. every package under `packages/*` publishes **itself** to npm — `git` and `github` are disabled in the package's own `release-it` block, whose `before:init` hook runs `pnpm check` and whose `after:bump` hook rebuilds and verifies the tarball that is then published;
2. the repository root makes **one** version bump commit, tag and GitHub release — `npm.publish` is disabled there, `@release-it/bumper` writes the new version into the package, and `@release-it/conventional-changelog` writes the package changelog.

The root pass allows a dirty working directory on purpose: the packages have already bumped their own `package.json` by the time it runs. Configuration lives in the `release-it` block of each `package.json`; there is no separate config file.

The script resolves `GITHUB_TOKEN` from the environment, then `GH_TOKEN`, then `gh auth token`, and fails with instructions rather than releasing without one. `pnpm release:dry-run` skips that requirement and rehearses offline — no registry, GitHub or upstream contact — while still computing the version, changelog and tag from local history. A dry run must not be described as publication.

The first real publication can retain the prepared version with `pnpm release --no-increment` after the remote and credentials are configured. Later releases choose a semver increment appropriate to the public API change. Breaking configuration changes require migration notes and a matching major version when applicable.

The GitHub release workflow is intended to use npm trusted publishing with the `npm` environment. Configure the exact repository, workflow and environment in npm before relying on OIDC. The initial package may require an authorized manual publish before trusted publishing is configured. Inspect the workflow and `scripts/release.sh` for the supported path; do not create a duplicate manual publish for the same version. The workflow passes the increment and `--ci --npm.skipChecks` straight through to both passes.

Use [release-it's npm documentation](https://github.com/release-it/release-it/blob/main/docs/npm.md) and [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers) when configuring credentials. Never store npm or GitHub tokens in the repository.

After publication, install the published version into a fresh Expo app, run validation and prebuild, verify the registry tarball and tag correspond to the release commit, and attach exact verification evidence to release notes. Update the README's unpublished status only after the registry package exists.
