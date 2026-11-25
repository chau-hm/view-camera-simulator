import { defineConfig } from "@playwright/test";
import developmentConfig from "./playwright.config";

/** Keeps the bounded renderer experiment outside ordinary E2E discovery. */
export default defineConfig({
  ...developmentConfig,
  testDir: "./src/tests/benchmarks",
  testMatch: ["observer-output-compositing.spec.ts"],
});
