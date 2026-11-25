import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

const dreamLoopPort = 4176;
const manifestPath = process.env.DREAM_LOOP_CAPTURE_MANIFEST;
if (!manifestPath) {
  throw new Error("The Dream Loop capture runner must select a pilot manifest.");
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  pilotId: string;
  sceneId: string;
  assetKey: string;
  optimizationSurface: { id: string };
  capture: {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
  };
};
if (
  !manifest.pilotId ||
  !manifest.sceneId ||
  !manifest.assetKey ||
  manifest.optimizationSurface?.id !== "observer-scene-viewport"
) {
  throw new Error("The selected Dream Loop pilot manifest is incomplete.");
}

export default defineConfig({
  testDir: "./src/tests/e2e",
  testMatch: "dream-loop-capture.spec.ts",
  timeout: 90_000,
  workers: 1,
  outputDir: ".dream-loop/playwright-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:" + dreamLoopPort,
    viewport: manifest.capture.viewport,
    deviceScaleFactor: manifest.capture.deviceScaleFactor,
    colorScheme: "light",
    locale: "en-US",
    trace: "off",
  },
  webServer: {
    command:
      "npm run dev -- --host 127.0.0.1 --port " + dreamLoopPort + " --strictPort",
    url: "http://127.0.0.1:" + dreamLoopPort,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_BASE_PATH: "/",
    },
  },
});
