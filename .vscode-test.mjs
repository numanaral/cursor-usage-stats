import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/testing/suite/**/*.test.js",
  mocha: {
    ui: "tdd",
    timeout: 20000,
  },
  env: {
    USE_MOCKED_API_DATA: "true",
  },
});
