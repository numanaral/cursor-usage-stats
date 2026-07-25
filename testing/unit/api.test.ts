import * as assert from "assert";

import {
  findModelKey,
  getModelUsage,
  normalizeUsageSummary,
} from "../../src/api";
import {
  type CursorUsageDetailsForModel,
  type CursorUsageApiResponse,
} from "../../src/types";

suite("API", () => {
  const createMockUsage = (
    models: Record<string, Partial<CursorUsageDetailsForModel>>,
  ): CursorUsageApiResponse => {
    const usage: CursorUsageApiResponse = {
      startOfMonth: "2026-01-01T00:00:00Z",
    };

    for (const [key, value] of Object.entries(models)) {
      usage[key] = {
        numRequests: 0,
        numRequestsTotal: 0,
        numTokens: 0,
        maxRequestUsage: null,
        maxTokenUsage: null,
        ...value,
      } as CursorUsageDetailsForModel;
    }

    return usage;
  };

  suite("normalizeUsageSummary", () => {
    const legacyMetric = {
      enabled: true,
      used: 250,
      limit: 1000,
      remaining: 750,
    };
    const overallMetric = {
      enabled: true,
      used: 400,
      limit: 2000,
      remaining: 1600,
    };

    test("preserves the legacy on-demand metric", () => {
      const result = normalizeUsageSummary({
        individualUsage: {
          onDemand: legacyMetric,
          overall: overallMetric,
        },
      });

      assert.deepStrictEqual(result.individualUsage.onDemand, legacyMetric);
    });

    test("maps the current overall metric to on-demand usage", () => {
      const result = normalizeUsageSummary({
        individualUsage: {
          overall: overallMetric,
        },
      });

      assert.deepStrictEqual(result.individualUsage.onDemand, overallMetric);
      assert.deepStrictEqual(result.individualUsage.overall, overallMetric);
    });

    test("rejects unsupported individual usage data", () => {
      assert.throws(() => {
        normalizeUsageSummary({ individualUsage: {} });
      }, /unsupported individual usage format/);
    });
  });

  suite("findModelKey", () => {
    test("returns preferred key when it exists and is valid", () => {
      const usage = createMockUsage({
        "gpt-4": { numRequestsTotal: 100, maxRequestUsage: 500 },
        "claude-3": { numRequestsTotal: 50, maxRequestUsage: 200 },
      });

      const result = findModelKey(usage, "gpt-4");
      assert.strictEqual(result, "gpt-4");
    });

    test("falls back to first valid key when preferred is missing", () => {
      const usage = createMockUsage({
        "claude-3": { numRequestsTotal: 50, maxRequestUsage: 200 },
      });

      const result = findModelKey(usage, "gpt-4");
      assert.strictEqual(result, "claude-3");
    });

    test("returns null when no valid keys exist", () => {
      const usage: CursorUsageApiResponse = {
        startOfMonth: "2026-01-01T00:00:00Z",
        invalidKey: "not a model usage",
      };

      const result = findModelKey(usage, "gpt-4");
      assert.strictEqual(result, null);
    });

    test("skips startOfMonth key", () => {
      const usage: CursorUsageApiResponse = {
        startOfMonth: "2026-01-01T00:00:00Z",
      };

      const result = findModelKey(usage, "gpt-4");
      assert.strictEqual(result, null);
    });

    test("returns preferred key even when other valid keys exist", () => {
      const usage = createMockUsage({
        "gpt-4": { numRequestsTotal: 100, maxRequestUsage: 500 },
        "claude-3": { numRequestsTotal: 50, maxRequestUsage: 200 },
        "gpt-3.5": { numRequestsTotal: 25, maxRequestUsage: 100 },
      });

      const result = findModelKey(usage, "claude-3");
      assert.strictEqual(result, "claude-3");
    });

    test("handles usage with unavailable request limit data", () => {
      const usage = createMockUsage({
        "gpt-4": { numRequestsTotal: 100, maxRequestUsage: null },
      });

      const result = findModelKey(usage, "gpt-4");
      assert.strictEqual(result, "gpt-4");
    });
  });

  suite("getModelUsage", () => {
    test("returns ModelUsage when key is found", () => {
      const usage = createMockUsage({
        "gpt-4": {
          numRequests: 50,
          numRequestsTotal: 100,
          numTokens: 5000,
          maxRequestUsage: 500,
          maxTokenUsage: 100000,
        },
      });

      const result = getModelUsage(usage, "gpt-4");
      assert.ok(result);
      assert.strictEqual(result.numRequests, 50);
      assert.strictEqual(result.numRequestsTotal, 100);
      assert.strictEqual(result.maxRequestUsage, 500);
    });

    test("returns null when key is not found", () => {
      const usage: CursorUsageApiResponse = {
        startOfMonth: "2026-01-01T00:00:00Z",
      };

      const result = getModelUsage(usage, "gpt-4");
      assert.strictEqual(result, null);
    });

    test("returns fallback model when preferred is not found", () => {
      const usage = createMockUsage({
        "claude-3": {
          numRequests: 25,
          numRequestsTotal: 50,
          maxRequestUsage: 200,
        },
      });

      const result = getModelUsage(usage, "gpt-4");
      assert.ok(result);
      assert.strictEqual(result.numRequests, 25);
    });

    test("returns model usage with an unavailable request limit", () => {
      const usage = createMockUsage({
        "gpt-4": {
          numRequests: 100,
          numRequestsTotal: 100,
          maxRequestUsage: null,
        },
      });

      const result = getModelUsage(usage, "gpt-4");
      assert.ok(result);
      assert.strictEqual(result.maxRequestUsage, null);
    });
  });
});
