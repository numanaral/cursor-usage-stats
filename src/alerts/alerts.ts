import * as vscode from "vscode";

import { getModelUsage } from "../api";
import { StatusBarPrimaryMetric, ThresholdSeverity } from "../constants";
import { getIncludedRequestSeverity, getOnDemandSeverity } from "../statusBar";
import {
  type ExtensionAlertThresholds,
  type CursorCombinedUsage,
  type ExtensionConfig,
  type ExtensionThresholdSeverity,
  type ExtensionNotificationRecord,
} from "../types";
import { formatCents, formatResetDateFull } from "../utils";
import {
  getTriggeredIncludedRequestThresholds,
  getTriggeredOnDemandThresholds,
} from "./utils";

/** Tracks notifications shown. Used only for testing. */
let notificationHistory: ExtensionNotificationRecord[] | null = null;

/**
 * Shows a toast notification with the appropriate severity.
 */
export const showNotification = (
  message: string,
  severity: ExtensionThresholdSeverity,
): Thenable<string | undefined> => {
  // Keep track of notifications. Used only for testing.
  if (notificationHistory) {
    notificationHistory.push({ message, severity, timestamp: Date.now() });
  }

  if (severity === ThresholdSeverity.Critical) {
    return vscode.window.showErrorMessage(message, "Refresh", "Open Dashboard");
  }

  if (severity === ThresholdSeverity.Warning) {
    return vscode.window.showWarningMessage(
      message,
      "Refresh",
      "Open Dashboard",
    );
  }

  return vscode.window.showInformationMessage(
    message,
    "Refresh",
    "Open Dashboard",
  );
};

/**
 * Handles notification button selection.
 */
export const handleNotificationSelection = (
  selection: string | undefined,
  onRefresh: () => void,
) => {
  if (selection === "Refresh") {
    onRefresh();
  } else if (selection === "Open Dashboard") {
    vscode.env.openExternal(
      vscode.Uri.parse("https://cursor.com/dashboard?tab=usage"),
    );
  }
};

interface ThresholdCheckParams {
  currentPercent: number;
  thresholds: ExtensionAlertThresholds;
  triggeredSet: Set<number>;
  formatMessage: (actualPercent: number, thresholdValue: number) => string;
  onRefresh: () => void;
}

/**
 * Checks usage against thresholds and shows alert for the highest newly-crossed threshold.
 */
const checkThresholds = ({
  currentPercent,
  thresholds,
  triggeredSet,
  formatMessage,
  onRefresh,
}: ThresholdCheckParams) => {
  const allThresholds = [
    ...thresholds.warningPercentageThresholds.map((t) => {
      return { value: t, severity: ThresholdSeverity.Warning };
    }),
    ...thresholds.criticalPercentageThresholds.map((t) => {
      return { value: t, severity: ThresholdSeverity.Critical };
    }),
  ];

  // Sort descending to find highest threshold first.
  allThresholds.sort((a, b) => b.value - a.value);

  // Find the highest newly-crossed threshold.
  for (const threshold of allThresholds) {
    if (
      currentPercent >= threshold.value &&
      !triggeredSet.has(threshold.value)
    ) {
      // Mark all thresholds at or below this one as triggered.
      for (const t of allThresholds) {
        if (t.value <= threshold.value) {
          triggeredSet.add(t.value);
        }
      }

      const actualPercent = Math.round(currentPercent);
      const message = formatMessage(actualPercent, threshold.value);

      showNotification(message, threshold.severity).then((selection) => {
        handleNotificationSelection(selection, onRefresh);
      });

      // Only show one notification.
      break;
    }
  }
};

/**
 * Checks included request usage against thresholds and shows alerts if needed.
 */
export const checkIncludedRequestThresholds = (
  data: CursorCombinedUsage,
  config: ExtensionConfig,
  onRefresh: () => void,
) => {
  const modelUsage = getModelUsage(
    data.usage,
    config.api.includedRequestModelKey,
  );

  if (!modelUsage || modelUsage.maxRequestUsage === null) {
    return;
  }

  checkThresholds({
    currentPercent: (modelUsage.numRequests / modelUsage.maxRequestUsage) * 100,
    thresholds: config.alerts.includedRequestUsage,
    triggeredSet: getTriggeredIncludedRequestThresholds(),
    formatMessage: (actualPercent, thresholdValue) => {
      return `Requests: ${modelUsage.numRequests}/${modelUsage.maxRequestUsage} (${actualPercent}%) - Passed ${thresholdValue}% threshold`;
    },
    onRefresh,
  });
};

/**
 * Checks on-demand usage against thresholds and shows alerts if needed.
 */
export const checkOnDemandThresholds = (
  data: CursorCombinedUsage,
  config: ExtensionConfig,
  onRefresh: () => void,
) => {
  const onDemand = data.summary.individualUsage.onDemand;

  if (!onDemand.enabled || onDemand.limit === 0) {
    return;
  }

  checkThresholds({
    currentPercent: (onDemand.used / onDemand.limit) * 100,
    thresholds: config.alerts.onDemandUsage,
    triggeredSet: getTriggeredOnDemandThresholds(),
    formatMessage: (actualPercent, thresholdValue) => {
      return `On-Demand: ${formatCents(onDemand.used)}/${formatCents(onDemand.limit)} (${actualPercent}%) - Passed ${thresholdValue}% threshold`;
    },
    onRefresh,
  });
};

/**
 * Checks all thresholds for both included requests and on-demand usage.
 */
export const checkAllThresholds = (
  data: CursorCombinedUsage,
  config: ExtensionConfig,
  onRefresh: () => void,
) => {
  checkIncludedRequestThresholds(data, config, onRefresh);
  checkOnDemandThresholds(data, config, onRefresh);
};

/**
 * Shows a notification with current usage summary.
 */
export const showUsageSummaryNotification = (
  data: CursorCombinedUsage,
  config: ExtensionConfig,
  onRefresh: () => void,
) => {
  const modelUsage = getModelUsage(
    data.usage,
    config.api.includedRequestModelKey,
  );
  const onDemand = data.summary.individualUsage.onDemand;
  const resetDate = formatResetDateFull(data.summary.billingCycleEnd);

  const parts: string[] = [];

  if (modelUsage) {
    if (modelUsage.maxRequestUsage !== null) {
      parts.push(
        `Requests: ${modelUsage.numRequests} / ${modelUsage.maxRequestUsage}`,
      );
    } else {
      parts.push(`Requests: ${modelUsage.numRequests} (unlimited)`);
    }
  }

  if (onDemand.enabled) {
    parts.push(
      `On-Demand: ${formatCents(onDemand.used)} / ${formatCents(onDemand.limit)}`,
    );
  }

  parts.push(`Resets: ${resetDate}`);

  const message = parts.join(" | ");

  // Determine severity based on primaryMetric.
  const severity =
    config.statusBar.primaryMetric === StatusBarPrimaryMetric.IncludedRequest
      ? getIncludedRequestSeverity(modelUsage, config)
      : getOnDemandSeverity(data, config);

  showNotification(message, severity).then((selection) => {
    handleNotificationSelection(selection, onRefresh);
  });
};

// #region Test helpers

/**
 * Sets notification tracking state (for testing).
 * Pass true in test setup, false in teardown.
 */
export const setNotificationTracking = (enabled: boolean) => {
  notificationHistory = enabled ? [] : null;
};

/**
 * Gets notification history (only available when tracking enabled).
 */
export const getNotificationHistory = () => {
  return notificationHistory ?? [];
};

// #endregion
