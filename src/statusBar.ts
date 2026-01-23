import * as vscode from "vscode";

import { getModelUsage } from "./api";
import {
  StatusBarDisplayMode,
  StatusBarPrimaryMetric,
  ThresholdSeverity,
} from "./constants";
import {
  type CursorCombinedUsage,
  type ExtensionConfig,
  type CursorUsageDetailsForModel,
  type ExtensionThresholdSeverity,
} from "./types";
import { calculateSeverity, formatCents, formatResetDateFull } from "./utils";

let statusBarItem: vscode.StatusBarItem | null = null;
let lastDisplayText: string = "";

/**
 * Creates and returns the status bar item.
 */
export const createStatusBarItem = () => {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "cursorUsageStats.showDetails";
  statusBarItem.show();

  return statusBarItem;
};

/**
 * Gets the current severity for included requests.
 */
export const getIncludedRequestSeverity = (
  modelUsage: CursorUsageDetailsForModel | null,
  config: ExtensionConfig,
): ExtensionThresholdSeverity => {
  if (!modelUsage || modelUsage.maxRequestUsage === null) {
    return ThresholdSeverity.Normal;
  }

  const percent = (modelUsage.numRequests / modelUsage.maxRequestUsage) * 100;

  return calculateSeverity(
    percent,
    config.alerts.includedRequestUsage.warningPercentageThresholds,
    config.alerts.includedRequestUsage.criticalPercentageThresholds,
  );
};

/**
 * Gets the current severity for on-demand usage.
 */
export const getOnDemandSeverity = (
  data: CursorCombinedUsage,
  config: ExtensionConfig,
): ExtensionThresholdSeverity => {
  const onDemand = data.summary.individualUsage.onDemand;

  if (!onDemand.enabled || onDemand.limit === 0) {
    return ThresholdSeverity.Normal;
  }

  const percent = (onDemand.used / onDemand.limit) * 100;

  return calculateSeverity(
    percent,
    config.alerts.onDemandUsage.warningPercentageThresholds,
    config.alerts.onDemandUsage.criticalPercentageThresholds,
  );
};

/**
 * Applies severity color to the status bar.
 */
export const applyStatusBarColor = (severity: ExtensionThresholdSeverity) => {
  if (!statusBarItem) {
    return;
  }

  switch (severity) {
    case ThresholdSeverity.Critical:
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
      break;
    case ThresholdSeverity.Warning:
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground",
      );
      break;
    default:
      statusBarItem.backgroundColor = undefined;
  }
};

/**
 * Updates the status bar with current usage data.
 */
export const updateStatusBar = (
  data: CursorCombinedUsage,
  config: ExtensionConfig,
) => {
  if (!statusBarItem) {
    return;
  }

  const modelUsage = getModelUsage(
    data.usage,
    config.api.includedRequestModelKey,
  );
  const onDemand = data.summary.individualUsage.onDemand;

  const parts: string[] = [];
  const { displayMode } = config.statusBar;

  // Request usage from /api/usage.
  if (
    (displayMode === StatusBarDisplayMode.Both ||
      displayMode === StatusBarDisplayMode.Requests) &&
    modelUsage &&
    modelUsage.maxRequestUsage !== null
  ) {
    parts.push(`${modelUsage.numRequests}/${modelUsage.maxRequestUsage}`);
  }

  // On-demand from /api/usage-summary.
  if (
    (displayMode === StatusBarDisplayMode.Both ||
      displayMode === StatusBarDisplayMode.OnDemand) &&
    onDemand.enabled
  ) {
    parts.push(`${formatCents(onDemand.used)}/${formatCents(onDemand.limit)}`);
  }

  if (parts.length === 0) {
    lastDisplayText = "Cursor Usage Stats";
  } else {
    lastDisplayText = parts.join(" | ");
  }

  statusBarItem.text = `$(graph) ${lastDisplayText}`;

  // Apply color based on primaryMetric.
  const severity =
    config.statusBar.primaryMetric === StatusBarPrimaryMetric.IncludedRequest
      ? getIncludedRequestSeverity(modelUsage, config)
      : getOnDemandSeverity(data, config);

  applyStatusBarColor(severity);

  statusBarItem.tooltip = buildTooltip(data, config);
};

/**
 * Builds detailed tooltip for the status bar item.
 */
export const buildTooltip = (
  data: CursorCombinedUsage,
  config: ExtensionConfig,
) => {
  const modelUsage = getModelUsage(
    data.usage,
    config.api.includedRequestModelKey,
  );
  const onDemand = data.summary.individualUsage.onDemand;
  const resetDate = formatResetDateFull(data.summary.billingCycleEnd);

  const lines: string[] = ["Cursor Usage Stats", "───────────────"];

  // Request usage.
  if (modelUsage) {
    if (modelUsage.maxRequestUsage !== null) {
      lines.push(
        `Requests: ${modelUsage.numRequests} / ${modelUsage.maxRequestUsage}`,
      );
    } else {
      lines.push(`Requests: ${modelUsage.numRequests} (unlimited)`);
    }
  }

  // On-demand usage.
  if (onDemand.enabled) {
    lines.push(
      `On-Demand: ${formatCents(onDemand.used)} / ${formatCents(onDemand.limit)}`,
    );
  }

  lines.push("───────────────");
  lines.push(`Resets: ${resetDate}`);
  lines.push("");
  lines.push("Click for details");

  return lines.join("\n");
};

/**
 * Sets the status bar to show an error state.
 */
export const setStatusBarError = (message: string) => {
  if (!statusBarItem) {
    return;
  }

  statusBarItem.text = `$(error) Cursor Usage Stats`;
  statusBarItem.tooltip = `Error: ${message}`;
  statusBarItem.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.errorBackground",
  );
};

/**
 * Sets the status bar to show a loading state.
 * Keeps the last displayed values and shows a subtle spinner.
 */
export const setStatusBarLoading = () => {
  if (!statusBarItem) {
    return;
  }

  // Keep values visible, just swap icon to subtle spinner.
  const displayText = lastDisplayText || "Cursor Usage Stats";
  statusBarItem.text = `$(sync~spin) ${displayText}`;
};

/**
 * Disposes of the status bar item.
 */
export const disposeStatusBar = () => {
  statusBarItem?.dispose();
  statusBarItem = null;
};

// #region Test helpers

/**
 * Gets the current status bar item.
 */
export const getStatusBarItem = () => {
  return statusBarItem;
};

// #endregion
