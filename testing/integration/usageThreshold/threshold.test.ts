import * as assert from "assert";

import {
  checkOnDemandThresholds,
  getNotificationHistory,
  getTriggeredOnDemandThresholds,
  resetTriggeredThresholds,
  setNotificationTracking,
} from "../../../src/alerts";
import { EXTENSION_DEFAULT_CONFIG } from "../../../src/constants";
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
import { sleep, UI_PAUSE_MS, waitForNotificationAndDismiss } from "../../utils";

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
      showWelcomeMessage: true,
      api: {
        includedRequestModelKey: "gpt-4",
      },
      alerts: {
        ...EXTENSION_DEFAULT_CONFIG.alerts,
        usageThreshold: {
          ...EXTENSION_DEFAULT_CONFIG.alerts.usageThreshold,
          pollIntervalSeconds: 1,
          statusBar: {
            displayMode: "both",
            trackedMetric: "onDemand",
          },
          includedRequestUsage:
            EXTENSION_DEFAULT_CONFIG.alerts.usageThreshold.includedRequestUsage,
          onDemandUsage:
            EXTENSION_DEFAULT_CONFIG.alerts.usageThreshold.onDemandUsage,
        },
        maxModeDetection: {
          enabled: true,
          notificationMode: "modal",
          pollIntervalSeconds: 300,
        },
        spendingGuard: {
          enabled: true,
          notificationMode: "modal",
          pollIntervalSeconds: 300,
          costThreshold: 20,
        },
      },
      tips: EXTENSION_DEFAULT_CONFIG.tips,
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
    test("does not notify below thresholds", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      const data = createCombinedUsage(3000); // 20%.
      checkOnDemandThresholds(data, config, onRefresh);

      assert.strictEqual(
        getNotificationHistory().length,
        0,
        "Should not notify below thresholds",
      );
      assert.strictEqual(
        getTriggeredOnDemandThresholds().size,
        0,
        "No thresholds should be triggered",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("does not re-notify for already triggered threshold", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      const data = createCombinedUsage(7500); // 50%.
      checkOnDemandThresholds(data, config, onRefresh);
      assert.strictEqual(getNotificationHistory().length, 1);

      await waitForNotificationAndDismiss();

      // Same level again -- should not notify.
      checkOnDemandThresholds(data, config, onRefresh);
      assert.strictEqual(
        getNotificationHistory().length,
        1,
        "No additional notification for same threshold",
      );
      assert.strictEqual(
        getTriggeredOnDemandThresholds().size,
        1,
        "Still only 1 threshold triggered",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("jumping multiple thresholds fires one notification at highest severity", async () => {
      const config = createMockConfig();
      const onRefresh = () => {};

      // Jump from 0% to 85% (crosses 50, 60, 70, 80).
      const data = createCombinedUsage(12750);
      checkOnDemandThresholds(data, config, onRefresh);

      const history = getNotificationHistory();
      assert.strictEqual(history.length, 1, "Should show only 1 notification");
      assert.strictEqual(
        history[0].severity,
        "critical",
        "Should use highest severity (critical at 80%)",
      );

      const triggered = getTriggeredOnDemandThresholds();
      assert.ok(triggered.has(50), "50% marked");
      assert.ok(triggered.has(60), "60% marked");
      assert.ok(triggered.has(70), "70% marked");
      assert.ok(triggered.has(80), "80% marked");
      assert.ok(!triggered.has(90), "90% not yet");
      assert.ok(!triggered.has(95), "95% not yet");

      await waitForNotificationAndDismiss();
    });
  });

  suite("Full Usage Progression", () => {
    // eslint-disable-next-line no-restricted-syntax
    test("thresholds, notifications, and status bar update correctly as usage climbs", async function () {
      this.timeout(15000);

      const config = createMockConfig();
      const statusBar = getStatusBarItem();
      assert.ok(statusBar, "Status bar should be created");
      const onRefresh = () => {};

      const steps: Array<{
        cents: number;
        dollars: string;
        expectedThresholds: number;
        expectedSeverity?: "warning" | "critical";
        expectedColor: "none" | "warning" | "critical";
      }> = [
        {
          cents: 1000,
          dollars: "$10.00",
          expectedThresholds: 0,
          expectedColor: "none",
        },
        {
          cents: 3000,
          dollars: "$30.00",
          expectedThresholds: 0,
          expectedColor: "none",
        },
        {
          cents: 7500,
          dollars: "$75.00",
          expectedThresholds: 1,
          expectedSeverity: "warning",
          expectedColor: "warning",
        },
        {
          cents: 9000,
          dollars: "$90.00",
          expectedThresholds: 2,
          expectedSeverity: "warning",
          expectedColor: "warning",
        },
        {
          cents: 10500,
          dollars: "$105.00",
          expectedThresholds: 3,
          expectedSeverity: "warning",
          expectedColor: "warning",
        },
        {
          cents: 12000,
          dollars: "$120.00",
          expectedThresholds: 4,
          expectedSeverity: "critical",
          expectedColor: "critical",
        },
        {
          cents: 13500,
          dollars: "$135.00",
          expectedThresholds: 5,
          expectedSeverity: "critical",
          expectedColor: "critical",
        },
        {
          cents: 15000,
          dollars: "$150.00",
          expectedThresholds: 6,
          expectedSeverity: "critical",
          expectedColor: "critical",
        },
      ];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const data = createCombinedUsage(step.cents);
        const prevThresholds = i > 0 ? steps[i - 1].expectedThresholds : 0;

        updateStatusBar(data, config);
        checkOnDemandThresholds(data, config, onRefresh);

        // Verify status bar text.
        assert.ok(
          statusBar.text.includes(step.dollars),
          `Step ${i + 1}: Expected ${step.dollars}, got: ${statusBar.text}`,
        );

        // Verify thresholds.
        assert.strictEqual(
          getTriggeredOnDemandThresholds().size,
          step.expectedThresholds,
          `Step ${i + 1} (${step.dollars}): Expected ${step.expectedThresholds} thresholds`,
        );

        // Verify notification severity if a new threshold fired.
        if (step.expectedSeverity && step.expectedThresholds > prevThresholds) {
          const history = getNotificationHistory();
          const last = history[history.length - 1];
          assert.strictEqual(
            last.severity,
            step.expectedSeverity,
            `Step ${i + 1}: Expected ${step.expectedSeverity} severity`,
          );
        }

        // Verify status bar color.
        if (step.expectedColor === "none") {
          assert.strictEqual(
            statusBar.backgroundColor,
            undefined,
            `Step ${i + 1}: Expected no background color`,
          );
        } else {
          const bg = statusBar.backgroundColor as vscode.ThemeColor;
          const expectedId =
            step.expectedColor === "warning"
              ? "statusBarItem.warningBackground"
              : "statusBarItem.errorBackground";
          assert.strictEqual(
            bg.id,
            expectedId,
            `Step ${i + 1}: Expected ${step.expectedColor} color`,
          );
        }

        // Dismiss notification if one fired, otherwise pause.
        if (step.expectedThresholds > prevThresholds) {
          await waitForNotificationAndDismiss();
        } else if (i < steps.length - 1) {
          await sleep(UI_PAUSE_MS);
        }
      }
    });
  });
});
