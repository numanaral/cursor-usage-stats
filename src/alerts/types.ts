export interface CursorUsageEventTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  totalCents: number;
}

export interface CursorUsageEvent {
  timestamp: string;
  model: string;
  kind: string;
  maxMode?: boolean;
  requestsCosts: number;
  usageBasedCosts: string;
  isTokenBasedCall: boolean;
  tokenUsage: CursorUsageEventTokenUsage;
  owningUser: string;
  owningTeam: string;
  cursorTokenFee: number;
  isChargeable: boolean;
  isHeadless: boolean;
}

export interface CursorUsageEventsApiResponse {
  totalUsageEventsCount: number;
  usageEventsDisplay: CursorUsageEvent[];
}

export const NotificationMode = {
  Toast: "toast",
  Modal: "modal",
} as const;

export type NotificationModeType =
  (typeof NotificationMode)[keyof typeof NotificationMode];

export interface MaxModeDetectionConfig {
  enabled: boolean;
  notificationMode: NotificationModeType;
  pollIntervalSeconds: number;
}

export interface SpendingGuardConfig {
  enabled: boolean;
  notificationMode: NotificationModeType;
  pollIntervalSeconds: number;
  costThreshold: number;
}

export interface AlertsConfig {
  usageThreshold: {
    pollIntervalSeconds: number;
  };
  maxModeDetection: MaxModeDetectionConfig;
  spendingGuard: SpendingGuardConfig;
}

/**
 * Signature matching `vscode.window.showWarningMessage` /
 * `showErrorMessage` with message options and string items.
 *
 * Extracted so alert functions can accept an injectable
 * override for testing (VS Code blocks modals in tests).
 */
export type AlertShowFn = (
  message: string,
  options: { modal?: boolean },
  ...items: string[]
) => Thenable<string | undefined>;
