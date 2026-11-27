import { defineConfig, devices } from "@playwright/test";
import { productionPreviewSpecGlob } from "./scripts/e2e-spec-policy.mjs";

// GitHub CI reaches this config only after its mandatory type-check step. Keep
// standalone Production Preview invocations on the fully checked build path.
const previewBuildCommand = process.env.VCS_PREVIEW_TYPECHECK_PASSED === "1"
  ? "npm run build:production-preview:after-typecheck"
  : "npm run build";

export default defineConfig({
  testDir: "./src/tests/e2e",
  testMatch: [productionPreviewSpecGlob],
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "on-first-retry",
  },
  webServer: {
    command: `${previewBuildCommand} && npm run preview -- --host 127.0.0.1 --port 4175`,
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_BASE_PATH: "/",
    },
  },
  projects: [{
    name: "chromium-production-preview",
    use: { ...devices["Desktop Chrome"] },
  }],
});
