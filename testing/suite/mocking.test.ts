import * as assert from "assert";

import { isMockingEnabled } from "../../src/__mocking__";

suite("Mocking", () => {
  suite("isMockingEnabled", () => {
    const originalEnv = process.env.USE_MOCKED_API_DATA;

    teardown(() => {
      // Restore original env.
      if (originalEnv === undefined) {
        delete process.env.USE_MOCKED_API_DATA;
      } else {
        process.env.USE_MOCKED_API_DATA = originalEnv;
      }
    });

    test("returns false when env var is not set", () => {
      delete process.env.USE_MOCKED_API_DATA;
      assert.strictEqual(isMockingEnabled(), false);
    });

    test("returns false when env var is empty", () => {
      process.env.USE_MOCKED_API_DATA = "";
      assert.strictEqual(isMockingEnabled(), false);
    });

    test("returns false when env var is 'false'", () => {
      process.env.USE_MOCKED_API_DATA = "false";
      assert.strictEqual(isMockingEnabled(), false);
    });

    test("returns true when env var is 'true'", () => {
      process.env.USE_MOCKED_API_DATA = "true";
      assert.strictEqual(isMockingEnabled(), true);
    });

    test("returns false for other values", () => {
      process.env.USE_MOCKED_API_DATA = "1";
      assert.strictEqual(isMockingEnabled(), false);

      process.env.USE_MOCKED_API_DATA = "yes";
      assert.strictEqual(isMockingEnabled(), false);
    });
  });
});
