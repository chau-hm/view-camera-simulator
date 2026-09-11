import { defineConfig } from "@playwright/test";

const hardwareBenchmarkPort = 4175;

export default defineConfig({
  testDir: "./src/tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${hardwareBenchmarkPort}`,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    channel: "chrome",
    headless: false,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${hardwareBenchmarkPort}`,
    url: `http://127.0.0.1:${hardwareBenchmarkPort}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      VITE_BASE_PATH: "/",
    },
  },
});
