# Development

## Build

- `yarn build` -- esbuild bundle to `dist/extension.js`.
- `yarn watch` -- watch mode (auto-generates mock data first).

## Lint

- `yarn lint` -- typecheck + eslint + prettier.
- `yarn lint:fix` -- auto-fix all.
- `yarn typecheck` -- tsc --noEmit only.

## Mock Data

- `yarn mock generate` -- create initial mock data in `dist/`.
- `yarn mock set <amount>` -- set on-demand usage to a dollar amount.
- `yarn mock interval` -- auto-increment demo (+$15 every 3s).
- `yarn mock events-max <count>` -- generate MAX mode events.
- `yarn mock events-spending <cents>` -- generate spending guard events.

## Debug

Use `.vscode/launch.json` configurations:

- **Run Extension** -- normal run.
- **Run Extension (With Mocked API Data)** -- uses `USE_MOCKED_API_DATA=true`.
- **Run Extension (Mock + Events)** -- mock data with events force-enabled. Skips first-load guard so alerts fire immediately.
- **Run Extension (Missing sqlite3)** -- tests missing dependency handling.
- **Integration Tests** -- runs integration test suite.

## Testing Alerts (MAX mode detection / Spending guard) in Real VS Code

1. `yarn build && yarn mock generate`
2. `yarn mock events-max 5` or `yarn mock events-spending 800`
3. Launch **"Run Extension (Mock + Alerts)"** (F5).
4. The extension polls mock data and fires real notifications/modals.
5. While running, update mock data with `yarn mock events-max` / `events-spending` to trigger new alerts.

## Key Conventions

- Arrow functions for all function expressions.
- `as const` for object/array returns.
- Max 80 characters per line.
- `unknown` over `any` for unknown types.
- Empty line before return statements (unless single-line function body).
- Comments end with a period.
