import {
  getMockUsage,
  getMockUsageSummary,
  isMockingEnabled,
} from "./__mocking__";
import { buildAuthCookie, getAuthCredentials } from "./auth";
import { CURSOR_API_URLS } from "./constants";
import {
  type CursorCombinedUsage,
  type CursorUsageApiResponse,
  type CursorUsageDetailsForModel,
  type CursorUsageSummaryApiResponse,
} from "./types";
import { isModelUsage } from "./utils";

/**
 * Fetches from a Cursor API endpoint with authentication.
 */
export const fetchWithAuth = async <T>(url: string): Promise<T> => {
  const credentials = getAuthCredentials();
  const cookie = buildAuthCookie(credentials);

  const response = await fetch(url, {
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch: ${response.status} - ${error}`);
  }

  return response.json() as Promise<T>;
};

/**
 * Finds a model key in the usage response that has the expected shape.
 * Falls back to searching for any key with numRequestsTotal and maxRequestUsage.
 */
export const findModelKey = (
  usage: CursorUsageApiResponse,
  preferredKey: string,
): string | null => {
  // Try preferred key first.
  if (preferredKey in usage && isModelUsage(usage[preferredKey])) {
    return preferredKey;
  }

  // Fallback: search for any key with the expected shape.
  for (const key of Object.keys(usage)) {
    if (key === "startOfMonth") {
      continue;
    }

    if (isModelUsage(usage[key])) {
      return key;
    }
  }

  return null;
};

/**
 * Gets model usage data from the usage response.
 */
export const getModelUsage = (
  usage: CursorUsageApiResponse,
  preferredKey: string,
): CursorUsageDetailsForModel | null => {
  const key = findModelKey(usage, preferredKey);

  if (!key) {
    return null;
  }

  return usage[key] as CursorUsageDetailsForModel;
};

/**
 * Fetches usage data (request counts) from the Cursor API.
 */
export const fetchUsage = (): Promise<CursorUsageApiResponse> => {
  if (isMockingEnabled()) {
    return Promise.resolve(getMockUsage());
  }

  return fetchWithAuth<CursorUsageApiResponse>(CURSOR_API_URLS.USAGE);
};

/**
 * Fetches usage summary (billing, on-demand) from the Cursor API.
 */
export const fetchUsageSummary = (): Promise<CursorUsageSummaryApiResponse> => {
  if (isMockingEnabled()) {
    return Promise.resolve(getMockUsageSummary());
  }

  return fetchWithAuth<CursorUsageSummaryApiResponse>(
    CURSOR_API_URLS.USAGE_SUMMARY,
  );
};

/**
 * Fetches both usage and summary data.
 */
export const fetchCombinedUsage = async (): Promise<CursorCombinedUsage> => {
  const [usage, summary] = await Promise.all([
    fetchUsage(),
    fetchUsageSummary(),
  ]);

  return { usage, summary } as const;
};
