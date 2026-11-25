import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testDir: "./scripts/render-quality",
  testMatch: "rq2.1-native-m3.spec.ts",
});
