import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testMatch: "**/m7s-learning-drawer-contract.diagnostic.ts",
});
