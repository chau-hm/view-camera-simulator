import { defineConfig } from "@playwright/test";
import developmentConfig from "./playwright.config";

/** Native-required, single-state Anatomy GPU intermediate experiment. */
export default defineConfig({
  ...developmentConfig,
  testDir: "./src/tests/benchmarks",
  testMatch: ["anatomy-gpu-blend-intermediate.spec.ts"],
  workers: 1,
  retries: 0,
  timeout: 20 * 60 * 1000,
  expect: { timeout: 120_000 },
  outputDir: "test-results/anatomy-gpu-blend-intermediate/playwright",
});
