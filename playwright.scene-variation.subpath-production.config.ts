import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_SCENE_VARIATION_SUBPATH_PORT ?? "4177";
const basePath = "/view-camera-simulator/";

export default defineConfig({
  testDir: "./src/tests/scene-variation-e2e",
  testMatch: [
    "free-mode-seeded-materials-wave1-base-production.spec.ts",
    "interior-corner-seeded-materials-subpath-production.spec.ts",
    "interior-corner-seeded-props-subpath-production.spec.ts",
    "shelf-swing-seeded-props-subpath-production.spec.ts",
  ],
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}${basePath}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}${basePath}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...process.env, VITE_BASE_PATH: basePath },
  },
  projects: [{
    name: "chromium-scene-variation-subpath-production",
    use: { ...devices["Desktop Chrome"] },
  }],
});
