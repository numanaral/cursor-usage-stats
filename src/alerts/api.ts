import { getMockUsageEvents, isMockingEnabled } from "../__mocking__";
import { fetchWithAuthPost } from "../api";
import { CURSOR_API_URLS } from "../constants";
import { type CursorUsageEventsApiResponse } from "./types";

/**
 * Fetches usage events from the Cursor dashboard API for
 * a given time range.
 *
 * Uses `startDate` and `endDate` as epoch millisecond strings
 * to query only events since the last check.
 */
export const fetchRecentEvents = (
  startDate: number,
  endDate: number,
  pageSize: number,
) => {
  if (isMockingEnabled()) {
    return Promise.resolve(getMockUsageEvents());
  }

  return fetchWithAuthPost<CursorUsageEventsApiResponse>(
    CURSOR_API_URLS.USAGE_EVENTS,
    {
      startDate: String(startDate),
      endDate: String(endDate),
      page: 1,
      pageSize,
    },
  );
};
