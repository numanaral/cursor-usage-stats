/**
 * How long to pause between visible UI actions (ms).
 *
 * Reads from the `TEST_UI_PAUSE_MS` env var so the same tests
 * can run fast (default, 0 ms) or slow (`test:slow`, 1000 ms).
 */
export const UI_PAUSE_MS = Number(process.env.TEST_UI_PAUSE_MS) || 0;

/** Whether slow mode is active. */
export const IS_SLOW_MODE = UI_PAUSE_MS > 0;

/** Pauses execution so UI changes are observable in the Extension Host. */
export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Waits for a notification to render and be visible, then
 * dismisses all notifications.
 *
 * Use after calling a function that fires
 * `vscode.window.show*Message` (non-modal only).
 *
 * In fast mode, dismisses immediately with no delay.
 * In slow mode, pauses so notifications are visible.
 *
 * Note: modals are blocked by VS Code's `DialogService` in
 * the test environment. Use an injectable `AlertShowFn` mock
 * for modal tests instead.
 */
export const waitForNotificationAndDismiss = async () => {
  if (IS_SLOW_MODE) {
    await sleep(UI_PAUSE_MS);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vscode = require("vscode");
  await vscode.commands.executeCommand("notifications.clearAll");

  if (IS_SLOW_MODE) {
    await sleep(UI_PAUSE_MS);
  }
};
