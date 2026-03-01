import * as assert from "assert";

import { type CursorUsageEvent } from "../../src/alerts/types";
import {
  getMaxModeEvents,
  sumCostsCents,
  formatCostDollars,
} from "../../src/alerts/utils";

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

/**
 * Tests for MAX mode detection logic.
 *
 * The `checkMaxModeDetection` function depends on `vscode` and is tested
 * in integration tests. These unit tests cover the pure detection
 * and analysis utilities used by the MAX mode checker.
 */
suite("Alerts - MAX Mode Detection", () => {
  suite("getMaxModeEvents", () => {
    test("counts MAX mode events correctly", () => {
      const events = [
        createMockEvent({ maxMode: true }),
        createMockEvent({ maxMode: false }),
        createMockEvent({ maxMode: true }),
        createMockEvent({ maxMode: true }),
      ];

      const maxEvents = getMaxModeEvents(events);

      assert.strictEqual(maxEvents.length, 3);
    });

    test("returns empty array when no MAX mode events", () => {
      const events = [createMockEvent({ maxMode: false }), createMockEvent()];
      const result = getMaxModeEvents(events);

      assert.strictEqual(result.length, 0);
    });

    test("returns empty array for empty input", () => {
      assert.strictEqual(getMaxModeEvents([]).length, 0);
    });

    test("handles undefined maxMode as non-MAX", () => {
      const events = [createMockEvent({ maxMode: undefined })];
      const result = getMaxModeEvents(events);

      assert.strictEqual(result.length, 0);
    });

    test("sums costs of MAX mode events only", () => {
      const events = [
        createMockEvent({
          maxMode: true,
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 50,
            totalCents: 150,
          },
        }),
        createMockEvent({
          maxMode: false,
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 50,
            totalCents: 10,
          },
        }),
        createMockEvent({
          maxMode: true,
          tokenUsage: {
            inputTokens: 200,
            outputTokens: 100,
            totalCents: 200,
          },
        }),
      ];

      const maxEvents = getMaxModeEvents(events);
      const totalCents = sumCostsCents(maxEvents);

      assert.strictEqual(totalCents, 350);
    });
  });

  suite("sumCostsCents", () => {
    test("sums totalCents across events", () => {
      const events = [
        createMockEvent({
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 50,
            totalCents: 25,
          },
        }),
        createMockEvent({
          tokenUsage: {
            inputTokens: 200,
            outputTokens: 100,
            totalCents: 50,
          },
        }),
      ];

      assert.strictEqual(sumCostsCents(events), 75);
    });

    test("returns 0 for empty array", () => {
      assert.strictEqual(sumCostsCents([]), 0);
    });

    test("handles single event", () => {
      const events = [
        createMockEvent({
          tokenUsage: {
            inputTokens: 100,
            outputTokens: 50,
            totalCents: 42,
          },
        }),
      ];

      assert.strictEqual(sumCostsCents(events), 42);
    });
  });

  suite("formatCostDollars", () => {
    test("formats cents as dollars", () => {
      assert.strictEqual(formatCostDollars(500), "$5.00");
    });

    test("formats zero", () => {
      assert.strictEqual(formatCostDollars(0), "$0.00");
    });

    test("formats one dollar", () => {
      assert.strictEqual(formatCostDollars(100), "$1.00");
    });

    test("formats fractional cents", () => {
      assert.strictEqual(formatCostDollars(42), "$0.42");
    });

    test("formats large amounts", () => {
      assert.strictEqual(formatCostDollars(10000), "$100.00");
    });
  });

  suite("detection logic", () => {
    test("any MAX mode event should be detected", () => {
      const events = [createMockEvent({ maxMode: true })];
      const maxEvents = getMaxModeEvents(events);

      assert.ok(
        maxEvents.length > 0,
        "Any MAX mode call should trigger detection.",
      );
    });

    test("no MAX mode events means no detection", () => {
      const events = [
        createMockEvent({ maxMode: false }),
        createMockEvent({ maxMode: false }),
      ];
      const maxEvents = getMaxModeEvents(events);

      assert.strictEqual(
        maxEvents.length,
        0,
        "No MAX mode calls means no detection.",
      );
    });

    test("empty events means no detection", () => {
      const maxEvents = getMaxModeEvents([]);

      assert.strictEqual(maxEvents.length, 0);
    });
  });
});
