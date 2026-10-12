import { defineConfig } from "@playwright/test";

const observerBackendBenchmarkPort = 4176;

export default defineConfig({
  testDir: "./src/tests/benchmarks",
  testMatch: ["**/*.bench.ts"],
  testIgnore: ["**/helpers/**"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60 * 1000,
  expect: { timeout: 120_000 },
  outputDir: "test-results/observer-backend-comparison/playwright",
  use: {
    baseURL: `http://127.0.0.1:${observerBackendBenchmarkPort}`,
    viewport: { width: 1440, height: 1000 },
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
    command: `npm run dev -- --host 127.0.0.1 --port ${observerBackendBenchmarkPort} --strictPort`,
    url: `http://127.0.0.1:${observerBackendBenchmarkPort}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      VITE_BASE_PATH: "/",
    },
  },
  projects: [{ name: "chrome-native-webgpu" }],
});
