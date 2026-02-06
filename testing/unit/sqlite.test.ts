import * as assert from "assert";
import * as os from "os";

import {
  getSqliteInstallCommand,
  isSqliteAvailable,
} from "../../src/sqlite/utils";

suite("Sqlite Utils", () => {
  suite("isSqliteAvailable", () => {
    test("returns a boolean", () => {
      const result = isSqliteAvailable();
      assert.strictEqual(typeof result, "boolean");
    });

    test("returns true when sqlite3 is installed", () => {
      // sqlite3 is pre-installed on macOS.
      if (os.platform() === "darwin") {
        assert.strictEqual(isSqliteAvailable(), true);
      }
    });
  });

  suite("getSqliteInstallCommand", () => {
    test("returns a non-empty string", () => {
      const result = getSqliteInstallCommand();
      assert.strictEqual(typeof result, "string");
      assert.ok(result.length > 0);
    });

    test("includes sqlite3 in the command", () => {
      const result = getSqliteInstallCommand();
      assert.ok(
        result.toLowerCase().includes("sqlite"),
        `Expected "${result}" to include "sqlite".`,
      );
    });

    test("returns platform-appropriate command", () => {
      const platform = os.platform();
      const result = getSqliteInstallCommand();

      if (platform === "darwin") {
        assert.ok(result.includes("brew"));
      } else if (platform === "win32") {
        assert.ok(result.includes("winget"));
      } else {
        assert.ok(result.includes("apt"));
      }
    });
  });
});
