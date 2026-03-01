import * as vscode from "vscode";

import {
  checkAllThresholds,
  markExceededThresholdsAsTriggered,
  resetTriggeredThresholds,
  showUsageSummaryNotification,
} from "./alerts";
import { type NotificationModeType, NotificationMode } from "./alerts/types";
import { fetchCombinedUsage } from "./api";
import {
  EXTENSION_DEFAULT_CONFIG,
  StatusBarDisplayMode,
  StatusBarTrackedMetric,
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
  type ExtensionStatusBarTrackedMetric,
  type ExtensionAlertThresholds,
} from "./types";
import { validateThresholds } from "./utils";

let pollInterval: NodeJS.Timeout | null = null;
let lastBillingCycleEnd: string | null = null;
let isFirstLoad = true;

/**
 * Maps old configuration keys to their new equivalents.
 *
 * Used by `migrateSettings` to carry forward user values
 * when upgrading from an older version of the extension.
 */
const SETTINGS_MIGRATION_MAP: Record<string, string> = {
  notifyOnStartup: "showWelcomeMessage",
  pollIntervalSeconds: "alerts.usageThreshold.pollIntervalSeconds",
  "statusBar.displayMode": "alerts.usageThreshold.statusBar.displayMode",
  "statusBar.primaryMetric": "alerts.usageThreshold.statusBar.trackedMetric",
  "alerts.includedRequestUsage.warningPercentageThresholds":
    "alerts.usageThreshold.includedRequestUsage.warningPercentageThresholds",
  "alerts.includedRequestUsage.criticalPercentageThresholds":
    "alerts.usageThreshold.includedRequestUsage.criticalPercentageThresholds",
  "alerts.onDemandUsage.warningPercentageThresholds":
    "alerts.usageThreshold.onDemandUsage.warningPercentageThresholds",
  "alerts.onDemandUsage.criticalPercentageThresholds":
    "alerts.usageThreshold.onDemandUsage.criticalPercentageThresholds",
};

/**
 * Migrates old configuration keys to the new schema.
 *
 * Runs once per workspace. Reads old keys, writes non-default
 * values to the new keys, then clears the old keys.
 */
const migrateSettings = async (context: vscode.ExtensionContext) => {
  const config = vscode.workspace.getConfiguration("cursorUsageStats");

  // Skip if already migrated.
  if (context.globalState.get<boolean>("settingsMigrated")) {
    return;
  }

  let didMigrate = false;

  for (const [oldKey, newKey] of Object.entries(SETTINGS_MIGRATION_MAP)) {
    const inspected = config.inspect(oldKey);
    // Only migrate if the user explicitly set a value.
    const userValue = inspected?.globalValue ?? inspected?.workspaceValue;
    if (userValue === undefined) {
      continue;
    }

    const target =
      inspected?.workspaceValue !== undefined
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;

    await config.update(newKey, userValue, target);
    await config.update(oldKey, undefined, target);
    didMigrate = true;
  }

  // Mark as migrated.
  await context.globalState.update("settingsMigrated", true);

  if (didMigrate) {
    console.log("[Cursor Usage Stats] Settings migrated to new schema.");
  }
};

/**
 * Reads extension configuration from VS Code settings
 * with fallback to defaults.
 */
export const getConfig = (): ExtensionConfig => {
  const config = vscode.workspace.getConfiguration("cursorUsageStats");

  const showWelcomeMessage = config.get<boolean>("showWelcomeMessage");
  const usagePollSeconds = config.get<number>(
    "alerts.usageThreshold.pollIntervalSeconds",
  );
  const displayMode = config.get<ExtensionStatusBarDisplayMode>(
    "alerts.usageThreshold.statusBar.displayMode",
  );
  const trackedMetric = config.get<ExtensionStatusBarTrackedMetric>(
    "alerts.usageThreshold.statusBar.trackedMetric",
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
    : EXTENSION_DEFAULT_CONFIG.alerts.usageThreshold.statusBar.displayMode;

  // Validate tracked metric.
  const validTrackedMetrics = Object.values(StatusBarTrackedMetric);
  const safeTrackedMetric = validTrackedMetrics.includes(
    trackedMetric as ExtensionStatusBarTrackedMetric,
  )
    ? (trackedMetric as ExtensionStatusBarTrackedMetric)
    : EXTENSION_DEFAULT_CONFIG.alerts.usageThreshold.statusBar.trackedMetric;

  // Validate thresholds.
  const defaults = EXTENSION_DEFAULT_CONFIG.alerts.usageThreshold;
  const includedRequestUsage: ExtensionAlertThresholds = {
    warningPercentageThresholds: validateThresholds(
      config.get(
        "alerts.usageThreshold.includedRequestUsage" +
          ".warningPercentageThresholds",
      ),
      defaults.includedRequestUsage.warningPercentageThresholds,
    ),
    criticalPercentageThresholds: validateThresholds(
      config.get(
        "alerts.usageThreshold.includedRequestUsage" +
          ".criticalPercentageThresholds",
      ),
      defaults.includedRequestUsage.criticalPercentageThresholds,
    ),
  };

  const onDemandUsage: ExtensionAlertThresholds = {
    warningPercentageThresholds: validateThresholds(
      config.get(
        "alerts.usageThreshold.onDemandUsage" + ".warningPercentageThresholds",
      ),
      defaults.onDemandUsage.warningPercentageThresholds,
    ),
    criticalPercentageThresholds: validateThresholds(
      config.get(
        "alerts.usageThreshold.onDemandUsage" + ".criticalPercentageThresholds",
      ),
      defaults.onDemandUsage.criticalPercentageThresholds,
    ),
  };

  // MAX mode detection config.
  const maxModeEnabled = config.get<boolean>("alerts.maxModeDetection.enabled");
  const maxModeNotifMode = config.get<string>(
    "alerts.maxModeDetection.notificationMode",
  );
  const maxModePollSeconds = config.get<number>(
    "alerts.maxModeDetection.pollIntervalSeconds",
  );

  // Spending guard config.
  const spendingEnabled = config.get<boolean>("alerts.spendingGuard.enabled");
  const spendingNotifMode = config.get<string>(
    "alerts.spendingGuard.notificationMode",
  );
  const spendingPollSeconds = config.get<number>(
    "alerts.spendingGuard.pollIntervalSeconds",
  );
  const costThreshold = config.get<number>(
    "alerts.spendingGuard.costThreshold",
  );

  // Tips config.
  const tipsShowOnStartup = config.get<boolean>("tips.showOnStartup");
  const tipsGistUrl = config.get<string>("tips.gistUrl");

  // Validate notification mode values.
  const validModes = Object.values(NotificationMode);

  const safeMaxModeNotif = validModes.includes(
    maxModeNotifMode as NotificationModeType,
  )
    ? (maxModeNotifMode as NotificationModeType)
    : EXTENSION_DEFAULT_CONFIG.alerts.maxModeDetection.notificationMode;

  const safeSpendingNotif = validModes.includes(
    spendingNotifMode as NotificationModeType,
  )
    ? (spendingNotifMode as NotificationModeType)
    : EXTENSION_DEFAULT_CONFIG.alerts.spendingGuard.notificationMode;

  const dMaxMode = EXTENSION_DEFAULT_CONFIG.alerts.maxModeDetection;
  const dSpending = EXTENSION_DEFAULT_CONFIG.alerts.spendingGuard;

  return {
    showWelcomeMessage:
      typeof showWelcomeMessage === "boolean"
        ? showWelcomeMessage
        : EXTENSION_DEFAULT_CONFIG.showWelcomeMessage,
    api: {
      includedRequestModelKey:
        typeof includedRequestModelKey === "string" &&
        includedRequestModelKey.length > 0
          ? includedRequestModelKey
          : EXTENSION_DEFAULT_CONFIG.api.includedRequestModelKey,
    },
    alerts: {
      usageThreshold: {
        pollIntervalSeconds:
          Number(process.env.CURSOR_USAGE_STATS_POLL_INTERVAL) ||
          (typeof usagePollSeconds === "number" && usagePollSeconds > 0
            ? usagePollSeconds
            : defaults.pollIntervalSeconds),
        statusBar: {
          displayMode: safeDisplayMode,
          trackedMetric: safeTrackedMetric,
        },
        includedRequestUsage,
        onDemandUsage,
      },
      maxModeDetection: {
        enabled:
          typeof maxModeEnabled === "boolean"
            ? maxModeEnabled
            : dMaxMode.enabled,
        notificationMode: safeMaxModeNotif,
        pollIntervalSeconds:
          Number(process.env.CURSOR_USAGE_STATS_MAX_MODE_POLL_INTERVAL) ||
          (typeof maxModePollSeconds === "number" && maxModePollSeconds > 0
            ? maxModePollSeconds
            : dMaxMode.pollIntervalSeconds),
      },
      spendingGuard: {
        enabled:
          typeof spendingEnabled === "boolean"
            ? spendingEnabled
            : dSpending.enabled,
        notificationMode: safeSpendingNotif,
        pollIntervalSeconds:
          Number(process.env.CURSOR_USAGE_STATS_SPENDING_POLL_INTERVAL) ||
          (typeof spendingPollSeconds === "number" && spendingPollSeconds > 0
            ? spendingPollSeconds
            : dSpending.pollIntervalSeconds),
        costThreshold:
          typeof costThreshold === "number" && costThreshold > 0
            ? costThreshold
            : dSpending.costThreshold,
      },
    },
    tips: {
      showOnStartup:
        typeof tipsShowOnStartup === "boolean"
          ? tipsShowOnStartup
          : EXTENSION_DEFAULT_CONFIG.tips.showOnStartup,
      gistUrl:
        typeof tipsGistUrl === "string"
          ? tipsGistUrl
          : EXTENSION_DEFAULT_CONFIG.tips.gistUrl,
    },
  };
};

/**
 * Starts the usage polling interval.
 */
export const startPolling = () => {
  const config = getConfig();
  const intervalMs = config.alerts.usageThreshold.pollIntervalSeconds * 1000;

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

    // On first load, mark exceeded thresholds as triggered
    // to avoid spam. Only show new threshold alerts going
    // forward.
    if (isFirstLoad) {
      markExceededThresholdsAsTriggered(data, config);

      if (config.showWelcomeMessage) {
        showUsageSummaryNotification(data, config);
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
 * Shows detailed usage information in a notification.
 */
export const showDetails = async () => {
  const config = getConfig();

  try {
    const data = await fetchCombinedUsage();

    showUsageSummaryNotification(data, config);

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
export const activate = async (context: vscode.ExtensionContext) => {
  console.log("[Cursor Usage Stats] Activating...");

  // Migrate old settings to new schema.
  await migrateSettings(context);

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
