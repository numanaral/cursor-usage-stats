import { ThresholdSeverity } from "./constants";
import {
  type CursorUsageDetailsForModel,
  type ExtensionThresholdSeverity,
} from "./types";

/**
 * Formats cents to dollar string.
 *
 * @example
 * ```ts
 * formatCents(432) // "$4.32"
 * formatCents(0) // "$0.00"
 * ```
 */
export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Formats a date for the status bar tooltip (short format).
 *
 * @example
 * ```ts
 * formatResetDateShort("2026-02-01T00:00:00Z") // "Feb 1, 2026"
 * ```
 */
export const formatResetDateShort = (dateString: string) => {
  const date = new Date(dateString);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

/**
 * Formats a date with both UTC and local time for detailed display.
 *
 * @example
 * ```ts
 * formatResetDateFull("2026-02-01T00:00:00Z")
 * // "Feb 1, 2026 UTC (Jan 31, 2026 4:00 PM PST)"
 * ```
 */
export const formatResetDateFull = (dateString: string) => {
  const date = new Date(dateString);

  // UTC date.
  const utcDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  // Local date with time and timezone.
  const localDateTime = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `${utcDate} UTC (${localDateTime})`;
};

/**
 * Validates and returns an array of thresholds, falling back to default if invalid.
 * Thresholds must be numbers between 0 and 100.
 *
 * @example
 * ```ts
 * validateThresholds([50, 60, 70], [80, 90]) // [50, 60, 70]
 * validateThresholds("invalid", [80, 90]) // [80, 90]
 * validateThresholds([150], [80, 90]) // [80, 90] (out of range)
 * ```
 */
export const validateThresholds = (
  value: unknown,
  defaultValue: number[],
): number[] => {
  if (!Array.isArray(value)) {
    return defaultValue;
  }

  const valid = value.every(
    (item) => typeof item === "number" && item >= 0 && item <= 100,
  );

  return valid ? value : defaultValue;
};

/**
 * Calculates severity based on percentage and thresholds.
 * Critical thresholds take precedence over warning thresholds.
 *
 * @example
 * ```ts
 * calculateSeverity(40, [50], [80]) // "normal"
 * calculateSeverity(60, [50], [80]) // "warning"
 * calculateSeverity(90, [50], [80]) // "critical"
 * ```
 */
export const calculateSeverity = (
  percent: number,
  warningThresholds: number[],
  criticalThresholds: number[],
): ExtensionThresholdSeverity => {
  // Check critical first (higher priority).
  for (const threshold of criticalThresholds) {
    if (percent >= threshold) {
      return ThresholdSeverity.Critical;
    }
  }

  // Check warning.
  for (const threshold of warningThresholds) {
    if (percent >= threshold) {
      return ThresholdSeverity.Warning;
    }
  }

  return ThresholdSeverity.Normal;
};

/**
 * Extracts user ID from a JWT token's sub field.
 * The sub field format is "auth-provider|user_xxxx".
 *
 * @example
 * ```ts
 * extractUserIdFromJwt("eyJ...") // "user_xxxx"
 * ```
 */
export const extractUserIdFromJwt = (token: string) => {
  const payload = token.split(".")[1];
  const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
  const sub = decoded.sub as string;

  // Format: "auth-provider|user_xxxx"
  const parts = sub.split("|");

  return parts[parts.length - 1];
};

/**
 * Checks if an object has the shape of ModelUsage.
 * Used as a type guard for runtime validation.
 *
 * @example
 * ```ts
 * isModelUsage({ numRequestsTotal: 10, maxRequestUsage: 100 }) // true
 * isModelUsage({ foo: "bar" }) // false
 * ```
 */
export const isModelUsage = (
  value: unknown,
): value is CursorUsageDetailsForModel => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.numRequestsTotal === "number" &&
    (obj.maxRequestUsage === null || typeof obj.maxRequestUsage === "number")
  );
};
