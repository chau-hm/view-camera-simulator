import { defineConfig } from "@playwright/test";
import developmentConfig from "./playwright.config";

/** Opt-in runtime audit for the real View Camera Anatomy scene. */
export default defineConfig({
  ...developmentConfig,
  testDir: "./src/tests/benchmarks",
  testMatch: ["anatomy-material-compatibility.spec.ts"],
  workers: 1,
  retries: 0,
});
