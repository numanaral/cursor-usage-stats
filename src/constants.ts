import { type ExtensionConfig } from "./types";

export const StatusBarDisplayMode = {
  Both: "both",
  Requests: "requests",
  OnDemand: "onDemand",
} as const;

export const StatusBarTrackedMetric = {
  IncludedRequest: "includedRequest",
  OnDemand: "onDemand",
} as const;

export const ThresholdSeverity = {
  Normal: "normal",
  Warning: "warning",
  Critical: "critical",
} as const;

export const CURSOR_API_URLS = {
  USAGE: "https://cursor.com/api/usage",
  USAGE_SUMMARY: "https://cursor.com/api/usage-summary",
  USAGE_EVENTS: "https://cursor.com/api/dashboard/get-filtered-usage-events",
};

/** Default configuration values. */
export const EXTENSION_DEFAULT_CONFIG: ExtensionConfig = {
  showWelcomeMessage: true,
  api: {
    includedRequestModelKey: "gpt-4",
  },
  alerts: {
    usageThreshold: {
      pollIntervalSeconds: 60,
      statusBar: {
        displayMode: StatusBarDisplayMode.Both,
        trackedMetric: StatusBarTrackedMetric.OnDemand,
      },
      includedRequestUsage: {
        warningPercentageThresholds: [50, 60, 70],
        criticalPercentageThresholds: [80, 90, 95],
      },
      onDemandUsage: {
        warningPercentageThresholds: [50, 60, 70],
        criticalPercentageThresholds: [80, 90, 95],
      },
    },
    maxModeDetection: {
      enabled: true,
      notificationMode: "modal",
      pollIntervalSeconds: 300,
    },
    spendingGuard: {
      enabled: true,
      notificationMode: "modal",
      pollIntervalSeconds: 300,
      costThreshold: 20,
    },
  },
  tips: {
    showOnStartup: false,
    gistUrl:
      "https://raw.githubusercontent.com/numanaral/cursor-usage-stats/main/src/tips/defaultTips.json",
  },
};
