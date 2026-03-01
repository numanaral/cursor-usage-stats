# Linting

## Commands

- `yarn lint` -- runs typecheck + eslint + prettier (check only).
- `yarn lint:fix` -- runs typecheck + eslint fix + prettier fix.
- `yarn typecheck` -- `tsc --noEmit` only.
- `yarn eslint:fix` -- eslint auto-fix only.
- `yarn prettier:fix` -- prettier auto-fix only.

## When to Lint

- Run `yarn lint:fix` after making changes and before committing.
- If `lint:fix` cannot resolve an issue, fix it manually and re-run.

## Config

- ESLint: `eslint.config.mjs` (flat config).
- Prettier: `prettier.config.mjs`.
- TypeScript: `tsconfig.json` with `strict: true`.
