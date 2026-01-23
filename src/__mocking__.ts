/**
 * This mocking module is used to mock the API responses for testing purposes.
 */

import * as fs from "fs";
import * as path from "path";

import {
  type CursorCombinedUsage,
  type CursorUsageApiResponse,
  type CursorUsageSummaryApiResponse,
} from "./types";

const MOCK_DATA_FILE = path.join(__dirname, "mock-api-responses.json");

const MOCK_DATA_MISSING_ERROR = `
Mock API data file not found: ${MOCK_DATA_FILE}

To generate mock data, run:
  yarn mock generate

Then rebuild the extension:
  yarn build
`.trim();

interface MockApiData {
  usage: CursorUsageApiResponse;
  summary: CursorUsageSummaryApiResponse;
}

/**
 * Checks if mocking is enabled via environment variable.
 */
export const isMockingEnabled = () => {
  return process.env.USE_MOCKED_API_DATA === "true";
};

/**
 * Reads mock API data from the JSON file in dist/.
 * Throws an error if the file is missing or invalid.
 */
const readMockApiData = (): MockApiData => {
  if (!fs.existsSync(MOCK_DATA_FILE)) {
    throw new Error(MOCK_DATA_MISSING_ERROR);
  }

  const content = fs.readFileSync(MOCK_DATA_FILE, "utf-8");

  return JSON.parse(content) as MockApiData;
};

/**
 * Gets mock usage data.
 * Throws if mock data file is missing.
 */
export const getMockUsage = (): CursorUsageApiResponse => {
  return readMockApiData().usage;
};

/**
 * Gets mock usage summary data.
 * Throws if mock data file is missing.
 */
export const getMockUsageSummary = (): CursorUsageSummaryApiResponse => {
  return readMockApiData().summary;
};

/**
 * Gets mock combined usage data.
 * Throws if mock data file is missing.
 */
export const getMockCombinedUsage = (): CursorCombinedUsage => {
  const data = readMockApiData();

  return {
    usage: data.usage,
    summary: data.summary,
  };
};
