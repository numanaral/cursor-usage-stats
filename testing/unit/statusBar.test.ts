import * as assert from "assert";

import {
  getIncludedRequestSeverity,
  getOnDemandSeverity,
} from "../../src/statusBar/utils";
import {
  type CursorCombinedUsage,
  type ExtensionConfig,
  type CursorUsageDetailsForModel,
  type CursorUsageSummaryApiResponse,
} from "../../src/types";

suite("StatusBar Utils", () => {
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

  const createMockUsageSummary = (
    overrides: Partial<CursorUsageSummaryApiResponse> = {},
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
          breakdown: {
            included: 500,
            bonus: 0,
            total: 500,
          },
          autoPercentUsed: 0,
          apiPercentUsed: 0,
          totalPercentUsed: 0,
        },
        onDemand: {
          enabled: true,
          used: 0,
          limit: 1000,
          remaining: 1000,
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
      ...overrides,
    };
  };

  const createMockCombinedUsage = (
    onDemandUsed: number,
    onDemandLimit: number,
    onDemandEnabled = true,
  ): CursorCombinedUsage => {
    return {
      usage: {
        startOfMonth: "2026-01-01T00:00:00Z",
      },
      summary: createMockUsageSummary({
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
      }),
    };
  };

  suite("getIncludedRequestSeverity", () => {
    test("returns normal when modelUsage is null", () => {
      const config = createMockConfig();
      const result = getIncludedRequestSeverity(null, config);
      assert.strictEqual(result, "normal");
    });

    test("returns normal when maxRequestUsage is null (unlimited)", () => {
      const modelUsage: CursorUsageDetailsForModel = {
        numRequests: 100,
        numRequestsTotal: 100,
        numTokens: 5000,
        maxRequestUsage: null,
        maxTokenUsage: null,
      };
      const config = createMockConfig();
      const result = getIncludedRequestSeverity(modelUsage, config);
      assert.strictEqual(result, "normal");
    });

    test("returns normal when below all thresholds", () => {
      const modelUsage: CursorUsageDetailsForModel = {
        numRequests: 40,
        numRequestsTotal: 40,
        numTokens: 2000,
        maxRequestUsage: 100,
        maxTokenUsage: 10000,
      };
      const config = createMockConfig();
      const result = getIncludedRequestSeverity(modelUsage, config);
      assert.strictEqual(result, "normal");
    });

    test("returns warning when at warning threshold", () => {
      const modelUsage: CursorUsageDetailsForModel = {
        numRequests: 50,
        numRequestsTotal: 50,
        numTokens: 2500,
        maxRequestUsage: 100,
        maxTokenUsage: 10000,
      };
      const config = createMockConfig();
      const result = getIncludedRequestSeverity(modelUsage, config);
      assert.strictEqual(result, "warning");
    });

    test("returns critical when at critical threshold", () => {
      const modelUsage: CursorUsageDetailsForModel = {
        numRequests: 80,
        numRequestsTotal: 80,
        numTokens: 4000,
        maxRequestUsage: 100,
        maxTokenUsage: 10000,
      };
      const config = createMockConfig();
      const result = getIncludedRequestSeverity(modelUsage, config);
      assert.strictEqual(result, "critical");
    });

    test("returns critical when above critical threshold", () => {
      const modelUsage: CursorUsageDetailsForModel = {
        numRequests: 95,
        numRequestsTotal: 95,
        numTokens: 4750,
        maxRequestUsage: 100,
        maxTokenUsage: 10000,
      };
      const config = createMockConfig();
      const result = getIncludedRequestSeverity(modelUsage, config);
      assert.strictEqual(result, "critical");
    });
  });

  suite("getOnDemandSeverity", () => {
    test("returns normal when on-demand is disabled", () => {
      const data = createMockCombinedUsage(500, 1000, false);
      const config = createMockConfig();
      const result = getOnDemandSeverity(data, config);
      assert.strictEqual(result, "normal");
    });

    test("returns normal when limit is 0", () => {
      const data = createMockCombinedUsage(0, 0, true);
      const config = createMockConfig();
      const result = getOnDemandSeverity(data, config);
      assert.strictEqual(result, "normal");
    });

    test("returns normal when below all thresholds", () => {
      const data = createMockCombinedUsage(400, 1000);
      const config = createMockConfig();
      const result = getOnDemandSeverity(data, config);
      assert.strictEqual(result, "normal");
    });

    test("returns warning when at warning threshold", () => {
      const data = createMockCombinedUsage(500, 1000);
      const config = createMockConfig();
      const result = getOnDemandSeverity(data, config);
      assert.strictEqual(result, "warning");
    });

    test("returns critical when at critical threshold", () => {
      const data = createMockCombinedUsage(800, 1000);
      const config = createMockConfig();
      const result = getOnDemandSeverity(data, config);
      assert.strictEqual(result, "critical");
    });
  });
});
