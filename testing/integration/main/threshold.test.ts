import * as assert from "assert";

import {
  checkOnDemandThresholds,
  getNotificationHistory,
  getTriggeredOnDemandThresholds,
  resetTriggeredThresholds,
  setNotificationTracking,
} from "../../../src/alerts";
import {
  createStatusBarItem,
  disposeStatusBar,
  getStatusBarItem,
  updateStatusBar,
} from "../../../src/statusBar";
import {
  type CursorCombinedUsage,
  type CursorUsageApiResponse,
  type CursorUsageSummaryApiResponse,
  type ExtensionConfig,
} from "../../../src/types";
import { sleep, UI_PAUSE_MS } from "../../utils";

import type * as vscode from "vscode";

/**
 * Integration tests for threshold alerts and status bar updates.
 *
 * These tests simulate the demo flow where usage increases over time
 * and verifies that thresholds, status bar text, and colors update correctly.
 */
suite("Integration - Threshold Alerts & Status Bar", () => {
  const createMockConfig = (): ExtensionConfig => {
    return {
      notifyOnStartup: true,
      pollIntervalSeconds: 1,
      statusBar: {
        displayMode: "both",
        primaryMetric: "onDemand",
      },
      api: {
        includedRequestModelKey: "gpt-4",
      },
      alerts: {
        includedRequestUsage: {
          warningPercentageThresholds: [50, 60, 70],
          criticalPercentageThresholds: [80, 90, 95],
        },
        onDemandUsage: {
          warningPercentageThresholds: [50, 60, 70],
          criticalPercentageThresholds: [80, 90, 95],
        },
      },
    };
  };

  const createMockUsage = (): CursorUsageApiResponse => {
    return {
      startOfMonth: "2026-01-01T00:00:00Z",
      "gpt-4": {
        numRequests: 500,
        numRequestsTotal: 500,
        numTokens: 850000,
        maxRequestUsage: 500,
        maxTokenUsage: 1000000,
      },
    };
  };

  const createMockSummary = (
    onDemandUsedCents: number,
  ): CursorUsageSummaryApiResponse => {
    const limit = 15000; // $150.

    return {
      billingCycleStart: "2026-01-01T00:00:00Z",
      billingCycleEnd: "2026-02-01T00:00:00Z",
      membershipType: "pro",
      limitType: "standard",
      isUnlimited: false,
      autoModelSelectedDisplayMessage: "",
      namedModelSelectedDisplayMessage: "",
      individualUsage: {
        plan: {
          enabled: true,
          used: 500,
          limit: 500,
          remaining: 0,
          breakdown: { included: 500, bonus: 0, total: 500 },
          autoPercentUsed: 0,
          apiPercentUsed: 0,
          totalPercentUsed: 100,
        },
        onDemand: {
          enabled: true,
          used: onDemandUsedCents,
          limit,
          remaining: limit - onDemandUsedCents,
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
    };
  };

  const createCombinedUsage = (onDemandCents: number): CursorCombinedUsage => {
    return {
      usage: createMockUsage(),
      summary: createMockSummary(onDemandCents),
    };
  };

  // Note: Tests use their own module instance, separate from the bundled extension.
  // We create/dispose our own status bar item for testing.

  setup(() => {
    resetTriggeredThresholds();
    setNotificationTracking(true);
    createStatusBarItem();
  });

  teardown(() => {
    resetTriggeredThresholds();
    setNotificationTracking(false);
    disposeStatusBar();
  });

  suite("Status Bar Text Updates", () => {
    test("displays correct text at different usage levels", async () => {
      const config = createMockConfig();
      const statusBar = getStatusBarItem();
      assert.ok(statusBar, "Status bar should be created");

      // $0 on-demand.
      let data = createCombinedUsage(0);
      updateStatusBar(data, config);
      assert.ok(
        statusBar.text.includes("$0.00/$150.00"),
        `Expected $0.00/$150.00, got: ${statusBar.text}`,
      );

      await sleep(UI_PAUSE_MS);

      // $75 on-demand.
      data = createCombinedUsage(7500);
      updateStatusBar(data, config);
      assert.ok(
        statusBar.text.includes("$75.00/$150.00"),
        `Expected $75.00/$150.00, got: ${statusBar.text}`,
      );

      await sleep(UI_PAUSE_MS);

      // $150 on-demand (max).
      data = createCombinedUsage(15000);
      updateStatusBar(data, config);
      assert.ok(
        statusBar.text.includes("$150.00/$150.00"),
        `Expected $150.00/$150.00, got: ${statusBar.text}`,
      );

      await sleep(UI_PAUSE_MS);
    });

    test("displays request count alongside on-demand", async () => {
      const config = createMockConfig();
      const statusBar = getStatusBarItem();
      assert.ok(statusBar, "Status bar should be created");

      const data = createCombinedUsage(5000);
      updateStatusBar(data, config);

      // Should show both: "500/500 | $50.00/$150.00".
      assert.ok(
        statusBar.text.includes("500/500"),
        `Expected 500/500, got: ${statusBar.text}`,
      );
      assert.ok(
        statusBar.text.includes("$50.00/$150.00"),
        `Expected $50.00/$150.00, got: ${statusBar.text}`,
      );

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Status Bar Color Changes", () => {
    test("has no background color below warning threshold", async () => {
      const config = createMockConfig();
      const statusBar = getStatusBarItem();
      assert.ok(statusBar, "Status bar should be created");

      // $30 -> 20% (normal).
      const data = createCombinedUsage(3000);
      updateStatusBar(data, config);

      assert.strictEqual(
        statusBar.backgroundColor,
        undefined,
        "Background should be undefined for normal",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("has warning background at 50%", async () => {
      const config = createMockConfig();
      const statusBar = getStatusBarItem();
      assert.ok(statusBar, "Status bar should be created");

      // $75 -> 50% (warning).
      const data = createCombinedUsage(7500);
      updateStatusBar(data, config);

      const bg = statusBar.backgroundColor as vscode.ThemeColor;
      assert.ok(bg, "Background should be set for warning");
      assert.strictEqual(
        bg.id,
        "statusBarItem.warningBackground",
        "Should use warning background color",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("has error background at 80%", async () => {
      const config = createMockConfig();
      const statusBar = getStatusBarItem();
      assert.ok(statusBar, "Status bar should be created");

      // $120 -> 80% (critical).
      const data = createCombinedUsage(12000);
      updateStatusBar(data, config);

      const bg = statusBar.backgroundColor as vscode.ThemeColor;
      assert.ok(bg, "Background should be set for critical");
      assert.strictEqual(
        bg.id,
        "statusBarItem.errorBackground",
        "Should use error background color",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("color transitions correctly as usage increases", async () => {
      const config = createMockConfig();
      const statusBar = getStatusBarItem();
      assert.ok(statusBar, "Status bar should be created");

      // Normal (20%).
      let data = createCombinedUsage(3000);
      updateStatusBar(data, config);
      assert.strictEqual(statusBar.backgroundColor, undefined, "Normal at 20%");

      await sleep(UI_PAUSE_MS);

      // Warning (50%).
      data = createCombinedUsage(7500);
      updateStatusBar(data, config);
      assert.ok(statusBar.backgroundColor, "Warning color at 50%");
      assert.strictEqual(
        (statusBar.backgroundColor as vscode.ThemeColor).id,
        "statusBarItem.warningBackground",
        "Should use warning background",
      );

      await sleep(UI_PAUSE_MS);

      // Critical (80%).
      data = createCombinedUsage(12000);
      updateStatusBar(data, config);
      assert.ok(statusBar.backgroundColor, "Critical color at 80%");
      assert.strictEqual(
        (statusBar.backgroundColor as vscode.ThemeColor).id,
        "statusBarItem.errorBackground",
        "Should use error background",
      );
    });
  });

  suite("Notification Alerts", () => {
    test("shows warning notification at 50% threshold", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      // $75 -> 50% (warning).
      const data = createCombinedUsage(7500);
      checkOnDemandThresholds(data, config, onRefresh);

      const history = getNotificationHistory();
      assert.strictEqual(history.length, 1, "Should show 1 notification");
      assert.strictEqual(
        history[0].severity,
        "warning",
        "Should be warning severity",
      );
      assert.ok(
        history[0].message.includes("50%"),
        `Message should mention 50% threshold: ${history[0].message}`,
      );

      await sleep(UI_PAUSE_MS);
    });

    test("shows critical notification at 80% threshold", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      // $120 -> 80% (critical).
      const data = createCombinedUsage(12000);
      checkOnDemandThresholds(data, config, onRefresh);

      const history = getNotificationHistory();
      assert.strictEqual(history.length, 1, "Should show 1 notification");
      assert.strictEqual(
        history[0].severity,
        "critical",
        "Should be critical severity",
      );
      assert.ok(
        history[0].message.includes("80%"),
        `Message should mention 80% threshold: ${history[0].message}`,
      );

      await sleep(UI_PAUSE_MS);
    });

    test("does not show notification below thresholds", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      // $30 -> 20% (no threshold).
      const data = createCombinedUsage(3000);
      checkOnDemandThresholds(data, config, onRefresh);

      const history = getNotificationHistory();
      assert.strictEqual(history.length, 0, "Should not show any notification");

      await sleep(UI_PAUSE_MS);
    });

    test("shows only one notification when jumping over multiple thresholds", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      // Jump from 0% to 85% (crosses 50, 60, 70, 80).
      const data = createCombinedUsage(12750);
      checkOnDemandThresholds(data, config, onRefresh);

      const history = getNotificationHistory();
      assert.strictEqual(
        history.length,
        1,
        "Should show only 1 notification even when crossing multiple thresholds",
      );
      assert.strictEqual(
        history[0].severity,
        "critical",
        "Should show highest severity (critical at 80%)",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("does not re-notify for already triggered threshold", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      // First check at 50%.
      const data = createCombinedUsage(7500);
      checkOnDemandThresholds(data, config, onRefresh);
      assert.strictEqual(
        getNotificationHistory().length,
        1,
        "First notification shown",
      );

      await sleep(UI_PAUSE_MS);

      // Check again at same level - should not notify again.
      checkOnDemandThresholds(data, config, onRefresh);
      assert.strictEqual(
        getNotificationHistory().length,
        1,
        "No additional notification for same threshold",
      );
    });

    test("notification sequence matches demo flow", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      // Sequence of expected notifications.
      const steps: Array<{
        cents: number;
        expectedNotifications: number;
        expectedSeverity?: "warning" | "critical";
      }> = [
        { cents: 1000, expectedNotifications: 0 }, // 6.7% - no notification.
        { cents: 3000, expectedNotifications: 0 }, // 20% - no notification.
        { cents: 7500, expectedNotifications: 1, expectedSeverity: "warning" }, // 50%.
        { cents: 9000, expectedNotifications: 2, expectedSeverity: "warning" }, // 60%.
        { cents: 10500, expectedNotifications: 3, expectedSeverity: "warning" }, // 70%.
        {
          cents: 12000,
          expectedNotifications: 4,
          expectedSeverity: "critical",
        }, // 80%.
        {
          cents: 13500,
          expectedNotifications: 5,
          expectedSeverity: "critical",
        }, // 90%.
        {
          cents: 15000,
          expectedNotifications: 6,
          expectedSeverity: "critical",
        }, // 100% (95% threshold).
      ];

      for (const step of steps) {
        const data = createCombinedUsage(step.cents);
        checkOnDemandThresholds(data, config, onRefresh);

        const history = getNotificationHistory();
        assert.strictEqual(
          history.length,
          step.expectedNotifications,
          `At $${step.cents / 100}: expected ${step.expectedNotifications} notifications, got ${history.length}`,
        );

        if (step.expectedSeverity && history.length > 0) {
          const lastNotification = history[history.length - 1];
          assert.strictEqual(
            lastNotification.severity,
            step.expectedSeverity,
            `At $${step.cents / 100}: expected ${step.expectedSeverity} severity`,
          );
        }

        await sleep(UI_PAUSE_MS);
      }
    });
  });

  suite("Threshold Triggering Sequence", () => {
    test("triggers thresholds in correct order as usage increases", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      // Simulate usage increasing over time.
      // $0 -> 0% (no threshold).
      let data = createCombinedUsage(0);
      checkOnDemandThresholds(data, config, onRefresh);
      assert.strictEqual(
        getTriggeredOnDemandThresholds().size,
        0,
        "No thresholds at 0%",
      );

      await sleep(UI_PAUSE_MS);

      // $75 -> 50% (first warning).
      data = createCombinedUsage(7500);
      checkOnDemandThresholds(data, config, onRefresh);
      assert.ok(
        getTriggeredOnDemandThresholds().has(50),
        "50% threshold triggered at $75",
      );

      await sleep(UI_PAUSE_MS);

      // $90 -> 60% (second warning).
      data = createCombinedUsage(9000);
      checkOnDemandThresholds(data, config, onRefresh);
      assert.ok(
        getTriggeredOnDemandThresholds().has(60),
        "60% threshold triggered at $90",
      );

      await sleep(UI_PAUSE_MS);

      // $105 -> 70% (third warning).
      data = createCombinedUsage(10500);
      checkOnDemandThresholds(data, config, onRefresh);
      assert.ok(
        getTriggeredOnDemandThresholds().has(70),
        "70% threshold triggered at $105",
      );

      await sleep(UI_PAUSE_MS);

      // $120 -> 80% (first critical).
      data = createCombinedUsage(12000);
      checkOnDemandThresholds(data, config, onRefresh);
      assert.ok(
        getTriggeredOnDemandThresholds().has(80),
        "80% threshold triggered at $120",
      );

      await sleep(UI_PAUSE_MS);

      // $135 -> 90% (second critical).
      data = createCombinedUsage(13500);
      checkOnDemandThresholds(data, config, onRefresh);
      assert.ok(
        getTriggeredOnDemandThresholds().has(90),
        "90% threshold triggered at $135",
      );

      await sleep(UI_PAUSE_MS);

      // $150 -> 100% (third critical).
      data = createCombinedUsage(15000);
      checkOnDemandThresholds(data, config, onRefresh);
      assert.ok(
        getTriggeredOnDemandThresholds().has(95),
        "95% threshold triggered at $150",
      );

      // All thresholds should be triggered.
      const triggered = getTriggeredOnDemandThresholds();
      assert.strictEqual(triggered.size, 6, "All 6 thresholds triggered");
    });

    test("does not re-trigger already triggered thresholds", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      // Trigger 50% threshold.
      const data = createCombinedUsage(7500);
      checkOnDemandThresholds(data, config, onRefresh);
      const triggeredAfterFirst = getTriggeredOnDemandThresholds().size;

      await sleep(UI_PAUSE_MS);

      // Same data again - should not trigger again.
      checkOnDemandThresholds(data, config, onRefresh);
      const triggeredAfterSecond = getTriggeredOnDemandThresholds().size;

      assert.strictEqual(
        triggeredAfterFirst,
        triggeredAfterSecond,
        "No new thresholds triggered on repeat",
      );
    });

    test("handles jump over multiple thresholds", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      // Jump directly from 0% to 85% (should trigger 50, 60, 70, 80).
      const data = createCombinedUsage(12750); // 85%.
      checkOnDemandThresholds(data, config, onRefresh);

      const triggered = getTriggeredOnDemandThresholds();
      assert.ok(triggered.has(50), "50% threshold marked");
      assert.ok(triggered.has(60), "60% threshold marked");
      assert.ok(triggered.has(70), "70% threshold marked");
      assert.ok(triggered.has(80), "80% threshold marked");
      assert.ok(!triggered.has(90), "90% not triggered yet");
      assert.ok(!triggered.has(95), "95% not triggered yet");
    });
  });

  suite("Full Demo Flow Simulation", () => {
    // eslint-disable-next-line no-restricted-syntax
    test("simulates complete demo with status bar and threshold updates", async function () {
      // This test runs longer, increase timeout.
      this.timeout(15000);

      const config = createMockConfig();
      const statusBar = getStatusBarItem();
      assert.ok(statusBar, "Status bar should be created");
      const onRefresh = () => {};

      // Demo sequence: [cents, expectedThresholds, hasColor].
      const sequence: Array<{
        cents: number;
        dollars: string;
        percent: number;
        expectedThresholds: number;
        expectedColorState: "none" | "warning" | "critical";
      }> = [
        {
          cents: 1000,
          dollars: "$10.00",
          percent: 6.7,
          expectedThresholds: 0,
          expectedColorState: "none",
        },
        {
          cents: 3000,
          dollars: "$30.00",
          percent: 20,
          expectedThresholds: 0,
          expectedColorState: "none",
        },
        {
          cents: 7500,
          dollars: "$75.00",
          percent: 50,
          expectedThresholds: 1,
          expectedColorState: "warning",
        },
        {
          cents: 9000,
          dollars: "$90.00",
          percent: 60,
          expectedThresholds: 2,
          expectedColorState: "warning",
        },
        {
          cents: 10500,
          dollars: "$105.00",
          percent: 70,
          expectedThresholds: 3,
          expectedColorState: "warning",
        },
        {
          cents: 12000,
          dollars: "$120.00",
          percent: 80,
          expectedThresholds: 4,
          expectedColorState: "critical",
        },
        {
          cents: 13500,
          dollars: "$135.00",
          percent: 90,
          expectedThresholds: 5,
          expectedColorState: "critical",
        },
        {
          cents: 15000,
          dollars: "$150.00",
          percent: 100,
          expectedThresholds: 6,
          expectedColorState: "critical",
        },
      ];

      for (let i = 0; i < sequence.length; i++) {
        const step = sequence[i];
        const data = createCombinedUsage(step.cents);

        // Update status bar.
        updateStatusBar(data, config);

        // Check thresholds.
        checkOnDemandThresholds(data, config, onRefresh);

        // Verify status bar text.
        assert.ok(
          statusBar.text.includes(step.dollars),
          `Step ${i + 1}: Expected ${step.dollars} in text, got: ${statusBar.text}`,
        );

        // Verify threshold count.
        const triggered = getTriggeredOnDemandThresholds();
        assert.strictEqual(
          triggered.size,
          step.expectedThresholds,
          `Step ${i + 1} (${step.dollars}): Expected ${step.expectedThresholds} thresholds, got ${triggered.size}`,
        );

        // Verify color state.
        if (step.expectedColorState === "none") {
          assert.strictEqual(
            statusBar.backgroundColor,
            undefined,
            `Step ${i + 1}: Expected no background color`,
          );
        } else {
          const bg = statusBar.backgroundColor as vscode.ThemeColor;
          assert.ok(bg, `Step ${i + 1}: Expected background color`);

          const expectedColorId =
            step.expectedColorState === "warning"
              ? "statusBarItem.warningBackground"
              : "statusBarItem.errorBackground";

          assert.strictEqual(
            bg.id,
            expectedColorId,
            `Step ${i + 1}: Expected ${step.expectedColorState} color (${expectedColorId})`,
          );
        }

        // Wait 1s between updates (like real demo).
        if (i < sequence.length - 1) {
          await sleep(UI_PAUSE_MS);
        }
      }
    });
  });
});
