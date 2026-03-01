import DEFAULT_TIPS from "./defaultTips.json";
import { type Tip } from "./types";

/** Cached tips from the remote source. */
let cachedTips: Tip[] | null = null;

/**
 * Fetches tips from a remote gist URL.
 *
 * Falls back to bundled default tips if the fetch fails
 * or the response is invalid.
 */
export const fetchTips = async (gistUrl?: string) => {
  if (cachedTips) {
    return cachedTips;
  }

  if (!gistUrl) {
    cachedTips = DEFAULT_TIPS as Tip[];

    return cachedTips;
  }

  try {
    const response = await fetch(gistUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn(
        "[Cursor Usage Stats] Failed to fetch tips, using defaults.",
      );
      cachedTips = DEFAULT_TIPS as Tip[];

      return cachedTips;
    }

    const tips = (await response.json()) as Tip[];

    if (!Array.isArray(tips) || tips.length === 0) {
      cachedTips = DEFAULT_TIPS as Tip[];

      return cachedTips;
    }

    cachedTips = tips;

    return cachedTips;
  } catch {
    console.warn("[Cursor Usage Stats] Tips fetch error, using defaults.");
    cachedTips = DEFAULT_TIPS as Tip[];

    return cachedTips;
  }
};

/**
 * Clears the cached tips (for testing or when gist URL changes).
 */
export const clearTipsCache = () => {
  cachedTips = null;
};
