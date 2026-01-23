import * as assert from "assert";
import * as os from "os";

import { buildAuthCookie, getDbPath } from "../../src/auth";
import { type CursorAuthCredentials } from "../../src/types";

suite("Auth", () => {
  suite("getDbPath", () => {
    test("returns correct path for current platform", () => {
      const platform = os.platform();
      const result = getDbPath();

      // Verify it's a string path.
      assert.strictEqual(typeof result, "string");

      // Verify it ends with the expected database file.
      assert.ok(result.endsWith("state.vscdb"));

      // Verify it contains Cursor in the path.
      assert.ok(result.includes("Cursor"));

      // Platform-specific checks.
      if (platform === "darwin") {
        assert.ok(result.includes("Library"));
        assert.ok(result.includes("Application Support"));
      } else if (platform === "linux") {
        assert.ok(result.includes(".config"));
      } else if (platform === "win32") {
        // Windows path should contain User/globalStorage.
        assert.ok(result.includes("User"));
        assert.ok(result.includes("globalStorage"));
      }
    });

    test("path includes home directory", () => {
      const result = getDbPath();
      const platform = os.platform();

      if (platform === "darwin" || platform === "linux") {
        assert.ok(result.startsWith(os.homedir()));
      }
      // Windows uses APPDATA which may not start with homedir.
    });
  });

  suite("buildAuthCookie", () => {
    test("builds correct cookie format", () => {
      const credentials: CursorAuthCredentials = {
        userId: "user_12345",
        accessToken: "token_abc123",
      };

      const result = buildAuthCookie(credentials);
      assert.strictEqual(
        result,
        "WorkosCursorSessionToken=user_12345::token_abc123",
      );
    });

    test("handles special characters in token", () => {
      const credentials: CursorAuthCredentials = {
        userId: "user_test",
        accessToken:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      };

      const result = buildAuthCookie(credentials);
      assert.ok(result.startsWith("WorkosCursorSessionToken="));
      assert.ok(result.includes("user_test::"));
      assert.ok(result.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
    });

    test("separates userId and accessToken with double colon", () => {
      const credentials: CursorAuthCredentials = {
        userId: "test_user",
        accessToken: "test_token",
      };

      const result = buildAuthCookie(credentials);
      assert.ok(result.includes("::"));

      const parts = result.split("=")[1].split("::");
      assert.strictEqual(parts.length, 2);
      assert.strictEqual(parts[0], "test_user");
      assert.strictEqual(parts[1], "test_token");
    });
  });
});
