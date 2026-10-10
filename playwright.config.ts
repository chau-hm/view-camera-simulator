import { defineConfig, devices } from "@playwright/test";

const nativeWebGpuRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";

export default defineConfig({
  testDir: "./src/tests/e2e",
  timeout: 30_000,

  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },

  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_BASE_PATH: "/",
    },
  },

  projects: [
    nativeWebGpuRequired
      ? {
          name: "chrome-native-webgpu",
          use: {
            ...devices["Desktop Chrome"],
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
