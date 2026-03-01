import * as assert from "assert";

import {
  checkSpendingGuard,
  resetSpendingGuardState,
  getLastCheckedDate,
  setLastCheckedDate,
  isIgnoredForSession,
  isNotificationPending,
} from "../../../src/alerts/spendingGuard";
import {
  type AlertShowFn,
  type AlertsConfig,
  type CursorUsageEvent,
} from "../../../src/alerts/types";
import { EXTENSION_DEFAULT_CONFIG } from "../../../src/constants";
import {
  IS_SLOW_MODE,
  sleep,
  UI_PAUSE_MS,
  waitForNotificationAndDismiss,
} from "../../utils";

const createMockEvent = (
  overrides: Partial<CursorUsageEvent> = {},
): CursorUsageEvent => {
  return {
    timestamp: String(Date.now()),
    model: "gpt-4o",
    kind: "chat",
    maxMode: false,
    requestsCosts: 0,
    usageBasedCosts: "0",
    isTokenBasedCall: true,
    tokenUsage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalCents: 10,
    },
    owningUser: "test-user",
    owningTeam: "test-team",
    cursorTokenFee: 0,
    isChargeable: true,
    isHeadless: false,
    ...overrides,
  };
};

/** Creates fresh events that exceed the $20 cost threshold. */
const createOverThresholdEvents = () => {
  return [
    createMockEvent({
      tokenUsage: {
        inputTokens: 15000,
        outputTokens: 8000,
        totalCents: 2500,
      },
    }),
  ];
};

const createAlertsConfig = (
  overrides: Partial<AlertsConfig> = {},
): AlertsConfig => {
  const base = EXTENSION_DEFAULT_CONFIG.alerts;

  return {
    usageThreshold: base.usageThreshold,
    maxModeDetection: base.maxModeDetection,
    spendingGuard: {
      ...base.spendingGuard,
      ...overrides.spendingGuard,
    },
  };
};

/** Creates a mock show function that records calls. */
const createMockShowFn = (selection?: string) => {
  const calls: Array<{
    message: string;
    options: { modal?: boolean };
    items: string[];
  }> = [];

  const mockFn: AlertShowFn = (message, options, ...items) => {
    calls.push({ message, options, items });

    return Promise.resolve(selection);
  };

  return { mockFn, calls } as const;
};

const spendingConfig = createAlertsConfig({
  spendingGuard: {
    enabled: true,
    costThreshold: 20,
    notificationMode: "modal",
    pollIntervalSeconds: 300,
  },
});

/**
 * Integration tests for spending guard alerts.
 *
 * Toast notification mode tests trigger real VS Code notifications.
 * Modal notification mode tests use an injected mock since VS Code
 * blocks modals in the test environment.
 */
suite("Integration - Spending Guard Alerts", () => {
  setup(() => {
    resetSpendingGuardState();
  });

  teardown(() => {
    resetSpendingGuardState();
  });

  suite("State Management", () => {
    test("resetSpendingGuardState initializes lastCheckedDate to now", async () => {
      const before = Date.now() - 1;
      resetSpendingGuardState();
      const after = Date.now();

      const lastChecked = getLastCheckedDate();
      assert.ok(
        lastChecked >= before && lastChecked <= after,
        `lastCheckedDate (${lastChecked}) should be near now ` +
          `(${before}–${after}).`,
      );

      await sleep(UI_PAUSE_MS);
    });

    test("resetSpendingGuardState clears ignoredForSession", async () => {
      resetSpendingGuardState();
      assert.strictEqual(isIgnoredForSession(), false);

      await sleep(UI_PAUSE_MS);
    });

    test("resetSpendingGuardState clears notificationPending", async () => {
      resetSpendingGuardState();
      assert.strictEqual(isNotificationPending(), false);

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Alert Triggering (toast -- real notifications)", () => {
    test("does not alert below threshold", async () => {
      const events = [
        createMockEvent({
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 50,
            totalCents: 10,
          },
        }),
      ];
      // Default threshold is $20 = 2000 cents.
      const config = createAlertsConfig({
        spendingGuard: {
          enabled: true,
          costThreshold: 20,
          notificationMode: "toast",
          pollIntervalSeconds: 300,
        },
      });

      const before = getLastCheckedDate();
      checkSpendingGuard(events, config);

      // 10 cents is well below $20 threshold -- should advance checkpoint.
      assert.ok(getLastCheckedDate() >= before);

      await sleep(UI_PAUSE_MS);
    });

    test("triggers toast notification above threshold", async () => {
      const events = [
        createMockEvent({
          tokenUsage: {
            inputTokens: 10000,
            outputTokens: 5000,
            totalCents: 1500,
          },
        }),
        createMockEvent({
          tokenUsage: {
            inputTokens: 8000,
            outputTokens: 4000,
            totalCents: 1000,
          },
        }),
      ];
      const config = createAlertsConfig({
        spendingGuard: {
          enabled: true,
          costThreshold: 20,
          notificationMode: "toast",
          pollIntervalSeconds: 300,
        },
      });

      // 1500 + 1000 = 2500 cents = $25 > $20 threshold.
      checkSpendingGuard(events, config);

      // Extra pause so the notification is readable in slow mode.
      if (IS_SLOW_MODE) {
        await sleep(UI_PAUSE_MS);
      }
      await waitForNotificationAndDismiss();
    });

    test("does not alert when disabled", async () => {
      const events = [
        createMockEvent({
          tokenUsage: {
            inputTokens: 10000,
            outputTokens: 5000,
            totalCents: 5000,
          },
        }),
      ];
      const config = createAlertsConfig({
        spendingGuard: {
          enabled: false,
          costThreshold: 20,
          notificationMode: "toast",
          pollIntervalSeconds: 300,
        },
      });
      const { mockFn, calls } = createMockShowFn();

      checkSpendingGuard(events, config, mockFn);
      assert.strictEqual(calls.length, 0);

      await sleep(UI_PAUSE_MS);
    });

    test("does not alert on historical events", async () => {
      // Events with timestamps BEFORE lastCheckedDate.
      const oldEvents = [
        createMockEvent({
          timestamp: String(Date.now() - 60000),
          tokenUsage: {
            inputTokens: 15000,
            outputTokens: 8000,
            totalCents: 2500,
          },
        }),
      ];
      const config = createAlertsConfig({
        spendingGuard: {
          enabled: true,
          costThreshold: 20,
          notificationMode: "toast",
          pollIntervalSeconds: 300,
        },
      });
      const { mockFn, calls } = createMockShowFn();

      checkSpendingGuard(oldEvents, config, mockFn);
      assert.strictEqual(
        calls.length,
        0,
        "Historical events should not trigger alerts.",
      );

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Button Interactions", () => {
    test("Dismiss advances checkpoint and allows future alerts", async () => {
      const { mockFn } = createMockShowFn("Dismiss");

      const before = Date.now();
      checkSpendingGuard(createOverThresholdEvents(), spendingConfig, mockFn);
      await sleep(50);

      assert.ok(
        getLastCheckedDate() >= before,
        "Dismiss should advance lastCheckedDate.",
      );
      assert.strictEqual(
        isIgnoredForSession(),
        false,
        "Dismiss should not set ignoredForSession.",
      );

      // Fresh events (new timestamps) should alert again.
      const { mockFn: secondFn, calls: secondCalls } =
        createMockShowFn("Dismiss");
      checkSpendingGuard(createOverThresholdEvents(), spendingConfig, secondFn);

      assert.strictEqual(
        secondCalls.length,
        1,
        "Should alert again after dismiss with new events.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Snooze blocks alerts until expiry", async () => {
      const { mockFn } = createMockShowFn("Snooze 5 min");

      checkSpendingGuard(createOverThresholdEvents(), spendingConfig, mockFn);
      await sleep(50);

      assert.ok(
        getLastCheckedDate() > Date.now(),
        "Snooze should set lastCheckedDate to a future time.",
      );
      assert.strictEqual(
        isIgnoredForSession(),
        false,
        "Snooze should not set ignoredForSession.",
      );

      // During snooze -- should skip even with fresh events.
      const { mockFn: duringFn, calls: duringCalls } = createMockShowFn();
      checkSpendingGuard(createOverThresholdEvents(), spendingConfig, duringFn);

      assert.strictEqual(
        duringCalls.length,
        0,
        "Should not alert during snooze period.",
      );

      // Simulate snooze expiry by setting lastCheckedDate to past.
      setLastCheckedDate(Date.now() - 1000);

      // After snooze -- fresh events should alert again.
      const { mockFn: afterFn, calls: afterCalls } = createMockShowFn();
      checkSpendingGuard(createOverThresholdEvents(), spendingConfig, afterFn);

      assert.strictEqual(
        afterCalls.length,
        1,
        "Should alert again after snooze expires.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Ignore for Session permanently disables until reset", async () => {
      const { mockFn } = createMockShowFn("Ignore for Session");

      checkSpendingGuard(createOverThresholdEvents(), spendingConfig, mockFn);
      await sleep(50);

      assert.strictEqual(
        isIgnoredForSession(),
        true,
        "Should be ignored for session.",
      );

      // Subsequent checks should all be skipped.
      const { mockFn: secondFn, calls: secondCalls } = createMockShowFn();
      checkSpendingGuard(createOverThresholdEvents(), spendingConfig, secondFn);

      assert.strictEqual(
        secondCalls.length,
        0,
        "Should not alert after ignore for session.",
      );

      // Only resetSpendingGuardState clears it.
      resetSpendingGuardState();
      assert.strictEqual(
        isIgnoredForSession(),
        false,
        "Reset should clear ignoredForSession.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Closing without selecting still advances checkpoint", async () => {
      // undefined selection = user closed the notification.
      const { mockFn } = createMockShowFn(undefined);

      const before = Date.now();
      checkSpendingGuard(createOverThresholdEvents(), spendingConfig, mockFn);
      await sleep(50);

      assert.ok(
        getLastCheckedDate() >= before,
        "Closing without selecting should still advance checkpoint.",
      );
      assert.strictEqual(
        isIgnoredForSession(),
        false,
        "Closing should not set ignoredForSession.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Below-threshold events do not trigger after dismiss", async () => {
      const { mockFn: firstFn } = createMockShowFn("Dismiss");
      checkSpendingGuard(createOverThresholdEvents(), spendingConfig, firstFn);
      await sleep(50);

      // Now check with events below threshold -- no alert.
      const belowEvents = [
        createMockEvent({
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 50,
            totalCents: 10,
          },
        }),
      ];
      const { mockFn: secondFn, calls: secondCalls } = createMockShowFn();
      checkSpendingGuard(belowEvents, spendingConfig, secondFn);

      assert.strictEqual(
        secondCalls.length,
        0,
        "Should not alert when below threshold.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Old events do not re-trigger after checkpoint advances", async () => {
      const events = createOverThresholdEvents();

      // First alert -- user dismisses.
      const { mockFn: firstFn, calls: firstCalls } =
        createMockShowFn("Dismiss");
      checkSpendingGuard(events, spendingConfig, firstFn);
      await sleep(50);

      assert.strictEqual(firstCalls.length, 1, "First check should alert.");

      // Re-check with the SAME events (old timestamps) -- should NOT alert.
      const { mockFn: secondFn, calls: secondCalls } = createMockShowFn();
      checkSpendingGuard(events, spendingConfig, secondFn);

      assert.strictEqual(
        secondCalls.length,
        0,
        "Same old events should not re-trigger.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Pending notification blocks subsequent polls", async () => {
      const events = createOverThresholdEvents();

      // Use a manually-controlled promise so the notification
      // stays "pending" until we explicitly resolve it.
      let resolveNotification:
        | ((value: string | undefined) => void)
        | undefined;
      const calls: Array<{
        message: string;
        options: { modal?: boolean };
        items: string[];
      }> = [];
      const pendingFn: AlertShowFn = (message, options, ...items) => {
        calls.push({ message, options, items });

        return new Promise((resolve) => {
          resolveNotification = resolve;
        });
      };

      checkSpendingGuard(events, spendingConfig, pendingFn);
      assert.strictEqual(calls.length, 1, "First poll should alert.");
      assert.strictEqual(
        isNotificationPending(),
        true,
        "Notification should be pending.",
      );

      // Another poll fires with fresh events -- blocked.
      const freshEvents = createOverThresholdEvents();
      const { mockFn: secondFn, calls: secondCalls } = createMockShowFn();
      checkSpendingGuard(freshEvents, spendingConfig, secondFn);

      assert.strictEqual(
        secondCalls.length,
        0,
        "Should not show while notification pending.",
      );

      // User finally dismisses the first notification.
      resolveNotification?.("Dismiss");
      await sleep(50);

      assert.strictEqual(
        isNotificationPending(),
        false,
        "Notification should no longer be pending.",
      );

      // Now a new poll with fresh events should work.
      const newerEvents = createOverThresholdEvents();
      const { mockFn: thirdFn, calls: thirdCalls } = createMockShowFn();
      checkSpendingGuard(newerEvents, spendingConfig, thirdFn);

      assert.strictEqual(
        thirdCalls.length,
        1,
        "Should alert after pending cleared.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Events during pending period are caught after dismiss", async () => {
      // Controlled promise -- notification stays open.
      let resolveNotification:
        | ((value: string | undefined) => void)
        | undefined;
      const firstCalls: Array<{
        message: string;
        options: { modal?: boolean };
        items: string[];
      }> = [];
      const pendingFn: AlertShowFn = (message, options, ...items) => {
        firstCalls.push({ message, options, items });

        return new Promise((resolve) => {
          resolveNotification = resolve;
        });
      };

      // T0: First alert triggers, notification stays open.
      const checkpointBefore = getLastCheckedDate();
      checkSpendingGuard(
        createOverThresholdEvents(),
        spendingConfig,
        pendingFn,
      );

      assert.strictEqual(firstCalls.length, 1, "Initial alert should fire.");
      assert.ok(
        getLastCheckedDate() > checkpointBefore,
        "Checkpoint should advance when notification is shown.",
      );
      const frozenCheckpoint = getLastCheckedDate();

      // T5: Simulate expensive events arriving WHILE notification
      // is open.
      await sleep(5);
      const midPendingEvents = createOverThresholdEvents();

      // T5: Poll fires -- blocked by notificationPending.
      const { mockFn: blockedFn, calls: blockedCalls } = createMockShowFn();
      checkSpendingGuard(midPendingEvents, spendingConfig, blockedFn);
      assert.strictEqual(
        blockedCalls.length,
        0,
        "Should be blocked during pending.",
      );

      // Checkpoint should NOT have moved during pending.
      assert.strictEqual(
        getLastCheckedDate(),
        frozenCheckpoint,
        "Checkpoint stays frozen while notification is pending.",
      );

      // T10: User finally dismisses.
      resolveNotification?.("Dismiss");
      await sleep(50);

      // T15: Next poll -- should catch the mid-pending events
      // because checkpoint is still at T0 and those events
      // have timestamps > T0.
      const { mockFn: catchUpFn, calls: catchUpCalls } =
        createMockShowFn("Dismiss");
      checkSpendingGuard(midPendingEvents, spendingConfig, catchUpFn);

      assert.strictEqual(
        catchUpCalls.length,
        1,
        "Events from during the pending period should be caught.",
      );

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Notification Mode (modal -- injected mock)", () => {
    test("triggers modal with correct message and buttons", async () => {
      const events = [
        createMockEvent({
          tokenUsage: {
            inputTokens: 15000,
            outputTokens: 8000,
            totalCents: 2500,
          },
        }),
      ];
      const config = createAlertsConfig({
        spendingGuard: {
          enabled: true,
          costThreshold: 20,
          notificationMode: "modal",
          pollIntervalSeconds: 300,
        },
      });
      const { mockFn, calls } = createMockShowFn();

      checkSpendingGuard(events, config, mockFn);

      assert.strictEqual(calls.length, 1, "Should call showFn once.");
      assert.strictEqual(
        calls[0].options.modal,
        true,
        "Should pass modal: true for modal notification mode.",
      );
      assert.ok(
        calls[0].message.includes("Spending alert:"),
        `Message should mention spending: ${calls[0].message}`,
      );
      assert.ok(
        calls[0].items.includes("Dismiss"),
        "Should include Dismiss button.",
      );
      assert.ok(
        calls[0].items.includes("Snooze 5 min"),
        "Should include Snooze 5 min button.",
      );
      assert.ok(
        calls[0].items.includes("Ignore for Session"),
        "Should include Ignore for Session button.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("toast notification mode does not pass modal option", async () => {
      const events = [
        createMockEvent({
          tokenUsage: {
            inputTokens: 15000,
            outputTokens: 8000,
            totalCents: 2500,
          },
        }),
      ];
      const config = createAlertsConfig({
        spendingGuard: {
          enabled: true,
          costThreshold: 20,
          notificationMode: "toast",
          pollIntervalSeconds: 300,
        },
      });
      const { mockFn, calls } = createMockShowFn();

      checkSpendingGuard(events, config, mockFn);

      assert.strictEqual(calls.length, 1, "Should call showFn once.");
      assert.strictEqual(
        calls[0].options.modal,
        undefined,
        "Should not pass modal for toast notification mode.",
      );

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Configuration Defaults", () => {
    test("default spendingGuard.enabled is true", () => {
      assert.strictEqual(
        EXTENSION_DEFAULT_CONFIG.alerts.spendingGuard.enabled,
        true,
      );
    });

    test("default spendingGuard.costThreshold is 20", () => {
      assert.strictEqual(
        EXTENSION_DEFAULT_CONFIG.alerts.spendingGuard.costThreshold,
        20,
      );
    });

    test("default spendingGuard.notificationMode is modal", () => {
      assert.strictEqual(
        EXTENSION_DEFAULT_CONFIG.alerts.spendingGuard.notificationMode,
        "modal",
      );
    });
  });
});
