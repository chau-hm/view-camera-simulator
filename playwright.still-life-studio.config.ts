import { defineConfig, devices } from "@playwright/test";

const port = process.env.STILL_LIFE_STUDIO_PLAYWRIGHT_PORT ?? "4176";
const basePath = process.env.STILL_LIFE_STUDIO_BASE_PATH ?? "/";
const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;

export default defineConfig({
  testDir: "./src/tests/still-life-studio-e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}${normalizedBasePath}`,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npm run build:still-life-studio-qualification && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}${normalizedBasePath}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, VITE_BASE_PATH: normalizedBasePath },
  },
  projects: [{ name: "chromium-production-preview", use: { ...devices["Desktop Chrome"] } }],
});
