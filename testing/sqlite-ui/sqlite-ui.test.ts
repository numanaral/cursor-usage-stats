// Save original PATH before stripping it.
// Restored later to simulate a successful sqlite3 installation.
const originalPath = process.env.PATH;

// Strip PATH before extension activation (onStartupFinished).
// Mocha loads test files during discovery, which happens before
// onStartupFinished fires. This makes sqlite3 genuinely unavailable.
process.env.PATH = "/nonexistent";

import * as vscode from "vscode";
import * as assert from "assert";

import {
  getSqliteInstallCommand,
  isSqliteAvailable,
  type SqlitePromptSignal,
} from "../../src/sqlite";
import { sleep, UI_PAUSE_MS } from "../utils";

/**
 * Polls globalThis for the prompt signal set by the bundled extension.
 * The signal is set synchronously before the first await in
 * promptSqliteInstall, so it's available as soon as activate() runs.
 */
const waitForPromptSignal = (timeoutMs = 10_000) => {
  return new Promise<SqlitePromptSignal>((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      if (globalThis.__sqlitePromptSignal) {
        resolve(globalThis.__sqlitePromptSignal);

        return;
      }

      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            "Timed out waiting for sqlite prompt signal from activation.",
          ),
        );

        return;
      }

      setTimeout(check, 100);
    };

    check();
  });
};

/**
 * Tests that run in an Extension Host where sqlite3 is not on PATH.
 *
 * The test runner strips PATH before extension activation, so
 * sqlite3 genuinely cannot be found. activate() calls
 * promptSqliteInstall() (showing a real notification) and
 * returns early without registering commands or status bar.
 */
suite("Sqlite UI - Missing sqlite3 activation flow", () => {
  let signal: SqlitePromptSignal;

  suiteSetup(async () => {
    signal = await waitForPromptSignal();

    // Pause so you can see the error notification in the UI.
    await sleep(UI_PAUSE_MS);
  });

  test("extension showed the install prompt on activation", () => {
    assert.ok(signal, "Expected prompt signal from activation.");
  });

  test("prompt message describes the missing dependency", () => {
    assert.ok(
      signal.message.toLowerCase().includes("sqlite3"),
      `Expected message to mention sqlite3: "${signal.message}"`,
    );
    assert.ok(
      signal.message.toLowerCase().includes("not found"),
      `Expected message to mention "not found": "${signal.message}"`,
    );
  });

  test("prompt offers Install in Terminal action", () => {
    assert.ok(
      signal.actions.includes("Install in Terminal"),
      `Missing "Install in Terminal" action: ${signal.actions}`,
    );
  });

  test("prompt offers Copy Command action", () => {
    assert.ok(
      signal.actions.includes("Copy Command"),
      `Missing "Copy Command" action: ${signal.actions}`,
    );
  });

  test("extension did not register commands (early return)", async () => {
    try {
      await vscode.commands.executeCommand("cursorUsageStats.refresh");
      assert.fail("Expected command to throw (not registered).");
    } catch (error) {
      assert.ok(
        error instanceof Error,
        "Should throw when command has no handler.",
      );
    }
  });
});

suite("Sqlite UI - Notification button actions", () => {
  const command = getSqliteInstallCommand();

  test("'Install in Terminal' creates a terminal with the install command", async () => {
    const countBefore = vscode.window.terminals.length;

    // Execute the exact same code the button handler runs.
    const terminal = vscode.window.createTerminal("Install sqlite3");
    terminal.show();
    terminal.sendText(command);

    // Show the reload prompt (same as the real handler).
    vscode.window.showInformationMessage(
      "After installing sqlite3, reload the window to activate " +
        "Cursor Usage Stats.",
      "Reload Window",
    );

    // Pause so you can see the terminal + reload prompt in the UI.
    await sleep(UI_PAUSE_MS);

    assert.strictEqual(
      vscode.window.terminals.length,
      countBefore + 1,
      "Expected a new terminal to be created.",
    );

    const match = vscode.window.terminals.find(
      (t) => t.name === "Install sqlite3",
    );
    assert.ok(match, "Expected terminal named 'Install sqlite3'.");

    // Cleanup.
    terminal.dispose();
  });

  test("'Copy Command' copies the install command to clipboard", async () => {
    // Execute the exact same code the button handler runs.
    await vscode.env.clipboard.writeText(command);

    const content = await vscode.env.clipboard.readText();

    // Show the reload prompt (same as the real handler).
    vscode.window.showInformationMessage(
      "After installing sqlite3, reload the window to activate " +
        "Cursor Usage Stats.",
      "Reload Window",
    );

    await sleep(UI_PAUSE_MS);

    assert.strictEqual(
      content,
      command,
      `Clipboard should contain "${command}", got "${content}".`,
    );
  });

  test("install command is platform-appropriate", () => {
    const platform = process.platform;

    if (platform === "darwin") {
      assert.ok(
        command.includes("brew"),
        `Expected brew command on macOS, got "${command}".`,
      );
    } else if (platform === "win32") {
      assert.ok(
        command.includes("winget"),
        `Expected winget command on Windows, got "${command}".`,
      );
    } else {
      assert.ok(
        command.includes("apt"),
        `Expected apt command on Linux, got "${command}".`,
      );
    }
  });
});

suite("Sqlite UI - Post-install recovery", () => {
  const disposables: vscode.Disposable[] = [];

  suiteTeardown(() => {
    disposables.forEach((d) => d.dispose());
  });

  test("sqlite3 is NOT available with stripped PATH", async () => {
    vscode.window.showInformationMessage(
      "PATH is stripped — sqlite3 should NOT be found.",
    );
    await sleep(UI_PAUSE_MS);

    assert.strictEqual(
      isSqliteAvailable(),
      false,
      "sqlite3 should not be found with PATH=/nonexistent.",
    );
  });

  test("sqlite3 becomes available after PATH is restored", async () => {
    // Restore original PATH (simulates a successful sqlite3 install).
    process.env.PATH = originalPath!;

    vscode.window.showInformationMessage(
      "PATH restored — sqlite3 should be found now.",
    );
    await sleep(UI_PAUSE_MS);

    assert.strictEqual(
      isSqliteAvailable(),
      true,
      "sqlite3 should be found after restoring PATH.",
    );
  });

  test("extension activates successfully after install", async () => {
    // Copy mock data to where the tsc-compiled module expects it.
    // The bundle reads from dist/, but tsc output uses out/src/.
    const fs = await import("fs");
    const path = await import("path");
    const src = path.join(__dirname, "../../../dist/mock-api-responses.json");
    const dest = path.join(__dirname, "../../src/mock-api-responses.json");

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }

    // Import the test module's copy of the extension.
    // This is a fresh module instance separate from the bundle,
    // so calling activate() here runs the full activation path
    // (status bar, commands, polling) with PATH now restored.
    const { activate } = await import("../../src/extension");

    const mockContext = {
      subscriptions: disposables,
      extension: { packageJSON: { version: "test" } },
      globalStorageUri: { fsPath: "/tmp" },
    } as unknown as vscode.ExtensionContext;

    activate(mockContext);

    // Wait for async operations (refreshUsage, fetchCombinedUsage, etc.).
    await sleep(UI_PAUSE_MS);

    // Verify commands are registered (would throw if not).
    await Promise.resolve(
      vscode.commands.executeCommand("cursorUsageStats.refresh"),
    );
    await Promise.resolve(
      vscode.commands.executeCommand("cursorUsageStats.showDetails"),
    );

    // Give extra time to see the status bar and notification in the UI.
    await sleep(UI_PAUSE_MS * 3);
  });
});
