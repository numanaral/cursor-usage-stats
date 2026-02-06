# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-02-05

### Added

- `sqlite3` dependency check on activation with an interactive install prompt ("Install in Terminal" / "Copy Command").
- Follow-up "Reload Window" prompt after installing `sqlite3`.
- `extensionKind: ["ui"]` to ensure the extension runs locally (fixes remote/SSH environments where the auth database is not accessible).
- `test:slow` script for running tests with 1s UI pauses for visual observation.
- Sqlite UI tests that verify the missing-dependency prompt, button actions, and post-install recovery flow.
- Shared test utilities (`testing/utils.ts`) for `sleep` and `UI_PAUSE_MS`.

### Fixed

- Extension failing with `sqlite3: not found` on systems without sqlite3 pre-installed.
- Extension failing with `unable to open database file` when used via Cursor Remote Explorer.

## [1.0.0] - 2026-01-30

### Added

- Real-time status bar showing included request count and on-demand spending.
- Configurable threshold alerts (warning & critical levels) for both included requests and on-demand usage.
- Auto-refresh polling with configurable interval.
- Startup summary notification.
- Color-coded status bar indicators (normal → warning → critical).
- Detailed usage breakdown via status bar click.
- Mock mode for testing alerts without real usage data.
