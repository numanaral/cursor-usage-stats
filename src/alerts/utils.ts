import { getModelUsage } from "../api";
import {
  type ExtensionAlertThresholds,
  type CursorCombinedUsage,
  type ExtensionConfig,
} from "../types";

/** Tracks which thresholds have already triggered alerts for included requests. */
const triggeredIncludedRequestThresholds = new Set<number>();

/** Tracks which thresholds have already triggered alerts for on-demand usage. */
const triggeredOnDemandThresholds = new Set<number>();

/**
 * Marks exceeded thresholds as triggered for a given percentage and threshold config.
 */
const markExceededThresholds = (
  percent: number,
  thresholds: ExtensionAlertThresholds,
  triggeredSet: Set<number>,
) => {
  const allThresholds = [
    ...thresholds.warningPercentageThresholds,
    ...thresholds.criticalPercentageThresholds,
  ];

  for (const threshold of allThresholds) {
    if (percent >= threshold) {
      triggeredSet.add(threshold);
    }
  }
};

/**
 * Marks all currently-exceeded thresholds as triggered without showing alerts.
 * Call this on first load to avoid spamming notifications.
 */
export const markExceededThresholdsAsTriggered = (
  data: CursorCombinedUsage,
  config: ExtensionConfig,
) => {
  const modelUsage = getModelUsage(
    data.usage,
    config.api.includedRequestModelKey,
  );

  if (modelUsage && modelUsage.maxRequestUsage !== null) {
    const percent = (modelUsage.numRequests / modelUsage.maxRequestUsage) * 100;
    markExceededThresholds(
      percent,
      config.alerts.includedRequestUsage,
      triggeredIncludedRequestThresholds,
    );
  }

  const onDemand = data.summary.individualUsage.onDemand;

  if (onDemand.enabled && onDemand.limit > 0) {
    const percent = (onDemand.used / onDemand.limit) * 100;
    markExceededThresholds(
      percent,
      config.alerts.onDemandUsage,
      triggeredOnDemandThresholds,
    );
  }
};

/**
 * Resets triggered thresholds (call on new billing cycle).
 */
export const resetTriggeredThresholds = () => {
  triggeredIncludedRequestThresholds.clear();
  triggeredOnDemandThresholds.clear();
};

/**
 * Gets the triggered included request thresholds (for testing).
 */
export const getTriggeredIncludedRequestThresholds = () => {
  return triggeredIncludedRequestThresholds;
};

/**
 * Gets the triggered on-demand thresholds (for testing).
 */
export const getTriggeredOnDemandThresholds = () => triggeredOnDemandThresholds;
