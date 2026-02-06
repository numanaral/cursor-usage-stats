import { defineConfig } from "@vscode/test-cli";

export default defineConfig([
  {
    label: "Sqlite UI Tests (missing sqlite3)",
    files: "out/testing/sqlite-ui/**/*.test.js",
    mocha: {
      ui: "tdd",
      timeout: 20000,
    },
    env: {
      USE_MOCKED_API_DATA: "true",
      TEST_UI_PAUSE_MS: process.env.TEST_UI_PAUSE_MS || "0",
    },
  },
  {
    label: "Unit & Integration Tests",
    files: "out/testing/suite/**/*.test.js",
    mocha: {
      ui: "tdd",
      timeout: 20000,
    },
    env: {
      USE_MOCKED_API_DATA: "true",
      TEST_UI_PAUSE_MS: process.env.TEST_UI_PAUSE_MS || "0",
    },
  },
]);
