import * as assert from "assert";

import { createStatusBarItem, disposeStatusBar } from "../../../src/statusBar";

suite("StatusBar", () => {
  suite("Status Bar Item", () => {
    // Note: Tests use their own module instance, separate from the bundled extension.
    // Each test creates/disposes its own status bar item.

    test("createStatusBarItem creates a status bar item", () => {
      const item = createStatusBarItem();
      assert.ok(item);
      assert.strictEqual(item.command, "cursorUsageStats.showDetails");
      disposeStatusBar();
    });

    test("disposeStatusBar cleans up the status bar item", () => {
      createStatusBarItem();
      disposeStatusBar();
      // No error means success.
    });
  });
});
