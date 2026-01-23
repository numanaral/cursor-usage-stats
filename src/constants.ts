import { type ExtensionConfig } from "./types";

export const StatusBarDisplayMode = {
  Both: "both",
  Requests: "requests",
  OnDemand: "onDemand",
} as const;

export const StatusBarPrimaryMetric = {
  IncludedRequest: "includedRequest",
  OnDemand: "onDemand",
} as const;

export const ThresholdSeverity = {
  Normal: "normal",
  Warning: "warning",
  Critical: "critical",
} as const;

/** Default configuration values. */
export const EXTENSION_DEFAULT_CONFIG: ExtensionConfig = {
  notifyOnStartup: true,
  pollIntervalSeconds: 60,
  statusBar: {
    displayMode: StatusBarDisplayMode.Both,
    primaryMetric: StatusBarPrimaryMetric.OnDemand,
  },
  api: {
    includedRequestModelKey: "gpt-4",
  },
  alerts: {
    includedRequestUsage: {
      warningPercentageThresholds: [50, 60, 70],
      criticalPercentageThresholds: [80, 90, 95],
    },
    onDemandUsage: {
      warningPercentageThresholds: [50, 60, 70],
      criticalPercentageThresholds: [80, 90, 95],
    },
  },
};

export const CURSOR_API_URLS = {
  USAGE: "https://cursor.com/api/usage",
  USAGE_SUMMARY: "https://cursor.com/api/usage-summary",
};
