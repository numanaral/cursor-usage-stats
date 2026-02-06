/**
 * How long to pause between visible UI actions (ms).
 *
 * Reads from the `TEST_UI_PAUSE_MS` env var so the same tests
 * can run fast (default, 0 ms) or slow (`test:slow`, 1000 ms).
 */
export const UI_PAUSE_MS = Number(process.env.TEST_UI_PAUSE_MS) || 0;

/** Pauses execution so UI changes are observable in the Extension Host. */
export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
