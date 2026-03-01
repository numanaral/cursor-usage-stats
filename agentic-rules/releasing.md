# Releasing

## Release Command

```bash
yarn release <patch|minor|major> [--dry-run]
```

## Prerequisites

- Must be on `main` branch.
- Clean working tree (no uncommitted changes).
- Up to date with `origin/main`.

## What It Does

1. Bumps version via `npm version <bump> --no-git-tag-version`.
2. Creates branch `numanaral/release-v{X.Y.Z}`.
3. Commits version bump, creates git tag `v{X.Y.Z}`.
4. Pushes branch and tag, opens a PR to `main`.

## After Merge

Merging the PR to `main` triggers `.github/workflows/publish.yml`:

- Builds and packages the extension.
- Creates a GitHub release with the `.vsix` artifact.
- Publishes to Open VSX via `ovsx publish`.

## CI on PRs

`.github/workflows/ci.yml` runs: lint, typecheck, unit tests, integration tests (xvfb).

## Before Releasing

- Update `CHANGELOG.md` with the new version and changes.
- Ensure `yarn lint` and `yarn test` pass locally.
