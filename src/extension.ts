import * as vscode from "vscode";

import {
  checkAllThresholds,
  markExceededThresholdsAsTriggered,
  resetTriggeredThresholds,
  showUsageSummaryNotification,
} from "./alerts";
import { fetchCombinedUsage } from "./api";
import {
  EXTENSION_DEFAULT_CONFIG,
  StatusBarDisplayMode,
  StatusBarPrimaryMetric,
} from "./constants";
import { isSqliteAvailable, promptSqliteInstall } from "./sqlite";
import {
  createStatusBarItem,
  updateStatusBar,
  setStatusBarError,
  setStatusBarLoading,
  disposeStatusBar,
} from "./statusBar";
import {
  type ExtensionConfig,
  type ExtensionStatusBarDisplayMode,
  type ExtensionStatusBarPrimaryMetric,
  type ExtensionAlertThresholds,
} from "./types";
import { validateThresholds } from "./utils";

let pollInterval: NodeJS.Timeout | null = null;
let lastBillingCycleEnd: string | null = null;
let isFirstLoad = true;

/**
 * Reads extension configuration from VS Code settings with fallback to defaults.
 */
export const getConfig = (): ExtensionConfig => {
  const config = vscode.workspace.getConfiguration("cursorUsageStats");

  const notifyOnStartup = config.get<boolean>("notifyOnStartup");
  const pollIntervalSeconds = config.get<number>("pollIntervalSeconds");
  const displayMode = config.get<ExtensionStatusBarDisplayMode>(
    "statusBar.displayMode",
  );
  const primaryMetric = config.get<ExtensionStatusBarPrimaryMetric>(
    "statusBar.primaryMetric",
  );
  const includedRequestModelKey = config.get<string>(
    "api.includedRequestModelKey",
  );

  // Validate display mode.
  const validDisplayModes = Object.values(StatusBarDisplayMode);
  const safeDisplayMode = validDisplayModes.includes(
    displayMode as ExtensionStatusBarDisplayMode,
  )
    ? (displayMode as ExtensionStatusBarDisplayMode)
    : EXTENSION_DEFAULT_CONFIG.statusBar.displayMode;

  // Validate primary metric.
  const validPrimaryMetrics = Object.values(StatusBarPrimaryMetric);
  const safePrimaryMetric = validPrimaryMetrics.includes(
    primaryMetric as ExtensionStatusBarPrimaryMetric,
  )
    ? (primaryMetric as ExtensionStatusBarPrimaryMetric)
    : EXTENSION_DEFAULT_CONFIG.statusBar.primaryMetric;

  // Validate thresholds.
  const includedRequestUsage: ExtensionAlertThresholds = {
    warningPercentageThresholds: validateThresholds(
      config.get("alerts.includedRequestUsage.warningPercentageThresholds"),
      EXTENSION_DEFAULT_CONFIG.alerts.includedRequestUsage
        .warningPercentageThresholds,
    ),
    criticalPercentageThresholds: validateThresholds(
      config.get("alerts.includedRequestUsage.criticalPercentageThresholds"),
      EXTENSION_DEFAULT_CONFIG.alerts.includedRequestUsage
        .criticalPercentageThresholds,
    ),
  };

  const onDemandUsage: ExtensionAlertThresholds = {
    warningPercentageThresholds: validateThresholds(
      config.get("alerts.onDemandUsage.warningPercentageThresholds"),
      EXTENSION_DEFAULT_CONFIG.alerts.onDemandUsage.warningPercentageThresholds,
    ),
    criticalPercentageThresholds: validateThresholds(
      config.get("alerts.onDemandUsage.criticalPercentageThresholds"),
      EXTENSION_DEFAULT_CONFIG.alerts.onDemandUsage
        .criticalPercentageThresholds,
    ),
  };

  return {
    notifyOnStartup:
      typeof notifyOnStartup === "boolean"
        ? notifyOnStartup
        : EXTENSION_DEFAULT_CONFIG.notifyOnStartup,
    pollIntervalSeconds:
      typeof pollIntervalSeconds === "number" && pollIntervalSeconds > 0
        ? pollIntervalSeconds
        : EXTENSION_DEFAULT_CONFIG.pollIntervalSeconds,
    statusBar: {
      displayMode: safeDisplayMode,
      primaryMetric: safePrimaryMetric,
    },
    api: {
      includedRequestModelKey:
        typeof includedRequestModelKey === "string" &&
        includedRequestModelKey.length > 0
          ? includedRequestModelKey
          : EXTENSION_DEFAULT_CONFIG.api.includedRequestModelKey,
    },
    alerts: {
      includedRequestUsage,
      onDemandUsage,
    },
  };
};

/**
 * Starts the polling interval.
 */
export const startPolling = () => {
  const config = getConfig();
  const intervalMs = config.pollIntervalSeconds * 1000;

  if (pollInterval) {
    clearInterval(pollInterval);
  }

  pollInterval = setInterval(refreshUsage, intervalMs);

  console.log("[Cursor Usage Stats] Poll started.");
};

/**
 * Refreshes usage and restarts the polling interval.
 */
export const refreshAndResetPoll = async () => {
  startPolling();
  await refreshUsage();

  console.log("[Cursor Usage Stats] Poll restarted.");
};

/**
 * Fetches usage and updates UI.
 */
export const refreshUsage = async () => {
  const config = getConfig();

  setStatusBarLoading();

  try {
    const data = await fetchCombinedUsage();

    // Reset thresholds on new billing cycle.
    if (
      lastBillingCycleEnd &&
      lastBillingCycleEnd !== data.summary.billingCycleEnd
    ) {
      resetTriggeredThresholds();
    }
    lastBillingCycleEnd = data.summary.billingCycleEnd;

    updateStatusBar(data, config);

    // On first load, mark exceeded thresholds as triggered to avoid spam.
    // Only show new threshold alerts going forward.
    if (isFirstLoad) {
      markExceededThresholdsAsTriggered(data, config);

      if (config.notifyOnStartup) {
        showDetails();
      }

      isFirstLoad = false;

      return;
    }

    // Check thresholds for alerts (not on first load).
    checkAllThresholds(data, config, refreshAndResetPoll);

    console.log("[Cursor Usage Stats] Usage refreshed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    setStatusBarError(message);
    console.error("[Cursor Usage Stats]", error);
  }
};

/**
 * Shows detailed usage information in a modal and re-opens after refresh.
 */
export const showDetails = async () => {
  const config = getConfig();

  try {
    const data = await fetchCombinedUsage();

    showUsageSummaryNotification(data, config, async () => {
      await refreshAndResetPoll();
      // Re-open the details modal after refresh.
      showDetails();
    });

    console.log("[Cursor Usage Stats] Details shown.");
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to fetch usage: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Extension activation.
 */
export const activate = (context: vscode.ExtensionContext) => {
  console.log("[Cursor Usage Stats] Activating...");

  // Check for sqlite3 dependency.
  if (!isSqliteAvailable()) {
    promptSqliteInstall();

    return;
  }

  // Create status bar.
  const statusBar = createStatusBarItem();
  context.subscriptions.push(statusBar);

  // Register commands.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cursorUsageStats.refresh",
      refreshAndResetPoll,
    ),
    vscode.commands.registerCommand(
      "cursorUsageStats.showDetails",
      showDetails,
    ),
  );

  // Listen for config changes.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("cursorUsageStats")) {
        startPolling();
        refreshUsage();
      }
    }),
  );

  // Initial fetch and start polling.
  refreshUsage();
  startPolling();

  console.log("[Cursor Usage Stats] Activated.");
};

/**
 * Extension deactivation.
 */
export const deactivate = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  disposeStatusBar();

  console.log("[Cursor Usage Stats] Deactivated.");
};
