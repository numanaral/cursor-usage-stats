# Cursor Usage Stats

![Cursor Usage Stats Banner](https://raw.githubusercontent.com/numanaral/cursor-usage-stats/main/assets/banner.png)

Monitor your Cursor IDE usage directly in the status bar. Track included requests and on-demand spending with configurable threshold alerts.

> **Note:** This extension is built for [Cursor](https://cursor.com), not VS Code.

## Demo

![Cursor Usage Stats Demo](https://raw.githubusercontent.com/numanaral/cursor-usage-stats/main/assets/cursor-usage-stats-demo.gif)

## Features

- **Real-time Status Bar** — See your request count and on-demand spending at a glance
- **Threshold Alerts** — Get notified at configurable usage percentages (warning & critical levels)
- **Auto-refresh** — Automatically polls for updates (configurable interval)
- **Startup Summary** — Optional notification showing current usage when Cursor starts
- **Color-coded Indicators** — Status bar changes color as usage increases:
  - Normal (no color) → Warning (yellow) → Critical (red)
- **Detailed Breakdown** — Click the status bar for a full usage summary

## Installation

### From Cursor Marketplace

<!-- TODO: Add marketplace link once published -->

Search for "Cursor Usage Stats" in Cursor's extension panel.

### Manual Installation

1. Download the latest `.vsix` file from [Releases](https://github.com/numanaral/cursor-usage-stats/releases)
2. In Cursor, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run `Extensions: Install from VSIX...`
4. Select the downloaded `.vsix` file

## Configuration

All settings are under `cursorUsageStats.*` in your settings.

| Setting                                | Default        | Description                                                                 |
| -------------------------------------- | -------------- | --------------------------------------------------------------------------- |
| `notifyOnStartup`                      | `true`         | Show usage notification when extension loads                                |
| `pollIntervalSeconds`                  | `60`           | How often to fetch usage data (in seconds)                                  |
| `statusBar.displayMode`                | `"both"`       | What to show: `"both"`, `"requests"`, or `"onDemand"`                       |
| `statusBar.primaryMetric`              | `"onDemand"`   | Which metric controls status bar color: `"includedRequest"` or `"onDemand"` |
| `api.includedRequestModelKey`          | `"gpt-4"`      | Model key for included requests (auto-detects if not found)                 |
| `alerts.includedRequestUsage.warningPercentageThresholds`  | `[50, 60, 70]` | Warning thresholds (%) for included requests                                |
| `alerts.includedRequestUsage.criticalPercentageThresholds` | `[80, 90, 95]` | Critical thresholds (%) for included requests                               |
| `alerts.onDemandUsage.warningPercentageThresholds`         | `[50, 60, 70]` | Warning thresholds (%) for on-demand spending                               |
| `alerts.onDemandUsage.criticalPercentageThresholds`        | `[80, 90, 95]` | Critical thresholds (%) for on-demand spending                              |

### Example: Disable All Alerts

```json
{
  "cursorUsageStats.alerts.includedRequestUsage.warningPercentageThresholds": [],
  "cursorUsageStats.alerts.includedRequestUsage.criticalPercentageThresholds": [],
  "cursorUsageStats.alerts.onDemandUsage.warningPercentageThresholds": [],
  "cursorUsageStats.alerts.onDemandUsage.criticalPercentageThresholds": []
}
```

### Example: Only Alert at 90%

```json
{
  "cursorUsageStats.alerts.onDemandUsage.warningPercentageThresholds": [],
  "cursorUsageStats.alerts.onDemandUsage.criticalPercentageThresholds": [90]
}
```

## Commands

| Command                            | Description                   |
| ---------------------------------- | ----------------------------- |
| `Cursor Usage Stats: Refresh`      | Manually refresh usage data   |
| `Cursor Usage Stats: Show Details` | Show detailed usage breakdown |

## How It Works

The extension reads your Cursor authentication from the local database and fetches usage data from Cursor's API endpoints:

- `/api/usage` — Included request counts
- `/api/usage/summary` — On-demand spending and limits

All data stays local. No external services are contacted except Cursor's own API.

## Requirements

- **Cursor IDE** with an active subscription
- Must be logged into Cursor (authentication is read from local storage)

## Development

### Setup

```bash
git clone https://github.com/numanaral/cursor-usage-stats.git
cd cursor-usage-stats
yarn install
```

### Build & Run

```bash
yarn build          # Build the extension
yarn watch          # Build and watch for changes
```

Press `F5` in Cursor to launch the Extension Development Host.

### Testing

```bash
yarn test           # Run all tests
yarn lint           # Check for linting errors
```

#### Testing Demo

![Cursor Usage Stats Testing Demo](https://raw.githubusercontent.com/numanaral/cursor-usage-stats/main/assets/cursor-usage-stats-testing-demo.gif)

### Mock Mode

For testing alerts without real usage data:

```bash
yarn mock generate  # Create mock data file
yarn mock set 75    # Set on-demand to $75 (50% of $150 limit)
yarn mock interval  # Auto-increment usage every 3 seconds
```

Then launch with the "Run Extension (Mock)" debug configuration.

## Publishing to Cursor Marketplace

Cursor uses the [Open VSX Registry](https://open-vsx.org) for extensions. See the [official publishing guide](https://github.com/EclipseFdn/open-vsx.org/wiki/Publishing-Extensions#publishing-with-the-ovsx-command) for more details.

### Setup

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Create an access token at [open-vsx.org](https://open-vsx.org) (Avatar → Settings → Access Tokens → Generate New Token)

3. Add your token to `.env`:

   ```bash
   OVSX_PAT=your-token-here
   ```

4. Create the namespace (first time only):

   ```bash
   source .env && npx ovsx create-namespace numanaral -p $OVSX_PAT
   ```

### Steps to Publish

1. **Package the extension:**

   ```bash
   yarn package        # Creates cursor-usage-stats-x.x.x.vsix
   ```

2. **Publish to Open VSX:**

   ```bash
   source .env && npx ovsx publish cursor-usage-stats-*.vsix -p $OVSX_PAT --yarn
   ```

   Or build and publish in one step:

   ```bash
   source .env && npx ovsx publish -p $OVSX_PAT --yarn
   ```

3. **Wait for processing** — The extension may take some time to be available in the marketplace.

> **Note:** Extensions on Open VSX automatically appear in Cursor's marketplace.

## License

MIT
