import * as vscode from "vscode";
import * as assert from "assert";

import { EXTENSION_DEFAULT_CONFIG } from "../../../src/constants";
import DEFAULT_TIPS from "../../../src/tips/defaultTips.json";
import { clearTipsCache, fetchTips } from "../../../src/tips/fetchTips";
import { showRandomTip, showTips } from "../../../src/tips/tips";
import { TipCategory } from "../../../src/tips/types";
import { IS_SLOW_MODE, sleep, UI_PAUSE_MS } from "../../utils";

/**
 * Integration tests for the tips feature.
 *
 * These tests trigger real VS Code Quick Picks and
 * information notifications via `showTips` and
 * `showRandomTip`.
 */
suite("Integration - Tips", () => {
  setup(() => {
    clearTipsCache();
  });

  teardown(() => {
    clearTipsCache();
  });

  suite("Commands", () => {
    test("tips command is registered", async () => {
      // Allow async activate() to finish registering commands.
      await sleep(IS_SLOW_MODE ? 500 : 50);

      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("cursorUsageStats.tips"),
        "cursorUsageStats.tips command should be registered.",
      );

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Default Tips Data", () => {
    test("DEFAULT_TIPS has tips in all categories", async () => {
      const categories = DEFAULT_TIPS.map((t) => t.category);
      assert.ok(
        categories.includes(TipCategory.Cursor),
        "Should have Cursor tips.",
      );
      assert.ok(
        categories.includes(TipCategory.AiGeneral),
        "Should have AI General tips.",
      );
      assert.ok(
        categories.includes(TipCategory.Productivity),
        "Should have Productivity tips.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("each tip has title and description", async () => {
      for (const tip of DEFAULT_TIPS) {
        assert.ok(tip.title.length > 0, "Tip should have a title.");
        assert.ok(tip.description.length > 0, "Tip should have a description.");
      }

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Fetch Tips", () => {
    test("falls back to defaults with empty gist URL", async () => {
      const tips = await fetchTips("");
      assert.strictEqual(
        tips.length,
        DEFAULT_TIPS.length,
        "Should return default tips when gist URL is empty.",
      );

      await sleep(UI_PAUSE_MS);
    });

    test("caches tips after first fetch", async () => {
      const first = await fetchTips("");
      const second = await fetchTips("");
      assert.strictEqual(first, second, "Should return same cached reference.");

      await sleep(UI_PAUSE_MS);
    });

    test("clearTipsCache allows re-fetch", async () => {
      const first = await fetchTips("");
      clearTipsCache();
      const second = await fetchTips("");
      assert.strictEqual(
        first.length,
        second.length,
        "Should return same number of tips after cache clear.",
      );

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Show Tips UI", () => {
    test("showRandomTip shows an information notification", async () => {
      // Triggers vscode.window.showInformationMessage with a random tip.
      // The notification will be visible in slow mode.
      showRandomTip("");

      await sleep(UI_PAUSE_MS);
    });

    test("showTips opens a Quick Pick with all tips", async () => {
      // Triggers vscode.window.showQuickPick with all tips.
      // The Quick Pick will be visible in slow mode.
      // Note: Quick Pick auto-dismisses in test environment.
      showTips("");

      await sleep(UI_PAUSE_MS);
    });
  });

  suite("Configuration Defaults", () => {
    test("showOnStartup defaults to false", () => {
      assert.strictEqual(EXTENSION_DEFAULT_CONFIG.tips.showOnStartup, false);
    });

    test("gistUrl defaults to the official gist URL", () => {
      assert.ok(
        EXTENSION_DEFAULT_CONFIG.tips.gistUrl.includes(
          "gist.githubusercontent.com",
        ),
        "gistUrl should default to the official gist URL.",
      );
    });

    test("tips configuration section exists", async () => {
      const config = vscode.workspace.getConfiguration("cursorUsageStats");
      const value = config.get<boolean>("tips.showOnStartup");
      assert.ok(
        value === false || value === undefined,
        "Tips showOnStartup should default to false.",
      );

      await sleep(UI_PAUSE_MS);
    });
  });
});
