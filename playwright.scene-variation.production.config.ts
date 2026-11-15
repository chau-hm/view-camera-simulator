import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_SCENE_VARIATION_PRODUCTION_PORT ?? "4176";

export default defineConfig({
  testDir: "./src/tests/scene-variation-e2e",
  testMatch: [
    "interior-corner-seeded-materials-production.spec.ts",
    "interior-corner-seeded-props-production.spec.ts",
  ],
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...process.env, VITE_BASE_PATH: "/" },
  },
  projects: [{
    name: "chromium-scene-variation-production",
    use: { ...devices["Desktop Chrome"] },
  }],
});
