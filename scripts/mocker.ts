/**
 * Mock data management tool for Cursor Usage Stats extension.
 *
 * Usage:
 *   yarn mock <command> [args]
 *
 * Commands:
 *   generate        Generate initial mock data file in dist/
 *   set <amount>    Set on-demand usage to a specific dollar amount
 *   interval        Run interval demo (+$15 every 3s until $150)
 *   help            Show this help message
 *
 * Examples:
 *   yarn mock generate
 *   yarn mock set 30
 *   yarn mock interval
 */

import * as fs from "fs";
import * as path from "path";

const DIST_DIR = path.join(__dirname, "..", "dist");
const MOCK_DATA_FILE = path.join(DIST_DIR, "mock-api-responses.json");

// =============================================================================
// HELP
// =============================================================================

const showHelp = () => {
  console.log(`
═══════════════════════════════════════════════════
CURSOR USAGE STATS - MOCK DATA TOOL
═══════════════════════════════════════════════════

Usage:
  yarn mock <command> [args]

Commands:
  generate        Generate initial mock data file in dist/
  set <amount>    Set on-demand usage to a specific dollar amount
  interval        Run interval demo (+$15 every 3s until $150)
  help            Show this help message

Examples:
  yarn mock generate
  yarn mock set 0
  yarn mock set 30
  yarn mock set 75
  yarn mock interval

═══════════════════════════════════════════════════

═══════════════════════════════════════════════════
CURSOR USAGE STATS - DEMO
═══════════════════════════════════════════════════

1. STARTUP
   → Show startup notification
   → Click "Open Dashboard"
   → Hover status bar (tooltip)

2. MANUAL UPDATES
   yarn mock set 30   → 20% (normal)
   → Click Refresh
   yarn mock set 60   → 40% (normal)
   → Click Refresh
   yarn mock set 75   → 50% (warning!)
   → Let auto-poll pick it up

3. INTERVAL MODE (+$15 every 3s from $75)
   yarn mock interval

   >>> Thresholds:
   → Warning:  50%, 60%, 70%
   → Critical: 80%, 90%, 95%

   >>> Sequence:
   → $75  → 50%  (warning)
   → $90  → 60%  (warning)
   → $105 → 70%  (warning)
   → $120 → 80%  (critical)
   → $135 → 90%  (critical)
   → $150 → 100% (critical)

═══════════════════════════════════════════════════
`);
};

// =============================================================================
// GENERATE
// =============================================================================

const generateMockData = () => {
  const defaultMockData = {
    usage: {
      startOfMonth: "2026-01-01T00:00:00.000Z",
      "gpt-4": {
        numRequests: 500,
        numRequestsTotal: 500,
        numTokens: 850000,
        maxRequestUsage: 500,
        maxTokenUsage: 1000000,
      },
    },
    summary: {
      billingCycleStart: "2026-01-01T00:00:00.000Z",
      billingCycleEnd: "2026-02-01T00:00:00.000Z",
      membershipType: "pro",
      limitType: "standard",
      isUnlimited: false,
      autoModelSelectedDisplayMessage: "Auto-selected model",
      namedModelSelectedDisplayMessage: "GPT-4",
      individualUsage: {
        plan: {
          enabled: true,
          used: 500,
          limit: 500,
          remaining: 0,
          breakdown: {
            included: 500,
            bonus: 0,
            total: 500,
          },
          autoPercentUsed: 0,
          apiPercentUsed: 0,
          totalPercentUsed: 100,
        },
        onDemand: {
          enabled: true,
          used: 0,
          limit: 15000,
          remaining: 15000,
        },
      },
      teamUsage: {
        onDemand: {
          enabled: false,
          used: 0,
          limit: 0,
          remaining: 0,
        },
      },
    },
  };

  // Ensure dist directory exists.
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  fs.writeFileSync(
    MOCK_DATA_FILE,
    JSON.stringify(defaultMockData, null, 2) + "\n",
  );

  console.log(`\n✓ Generated mock data at: ${MOCK_DATA_FILE}\n`);
  console.log("Next steps:");
  console.log("  1. Build: yarn build");
  console.log('  2. Select "Run Extension (Mock)" and press F5');
  console.log("  3. Use: yarn mock set <amount>\n");
};

// =============================================================================
// SET
// =============================================================================

const setOnDemandCost = (amount: number) => {
  if (!fs.existsSync(MOCK_DATA_FILE)) {
    console.error(`\n✗ Mock data file not found: ${MOCK_DATA_FILE}`);
    console.error("  Run: yarn mock generate\n");
    process.exit(1);
  }

  const cents = Math.round(amount * 100);
  const mockData = JSON.parse(fs.readFileSync(MOCK_DATA_FILE, "utf-8"));
  const limit = mockData.summary.individualUsage.onDemand.limit;

  mockData.summary.individualUsage.onDemand.used = cents;
  mockData.summary.individualUsage.onDemand.remaining = limit - cents;

  fs.writeFileSync(MOCK_DATA_FILE, JSON.stringify(mockData, null, 2) + "\n");

  const percent = ((cents / limit) * 100).toFixed(1);
  console.log(
    `\n✓ Set on-demand to $${amount.toFixed(2)} / $${(limit / 100).toFixed(2)} (${percent}%)\n`,
  );
};

// =============================================================================
// INTERVAL
// =============================================================================

const runIntervalDemo = () => {
  if (!fs.existsSync(MOCK_DATA_FILE)) {
    console.error(`\n✗ Mock data file not found: ${MOCK_DATA_FILE}`);
    console.error("  Run: yarn mock generate\n");
    process.exit(1);
  }

  const INTERVAL_MS = 3000;
  const INCREMENT_CENTS = 1500;
  const MAX_VALUE = 15000;

  let intervalId: ReturnType<typeof setInterval> | null = null;

  const updateMockData = () => {
    const mockData = JSON.parse(fs.readFileSync(MOCK_DATA_FILE, "utf-8"));
    const limit = mockData.summary.individualUsage.onDemand.limit;
    const currentValue = mockData.summary.individualUsage.onDemand.used;
    const newValue = Math.min(currentValue + INCREMENT_CENTS, MAX_VALUE);

    mockData.summary.individualUsage.onDemand.used = newValue;
    mockData.summary.individualUsage.onDemand.remaining = limit - newValue;

    fs.writeFileSync(MOCK_DATA_FILE, JSON.stringify(mockData, null, 2) + "\n");

    const percent = ((newValue / limit) * 100).toFixed(1);

    console.log(
      `[${new Date().toLocaleTimeString()}] On-Demand: $${(newValue / 100).toFixed(2)} / $${(limit / 100).toFixed(2)} (${percent}%)`,
    );

    if (newValue >= MAX_VALUE) {
      if (intervalId) {
        clearInterval(intervalId);
      }

      console.log("\n✓ Demo complete!");

      // Wait before resetting so $150 is visible.
      setTimeout(() => {
        const resetData = JSON.parse(fs.readFileSync(MOCK_DATA_FILE, "utf-8"));
        resetData.summary.individualUsage.onDemand.used = 0;
        resetData.summary.individualUsage.onDemand.remaining = limit;
        fs.writeFileSync(
          MOCK_DATA_FILE,
          JSON.stringify(resetData, null, 2) + "\n",
        );
        console.log("✓ Reset to $0\n");
        process.exit(0);
      }, 5000);
    }
  };

  console.log("\n═══════════════════════════════════════");
  console.log("CURSOR USAGE STATS - INTERVAL DEMO");
  console.log("═══════════════════════════════════════\n");
  console.log(
    `Increment: +$${(INCREMENT_CENTS / 100).toFixed(2)} every ${INTERVAL_MS / 1000}s`,
  );
  console.log(`Stops at: $${(MAX_VALUE / 100).toFixed(2)}`);
  console.log("\nPress Ctrl+C to stop.\n");

  // Run immediately, then every 3 seconds.
  updateMockData();
  intervalId = setInterval(updateMockData, INTERVAL_MS);
};

// =============================================================================
// MAIN
// =============================================================================

const main = () => {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "generate":
      generateMockData();
      break;

    case "set": {
      const amount = parseFloat(args[1]);

      if (isNaN(amount)) {
        console.error("\n✗ Invalid amount. Usage: yarn mock set <amount>");
        console.error("  Example: yarn mock set 30\n");
        process.exit(1);
      }

      setOnDemandCost(amount);
      break;
    }

    case "interval":
      runIntervalDemo();
      break;

    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;

    default:
      if (command) {
        console.error(`\n✗ Unknown command: ${command}`);
      }
      showHelp();
      process.exit(command ? 1 : 0);
  }
};

main();
