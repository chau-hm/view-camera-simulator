import { defineConfig, devices } from "@playwright/test";

const artifact = process.env.VCS_PAGES_ARTIFACT;
if (!artifact) throw new Error("VCS_PAGES_ARTIFACT must name the prebuilt payload directory");

export default defineConfig({
  testDir: "./src/tests",
  testMatch: [
    "e2e/architecture-rise-webgpu-production.spec.ts",
    "scene-variation-e2e/pages-artifact.spec.ts",
    "scene-variation-e2e/architecture-rise-seeded-materials-subpath-production.spec.ts",
  ],
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4178/view-camera-simulator/", trace: "on-first-retry" },
  webServer: {
    command: "node scripts/pages-artifact-server.mjs \"$VCS_PAGES_ARTIFACT\"",
    url: "http://127.0.0.1:4178/view-camera-simulator/",
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [{ name: "chromium-pages-artifact", use: { ...devices["Desktop Chrome"] } }],
});
