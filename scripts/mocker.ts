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
import * as readline from "readline";

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
  generate              Generate initial mock data file in dist/
  set <amount>          Set on-demand usage to a specific dollar amount
  interval              Run interval demo (+$15 every 3s until $150)
  events-max <count>    Generate <count> MAX mode events (alert mock data)
  events-spending <cents>  Generate spending guard events totaling <cents> (alert mock data)
  demo                  Interactive walkthrough — notifications + modals (use "Run Extension (Demo)")
  help                  Show this help message

Examples:
  yarn mock generate
  yarn mock set 0
  yarn mock set 30
  yarn mock set 75
  yarn mock interval
  yarn mock events-max 5
  yarn mock events-spending 2500

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

═══════════════════════════════════════════════════
ALERTS TESTING (MAX mode detection + Spending guard)
═══════════════════════════════════════════════════

1. SETUP
   yarn build
   yarn mock generate

2. GENERATE EVENTS
   yarn mock events-max 5       → 5 MAX mode events
   yarn mock events-spending 2500  → spending events ($25, above $20 threshold)

3. LAUNCH
   Select "Run Extension (Mock + Alerts)" and press F5.
   Alert polling starts automatically (MAX mode detection + spending guard enabled by default).

4. CONFIGURE (optional, in the launched VS Code)
   Use Cmd+Shift+P → "Cursor Usage Stats: Configure Settings"
   to adjust poll intervals, thresholds, and notification mode.

5. TRIGGER ALERTS
   While the extension is running, update mock data:
   yarn mock events-max 5       → triggers MAX mode detection alert
   yarn mock events-spending 2500  → triggers spending guard alert

   The extension polls the mock file and fires real
   notifications/modals based on the configured notification mode.

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
  console.log(
    '  1. Select "Run Extension (With Mocked API Data)" and press F5',
  );
  console.log("  2. Use: yarn mock set <amount>");
  console.log("");
  console.log(
    "Note: yarn build wipes dist/. Run yarn mock generate again after building.\n",
  );
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
// EVENTS - MAX MODE
// =============================================================================

interface MockEvent {
  timestamp: string;
  model: string;
  kind: string;
  maxMode: boolean;
  requestsCosts: number;
  usageBasedCosts: string;
  isTokenBasedCall: boolean;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    cacheWriteTokens: number;
    cacheReadTokens: number;
    totalCents: number;
  };
  owningUser: string;
  owningTeam: string;
  cursorTokenFee: number;
  isChargeable: boolean;
  isHeadless: boolean;
}

const createMockEvent = (overrides: Partial<MockEvent> = {}): MockEvent => {
  return {
    timestamp: String(Date.now()),
    model: "claude-4-opus",
    kind: "chat",
    maxMode: false,
    requestsCosts: 0,
    usageBasedCosts: "0",
    isTokenBasedCall: true,
    tokenUsage: {
      inputTokens: 5000,
      outputTokens: 2000,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      totalCents: 25,
    },
    owningUser: "mock-user",
    owningTeam: "mock-team",
    cursorTokenFee: 0,
    isChargeable: true,
    isHeadless: false,
    ...overrides,
  };
};

const generateMaxModeEvents = (count: number) => {
  if (!fs.existsSync(MOCK_DATA_FILE)) {
    console.error(`\n✗ Mock data file not found: ${MOCK_DATA_FILE}`);
    console.error("  Run: yarn mock generate\n");
    process.exit(1);
  }

  const mockData = JSON.parse(fs.readFileSync(MOCK_DATA_FILE, "utf-8"));

  const events: MockEvent[] = [];
  const now = Date.now();

  // Generate regular events interspersed with MAX mode events.
  for (let i = 0; i < count; i++) {
    events.push(
      createMockEvent({
        timestamp: String(now - i * 60000),
        maxMode: true,
        model: "claude-4-opus",
        tokenUsage: {
          inputTokens: 10000,
          outputTokens: 5000,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
          totalCents: 150,
        },
      }),
    );
  }

  // Add some regular events too.
  for (let i = 0; i < 5; i++) {
    events.push(
      createMockEvent({
        timestamp: String(now - (count + i) * 60000),
        model: "gpt-4o",
        tokenUsage: {
          inputTokens: 3000,
          outputTokens: 1000,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
          totalCents: 10,
        },
      }),
    );
  }

  // Append to existing events instead of replacing.
  const existing = mockData.events?.usageEventsDisplay ?? [];
  const combined = [...existing, ...events];

  mockData.events = {
    totalUsageEventsCount: combined.length,
    usageEventsDisplay: combined,
  };

  fs.writeFileSync(MOCK_DATA_FILE, JSON.stringify(mockData, null, 2) + "\n");

  console.log(
    `\n✓ Appended ${count} MAX mode events (+ 5 regular). ` +
      `Total: ${combined.length} events.\n`,
  );
};

// =============================================================================
// EVENTS - SPENDING GUARD
// =============================================================================

const generateSpendingGuardEvents = (totalCents: number) => {
  if (!fs.existsSync(MOCK_DATA_FILE)) {
    console.error(`\n✗ Mock data file not found: ${MOCK_DATA_FILE}`);
    console.error("  Run: yarn mock generate\n");
    process.exit(1);
  }

  const mockData = JSON.parse(fs.readFileSync(MOCK_DATA_FILE, "utf-8"));

  const EVENT_COUNT = 5;
  const events: MockEvent[] = [];
  const now = Date.now();
  const centsPerEvent = Math.ceil(totalCents / EVENT_COUNT);
  let remaining = totalCents;

  for (let i = 0; i < EVENT_COUNT; i++) {
    const cents = Math.min(centsPerEvent, remaining);
    remaining -= cents;

    events.push(
      createMockEvent({
        timestamp: String(now),
        model: i % 2 === 0 ? "claude-4-opus" : "gpt-4o",
        tokenUsage: {
          inputTokens: 5000 + i * 1000,
          outputTokens: 2000 + i * 500,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
          totalCents: cents,
        },
      }),
    );

    if (remaining <= 0) {
      break;
    }
  }

  // Append to existing events instead of replacing.
  const existing = mockData.events?.usageEventsDisplay ?? [];
  const combined = [...existing, ...events];

  mockData.events = {
    totalUsageEventsCount: combined.length,
    usageEventsDisplay: combined,
  };

  fs.writeFileSync(MOCK_DATA_FILE, JSON.stringify(mockData, null, 2) + "\n");

  console.log(
    `\n✓ Appended ${events.length} spending guard events ` +
      `totaling ${totalCents} cents ` +
      `($${(totalCents / 100).toFixed(2)}). ` +
      `Total: ${combined.length} events.\n`,
  );
};

// =============================================================================
// DEMO
// =============================================================================

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const log = (msg: string) => {
  const time = new Date().toLocaleTimeString();
  console.log(`  [${time}] ${msg}`);
};

const _announce = (msg: string) => {
  console.log(`\n  >>> ${msg}\n`);
};

/**
 * Clears the events key from mock data.
 */
const clearMockEvents = () => {
  const data = JSON.parse(fs.readFileSync(MOCK_DATA_FILE, "utf-8"));
  delete data.events;
  fs.writeFileSync(MOCK_DATA_FILE, JSON.stringify(data, null, 2) + "\n");
};

/**
 * Waits for the user to press Enter before continuing.
 */
const waitForEnter = (prompt: string) => {
  return new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
};

/**
 * Runs a narrated demo walkthrough that exercises all alert types.
 *
 * Shows both notification and modal severity for MAX mode and
 * spending guard detection. Pauses between phases so the user can change
 * severity via the VS Code command palette in the launched window.
 *
 * Designed to run while "Run Extension (Demo)" is active
 * (no severity env vars, poll: usage=3s, events=5s).
 */
const runDemo = async () => {
  if (!fs.existsSync(MOCK_DATA_FILE)) {
    console.error(`\n✗ Mock data file not found: ${MOCK_DATA_FILE}`);
    console.error("  Run: yarn build && yarn mock generate\n");
    process.exit(1);
  }

  // Clean up on Ctrl+C.
  process.on("SIGINT", () => {
    console.log("\n\n  Cleaning up...");
    clearMockEvents();
    setOnDemandCost(0);
    console.log("  ✓ Mock data reset.\n");
    process.exit(0);
  });

  console.log(`
═══════════════════════════════════════════════════
  CURSOR USAGE STATS — DEMO
═══════════════════════════════════════════════════

  Launch: "Run Extension (Demo)"
  Polls: usage=3s, alerts=5s
  Notification mode starts at "modal" (default).

  The script will pause and ask you to change
  notification mode via Cmd+Shift+P → Preferences:
  Open Settings (UI) → search "cursorUsageStats".

  Ctrl+C to stop and clean up.
═══════════════════════════════════════════════════
`);

  // ─── Phase 1: On-Demand Notifications ────────────────────────────
  console.log("━━━ Phase 1: On-Demand Notifications ━━━\n");
  log("$75 → 50% — ⚠ warning notification");
  setOnDemandCost(75);
  await sleep(4000);

  log("$120 → 80% — 🔴 critical notification");
  setOnDemandCost(120);
  await sleep(4000);

  log("Resetting on-demand...");
  setOnDemandCost(0);

  // ─── Phase 2a: MAX Mode — modal (default) ────────────────────────
  console.log("\n━━━ Phase 2a: MAX Mode — modal (default) ━━━\n");
  clearMockEvents();
  log("Generating 3 MAX mode calls (mode=modal)...");
  generateMaxModeEvents(3);
  await sleep(6000);

  // ─── Pause: switch to toast ─────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║  ACTION REQUIRED: In the launched VS Code:    ║");
  console.log("║                                               ║");
  console.log("║  Cmd+Shift+P → Open Settings (UI)             ║");
  console.log('║  Search: "cursorUsageStats maxModeDetection"   ║');
  console.log('║  Change notificationMode to: "toast"           ║');
  console.log("╚═══════════════════════════════════════════════╝\n");
  await waitForEnter("  Press Enter when done...");

  // ─── Phase 2b: MAX Mode — toast (notification) ──────────────────
  console.log("\n━━━ Phase 2b: MAX Mode — toast notification ━━━\n");
  clearMockEvents();
  log("Generating 5 MAX mode calls (mode=toast)...");
  generateMaxModeEvents(5);
  await sleep(6000);

  // ─── Phase 3a: Spending Guard — modal (default) ─────────────────
  console.log("\n━━━ Phase 3a: Spending Guard — modal (default) ━━━\n");
  clearMockEvents();
  log("Generating $25.00 spend (mode=modal, threshold=$20)...");
  generateSpendingGuardEvents(2500);
  await sleep(6000);

  // ─── Pause: switch to toast ─────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║  ACTION REQUIRED: In the launched VS Code:    ║");
  console.log("║                                               ║");
  console.log('║  Search: "cursorUsageStats spendingGuard"      ║');
  console.log('║  Change notificationMode to: "toast"           ║');
  console.log("╚═══════════════════════════════════════════════╝\n");
  await waitForEnter("  Press Enter when done...");

  // ─── Phase 3b: Spending Guard — toast (notification) ────────────
  console.log("\n━━━ Phase 3b: Spending Guard — toast notification ━━━\n");
  clearMockEvents();
  log("Generating $30.00 spend (mode=toast, threshold=$20)...");
  generateSpendingGuardEvents(3000);
  await sleep(6000);

  // ─── Cleanup ─────────────────────────────────────────────────────
  console.log("\n━━━ Cleanup ━━━\n");
  setOnDemandCost(0);
  clearMockEvents();
  log("Mock data reset.");

  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║  Remember to reset notificationMode back to   ║");
  console.log('║  "modal" in the launched VS Code if needed.    ║');
  console.log("╚═══════════════════════════════════════════════╝");

  console.log(`
═══════════════════════════════════════════════════
  DEMO COMPLETE
═══════════════════════════════════════════════════
`);
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

    case "events-max": {
      const maxCount = parseInt(args[1], 10);

      if (isNaN(maxCount) || maxCount <= 0) {
        console.error("\n✗ Invalid count. Usage: yarn mock events-max <count>");
        console.error("  Example: yarn mock events-max 5\n");
        process.exit(1);
      }

      generateMaxModeEvents(maxCount);
      break;
    }

    case "events-spending": {
      const spendingCents = parseInt(args[1], 10);

      if (isNaN(spendingCents) || spendingCents <= 0) {
        console.error(
          "\n✗ Invalid cents. Usage: yarn mock events-spending <cents>",
        );
        console.error("  Example: yarn mock events-spending 800\n");
        process.exit(1);
      }

      generateSpendingGuardEvents(spendingCents);
      break;
    }

    case "demo":
      runDemo();
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
