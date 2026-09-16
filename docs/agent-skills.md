# Agent skills

The package includes two self-contained skills:

- `skills/expo-native-workspace/SKILL.md` helps agents configure consuming Expo apps.
- `skills/expo-native-workspace-maintainer/SKILL.md` helps agents change this package without confusing planning with execution.

To install one, copy its whole folder from the installed package's `skills/` directory into your agent's configured skill directory. For Codex, this is normally `~/.codex/skills/`. Inspect the content first and preserve an existing skill rather than silently overwriting it. No installer or remote skill service is required.

The usage skill contains the minimum public API and commands it needs; it does not depend on repository-relative documentation. The maintainer skill directs agents to the checked-out project's current scripts and schemas so it remains usable across revisions.

The authoring approach follows concise, scoped instructions and progressive disclosure described by [OpenAI's skill documentation](https://developers.openai.com/codex/skills/). Community workflow references include [Anthropic's skill repository](https://github.com/anthropics/skills) and [Contributor Covenant](https://www.contributor-covenant.org/). These are provenance and further reading, not copied skill bundles or automatically binding project policies. Project schema-first and public-boundary rules were adapted from the local Yayando development guidance; Nx-specific instructions were not carried over.
