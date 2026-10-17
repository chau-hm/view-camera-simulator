import { defineConfig } from "@playwright/test";
import developmentConfig from "./playwright.config";

/** Isolated native-required fixture; excluded from normal E2E discovery. */
export default defineConfig({
  ...developmentConfig,
  testDir: "./src/tests/benchmarks",
  testMatch: ["anatomy-transparency-output-investigation.spec.ts"],
  workers: 1,
  retries: 0,
  timeout: 30 * 60 * 1000,
  expect: { timeout: 120_000 },
  outputDir: "test-results/anatomy-transparency-output-investigation/playwright",
  use: {
    ...developmentConfig.use,
    baseURL: "http://127.0.0.1:4178",
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    channel: "chrome",
    headless: false,
    launchOptions: {
      ignoreDefaultArgs: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    ...developmentConfig.webServer,
    command: "npm run dev -- --host 127.0.0.1 --port 4178 --strictPort",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
    env: {
      ...process.env,
      VITE_BASE_PATH: "/",
    },
  },
  projects: [{ name: "chrome-native-webgpu" }],
});
