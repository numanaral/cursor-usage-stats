import * as assert from "assert";

import {
  checkMaxModeDetection,
  resetMaxModeDetectionState,
  getLastCheckedDate,
  setLastCheckedDate,
  isIgnoredForSession,
  isNotificationPending,
} from "../../../src/alerts/maxModeDetection";
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

const createAlertsConfig = (
  overrides: Partial<AlertsConfig> = {},
): AlertsConfig => {
  const base = EXTENSION_DEFAULT_CONFIG.alerts;

  return {
    usageThreshold: base.usageThreshold,
    maxModeDetection: {
      ...base.maxModeDetection,
      ...overrides.maxModeDetection,
    },
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

/**
 * Integration tests for MAX mode detection alerts.
 *
 * Toast notification mode tests trigger real VS Code notifications.
 * Modal notification mode tests use an injected mock since VS Code
 * blocks modals in the test environment.
 */
suite("Integration - MAX Mode Detection", () => {
  setup(() => {
    resetMaxModeDetectionState();
  });

  teardown(() => {
    resetMaxModeDetectionState();
  });

  suite("State Management", () => {
    test("resetMaxModeDetectionState initializes lastCheckedDate to now", async () => {
      const before = Date.now() - 1;
      resetMaxModeDetectionState();
      const after = Date.now();

      const lastChecked = getLastCheckedDate();
      assert.ok(
        lastChecked >= before && lastChecked <= after,
        `lastCheckedDate (${lastChecked}) should be near now ` +
          `(${before}–${after}).`,
      );

      await sleep(UI_PAUSE_MS);
    });

    test("resetMaxModeDetectionState clears ignoredForSession", async () => {
      resetMaxModeDetectionState();
      assert.strictEqual(isIgnoredForSession(), false);

      await sleep(UI_PAUSE_MS);
    });

    test("resetMaxModeDetectionState clears notificationPending", async () => {
      resetMaxModeDetectionState();
      assert.strictEqual(isNotificationPending(), false);

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Alert Triggering (toast -- real notifications)", () => {
    test("does not alert when no MAX mode events", async () => {
      const events = [createMockEvent({ maxMode: false })];
      const config = createAlertsConfig({
        maxModeDetection: {
          enabled: true,
          notificationMode: "toast",
          pollIntervalSeconds: 300,
        },
      });

      const before = getLastCheckedDate();
      checkMaxModeDetection(events, config);

      // lastCheckedDate should advance (no MAX events found).
      assert.ok(getLastCheckedDate() >= before);

      await sleep(UI_PAUSE_MS);
    });

    test("alerts when any MAX mode event detected", async () => {
      const events = [
        createMockEvent({
          maxMode: true,
          tokenUsage: {
            inputTokens: 5000,
            outputTokens: 2000,
            totalCents: 150,
          },
        }),
      ];
      const config = createAlertsConfig({
        maxModeDetection: {
          enabled: true,
          notificationMode: "toast",
          pollIntervalSeconds: 300,
        },
      });

      checkMaxModeDetection(events, config);

      // Extra pause so the notification is readable in slow mode.
      if (IS_SLOW_MODE) {
        await sleep(UI_PAUSE_MS);
      }
      await waitForNotificationAndDismiss();
    });

    test("does not alert when disabled", async () => {
      const events = [createMockEvent({ maxMode: true })];
      const config = createAlertsConfig({
        maxModeDetection: {
          enabled: false,
          notificationMode: "toast",
          pollIntervalSeconds: 300,
        },
      });
      const { mockFn, calls } = createMockShowFn();

      checkMaxModeDetection(events, config, mockFn);
      assert.strictEqual(calls.length, 0);

      await sleep(UI_PAUSE_MS);
    });

    test("does not alert on historical events", async () => {
      // Events with timestamps BEFORE lastCheckedDate.
      const oldEvents = [
        createMockEvent({
          maxMode: true,
          timestamp: String(Date.now() - 60000),
        }),
      ];
      const config = createAlertsConfig({
        maxModeDetection: {
          enabled: true,
          notificationMode: "toast",
          pollIntervalSeconds: 300,
        },
      });
      const { mockFn, calls } = createMockShowFn();

      checkMaxModeDetection(oldEvents, config, mockFn);
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
      const events = [createMockEvent({ maxMode: true })];
      const config = createAlertsConfig();
      const { mockFn } = createMockShowFn("Dismiss");

      const before = Date.now();
      checkMaxModeDetection(events, config, mockFn);
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
      const freshEvents = [createMockEvent({ maxMode: true })];
      const { mockFn: secondFn, calls: secondCalls } =
        createMockShowFn("Dismiss");
      checkMaxModeDetection(freshEvents, config, secondFn);

      assert.strictEqual(
        secondCalls.length,
        1,
        "Should alert again after dismiss with new events.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Snooze blocks alerts until expiry", async () => {
      const events = [createMockEvent({ maxMode: true })];
      const config = createAlertsConfig();
      const { mockFn } = createMockShowFn("Snooze 5 min");

      checkMaxModeDetection(events, config, mockFn);
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
      const freshDuring = [createMockEvent({ maxMode: true })];
      const { mockFn: duringFn, calls: duringCalls } = createMockShowFn();
      checkMaxModeDetection(freshDuring, config, duringFn);

      assert.strictEqual(
        duringCalls.length,
        0,
        "Should not alert during snooze period.",
      );

      // Simulate snooze expiry by setting lastCheckedDate to past.
      setLastCheckedDate(Date.now() - 1000);

      // After snooze -- fresh events should alert again.
      const freshAfter = [createMockEvent({ maxMode: true })];
      const { mockFn: afterFn, calls: afterCalls } = createMockShowFn();
      checkMaxModeDetection(freshAfter, config, afterFn);

      assert.strictEqual(
        afterCalls.length,
        1,
        "Should alert again after snooze expires.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Ignore for Session permanently disables until reset", async () => {
      const events = [createMockEvent({ maxMode: true })];
      const config = createAlertsConfig();
      const { mockFn } = createMockShowFn("Ignore for Session");

      checkMaxModeDetection(events, config, mockFn);
      await sleep(50);

      assert.strictEqual(
        isIgnoredForSession(),
        true,
        "Should be ignored for session.",
      );

      // Subsequent checks should all be skipped.
      const freshEvents = [createMockEvent({ maxMode: true })];
      const { mockFn: secondFn, calls: secondCalls } = createMockShowFn();
      checkMaxModeDetection(freshEvents, config, secondFn);

      assert.strictEqual(
        secondCalls.length,
        0,
        "Should not alert after ignore for session.",
      );

      // Only resetMaxModeDetectionState clears it.
      resetMaxModeDetectionState();
      assert.strictEqual(
        isIgnoredForSession(),
        false,
        "Reset should clear ignoredForSession.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Closing without selecting still advances checkpoint", async () => {
      const events = [createMockEvent({ maxMode: true })];
      const config = createAlertsConfig();
      // undefined selection = user closed the notification.
      const { mockFn } = createMockShowFn(undefined);

      const before = Date.now();
      checkMaxModeDetection(events, config, mockFn);
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

    test("Old events do not re-trigger after checkpoint advances", async () => {
      const events = [createMockEvent({ maxMode: true })];
      const config = createAlertsConfig();

      // First alert -- user dismisses.
      const { mockFn: firstFn, calls: firstCalls } =
        createMockShowFn("Dismiss");
      checkMaxModeDetection(events, config, firstFn);
      await sleep(50);

      assert.strictEqual(firstCalls.length, 1, "First check should alert.");

      // Re-check with the SAME events (old timestamps) -- should NOT alert
      // because the checkpoint already advanced past them.
      const { mockFn: secondFn, calls: secondCalls } = createMockShowFn();
      checkMaxModeDetection(events, config, secondFn);

      assert.strictEqual(
        secondCalls.length,
        0,
        "Same old events should not re-trigger.",
      );

      // Tiny delay so fresh events get a strictly later timestamp
      // than the checkpoint advanced by the empty re-check above.
      await sleep(1);

      // Fresh events (new timestamps) DO trigger.
      const freshEvents = [createMockEvent({ maxMode: true })];
      const { mockFn: thirdFn, calls: thirdCalls } =
        createMockShowFn("Dismiss");
      checkMaxModeDetection(freshEvents, config, thirdFn);

      assert.strictEqual(
        thirdCalls.length,
        1,
        "Fresh events should trigger alert.",
      );

      // But if no MAX events, no alert.
      const noMaxEvents = [createMockEvent({ maxMode: false })];
      const { mockFn: fourthFn, calls: fourthCalls } = createMockShowFn();
      checkMaxModeDetection(noMaxEvents, config, fourthFn);

      assert.strictEqual(
        fourthCalls.length,
        0,
        "Should not alert when no MAX events exist.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Pending notification blocks subsequent polls", async () => {
      const events = [createMockEvent({ maxMode: true })];
      const config = createAlertsConfig();

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

      checkMaxModeDetection(events, config, pendingFn);
      assert.strictEqual(calls.length, 1, "First poll should alert.");
      assert.strictEqual(
        isNotificationPending(),
        true,
        "Notification should be pending.",
      );

      // Another poll fires with fresh events -- blocked.
      const freshEvents = [createMockEvent({ maxMode: true })];
      const { mockFn: secondFn, calls: secondCalls } = createMockShowFn();
      checkMaxModeDetection(freshEvents, config, secondFn);

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
      const newerEvents = [createMockEvent({ maxMode: true })];
      const { mockFn: thirdFn, calls: thirdCalls } = createMockShowFn();
      checkMaxModeDetection(newerEvents, config, thirdFn);

      assert.strictEqual(
        thirdCalls.length,
        1,
        "Should alert after pending cleared.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("Events during pending period are caught after dismiss", async () => {
      const config = createAlertsConfig();

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
      const initialEvents = [createMockEvent({ maxMode: true })];
      const checkpointBefore = getLastCheckedDate();
      checkMaxModeDetection(initialEvents, config, pendingFn);

      assert.strictEqual(firstCalls.length, 1, "Initial alert should fire.");
      assert.ok(
        getLastCheckedDate() > checkpointBefore,
        "Checkpoint should advance when notification is shown.",
      );
      const frozenCheckpoint = getLastCheckedDate();

      // T5: Simulate events arriving WHILE notification is open.
      await sleep(5);
      const midPendingEvents = [
        createMockEvent({ maxMode: true }),
        createMockEvent({ maxMode: true }),
      ];

      // T5: Poll fires -- blocked by notificationPending.
      const { mockFn: blockedFn, calls: blockedCalls } = createMockShowFn();
      checkMaxModeDetection(midPendingEvents, config, blockedFn);
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
      checkMaxModeDetection(midPendingEvents, config, catchUpFn);

      assert.strictEqual(
        catchUpCalls.length,
        1,
        "Events from during the pending period should be caught.",
      );
      assert.ok(
        catchUpCalls[0].message.includes("2 call(s)"),
        "Should report both mid-pending events.",
      );

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Notification Mode (modal -- injected mock)", () => {
    test("triggers modal with correct message and buttons", async () => {
      const events = [
        createMockEvent({
          maxMode: true,
          tokenUsage: {
            inputTokens: 5000,
            outputTokens: 2000,
            totalCents: 200,
          },
        }),
        createMockEvent({
          maxMode: true,
          tokenUsage: {
            inputTokens: 3000,
            outputTokens: 1500,
            totalCents: 180,
          },
        }),
      ];
      const config = createAlertsConfig({
        maxModeDetection: {
          enabled: true,
          notificationMode: "modal",
          pollIntervalSeconds: 300,
        },
      });
      const { mockFn, calls } = createMockShowFn();

      checkMaxModeDetection(events, config, mockFn);

      assert.strictEqual(calls.length, 1, "Should call showFn once.");
      assert.strictEqual(
        calls[0].options.modal,
        true,
        "Should pass modal: true for modal notification mode.",
      );
      assert.ok(
        calls[0].message.includes("MAX mode"),
        `Message should mention MAX mode: ${calls[0].message}`,
      );
      assert.ok(
        calls[0].message.includes("2 call(s)"),
        `Message should mention call count: ${calls[0].message}`,
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
      const events = [createMockEvent({ maxMode: true })];
      const config = createAlertsConfig({
        maxModeDetection: {
          enabled: true,
          notificationMode: "toast",
          pollIntervalSeconds: 300,
        },
      });
      const { mockFn, calls } = createMockShowFn();

      checkMaxModeDetection(events, config, mockFn);

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
    test("default maxModeDetection.enabled is true", () => {
      assert.strictEqual(
        EXTENSION_DEFAULT_CONFIG.alerts.maxModeDetection.enabled,
        true,
      );
    });

    test("default maxModeDetection.notificationMode is modal", () => {
      assert.strictEqual(
        EXTENSION_DEFAULT_CONFIG.alerts.maxModeDetection.notificationMode,
        "modal",
      );
    });
  });
});
