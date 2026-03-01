# Agent Rules

- [agentic-rules/conventions.md](agentic-rules/conventions.md)
  - Code style: arrow functions, `as const` returns, `unknown` over `any`, early returns.
  - Comments: third-person verbs, JSDoc tags, no obvious comments.
  - Folder structure: module layout with barrel exports, naming conventions, best practices.

- [agentic-rules/testing.md](agentic-rules/testing.md)
  - Framework: Mocha TDD (`suite`/`test`/`setup`/`teardown`), Node `assert` for assertions.
  - Unit vs integration: unit tests cannot import `vscode`; use integration tests for that.
  - Commands: `yarn test:unit`, `yarn test:integration`, `yarn test`, `yarn pretest`.

- [agentic-rules/feature-implementation.md](agentic-rules/feature-implementation.md)
  - Module structure: `types.ts`, `api.ts`, `utils.ts`, `index.ts` under `src/featureName/`.
  - Wiring: settings in `package.json`, config in `getConfig()`, commands in `activate()`.
  - Mocking: mock data in `src/__mocking__.ts`, CLI commands in `scripts/mocker.ts`.

- [agentic-rules/releasing.md](agentic-rules/releasing.md)
  - Release: `yarn release <patch|minor|major>` from `main`, creates branch + PR.
  - CI/CD: PR triggers lint + tests; merge triggers GitHub release + Open VSX publish.
  - Pre-release: update `CHANGELOG.md`, ensure `yarn lint` and `yarn test` pass.

- [agentic-rules/linting.md](agentic-rules/linting.md)
  - Commands: `yarn lint`, `yarn lint:fix`, `yarn typecheck`.
  - When to lint: after changes, before commits.
  - Config files: `eslint.config.mjs`, `prettier.config.mjs`, `tsconfig.json`.

- [agentic-rules/development.md](agentic-rules/development.md)
  - Build: `yarn build` (esbuild), `yarn watch` for dev, `yarn typecheck` for type-only checks.
  - Mock data: `yarn mock generate/set/interval/events-max/events-spending`.
  - Debug: VS Code launch configs for normal, mocked, missing sqlite3, and integration tests.
