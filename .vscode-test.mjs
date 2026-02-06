import { defineConfig } from "@vscode/test-cli";

const env = {
  USE_MOCKED_API_DATA: "true",
  TEST_UI_PAUSE_MS: process.env.TEST_UI_PAUSE_MS || "0",
};

export default defineConfig([
  {
    label: "Integration Tests",
    files: "out/testing/integration/main/**/*.test.js",
    mocha: { ui: "tdd", timeout: 20000 },
    env,
  },
  {
    label: "Integration Tests (sqlite)",
    files: "out/testing/integration/sqlite/**/*.test.js",
    mocha: { ui: "tdd", timeout: 20000 },
    env,
  },
]);
