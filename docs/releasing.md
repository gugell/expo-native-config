# Releasing

The npm package is `expo-native-workspace`; all sample apps and the repository root remain private. Publishing requires a real repository remote, npm package ownership, and release credentials or configured trusted publishing. This repository does not create those external resources.

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

The repository uses release-it with conventional changelog generation. Review the checked-in release configuration and `pnpm release --help` before release. Run `pnpm release:dry-run` to exercise the offline release rehearsal. Use release-it's dry-run mode to inspect the version, changelog, tag and npm actions; a dry run must not be described as publication.

The first real publication can retain the prepared version with `pnpm release --no-increment` after the remote and credentials are configured. Later releases choose a semver increment appropriate to the public API change. Breaking configuration changes require migration notes and a matching major version when applicable.

The GitHub release workflow is intended to use npm trusted publishing with the `npm` environment. Configure the exact repository, workflow and environment in npm before relying on OIDC. The initial package may require an authorized manual publish before trusted publishing is configured. Inspect the workflow and release script for the supported path; do not create a duplicate manual publish for the same version.

Use [release-it's npm documentation](https://github.com/release-it/release-it/blob/main/docs/npm.md) and [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers) when configuring credentials. Never store npm or GitHub tokens in the repository.

After publication, install the published version into a fresh Expo app, run validation and prebuild, verify the registry tarball and tag correspond to the release commit, and attach exact verification evidence to release notes. Update the README's unpublished status only after the registry package exists.
