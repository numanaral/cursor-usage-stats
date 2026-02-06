import * as assert from "assert";

import {
  calculateSeverity,
  extractUserIdFromJwt,
  formatCents,
  formatResetDateFull,
  formatResetDateShort,
  isModelUsage,
  validateThresholds,
} from "../../src/utils";

suite("Utils", () => {
  suite("formatCents", () => {
    test("formats 0 as $0.00", () => {
      assert.strictEqual(formatCents(0), "$0.00");
    });

    test("formats 100 as $1.00", () => {
      assert.strictEqual(formatCents(100), "$1.00");
    });

    test("formats 1234 as $12.34", () => {
      assert.strictEqual(formatCents(1234), "$12.34");
    });

    test("formats large amounts correctly", () => {
      assert.strictEqual(formatCents(999999), "$9999.99");
    });

    test("formats single digit cents correctly", () => {
      assert.strictEqual(formatCents(5), "$0.05");
    });
  });

  suite("formatResetDateShort", () => {
    test("formats date in MMM D, YYYY format", () => {
      const result = formatResetDateShort("2026-02-01T00:00:00Z");
      assert.strictEqual(result, "Feb 1, 2026");
    });

    test("handles different months", () => {
      const result = formatResetDateShort("2026-12-25T00:00:00Z");
      assert.strictEqual(result, "Dec 25, 2026");
    });
  });

  suite("formatResetDateFull", () => {
    test("includes UTC in the output", () => {
      const result = formatResetDateFull("2026-02-01T00:00:00Z");
      assert.ok(result.includes("UTC"));
    });

    test("includes both UTC and local time", () => {
      const result = formatResetDateFull("2026-02-01T00:00:00Z");
      // Should have format like "Feb 1, 2026 UTC (Jan 31, 2026 4:00 PM PST)"
      assert.ok(result.includes("Feb 1, 2026 UTC"));
      assert.ok(result.includes("("));
      assert.ok(result.includes(")"));
    });
  });

  suite("validateThresholds", () => {
    const defaultValue = [80, 90];

    test("returns input array when valid", () => {
      const result = validateThresholds([50, 60, 70], defaultValue);
      assert.deepStrictEqual(result, [50, 60, 70]);
    });

    test("returns default when input is not an array", () => {
      assert.deepStrictEqual(
        validateThresholds("invalid", defaultValue),
        defaultValue,
      );
      assert.deepStrictEqual(
        validateThresholds(null, defaultValue),
        defaultValue,
      );
      assert.deepStrictEqual(
        validateThresholds(undefined, defaultValue),
        defaultValue,
      );
      assert.deepStrictEqual(
        validateThresholds(123, defaultValue),
        defaultValue,
      );
    });

    test("returns default when array contains non-numbers", () => {
      assert.deepStrictEqual(
        validateThresholds(["50", 60], defaultValue),
        defaultValue,
      );
      assert.deepStrictEqual(
        validateThresholds([50, null], defaultValue),
        defaultValue,
      );
    });

    test("returns default when values are out of range", () => {
      assert.deepStrictEqual(
        validateThresholds([150], defaultValue),
        defaultValue,
      );
      assert.deepStrictEqual(
        validateThresholds([-10], defaultValue),
        defaultValue,
      );
    });

    test("accepts empty array", () => {
      assert.deepStrictEqual(validateThresholds([], defaultValue), []);
    });

    test("accepts boundary values 0 and 100", () => {
      assert.deepStrictEqual(
        validateThresholds([0, 100], defaultValue),
        [0, 100],
      );
    });
  });

  suite("calculateSeverity", () => {
    const warningThresholds = [50];
    const criticalThresholds = [80];

    test("returns normal when below all thresholds", () => {
      assert.strictEqual(
        calculateSeverity(40, warningThresholds, criticalThresholds),
        "normal",
      );
    });

    test("returns warning when at warning threshold", () => {
      assert.strictEqual(
        calculateSeverity(50, warningThresholds, criticalThresholds),
        "warning",
      );
    });

    test("returns warning when above warning but below critical", () => {
      assert.strictEqual(
        calculateSeverity(60, warningThresholds, criticalThresholds),
        "warning",
      );
    });

    test("returns critical when at critical threshold", () => {
      assert.strictEqual(
        calculateSeverity(80, warningThresholds, criticalThresholds),
        "critical",
      );
    });

    test("returns critical when above critical threshold", () => {
      assert.strictEqual(
        calculateSeverity(90, warningThresholds, criticalThresholds),
        "critical",
      );
    });

    test("critical takes precedence over warning", () => {
      // When both thresholds are exceeded, critical should win.
      assert.strictEqual(calculateSeverity(85, [50], [80]), "critical");
    });

    test("handles empty thresholds", () => {
      assert.strictEqual(calculateSeverity(90, [], []), "normal");
    });

    test("handles multiple thresholds", () => {
      const warnings = [50, 60, 70];
      const criticals = [80, 90, 95];
      assert.strictEqual(calculateSeverity(55, warnings, criticals), "warning");
      assert.strictEqual(
        calculateSeverity(85, warnings, criticals),
        "critical",
      );
    });
  });

  suite("extractUserIdFromJwt", () => {
    test("extracts user ID from JWT with provider|user format", () => {
      // Create a mock JWT with payload containing sub: "auth0|user_12345"
      const payload = { sub: "auth0|user_12345" };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const mockJwt = `header.${encodedPayload}.signature`;

      const result = extractUserIdFromJwt(mockJwt);
      assert.strictEqual(result, "user_12345");
    });

    test("handles different provider prefixes", () => {
      const payload = { sub: "google-oauth2|user_abc123" };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const mockJwt = `header.${encodedPayload}.signature`;

      const result = extractUserIdFromJwt(mockJwt);
      assert.strictEqual(result, "user_abc123");
    });

    test("handles sub without pipe separator", () => {
      const payload = { sub: "user_only" };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const mockJwt = `header.${encodedPayload}.signature`;

      const result = extractUserIdFromJwt(mockJwt);
      assert.strictEqual(result, "user_only");
    });
  });

  suite("isModelUsage", () => {
    test("returns true for valid ModelUsage object", () => {
      const validUsage = {
        numRequests: 10,
        numRequestsTotal: 100,
        numTokens: 5000,
        maxRequestUsage: 500,
        maxTokenUsage: 100000,
      };
      assert.strictEqual(isModelUsage(validUsage), true);
    });

    test("returns true when maxRequestUsage is null", () => {
      const validUsage = {
        numRequestsTotal: 100,
        maxRequestUsage: null,
      };
      assert.strictEqual(isModelUsage(validUsage), true);
    });

    test("returns false for missing numRequestsTotal", () => {
      const invalidUsage = {
        maxRequestUsage: 500,
      };
      assert.strictEqual(isModelUsage(invalidUsage), false);
    });

    test("returns false for wrong type numRequestsTotal", () => {
      const invalidUsage = {
        numRequestsTotal: "100",
        maxRequestUsage: 500,
      };
      assert.strictEqual(isModelUsage(invalidUsage), false);
    });

    test("returns false for null", () => {
      assert.strictEqual(isModelUsage(null), false);
    });

    test("returns false for undefined", () => {
      assert.strictEqual(isModelUsage(undefined), false);
    });

    test("returns false for non-object", () => {
      assert.strictEqual(isModelUsage("string"), false);
      assert.strictEqual(isModelUsage(123), false);
      assert.strictEqual(isModelUsage([]), false);
    });
  });
});
