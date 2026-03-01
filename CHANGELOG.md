# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-02-09

### ✨ Features

- **MAX Mode Detection**: Alerts when MAX mode API calls are detected. Configurable notification mode (modal or toast), 5-minute snooze, ignore for session, and dismiss with automatic checkpoint tracking.
- **Spending Guard**: Monitors on-demand spending and alerts when a configurable cost threshold is exceeded (default $20). Same snooze, ignore, and dismiss controls as MAX mode.
- **Tips**: Shows random productivity tips on startup. Supports custom tip sources via a Gist URL. New `cursorUsageStats.tips` command.
- **Settings Wizard**: Interactive guided configuration via `Cursor Usage Stats: Configure Settings`. Includes a "Configure All" option that walks through every setting in one pass, plus individual category selection.
- **Welcome Message**: Redesigned startup notification with "Tips" and "Configure Settings" action buttons.

### 🔧 Internal

- `yarn mock events-max <count>` and `yarn mock events-spending <cents>` for testing alert features. Interactive `yarn mock demo` walkthrough.
- Integration test suites restructured by feature (`welcomeMessage`, `usageThreshold`, `maxModeDetection`, `spendingGuard`, `wizard`, `tips`, `sqlite`). `yarn test:integration:only <suite>` for running individual suites.

### 📋 Misc

- Settings reorganized under logical groups (`alerts.usageThreshold.*`, `alerts.maxModeDetection.*`, `alerts.spendingGuard.*`, `tips.*`, `api.*`).
- Automatic one-time migration from v1.1.x config keys to the new schema on activation.
- `notifyOnStartup` setting renamed to `showWelcomeMessage`.
- `pollIntervalSeconds` moved under `alerts.usageThreshold.pollIntervalSeconds`.
- `statusBar.*` settings moved under `alerts.usageThreshold.statusBar.*`.
- `statusBar.primaryMetric` renamed to `statusBar.trackedMetric`.
- Alert threshold settings moved under `alerts.usageThreshold.*`.

## [1.1.1] - 2026-02-05

### 🔧 Internal

- GitHub Actions CI workflow (runs on PRs, required to pass before merge).
- GitHub Actions publish workflow (auto-publishes to Open VSX and creates GitHub release on version bump).
- `yarn release <patch|minor|major>` script for automated release flow.

### 🐛 Fixed

- Publish workflow failing with `HTTP 403` when creating GitHub releases (missing `permissions: contents: write`).
- Publish steps are now idempotent so re-runs don't fail on already-published versions.

## [1.1.0] - 2026-02-05

### ✨ Features

- `sqlite3` dependency check on activation with an interactive install prompt ("Install in Terminal" / "Copy Command").
- Follow-up "Reload Window" prompt after installing `sqlite3`.
- `extensionKind: ["ui"]` to ensure the extension runs locally (fixes remote/SSH environments where the auth database is not accessible).
- Screenshots in README for all visual states.

### 🐛 Fixed

- Extension failing with `sqlite3: not found` on systems without sqlite3 pre-installed.
- Extension failing with `unable to open database file` when used via Cursor Remote Explorer.

### 🔧 Internal

- Source code restructured to separate pure logic from VS Code APIs (`src/alerts/`, `src/statusBar/`, `src/sqlite/` feature folders).
- Unit tests run under plain `mocha` without a VS Code instance.
- Integration tests separated into `testing/integration/main/` and `testing/integration/sqlite/`.
- `test:slow` script for running tests with 1s UI pauses for visual observation.
- Sqlite UI tests that verify the missing-dependency prompt, button actions, and post-install recovery flow.
- Shared test utilities (`testing/utils.ts`) for `sleep` and `UI_PAUSE_MS`.

## [1.0.0] - 2026-01-30

### ✨ Features

- Real-time status bar showing included request count and on-demand spending.
- Configurable threshold alerts (warning & critical levels) for both included requests and on-demand usage.
- Auto-refresh polling with configurable interval.
- Startup summary notification.
- Color-coded status bar indicators (normal → warning → critical).
- Detailed usage breakdown via status bar click.
- Mock mode for testing alerts without real usage data.
