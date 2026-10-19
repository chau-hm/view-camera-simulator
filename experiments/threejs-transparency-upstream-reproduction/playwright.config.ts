import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["run.spec.ts", "screenshot-identity.spec.ts"],
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30 * 60 * 1000,
  expect: { timeout: 120_000 },
  outputDir: "../../test-results/threejs-transparency-upstream-reproduction/playwright",
  use: {
    viewport: { width: 320, height: 320 },
    deviceScaleFactor: 1,
    channel: "chrome",
    headless: false,
    launchOptions: {
      ignoreDefaultArgs: ["--no-sandbox", "--enable-unsafe-swiftshader"],
    },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
