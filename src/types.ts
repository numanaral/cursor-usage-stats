export interface CursorAuthCredentials {
  userId: string;
  accessToken: string;
}

export interface CursorUsageSummaryApiResponse {
  billingCycleStart: string;
  billingCycleEnd: string;
  membershipType: string;
  limitType: string;
  isUnlimited: boolean;
  autoModelSelectedDisplayMessage: string;
  namedModelSelectedDisplayMessage: string;
  individualUsage: {
    plan: {
      enabled: boolean;
      used: number;
      limit: number;
      remaining: number;
      breakdown: {
        included: number;
        bonus: number;
        total: number;
      };
      autoPercentUsed: number;
      apiPercentUsed: number;
      totalPercentUsed: number;
    };
    onDemand: {
      enabled: boolean;
      used: number;
      limit: number;
      remaining: number;
    };
  };
  teamUsage: {
    onDemand: {
      enabled: boolean;
      used: number;
      limit: number;
      remaining: number;
    };
  };
}

export interface CursorUsageDetailsForModel {
  numRequests: number;
  numRequestsTotal: number;
  numTokens: number;
  maxRequestUsage: number | null;
  maxTokenUsage: number | null;
}

export interface CursorUsageApiResponse {
  [modelKey: string]: CursorUsageDetailsForModel | string;
  startOfMonth: string;
}

export interface CursorCombinedUsage {
  usage: CursorUsageApiResponse;
  summary: CursorUsageSummaryApiResponse;
}

import { type AlertsConfig } from "./alerts/types";
import {
  type StatusBarDisplayMode,
  type StatusBarTrackedMetric,
  type ThresholdSeverity,
} from "./constants";

export type ExtensionStatusBarDisplayMode =
  (typeof StatusBarDisplayMode)[keyof typeof StatusBarDisplayMode];
export type ExtensionStatusBarTrackedMetric =
  (typeof StatusBarTrackedMetric)[keyof typeof StatusBarTrackedMetric];
export type ExtensionThresholdSeverity =
  (typeof ThresholdSeverity)[keyof typeof ThresholdSeverity];

export interface ExtensionAlertThresholds {
  warningPercentageThresholds: number[];
  criticalPercentageThresholds: number[];
}

export interface ExtensionNotificationRecord {
  message: string;
  severity: ExtensionThresholdSeverity;
  timestamp: number;
}

export interface TipsConfig {
  showOnStartup: boolean;
  gistUrl: string;
}

export interface ExtensionConfig {
  showWelcomeMessage: boolean;
  api: {
    includedRequestModelKey: string;
  };
  alerts: {
    usageThreshold: {
      pollIntervalSeconds: number;
      statusBar: {
        displayMode: ExtensionStatusBarDisplayMode;
        trackedMetric: ExtensionStatusBarTrackedMetric;
      };
      includedRequestUsage: ExtensionAlertThresholds;
      onDemandUsage: ExtensionAlertThresholds;
    };
  } & AlertsConfig;
  tips: TipsConfig;
}
