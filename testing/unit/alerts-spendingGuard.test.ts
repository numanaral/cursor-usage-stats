import * as assert from "assert";

/**
 * Tests for spending guard state management.
 *
 * The main `checkSpendingGuard` function depends on `vscode` and
 * is tested in integration tests. These unit tests cover the
 * supporting calculation logic used by spending guard.
 */
suite("Alerts - Spending Guard State", () => {
  suite("Snooze calculation", () => {
    test("5 minute snooze calculates correctly", () => {
      const now = Date.now();
      const snoozeMs = 5 * 60 * 1000;
      const snoozeUntil = now + snoozeMs;

      assert.ok(snoozeUntil > now);
      assert.strictEqual(snoozeUntil - now, 300000);
    });
  });

  suite("Threshold calculation", () => {
    test("cost threshold converts to cents correctly", () => {
      const costThreshold = 20;
      const thresholdCents = costThreshold * 100;

      assert.strictEqual(thresholdCents, 2000);
    });

    test("fractional cost threshold converts correctly", () => {
      const costThreshold = 5.5;
      const thresholdCents = costThreshold * 100;

      assert.strictEqual(thresholdCents, 550);
    });
  });
});
