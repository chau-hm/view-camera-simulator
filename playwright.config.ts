import { defineConfig, devices } from "@playwright/test";
import { productionPreviewSpecGlob } from "./scripts/e2e-spec-policy.mjs";

const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const groundGlassNativeWebGpuRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const groundGlassFailureIntegration = process.env.GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION === "1";
const groundGlassPhysicalCocResearch = process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "1";
const groundGlassApertureGatherResearch = process.env.GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH === "1";
const groundGlassM6PresentationRequired = process.env.GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED === "1";
const headedNativeWebGpuRequired = nativeWebGpuRequired || groundGlassNativeWebGpuRequired || groundGlassM6PresentationRequired;
const isolatedWebServerPort = process.env.PLAYWRIGHT_WEB_SERVER_PORT;
const webServerPort = isolatedWebServerPort ?? (groundGlassM6PresentationRequired ? "4175" : "4173");
const baselineWebServerPort = process.env.GROUND_GLASS_M6_WEBGL_BASELINE_PORT ?? String(Number(webServerPort) + 1);
const webServerEnvironment = {
  ...process.env,
  VITE_BASE_PATH: "/",
  VITE_GROUND_GLASS_WEBGPU_TEST_SEAM: groundGlassFailureIntegration || groundGlassPhysicalCocResearch || groundGlassApertureGatherResearch || groundGlassM6PresentationRequired ? "true" : "false",
  VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH: groundGlassPhysicalCocResearch ? "true" : groundGlassM6PresentationRequired ? "false" : process.env.VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH ?? "false",
  VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH: groundGlassApertureGatherResearch ? "true" : groundGlassM6PresentationRequired ? "false" : process.env.VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH ?? "false",
  VITE_GROUND_GLASS_WEBGPU_RAW_PILOT: groundGlassM6PresentationRequired ? "true" : process.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT ?? "false",
  VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION: groundGlassM6PresentationRequired ? "true" : "false",
};

export default defineConfig({
  testDir: "./src/tests/e2e",
  testIgnore: [productionPreviewSpecGlob],
  timeout: 30_000,

  use: {
    baseURL: `http://127.0.0.1:${webServerPort}`,
    trace: "on-first-retry",
  },

  webServer: groundGlassM6PresentationRequired
    ? [
        {
          command: `npm run dev -- --host 127.0.0.1 --port ${webServerPort} --strictPort`,
          url: `http://127.0.0.1:${webServerPort}`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: webServerEnvironment,
        },
        {
          command: `npm run dev -- --host 127.0.0.1 --port ${baselineWebServerPort} --strictPort`,
          url: `http://127.0.0.1:${baselineWebServerPort}`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...webServerEnvironment,
            VITE_GROUND_GLASS_WEBGPU_RAW_PILOT: "false",
            VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION: "false",
            VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH: "false",
            VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH: "false",
          },
        },
      ]
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${webServerPort} --strictPort`,
        url: `http://127.0.0.1:${webServerPort}`,
        reuseExistingServer: !process.env.CI && isolatedWebServerPort === undefined,
        timeout: 120_000,
        env: webServerEnvironment,
      },

  projects: [
    headedNativeWebGpuRequired
      ? {
          name: "chrome-native-webgpu",
          use: {
            channel: "chrome",
            headless: false,
            launchOptions: {
              ignoreDefaultArgs: ["--no-sandbox", "--enable-unsafe-swiftshader"],
            },
          },
        }
      : {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
  ],
});
