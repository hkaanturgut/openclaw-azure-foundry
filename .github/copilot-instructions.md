# Copilot instructions

- Use Conventional Commits for proposed commit messages and release-related examples.
- The CLI package in `cli/` uses `semantic-release` for versioning, npm publishes, GitHub tags, GitHub releases, and `cli/CHANGELOG.md`.
- The semantic-release configuration and release tooling live at the repository root and publish the npm package from `cli/`.
- Do not manually edit `cli/package.json` just to bump the version.
- Do not add or request changeset files under `cli/.changeset/`.
- When release automation is relevant, treat `fix:` as patch, `feat:` as minor, and `BREAKING CHANGE:` or `!` commits as major.
