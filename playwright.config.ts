import { defineConfig, devices } from "@playwright/test";
import { productionPreviewSpecGlob } from "./scripts/e2e-spec-policy.mjs";

const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const groundGlassNativeWebGpuRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const headedNativeWebGpuRequired = nativeWebGpuRequired || groundGlassNativeWebGpuRequired;
const isolatedWebServerPort = process.env.PLAYWRIGHT_WEB_SERVER_PORT;
const webServerPort = isolatedWebServerPort ?? "4173";

export default defineConfig({
  testDir: "./src/tests/e2e",
  testIgnore: [productionPreviewSpecGlob],
  timeout: 30_000,

  use: {
    baseURL: `http://127.0.0.1:${webServerPort}`,
    trace: "on-first-retry",
  },

  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${webServerPort} --strictPort`,
    url: `http://127.0.0.1:${webServerPort}`,
    reuseExistingServer: !process.env.CI && isolatedWebServerPort === undefined,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_BASE_PATH: "/",
    },
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
