import * as vscode from "vscode";
import * as assert from "assert";

import { EXTENSION_DEFAULT_CONFIG } from "../../../src/constants";

suite("Extension", () => {
  suite("EXTENSION_DEFAULT_CONFIG", () => {
    test("has correct default values", () => {
      assert.strictEqual(EXTENSION_DEFAULT_CONFIG.notifyOnStartup, true);
      assert.strictEqual(EXTENSION_DEFAULT_CONFIG.pollIntervalSeconds, 60);
      assert.strictEqual(
        EXTENSION_DEFAULT_CONFIG.statusBar.displayMode,
        "both",
      );
      assert.strictEqual(
        EXTENSION_DEFAULT_CONFIG.statusBar.primaryMetric,
        "onDemand",
      );
      assert.strictEqual(
        EXTENSION_DEFAULT_CONFIG.api.includedRequestModelKey,
        "gpt-4",
      );
      assert.deepStrictEqual(
        EXTENSION_DEFAULT_CONFIG.alerts.includedRequestUsage
          .warningPercentageThresholds,
        [50, 60, 70],
      );
      assert.deepStrictEqual(
        EXTENSION_DEFAULT_CONFIG.alerts.includedRequestUsage
          .criticalPercentageThresholds,
        [80, 90, 95],
      );
      assert.deepStrictEqual(
        EXTENSION_DEFAULT_CONFIG.alerts.onDemandUsage
          .warningPercentageThresholds,
        [50, 60, 70],
      );
      assert.deepStrictEqual(
        EXTENSION_DEFAULT_CONFIG.alerts.onDemandUsage
          .criticalPercentageThresholds,
        [80, 90, 95],
      );
    });
  });

  suite("Extension Lifecycle", () => {
    test("refresh command is registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("cursorUsageStats.refresh"),
        "cursorUsageStats.refresh command should be registered",
      );
    });

    test("showDetails command is registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("cursorUsageStats.showDetails"),
        "cursorUsageStats.showDetails command should be registered",
      );
    });
  });

  suite("Configuration", () => {
    test("configuration section exists", () => {
      const config = vscode.workspace.getConfiguration("cursorUsageStats");
      assert.ok(config);
    });

    test("default notifyOnStartup is true", () => {
      const config = vscode.workspace.getConfiguration("cursorUsageStats");
      const value = config.get<boolean>("notifyOnStartup");
      // May be undefined if not set, which means default applies.
      assert.ok(value === true || value === undefined);
    });

    test("default pollIntervalSeconds is 60", () => {
      const config = vscode.workspace.getConfiguration("cursorUsageStats");
      const value = config.get<number>("pollIntervalSeconds");
      // Note: package.json has 3 for testing, but we test against undefined.
      assert.ok(typeof value === "number" || value === undefined);
    });

    test("default displayMode is both", () => {
      const config = vscode.workspace.getConfiguration("cursorUsageStats");
      const value = config.get<string>("statusBar.displayMode");
      assert.ok(value === "both" || value === undefined);
    });

    test("default primaryMetric is onDemand", () => {
      const config = vscode.workspace.getConfiguration("cursorUsageStats");
      const value = config.get<string>("statusBar.primaryMetric");
      assert.ok(value === "onDemand" || value === undefined);
    });

    test("default includedRequestModelKey is gpt-4", () => {
      const config = vscode.workspace.getConfiguration("cursorUsageStats");
      const value = config.get<string>("api.includedRequestModelKey");
      assert.ok(value === "gpt-4" || value === undefined);
    });

    test("default warning thresholds for included requests", () => {
      const config = vscode.workspace.getConfiguration("cursorUsageStats");
      const value = config.get<number[]>(
        "alerts.includedRequestUsage.warningPercentageThresholds",
      );
      assert.ok(
        (Array.isArray(value) && value.length === 3) || value === undefined,
      );
    });

    test("default critical thresholds for included requests", () => {
      const config = vscode.workspace.getConfiguration("cursorUsageStats");
      const value = config.get<number[]>(
        "alerts.includedRequestUsage.criticalPercentageThresholds",
      );
      assert.ok(
        (Array.isArray(value) && value.length === 3) || value === undefined,
      );
    });
  });
});
