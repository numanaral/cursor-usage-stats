import * as vscode from "vscode";

import {
  type AlertShowFn,
  NotificationMode,
  type AlertsConfig,
  type CursorUsageEvent,
} from "./types";
import { formatCostDollars, sumCostsCents } from "./utils";

/** Snooze duration in minutes. */
const SNOOZE_MINUTES = 5;

/**
 * Epoch ms of the last successful check.
 *
 * Initialized to `Date.now()` on activation so we never
 * alert on historical data. When snoozed, set to a future
 * timestamp -- polls skip while `lastCheckedDate > now`.
 */
let lastCheckedDate = Date.now();

/** Soft-disabled for the remainder of this VS Code session. */
let ignoredForSession = false;

/** Prevents stacked notifications from repeated polls. */
let notificationPending = false;

/**
 * Resets all spending guard state.
 *
 * Call on new billing cycle or settings change.
 */
export const resetSpendingGuardState = () => {
  // Subtract 1ms so events created in the same ms as reset
  // still pass the strictly-greater filter.
  lastCheckedDate = Date.now() - 1;
  ignoredForSession = false;
  notificationPending = false;
};

/** Returns the current lastCheckedDate (for testing). */
export const getLastCheckedDate = () => lastCheckedDate;

/** Sets lastCheckedDate directly (for testing snooze expiry). */
export const setLastCheckedDate = (ms: number) => {
  lastCheckedDate = ms;
};

/** Returns whether the feature is ignored for session (for testing). */
export const isIgnoredForSession = () => ignoredForSession;

/** Returns whether a notification is currently pending (for testing). */
export const isNotificationPending = () => notificationPending;

/**
 * Checks events for spending that exceeds the configured
 * cost threshold.
 *
 * Skips when snoozed (`lastCheckedDate` is in the future),
 * ignored for session, or a notification is already showing.
 *
 * Events are filtered by `lastCheckedDate` so historical
 * data never triggers alerts -- even if the API returns
 * more events than requested.
 *
 * @param overrideShowFn - Injectable show function for testing.
 *   VS Code blocks modals in the test environment, so tests
 *   can pass a mock to verify the message and options.
 */
export const checkSpendingGuard = (
  events: CursorUsageEvent[],
  config: AlertsConfig,
  overrideShowFn?: AlertShowFn,
) => {
  if (!config.spendingGuard.enabled || ignoredForSession) {
    return;
  }

  const now = Date.now();

  // Snoozed -- lastCheckedDate is in the future.
  if (lastCheckedDate > now) {
    return;
  }

  // Already showing a notification -- skip to prevent stacking.
  if (notificationPending) {
    return;
  }

  // Only consider events strictly after the last check.
  const recentEvents = events.filter(
    (e) => Number(e.timestamp) > lastCheckedDate,
  );
  const totalCents = sumCostsCents(recentEvents);
  const thresholdCents = config.spendingGuard.costThreshold * 100;

  if (totalCents < thresholdCents) {
    // Below threshold. Advance checkpoint.
    lastCheckedDate = now;

    return;
  }

  // Advance checkpoint immediately so the next poll doesn't
  // re-trigger on the same events.
  lastCheckedDate = now;
  notificationPending = true;

  const costDisplay = formatCostDollars(totalCents);
  const message =
    `Spending alert: ${costDisplay} since last check ` +
    `(threshold: $${config.spendingGuard.costThreshold.toFixed(2)}).`;

  const isModal =
    config.spendingGuard.notificationMode === NotificationMode.Modal;
  const options = isModal ? { modal: true } : {};

  const showFn =
    overrideShowFn ??
    (isModal
      ? vscode.window.showErrorMessage
      : vscode.window.showWarningMessage);

  showFn(
    message,
    options,
    "Dismiss",
    `Snooze ${SNOOZE_MINUTES} min`,
    "Ignore for Session",
  ).then((selection) => {
    notificationPending = false;

    if (selection === `Snooze ${SNOOZE_MINUTES} min`) {
      lastCheckedDate = Date.now() + SNOOZE_MINUTES * 60 * 1000;
    } else if (selection === "Ignore for Session") {
      ignoredForSession = true;
    }
    // Dismiss and close-without-selecting: checkpoint was
    // already advanced before the notification was shown.
  });
};
