import * as vscode from "vscode";

import { fetchTips } from "./fetchTips";
import { type Tip, TipCategory } from "./types";

/** Category display labels. */
const CATEGORY_LABELS = {
  [TipCategory.Cursor]: "Cursor",
  [TipCategory.AiGeneral]: "AI General",
  [TipCategory.Productivity]: "Productivity",
} as const;

/**
 * Shows a Quick Pick menu with all available tips.
 */
export const showTips = async (gistUrl?: string) => {
  const tips = await fetchTips(gistUrl);

  const items = tips.map((tip) => {
    return {
      label: `$(lightbulb) ${tip.title}`,
      description: CATEGORY_LABELS[tip.category] || tip.category,
      detail: tip.description,
    };
  });

  await vscode.window.showQuickPick(items, {
    placeHolder: "AI Tips & Tricks",
    matchOnDescription: true,
    matchOnDetail: true,
  });
};

/**
 * Shows a random tip as an information notification.
 */
export const showRandomTip = async (gistUrl?: string) => {
  const tips = await fetchTips(gistUrl);
  const tip = tips[Math.floor(Math.random() * tips.length)];

  if (!tip) {
    return;
  }

  const selection = await vscode.window.showInformationMessage(
    `💡 ${tip.title}: ${tip.description}`,
    "More Tips",
    "Dismiss",
  );

  if (selection === "More Tips") {
    showTips(gistUrl);
  }
};

// Re-export for convenience.
export type { Tip };
