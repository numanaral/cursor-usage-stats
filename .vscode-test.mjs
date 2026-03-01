import { defineConfig } from "@vscode/test-cli";

const ENV_VARS = {
  USE_MOCKED_API_DATA: "true",
  TEST_UI_PAUSE_MS: process.env.TEST_UI_PAUSE_MS || "0",
};

const MOCHA_CONFIG = {
  ui: "tdd",
  timeout: 20000,
};

const SUITES = [
  "sqlite",
  "welcomeMessage",
  "usageThreshold",
  "maxModeDetection",
  "spendingGuard",
  "wizard",
  "tips",
];

const generateTestConfig = (featureName) => {
  return {
    label: `Integration Tests (${featureName})`,
    files: `out/testing/integration/${featureName}/**/*.test.js`,
    mocha: MOCHA_CONFIG,
    env: ENV_VARS,
  };
};

export default defineConfig(SUITES.map(generateTestConfig));
