import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

// Keep RQ1 capture tests out of the standard M7V/E2E discovery lanes while
// reusing the repository's browser projects, dev server, and trusted env policy.
export default defineConfig({
  ...baseConfig,
  testDir: "./scripts/render-quality",
  testMatch: "rq1-capture.spec.ts",
});
