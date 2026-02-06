import * as assert from "assert";

import { findModelKey, getModelUsage } from "../../src/api";
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

    test("handles usage with null maxRequestUsage (unlimited)", () => {
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

    test("handles unlimited model usage (null maxRequestUsage)", () => {
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
