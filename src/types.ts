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

import {
  type StatusBarDisplayMode,
  type StatusBarPrimaryMetric,
  type ThresholdSeverity,
} from "./constants";

export type ExtensionStatusBarDisplayMode =
  (typeof StatusBarDisplayMode)[keyof typeof StatusBarDisplayMode];
export type ExtensionStatusBarPrimaryMetric =
  (typeof StatusBarPrimaryMetric)[keyof typeof StatusBarPrimaryMetric];
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

export interface ExtensionConfig {
  notifyOnStartup: boolean;
  pollIntervalSeconds: number;
  statusBar: {
    displayMode: ExtensionStatusBarDisplayMode;
    primaryMetric: ExtensionStatusBarPrimaryMetric;
  };
  api: {
    includedRequestModelKey: string;
  };
  alerts: {
    includedRequestUsage: ExtensionAlertThresholds;
    onDemandUsage: ExtensionAlertThresholds;
  };
}
