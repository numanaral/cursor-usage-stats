import * as assert from "assert";

import DEFAULT_TIPS from "../../src/tips/defaultTips.json";
import { clearTipsCache } from "../../src/tips/fetchTips";
import { type Tip, TipCategory } from "../../src/tips/types";

suite("Tips", () => {
  setup(() => {
    clearTipsCache();
  });

  suite("DEFAULT_TIPS", () => {
    test("contains tips", () => {
      assert.ok(DEFAULT_TIPS.length > 0);
    });

    test("all tips have required fields", () => {
      for (const tip of DEFAULT_TIPS) {
        assert.ok(tip.title, `Tip missing title`);
        assert.ok(tip.description, `Tip missing description`);
        assert.ok(tip.category, `Tip missing category`);
      }
    });

    test("all tips have valid categories", () => {
      const validCategories: string[] = Object.values(TipCategory);

      for (const tip of DEFAULT_TIPS) {
        assert.ok(
          validCategories.includes(tip.category),
          `Invalid category "${tip.category}" for tip "${tip.title}".`,
        );
      }
    });

    test("contains tips from all categories", () => {
      const categories = new Set<string>(
        DEFAULT_TIPS.map((t) => t.category),
      );

      assert.ok(categories.has(TipCategory.Cursor), "Missing cursor tips.");
      assert.ok(
        categories.has(TipCategory.AiGeneral),
        "Missing AI general tips.",
      );
      assert.ok(
        categories.has(TipCategory.Productivity),
        "Missing productivity tips.",
      );
    });
  });

  suite("TipCategory", () => {
    test("has expected values", () => {
      assert.strictEqual(TipCategory.Cursor, "cursor");
      assert.strictEqual(TipCategory.AiGeneral, "ai-general");
      assert.strictEqual(TipCategory.Productivity, "productivity");
    });
  });

  suite("clearTipsCache", () => {
    test("can be called without error", () => {
      // Should not throw.
      clearTipsCache();
      clearTipsCache();
    });
  });

  suite("Tip structure", () => {
    test("tip interface shape is valid", () => {
      const tip: Tip = {
        title: "Test",
        description: "Test description.",
        category: "cursor",
      };

      assert.strictEqual(tip.title, "Test");
      assert.strictEqual(tip.description, "Test description.");
      assert.strictEqual(tip.category, "cursor");
    });
  });
});
