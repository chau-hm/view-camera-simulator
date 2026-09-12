import { defineConfig, devices } from "@playwright/test";

const sceneCapacityBenchmarkPort = 4174;

export default defineConfig({
  testDir: "./src/tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${sceneCapacityBenchmarkPort}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${sceneCapacityBenchmarkPort} --strictPort`,
    url: `http://127.0.0.1:${sceneCapacityBenchmarkPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_BASE_PATH: "/",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
