import { defineConfig, devices } from "@playwright/test";

const port = process.env.MACRO_TOURBILLON_HARDWARE_PORT ?? "4187";

export default defineConfig({
  testDir: process.env.MACRO_TOURBILLON_TEST_DIR ?? "./src/tests/render-quality/e2e",
  testMatch: process.env.MACRO_TOURBILLON_TEST_MATCH ?? "macro-tourbillon-reviewfix-capture.spec.ts",
  outputDir: process.env.MACRO_TOURBILLON_PLAYWRIGHT_OUTPUT ?? "/private/tmp/macro-tourbillon-playwright-output",
  timeout: 240_000,
  expect: { timeout: 120_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    headless: false,
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    baseURL: `http://127.0.0.1:${port}`,
    launchOptions: { args: ["--enable-gpu"] },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_BASE_PATH: "/",
      VITE_GROUND_GLASS_WEBGPU_TEST_SEAM: "true",
      VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH: "false",
      VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH: "false",
      VITE_GROUND_GLASS_WEBGPU_RAW_PILOT: "false",
    },
  },
});
