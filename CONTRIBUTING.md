# Contributing to OpenClaw Azure Foundry

Thanks for your interest in contributing! This guide explains how to get involved.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/<your-username>/openclaw-azure-foundry.git`
3. **Create a branch**: `git checkout -b feat/my-change`
4. **Make your changes**
5. **Submit a Pull Request** against `main`

## Development Setup

### CLI (`cli/`)

```bash
cd cli
npm install
npm run build       # compile TypeScript
npm run dev         # run from source (ts-node)
npm run start       # run compiled output
```

### Infrastructure (`infrastructure/`)

Requires [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) with Bicep:

```bash
az bicep build --file infrastructure/main.bicep   # lint & compile
```

### Scripts (`scripts/`)

Shell scripts are checked with [ShellCheck](https://www.shellcheck.net/). Install it locally to validate before pushing.

## Code Style

- Follow the [`.editorconfig`](.editorconfig) settings (2-space indent, UTF-8, LF line endings)
- TypeScript: strict mode, ESM modules
- Bicep: use the linter built into `az bicep build`
- Shell: pass ShellCheck

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add readiness polling before pairing
fix: handle timeout in az deployment
docs: update setup guide for OIDC
chore: bump typescript to 5.9
```

## Changesets (for CLI changes)

When your PR changes the CLI package (`cli/`), you **must** include a changeset:

```bash
cd cli
npx changeset
```

This prompts you to:
1. Select the package (`openclaw-azure-cli`)
2. Choose a version bump type (`patch`, `minor`, or `major`)
3. Write a summary of the change (shown in the changelog)

A `cli/.changeset/*.md` file is generated — commit it with your PR.

**When to use which bump:**
- `patch` — bug fixes, internal refactors, dependency updates
- `minor` — new features, new CLI commands, new config options
- `major` — breaking changes (config format changes, removed commands, Node version bumps)

If your PR only changes infrastructure or docs (not `cli/`), no changeset is needed.

## Pull Request Guidelines

- Fill out the PR template completely
- Keep PRs focused — one logical change per PR
- Ensure CI passes (CLI build + infrastructure validation)
- Include a changeset if you touched `cli/`
- Update docs if your change affects user-facing behavior

## Reporting Issues

Use the [issue templates](https://github.com/hkaanturgut/openclaw-azure-foundry/issues/new/choose) for bug reports and feature requests. Check existing issues before creating a new one.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
