import baseConfig from "./playwright.config.js";

export default {
  ...baseConfig,
  testDir: "./src/tests/render-quality/e2e",
};
