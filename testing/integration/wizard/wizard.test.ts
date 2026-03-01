import * as vscode from "vscode";
import * as assert from "assert";

import { EXTENSION_DEFAULT_CONFIG } from "../../../src/constants";
import { IS_SLOW_MODE, sleep, UI_PAUSE_MS } from "../../utils";

/** Re-reads the extension config (avoids stale cache). */
const getConfig = () => vscode.workspace.getConfiguration("cursorUsageStats");

/**
 * Integration tests for the settings wizard.
 *
 * Quick Picks auto-dismiss in the test environment, so we
 * cannot simulate the full wizard flow. Instead, we verify:
 * 1. Command registration and execution.
 * 2. Configuration values can be written and read back
 *    (the core functionality the wizard wraps).
 * 3. Defaults match EXTENSION_DEFAULT_CONFIG.
 */
suite("Integration - Settings Wizard", () => {
  suite("Commands", () => {
    test("configureSettings command is registered", async () => {
      // Allow async activate() to finish registering commands.
      await sleep(IS_SLOW_MODE ? 500 : 50);

      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("cursorUsageStats.configureSettings"),
        "cursorUsageStats.configureSettings command should be registered.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("executing wizard command opens Quick Pick", async () => {
      // Fire-and-forget since the Quick Pick awaits user input.
      vscode.commands.executeCommand("cursorUsageStats.configureSettings");

      await sleep(UI_PAUSE_MS);

      // Dismiss the Quick Pick by sending Escape.
      await vscode.commands.executeCommand("workbench.action.closeQuickOpen");

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Configuration Read/Write", () => {
    // Store original values to restore after each test.
    const restore: Array<{ key: string; value: unknown }> = [];

    teardown(async () => {
      for (const { key, value } of restore) {
        await getConfig().update(key, value, vscode.ConfigurationTarget.Global);
      }
      restore.length = 0;
    });

    test("showWelcomeMessage can be toggled", async () => {
      const key = "showWelcomeMessage";
      restore.push({ key, value: getConfig().get(key) });

      await getConfig().update(key, false, vscode.ConfigurationTarget.Global);
      assert.strictEqual(
        getConfig().get<boolean>(key),
        false,
        "Should be disabled after update.",
      );

      await getConfig().update(key, true, vscode.ConfigurationTarget.Global);
      assert.strictEqual(
        getConfig().get<boolean>(key),
        true,
        "Should be re-enabled after update.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("maxModeDetection.enabled can be toggled", async () => {
      const key = "alerts.maxModeDetection.enabled";
      restore.push({ key, value: getConfig().get(key) });

      await getConfig().update(key, false, vscode.ConfigurationTarget.Global);
      assert.strictEqual(getConfig().get<boolean>(key), false);

      await getConfig().update(key, true, vscode.ConfigurationTarget.Global);
      assert.strictEqual(getConfig().get<boolean>(key), true);

      await sleep(UI_PAUSE_MS);
    });

    test("maxModeDetection.notificationMode accepts toast and modal", async () => {
      const key = "alerts.maxModeDetection.notificationMode";
      restore.push({ key, value: getConfig().get(key) });

      await getConfig().update(key, "toast", vscode.ConfigurationTarget.Global);
      assert.strictEqual(getConfig().get<string>(key), "toast");

      await getConfig().update(key, "modal", vscode.ConfigurationTarget.Global);
      assert.strictEqual(getConfig().get<string>(key), "modal");

      await sleep(UI_PAUSE_MS);
    });

    test("spendingGuard.costThreshold accepts a number", async () => {
      const key = "alerts.spendingGuard.costThreshold";
      restore.push({ key, value: getConfig().get(key) });

      await getConfig().update(key, 50, vscode.ConfigurationTarget.Global);
      assert.strictEqual(getConfig().get<number>(key), 50);

      await getConfig().update(key, 20, vscode.ConfigurationTarget.Global);
      assert.strictEqual(getConfig().get<number>(key), 20);

      await sleep(UI_PAUSE_MS);
    });

    test("usageThreshold.statusBar.displayMode accepts valid values", async () => {
      const key = "alerts.usageThreshold.statusBar.displayMode";
      restore.push({ key, value: getConfig().get(key) });

      for (const mode of ["both", "requests", "onDemand"]) {
        await getConfig().update(key, mode, vscode.ConfigurationTarget.Global);
        assert.strictEqual(
          getConfig().get<string>(key),
          mode,
          `Should accept "${mode}".`,
        );
      }

      await sleep(UI_PAUSE_MS);
    });

    test("tips.showOnStartup can be toggled", async () => {
      const key = "tips.showOnStartup";
      restore.push({ key, value: getConfig().get(key) });

      await getConfig().update(key, true, vscode.ConfigurationTarget.Global);
      assert.strictEqual(getConfig().get<boolean>(key), true);

      await getConfig().update(key, false, vscode.ConfigurationTarget.Global);
      assert.strictEqual(getConfig().get<boolean>(key), false);

      await sleep(UI_PAUSE_MS);
    });

    test("api.includedRequestModelKey accepts a string", async () => {
      const key = "api.includedRequestModelKey";
      restore.push({ key, value: getConfig().get(key) });

      await getConfig().update(
        key,
        "claude-3.5-sonnet",
        vscode.ConfigurationTarget.Global,
      );
      assert.strictEqual(getConfig().get<string>(key), "claude-3.5-sonnet");

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Configuration Defaults", () => {
    test("alert defaults match EXTENSION_DEFAULT_CONFIG", () => {
      const defaults = EXTENSION_DEFAULT_CONFIG.alerts;
      assert.strictEqual(defaults.usageThreshold.pollIntervalSeconds, 60);
      assert.strictEqual(defaults.maxModeDetection.enabled, true);
      assert.strictEqual(defaults.maxModeDetection.notificationMode, "modal");
      assert.strictEqual(defaults.spendingGuard.enabled, true);
      assert.strictEqual(defaults.spendingGuard.costThreshold, 20);
      assert.strictEqual(defaults.spendingGuard.notificationMode, "modal");
    });

    test("tips defaults match EXTENSION_DEFAULT_CONFIG", () => {
      const defaults = EXTENSION_DEFAULT_CONFIG.tips;
      assert.strictEqual(defaults.showOnStartup, false);
      assert.ok(
        defaults.gistUrl.includes("githubusercontent.com"),
        "gistUrl should default to a GitHub URL.",
      );
    });
  });
});
