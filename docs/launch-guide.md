# Launch guide

Before presenting this as a released package, establish a real public repository, support channel, npm ownership and release process. Update package metadata and links together. Keep the original Expo workspace project unchanged; this is a separate project with its own history and versioning.

Use the sample apps to capture a short demonstration: edit a typed config, inspect the plan, run Expo prebuild, then show the generated native result. Native runtime demos should show actual simulator/device behavior and record the Expo and toolchain versions used.

A useful launch announcement explains the narrow problem: keeping native extensions and dependency configuration reproducible across Expo prebuild. Link to getting started, a complete sample, compatibility limits, and troubleshooting. Describe typed helpers and inspection commands accurately; do not advertise a full native diff, automatic migration, or successful store submission without implementation and evidence.

Release gates:

- Public package metadata, license and support destinations are correct.
- Typecheck, tests, tarball consumer, and sample validation pass on the release commit.
- Relevant prebuilds run; missing native-build evidence is disclosed.
- Release automation is rehearsed without publication, and actual publication has explicit authorization.
- A fresh registry installation succeeds before installation instructions are promoted.
