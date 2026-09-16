# Security

Configuration files are executable code. Only run the CLI and Expo prebuild against projects you trust. Native patches and build scripts run with the developer's permissions; validation is not a security sandbox.

Do not include secrets in configuration literals, generated fixtures, plans, logs or issue reports. Prefer environment references for signing credentials and review release tarballs for unintended files.

For a suspected vulnerability, contact the repository maintainer privately using the verified contact in the public repository profile, or use GitHub's private vulnerability reporting if enabled. Do not post exploit details or credentials in a public issue. A dedicated reporting address and supported-version policy must be established before public release; none is claimed here.
