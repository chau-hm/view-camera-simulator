import { defineConfig } from "@playwright/test";
import developmentConfig from "./playwright.config";

/** Native-only focused intervention and visibility audit for Anatomy output stages. */
export default defineConfig({
  ...developmentConfig,
  testDir: "./src/tests/benchmarks",
  testMatch: ["anatomy-dimmed-output-mechanism.spec.ts"],
  workers: 1,
  retries: 0,
  timeout: 30 * 60 * 1000,
  expect: { timeout: 120_000 },
  outputDir: "test-results/anatomy-dimmed-output-mechanism/playwright",
});
