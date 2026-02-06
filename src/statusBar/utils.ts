import { getModelUsage } from "../api";
import { ThresholdSeverity } from "../constants";
import {
  type CursorCombinedUsage,
  type ExtensionConfig,
  type CursorUsageDetailsForModel,
  type ExtensionThresholdSeverity,
} from "../types";
import { calculateSeverity, formatCents, formatResetDateFull } from "../utils";

/**
 * Gets the current severity for included requests.
 */
export const getIncludedRequestSeverity = (
  modelUsage: CursorUsageDetailsForModel | null,
  config: ExtensionConfig,
): ExtensionThresholdSeverity => {
  if (!modelUsage || modelUsage.maxRequestUsage === null) {
    return ThresholdSeverity.Normal;
  }

  const percent = (modelUsage.numRequests / modelUsage.maxRequestUsage) * 100;

  return calculateSeverity(
    percent,
    config.alerts.includedRequestUsage.warningPercentageThresholds,
    config.alerts.includedRequestUsage.criticalPercentageThresholds,
  );
};

/**
 * Gets the current severity for on-demand usage.
 */
export const getOnDemandSeverity = (
  data: CursorCombinedUsage,
  config: ExtensionConfig,
): ExtensionThresholdSeverity => {
  const onDemand = data.summary.individualUsage.onDemand;

  if (!onDemand.enabled || onDemand.limit === 0) {
    return ThresholdSeverity.Normal;
  }

  const percent = (onDemand.used / onDemand.limit) * 100;

  return calculateSeverity(
    percent,
    config.alerts.onDemandUsage.warningPercentageThresholds,
    config.alerts.onDemandUsage.criticalPercentageThresholds,
  );
};

/**
 * Builds detailed tooltip for the status bar item.
 */
export const buildTooltip = (
  data: CursorCombinedUsage,
  config: ExtensionConfig,
) => {
  const modelUsage = getModelUsage(
    data.usage,
    config.api.includedRequestModelKey,
  );
  const onDemand = data.summary.individualUsage.onDemand;
  const resetDate = formatResetDateFull(data.summary.billingCycleEnd);

  const lines: string[] = ["Cursor Usage Stats", "───────────────"];

  // Request usage.
  if (modelUsage) {
    if (modelUsage.maxRequestUsage !== null) {
      lines.push(
        `Requests: ${modelUsage.numRequests} / ${modelUsage.maxRequestUsage}`,
      );
    } else {
      lines.push(`Requests: ${modelUsage.numRequests} (unlimited)`);
    }
  }

  // On-demand usage.
  if (onDemand.enabled) {
    lines.push(
      `On-Demand: ${formatCents(onDemand.used)} / ${formatCents(onDemand.limit)}`,
    );
  }

  lines.push("───────────────");
  lines.push(`Resets: ${resetDate}`);
  lines.push("");
  lines.push("Click for details");

  return lines.join("\n");
};
