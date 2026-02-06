import * as assert from "assert";

import {
  getTriggeredIncludedRequestThresholds,
  getTriggeredOnDemandThresholds,
  markExceededThresholdsAsTriggered,
  resetTriggeredThresholds,
} from "../../src/alerts/utils";
import {
  type CursorCombinedUsage,
  type ExtensionConfig,
  type CursorUsageDetailsForModel,
  type CursorUsageApiResponse,
  type CursorUsageSummaryApiResponse,
} from "../../src/types";

suite("Alerts", () => {
  const createMockConfig = (
    overrides: Partial<ExtensionConfig> = {},
  ): ExtensionConfig => {
    return {
      notifyOnStartup: true,
      pollIntervalSeconds: 60,
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
      ...overrides,
    };
  };

  const createMockUsage = (
    numRequests: number,
    maxRequestUsage: number | null,
  ): CursorUsageApiResponse => {
    const modelUsage: CursorUsageDetailsForModel = {
      numRequests,
      numRequestsTotal: numRequests,
      numTokens: numRequests * 100,
      maxRequestUsage,
      maxTokenUsage: maxRequestUsage ? maxRequestUsage * 100 : null,
    };

    return {
      startOfMonth: "2026-01-01T00:00:00Z",
      "gpt-4": modelUsage,
    };
  };

  const createMockUsageSummary = (
    onDemandUsed: number,
    onDemandLimit: number,
    onDemandEnabled = true,
  ): CursorUsageSummaryApiResponse => {
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
          used: 0,
          limit: 500,
          remaining: 500,
          breakdown: { included: 500, bonus: 0, total: 500 },
          autoPercentUsed: 0,
          apiPercentUsed: 0,
          totalPercentUsed: 0,
        },
        onDemand: {
          enabled: onDemandEnabled,
          used: onDemandUsed,
          limit: onDemandLimit,
          remaining: onDemandLimit - onDemandUsed,
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

  const createMockCombinedUsage = (
    requestPercent: number,
    onDemandPercent: number,
  ): CursorCombinedUsage => {
    const maxRequests = 100;
    const numRequests = Math.floor((requestPercent / 100) * maxRequests);

    const onDemandLimit = 1000;
    const onDemandUsed = Math.floor((onDemandPercent / 100) * onDemandLimit);

    return {
      usage: createMockUsage(numRequests, maxRequests),
      summary: createMockUsageSummary(onDemandUsed, onDemandLimit),
    };
  };

  // Reset thresholds before each test.
  setup(() => {
    resetTriggeredThresholds();
  });

  suite("markExceededThresholdsAsTriggered", () => {
    test("marks thresholds at or below current usage for included requests", () => {
      const data = createMockCombinedUsage(75, 0);
      const config = createMockConfig();

      markExceededThresholdsAsTriggered(data, config);

      const triggered = getTriggeredIncludedRequestThresholds();
      // 75% should trigger 50, 60, 70 (warning thresholds).
      assert.ok(triggered.has(50));
      assert.ok(triggered.has(60));
      assert.ok(triggered.has(70));
      // But not 80, 90, 95 (critical thresholds).
      assert.ok(!triggered.has(80));
      assert.ok(!triggered.has(90));
      assert.ok(!triggered.has(95));
    });

    test("marks thresholds at or below current usage for on-demand", () => {
      const data = createMockCombinedUsage(0, 85);
      const config = createMockConfig();

      markExceededThresholdsAsTriggered(data, config);

      const triggered = getTriggeredOnDemandThresholds();
      // 85% should trigger 50, 60, 70, 80.
      assert.ok(triggered.has(50));
      assert.ok(triggered.has(60));
      assert.ok(triggered.has(70));
      assert.ok(triggered.has(80));
      // But not 90, 95.
      assert.ok(!triggered.has(90));
      assert.ok(!triggered.has(95));
    });

    test("does not mark thresholds above current usage", () => {
      const data = createMockCombinedUsage(45, 45);
      const config = createMockConfig();

      markExceededThresholdsAsTriggered(data, config);

      const includedTriggered = getTriggeredIncludedRequestThresholds();
      const onDemandTriggered = getTriggeredOnDemandThresholds();

      // 45% should not trigger any thresholds (lowest is 50).
      assert.strictEqual(includedTriggered.size, 0);
      assert.strictEqual(onDemandTriggered.size, 0);
    });

    test("handles unlimited requests (null maxRequestUsage)", () => {
      const data: CursorCombinedUsage = {
        usage: createMockUsage(100, null),
        summary: createMockUsageSummary(0, 1000),
      };
      const config = createMockConfig();

      // Should not throw.
      markExceededThresholdsAsTriggered(data, config);

      const triggered = getTriggeredIncludedRequestThresholds();
      assert.strictEqual(triggered.size, 0);
    });

    test("handles disabled on-demand", () => {
      const data: CursorCombinedUsage = {
        usage: createMockUsage(50, 100),
        summary: createMockUsageSummary(500, 1000, false),
      };
      const config = createMockConfig();

      markExceededThresholdsAsTriggered(data, config);

      const triggered = getTriggeredOnDemandThresholds();
      assert.strictEqual(triggered.size, 0);
    });
  });

  suite("resetTriggeredThresholds", () => {
    test("clears all tracked thresholds", () => {
      // First, trigger some thresholds.
      const data = createMockCombinedUsage(100, 100);
      const config = createMockConfig();
      markExceededThresholdsAsTriggered(data, config);

      // Verify thresholds are set.
      assert.ok(getTriggeredIncludedRequestThresholds().size > 0);
      assert.ok(getTriggeredOnDemandThresholds().size > 0);

      // Reset.
      resetTriggeredThresholds();

      // Verify cleared.
      assert.strictEqual(getTriggeredIncludedRequestThresholds().size, 0);
      assert.strictEqual(getTriggeredOnDemandThresholds().size, 0);
    });

    test("can be called multiple times without error", () => {
      resetTriggeredThresholds();
      resetTriggeredThresholds();
      resetTriggeredThresholds();

      assert.strictEqual(getTriggeredIncludedRequestThresholds().size, 0);
      assert.strictEqual(getTriggeredOnDemandThresholds().size, 0);
    });
  });
});
