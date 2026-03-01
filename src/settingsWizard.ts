import * as vscode from "vscode";

/**
 * Updates a single extension setting globally.
 */
const updateSetting = async (key: string, value: unknown) => {
  const config = vscode.workspace.getConfiguration("cursorUsageStats");
  await config.update(key, value, vscode.ConfigurationTarget.Global);
};

/**
 * Returns a fresh config reference to avoid stale reads.
 */
const getConfig = () => vscode.workspace.getConfiguration("cursorUsageStats");

/**
 * Prompts for a number input and updates the setting.
 *
 * Returns true if the user entered a value, false if cancelled.
 */
const promptNumber = async (
  key: string,
  label: string,
  currentValue: number,
) => {
  const input = await vscode.window.showInputBox({
    prompt: label,
    value: String(currentValue),
    validateInput: (v) => {
      const n = Number(v);

      if (isNaN(n) || n <= 0) {
        return "Enter a positive number.";
      }

      return undefined;
    },
  });

  if (input !== undefined) {
    await updateSetting(key, Number(input));

    return true;
  }

  return false;
};

/**
 * Prompts for a boolean toggle and updates the setting.
 *
 * Returns true if the user selected a value, false if cancelled.
 */
const promptBoolean = async (
  key: string,
  label: string,
  currentValue: boolean,
) => {
  const choice = await vscode.window.showQuickPick(
    [
      { label: "Enable", value: true },
      { label: "Disable", value: false },
    ],
    { placeHolder: `${label} (currently: ${currentValue})` },
  );

  if (choice) {
    await updateSetting(key, choice.value);

    return true;
  }

  return false;
};

/**
 * Prompts for notification mode selection and updates the setting.
 *
 * Returns true if the user selected a value, false if cancelled.
 */
const promptNotificationMode = async (key: string, currentValue: string) => {
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: "Modal (blocking dialog)",
        value: "modal",
      },
      {
        label: "Toast (standard notification)",
        value: "toast",
      },
    ],
    {
      placeHolder: `Notification mode (currently: ${currentValue})`,
    },
  );

  if (choice) {
    await updateSetting(key, choice.value);

    return true;
  }

  return false;
};

/**
 * Prompts for a threshold array (comma-separated percentages).
 *
 * Returns true if the user entered a value, false if cancelled.
 */
const promptThresholdArray = async (key: string, label: string) => {
  const current = getConfig().get<number[]>(key) ?? [];
  const input = await vscode.window.showInputBox({
    prompt: `${label} (comma-separated, 0-100)`,
    value: current.join(", "),
    validateInput: (v) => {
      const nums = v.split(",").map((s) => Number(s.trim()));

      if (nums.some((n) => isNaN(n) || n < 0 || n > 100)) {
        return "Enter comma-separated numbers between 0-100.";
      }

      return undefined;
    },
  });

  if (input !== undefined) {
    const values = input
      .split(",")
      .map((s) => Number(s.trim()))
      .sort((a, b) => a - b);
    await updateSetting(key, values);

    return true;
  }

  return false;
};

// =========================================================================
// Category flows.
// =========================================================================

/** Configures general settings. */
const configureGeneral = async () => {
  const config = getConfig();
  await promptBoolean(
    "showWelcomeMessage",
    "Welcome message on startup",
    config.get("showWelcomeMessage") ?? true,
  );
};

/** Configures usage threshold settings. */
const configureUsageThreshold = async () => {
  const config = getConfig();
  await promptNumber(
    "alerts.usageThreshold.pollIntervalSeconds",
    "Usage poll interval in seconds",
    config.get("alerts.usageThreshold.pollIntervalSeconds") ?? 60,
  );

  const displayChoice = await vscode.window.showQuickPick(
    [
      { label: "Both", value: "both" },
      { label: "Requests only", value: "requests" },
      { label: "On-Demand only", value: "onDemand" },
    ],
    {
      placeHolder: `Status bar display mode (currently: ${config.get("alerts.usageThreshold.statusBar.displayMode")})`,
    },
  );

  if (displayChoice) {
    await updateSetting(
      "alerts.usageThreshold.statusBar.displayMode",
      displayChoice.value,
    );
  }

  const metricChoice = await vscode.window.showQuickPick(
    [
      { label: "On-Demand", value: "onDemand" },
      { label: "Included Requests", value: "includedRequest" },
    ],
    {
      placeHolder: `Tracked metric for status bar color (currently: ${config.get("alerts.usageThreshold.statusBar.trackedMetric")})`,
    },
  );

  if (metricChoice) {
    await updateSetting(
      "alerts.usageThreshold.statusBar.trackedMetric",
      metricChoice.value,
    );
  }

  await promptThresholdArray(
    "alerts.usageThreshold.includedRequestUsage" +
      ".warningPercentageThresholds",
    "Included Requests - Warning %",
  );

  await promptThresholdArray(
    "alerts.usageThreshold.includedRequestUsage" +
      ".criticalPercentageThresholds",
    "Included Requests - Critical %",
  );

  await promptThresholdArray(
    "alerts.usageThreshold.onDemandUsage" + ".warningPercentageThresholds",
    "On-Demand - Warning %",
  );

  await promptThresholdArray(
    "alerts.usageThreshold.onDemandUsage" + ".criticalPercentageThresholds",
    "On-Demand - Critical %",
  );
};

/** Configures MAX mode detection settings. */
const configureMaxModeDetection = async () => {
  const config = getConfig();
  await promptBoolean(
    "alerts.maxModeDetection.enabled",
    "MAX mode detection",
    config.get("alerts.maxModeDetection.enabled") ?? true,
  );

  await promptNotificationMode(
    "alerts.maxModeDetection.notificationMode",
    config.get("alerts.maxModeDetection.notificationMode") ?? "modal",
  );

  await promptNumber(
    "alerts.maxModeDetection.pollIntervalSeconds",
    "MAX mode poll interval in seconds",
    config.get("alerts.maxModeDetection.pollIntervalSeconds") ?? 300,
  );
};

/** Configures spending guard settings. */
const configureSpendingGuard = async () => {
  const config = getConfig();
  await promptBoolean(
    "alerts.spendingGuard.enabled",
    "Spending guard",
    config.get("alerts.spendingGuard.enabled") ?? true,
  );

  await promptNotificationMode(
    "alerts.spendingGuard.notificationMode",
    config.get("alerts.spendingGuard.notificationMode") ?? "modal",
  );

  await promptNumber(
    "alerts.spendingGuard.pollIntervalSeconds",
    "Spending guard poll interval in seconds",
    config.get("alerts.spendingGuard.pollIntervalSeconds") ?? 300,
  );

  await promptNumber(
    "alerts.spendingGuard.costThreshold",
    "Alert when spending exceeds this amount ($)",
    config.get("alerts.spendingGuard.costThreshold") ?? 20,
  );
};

/** Configures tips settings. */
const configureTips = async () => {
  const config = getConfig();
  await promptBoolean(
    "tips.showOnStartup",
    "Show random tip on startup",
    config.get("tips.showOnStartup") ?? true,
  );

  const input = await vscode.window.showInputBox({
    prompt: "Custom tips JSON URL (leave empty for defaults)",
    value: config.get<string>("tips.gistUrl") ?? "",
  });

  if (input !== undefined) {
    await updateSetting("tips.gistUrl", input);
  }
};

/** Configures API settings. */
const configureApi = async () => {
  const config = getConfig();
  const input = await vscode.window.showInputBox({
    prompt: "Model key for included requests in /api/usage",
    value: config.get<string>("api.includedRequestModelKey") ?? "gpt-4",
  });

  if (input !== undefined) {
    await updateSetting("api.includedRequestModelKey", input);
  }
};

// =========================================================================
// Main wizard entry point.
// =========================================================================

/**
 * Runs an interactive settings wizard via Quick Pick menus.
 *
 * Covers all extension settings: welcome message, usage
 * thresholds, status bar, MAX mode detection, spending
 * guard, tips, and API.
 *
 * "Configure All" walks through every setting in one pass.
 */
export const configureSettingsWizard = async () => {
  const category = await vscode.window.showQuickPick(
    [
      {
        label: "$(checklist) Configure All",
        description: "Walk through every setting",
      },
      {
        label: "General",
        description: "Welcome message",
      },
      {
        label: "Usage Threshold",
        description: "Poll interval, status bar, thresholds",
      },
      {
        label: "MAX Mode Detection",
        description: "Detect accidental MAX mode usage",
      },
      {
        label: "Spending Guard",
        description: "Detect expensive requests",
      },
      {
        label: "Tips",
        description: "Tip display settings",
      },
      {
        label: "API",
        description: "Advanced model key setting",
      },
    ],
    { placeHolder: "Select a settings category to configure" },
  );

  if (!category) {
    return;
  }

  switch (category.label) {
    case "$(checklist) Configure All":
      await configureGeneral();
      await configureUsageThreshold();
      await configureMaxModeDetection();
      await configureSpendingGuard();
      await configureTips();
      await configureApi();
      break;

    case "General":
      await configureGeneral();
      break;

    case "Usage Threshold":
      await configureUsageThreshold();
      break;

    case "MAX Mode Detection":
      await configureMaxModeDetection();
      break;

    case "Spending Guard":
      await configureSpendingGuard();
      break;

    case "Tips":
      await configureTips();
      break;

    case "API":
      await configureApi();
      break;
  }
};
