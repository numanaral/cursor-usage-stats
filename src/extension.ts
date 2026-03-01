import * as vscode from "vscode";

import {
  checkAllThresholds,
  checkMaxModeDetection,
  checkSpendingGuard,
  fetchRecentEvents,
  getMaxModeLastCheckedDate,
  getSpendingGuardLastCheckedDate,
  isMaxModeIgnoredForSession,
  isMaxModeNotificationPending,
  isSpendingGuardIgnoredForSession,
  isSpendingGuardNotificationPending,
  markExceededThresholdsAsTriggered,
  resetMaxModeDetectionState,
  setMaxModeLastCheckedDate,
  setSpendingGuardLastCheckedDate,
  resetSpendingGuardState,
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
import { configureSettingsWizard } from "./settingsWizard";
import { isSqliteAvailable, promptSqliteInstall } from "./sqlite";
import {
  createStatusBarItem,
  updateStatusBar,
  setStatusBarError,
  setStatusBarLoading,
  disposeStatusBar,
} from "./statusBar";
import { showTips, showRandomTip } from "./tips";
import {
  type ExtensionConfig,
  type ExtensionStatusBarDisplayMode,
  type ExtensionStatusBarTrackedMetric,
  type ExtensionAlertThresholds,
} from "./types";
import { validateThresholds } from "./utils";

/** Internal page size for events API calls. */
const EVENTS_PAGE_SIZE = 50;

let pollInterval: NodeJS.Timeout | null = null;
let alertPollInterval: NodeJS.Timeout | null = null;
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
 * Returns whether either MAX mode or spending guard is enabled.
 */
const isAlertPollingEnabled = (config: ExtensionConfig) => {
  return (
    config.alerts.maxModeDetection.enabled ||
    config.alerts.spendingGuard.enabled
  );
};

/**
 * Starts the alert polling interval (MAX mode + spending guard).
 *
 * Uses the minimum poll interval of the two features so
 * both get checked on time.
 */
export const startAlertPolling = () => {
  const config = getConfig();

  if (alertPollInterval) {
    clearInterval(alertPollInterval);
  }

  if (!isAlertPollingEnabled(config)) {
    console.log("[Cursor Usage Stats] Alert polling disabled.");

    return;
  }

  // Use the shortest poll interval so neither feature misses
  // its window.
  const intervalMs =
    Math.min(
      config.alerts.maxModeDetection.pollIntervalSeconds,
      config.alerts.spendingGuard.pollIntervalSeconds,
    ) * 1000;
  alertPollInterval = setInterval(refreshAlerts, intervalMs);

  console.log("[Cursor Usage Stats] Alert poll started.");
};

/**
 * Returns whether a given alert feature needs an event check.
 *
 * A feature needs checking when it is enabled, not ignored
 * for the session, not pending a notification response, and
 * not snoozed (lastCheckedDate in the future).
 */
const featureNeedsCheck = (
  enabled: boolean,
  ignored: boolean,
  pending: boolean,
  lastChecked: number,
) => {
  return enabled && !ignored && !pending && lastChecked <= Date.now();
};

/**
 * Fetches recent events and runs MAX mode + spending guard checks.
 *
 * Skips the API call entirely when neither feature needs
 * checking (pending, snoozed, ignored, or disabled).
 *
 * Each feature manages its own `lastCheckedDate`. The API
 * is called with the earliest of the two dates so both
 * features get the data they need.
 */
export const refreshAlerts = async () => {
  const config = getConfig();

  if (!isAlertPollingEnabled(config)) {
    return;
  }

  const maxModeReady = featureNeedsCheck(
    config.alerts.maxModeDetection.enabled,
    isMaxModeIgnoredForSession(),
    isMaxModeNotificationPending(),
    getMaxModeLastCheckedDate(),
  );
  const spendingReady = featureNeedsCheck(
    config.alerts.spendingGuard.enabled,
    isSpendingGuardIgnoredForSession(),
    isSpendingGuardNotificationPending(),
    getSpendingGuardLastCheckedDate(),
  );

  // Nothing to check -- skip the API call entirely.
  if (!maxModeReady && !spendingReady) {
    return;
  }

  const endDate = Date.now();

  try {
    // Use the earliest lastCheckedDate among features that
    // actually need checking.
    const candidates: number[] = [];
    if (maxModeReady) {
      candidates.push(getMaxModeLastCheckedDate());
    }
    if (spendingReady) {
      candidates.push(getSpendingGuardLastCheckedDate());
    }

    const startDate = Math.min(...candidates);

    const response = await fetchRecentEvents(
      startDate,
      endDate,
      EVENTS_PAGE_SIZE,
    );

    const events = response.usageEventsDisplay;

    checkMaxModeDetection(events, config.alerts);
    checkSpendingGuard(events, config.alerts);

    console.log("[Cursor Usage Stats] Alerts refreshed.");
  } catch (error) {
    // Advance checkpoints so a stale checkpoint doesn't
    // accumulate events across a long auth-failure gap and
    // fire a false alert when the API recovers.
    if (maxModeReady) {
      setMaxModeLastCheckedDate(endDate);
    }
    if (spendingReady) {
      setSpendingGuardLastCheckedDate(endDate);
    }

    console.error("[Cursor Usage Stats] Alerts error:", error);
  }
};

/**
 * Refreshes alerts and restarts the alert polling interval.
 */
export const refreshAndResetAlertPoll = async () => {
  startAlertPolling();
  await refreshAlerts();
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
      resetMaxModeDetectionState();
      resetSpendingGuardState();
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

      if (config.tips.showOnStartup) {
        setTimeout(() => showRandomTip(config.tips.gistUrl), 1500);
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
    vscode.commands.registerCommand(
      "cursorUsageStats.configureSettings",
      () => {
        return configureSettingsWizard();
      },
    ),
    vscode.commands.registerCommand("cursorUsageStats.tips", () => {
      const config = getConfig();

      return showTips(config.tips.gistUrl);
    }),
  );

  // Listen for config changes.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("cursorUsageStats")) {
        startPolling();
        startAlertPolling();
        refreshUsage();
      }
    }),
  );

  // Initial fetch and start polling.
  refreshUsage();
  startPolling();
  startAlertPolling();

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
  if (alertPollInterval) {
    clearInterval(alertPollInterval);
    alertPollInterval = null;
  }
  disposeStatusBar();

  console.log("[Cursor Usage Stats] Deactivated.");
};
