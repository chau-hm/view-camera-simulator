import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_WEB_SERVER_PORT ?? "4291";

export default defineConfig({
  testDir: "./src/tests/scene-variation-e2e",
  testMatch: ["interior-corner-seeded-materials.spec.ts"],
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_BASE_PATH: "/",
      VITE_GROUND_GLASS_WEBGPU_TEST_SEAM: "false",
      VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH: "false",
      VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION: "false",
      VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH: "false",
      VITE_GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION: "false",
      VITE_GROUND_GLASS_WEBGPU_RAW_PILOT: "false",
      VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION: "false",
      VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION: "false",
    },
  },
  projects: [{
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  }],
});
