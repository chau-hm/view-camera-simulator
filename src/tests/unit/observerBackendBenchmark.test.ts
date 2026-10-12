import { describe, expect, it } from "vitest";
import developmentConfig from "../../../playwright.config";
import productionConfig from "../../../playwright.production.config";
import benchmarkConfig from "../../../playwright.observer-backend-benchmark.config";
import {
  comparePixelRegions,
  observerBackendMismatches,
  serializeBenchmarkReport,
  subjectRoiHasMeaningfulPixels,
  summarizeFrameCadence,
  summarizePixelRegion,
  type DecodedPng,
  type MountedObserverEvidence,
} from "../benchmarks/observerBackendBenchmark";

const activeNativeWebGpu: MountedObserverEvidence = {
  "data-observer-renderer-status": "active",
  "data-observer-renderer-request": "webgpu-pilot",
  "data-observer-selection-reason": "webgpu-pilot-approved",
  "data-observer-webgpu-scene-compatibility": "verified",
  "data-observer-webgpu-pilot-eligibility": "eligible",
  "data-observer-webgpu-api-present": "true",
  "data-observer-adapter-availability": "available",
  "data-observer-renderer-family": "webgpu-renderer",
  "data-observer-execution-backend": "webgpu",
  "data-observer-application-fallback": "none",
  "data-observer-webgpu-initialization-attempts": "1",
};

const activeWebGl: MountedObserverEvidence = {
  "data-observer-renderer-status": "active",
  "data-observer-renderer-request": "webgl",
  "data-observer-selection-reason": "default-webgl-request",
  "data-observer-renderer-family": "webgl-renderer",
  "data-observer-execution-backend": "webgl2",
  "data-observer-application-fallback": "none",
};

const syntheticPng = (pixels: readonly number[]): DecodedPng => ({
  width: 2,
  height: 2,
  channels: 4,
  pixels: Buffer.from([
    ...pixels,
    255, 255, 255, 255,
    0, 0, 0, 255,
    255, 255, 255, 255,
  ]),
});

describe("Observer backend comparison helpers", () => {
  it("requires a mounted WebGPURenderer using native WebGPU and rejects internal or app fallback", () => {
    expect(observerBackendMismatches(activeNativeWebGpu, "native-webgpu")).toEqual([]);
    expect(observerBackendMismatches({
      ...activeNativeWebGpu,
      "data-observer-execution-backend": "webgl2-fallback",
    }, "native-webgpu")).toContain("mounted execution backend is not native WebGPU");
    expect(observerBackendMismatches({
      ...activeNativeWebGpu,
      "data-observer-renderer-family": "webgl-renderer",
      "data-observer-execution-backend": "webgl2",
      "data-observer-application-fallback": "app-webgl",
      "data-observer-renderer-failure-stage": "initialization",
    }, "native-webgpu")).toEqual(expect.arrayContaining([
      "mounted renderer family is not WebGPURenderer",
      "mounted execution backend is not native WebGPU",
      "native trial used application-level fallback",
      "renderer reported failure stage initialization",
    ]));
  });

  it("does not treat an available API or adapter as native mounted execution", () => {
    const adapterOnly = {
      ...activeNativeWebGpu,
      "data-observer-adapter-availability": "available",
      "data-observer-renderer-family": "webgpu-renderer",
      "data-observer-execution-backend": "webgl2-fallback",
    };
    expect(observerBackendMismatches(adapterOnly, "native-webgpu")).not.toEqual([]);
  });

  it("classifies the normal WebGL request and rejects accidental module-attempt evidence upstream", () => {
    expect(observerBackendMismatches(activeWebGl, "webgl")).toEqual([]);
    expect(observerBackendMismatches({
      ...activeWebGl,
      "data-observer-renderer-family": "webgpu-renderer",
      "data-observer-execution-backend": "webgl2-fallback",
    }, "webgl")).toContain("mounted renderer family is not WebGLRenderer");
  });

  it("reports cadence percentiles with an adequate-sample p99 rule and ignores invalid values", () => {
    const small = summarizeFrameCadence([16, 17, 18, Number.NaN, -1]);
    expect(small).toEqual({
      sampleCount: 3,
      medianMs: 17,
      p95Ms: 18,
      p99Ms: null,
      maximumMs: 18,
      intervalsOver50Ms: 0,
    });
    const large = summarizeFrameCadence(Array.from({ length: 100 }, (_, index) => index + 1));
    expect(large.p99Ms).toBe(99);
  });

  it("measures subject detail and paired screenshot differences inside the selected ROI", () => {
    const first = syntheticPng([10, 20, 30, 255]);
    const second = syntheticPng([40, 20, 30, 255]);
    const full = { left: 0, top: 0, right: 2, bottom: 2 };
    expect(summarizePixelRegion(first, full).sampleCount).toBe(4);
    expect(subjectRoiHasMeaningfulPixels(summarizePixelRegion(first, full))).toBe(false);
    const diff = comparePixelRegions(first, second, full, 16);
    expect(diff.changedPixelCount).toBe(1);
    expect(diff.changedPixelFraction).toBe(0.25);
    expect(diff.meanAbsoluteRgbDifference).toBeCloseTo(2.5);
    expect(() => comparePixelRegions(first, { ...second, width: 1 }, full)).toThrow(/different dimensions/);
  });

  it("serializes a JSON-safe report while preserving null unsupported measurements", () => {
    const value = { schemaVersion: 1, observerGpuTimeMs: null, invalidTrials: ["native backend fallback"] };
    const serialized = serializeBenchmarkReport(value);
    expect(JSON.parse(serialized)).toEqual(value);
  });

  it("isolates benchmark discovery from the development and production E2E suites", () => {
    expect(developmentConfig.testDir).toBe("./src/tests/e2e");
    expect(productionConfig.testDir).toBe("./src/tests/e2e");
    expect(benchmarkConfig.testDir).toBe("./src/tests/benchmarks");
    expect(benchmarkConfig.testMatch).toEqual(["**/*.bench.ts"]);
  });
});
