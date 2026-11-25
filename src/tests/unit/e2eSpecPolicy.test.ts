import { describe, expect, it } from "vitest";
import {
  isDevelopmentE2ESpec,
  isProductionPreviewSpec,
  productionPreviewSpecGlob,
} from "../../../scripts/e2e-spec-policy.mjs";

describe("E2E spec suite selection", () => {
  it("keeps production-preview specs out of the development enumerator", () => {
    expect(productionPreviewSpecGlob).toBe("**/*-production.spec.ts");
    expect(isProductionPreviewSpec("architecture-rise-webgpu-production.spec.ts")).toBe(true);
    expect(isDevelopmentE2ESpec("architecture-rise-webgpu-production.spec.ts")).toBe(false);
  });

  it("keeps ordinary development and native verification specs in the development enumerator", () => {
    expect(isProductionPreviewSpec("architecture-rise-webgpu-validation.spec.ts")).toBe(false);
    expect(isDevelopmentE2ESpec("architecture-rise-webgpu-validation.spec.ts")).toBe(true);
    expect(isDevelopmentE2ESpec("observer-webgpu-pilot.spec.ts")).toBe(true);
    expect(isDevelopmentE2ESpec("not-a-playwright-spec.ts")).toBe(false);
  });
});
