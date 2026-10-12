import { describe, expect, it } from "vitest";
import developmentConfig from "../../../playwright.config";
import productionConfig from "../../../playwright.production.config";
import benchmarkConfig from "../../../playwright.observer-backend-benchmark.config";
import {
  analyzeOrbitCadence,
  calculateBenchmarkWallTimes,
  comparePixelRegions,
  deriveImageRestorationTolerance,
  imageMatchesRestorationTolerance,
  observerBackendMismatches,
  serializeBenchmarkReport,
  subjectRoiHasMeaningfulPixels,
  summarizeFrameCadence,
  summarizePixelRegion,
  type DecodedPng,
  type MountedObserverEvidence,
  type OrbitFrame,
  type OrbitPointerEvent,
  type BenchmarkTimingMarks,
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

const uniformPng = (width: number, height: number, value: number): DecodedPng => {
  const pixels: number[] = [];
  for (let index = 0; index < width * height; index += 1) {
    pixels.push(value, value, value, 255);
  }
  return { width, height, channels: 4, pixels: Buffer.from(pixels) };
};

const changedPngPixel = (image: DecodedPng, index: number, amount: number): DecodedPng => {
  const pixels = Buffer.from(image.pixels);
  const offset = index * image.channels;
  for (let channel = 0; channel < 3; channel += 1) {
    pixels[offset + channel] = Math.min(255, (pixels[offset + channel] ?? 0) + amount);
  }
  return { ...image, pixels };
};

const orbitEvents: OrbitPointerEvent[] = [
  { type: "pointerdown", timeMs: 0, pointerId: 7, gestureId: 1 },
  { type: "pointermove", timeMs: 250, pointerId: 7, gestureId: 1 },
  { type: "pointerup", timeMs: 1_000, pointerId: 7, gestureId: 1 },
  { type: "pointerdown", timeMs: 2_000, pointerId: 7, gestureId: 2 },
  { type: "pointermove", timeMs: 2_500, pointerId: 7, gestureId: 2 },
  { type: "pointerup", timeMs: 3_000, pointerId: 7, gestureId: 2 },
  { type: "pointerdown", timeMs: 4_000, pointerId: 7, gestureId: 3 },
  { type: "pointermove", timeMs: 4_500, pointerId: 7, gestureId: 3 },
  { type: "pointerup", timeMs: 5_000, pointerId: 7, gestureId: 3 },
  { type: "pointerdown", timeMs: 6_000, pointerId: 7, gestureId: 4 },
  { type: "pointermove", timeMs: 6_500, pointerId: 7, gestureId: 4 },
  { type: "pointerup", timeMs: 7_000, pointerId: 7, gestureId: 4 },
];

const orbitFrames: OrbitFrame[] = [
  { timestampMs: -100 }, { timestampMs: 0 }, { timestampMs: 400 }, { timestampMs: 900 }, { timestampMs: 1_000 },
  { timestampMs: 1_100 }, { timestampMs: 1_500 }, { timestampMs: 1_900 }, { timestampMs: 2_000 },
  { timestampMs: 2_500 }, { timestampMs: 3_000 }, { timestampMs: 3_100 }, { timestampMs: 3_500 }, { timestampMs: 3_900 },
  { timestampMs: 4_000 }, { timestampMs: 4_500 }, { timestampMs: 5_000 }, { timestampMs: 5_100 }, { timestampMs: 5_500 }, { timestampMs: 5_900 },
  { timestampMs: 6_000 }, { timestampMs: 6_500 }, { timestampMs: 7_000 }, { timestampMs: 7_100 },
];

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

  it("keeps context setup, navigation readiness, adapter diagnostics, and capture on separate monotonic intervals", () => {
    const marks: BenchmarkTimingMarks = {
      contextPageSetupStartedAtMs: 100,
      navigationStartedAtMs: 200,
      documentReadyAtMs: 250,
      rendererActiveAtMs: 300,
      adapterDiagnosticCompletedAtMs: 450,
      firstVerifiedObserverCaptureAtMs: 410,
    };
    expect(calculateBenchmarkWallTimes(marks)).toEqual({
      contextPageSetupWallMs: 100,
      navigationToDocumentReadyWallMs: 50,
      navigationToActiveRendererWallMs: 100,
      activeRendererToAdapterDiagnosticWallMs: 150,
      navigationToAdapterDiagnosticWallMs: 250,
      navigationToFirstVerifiedObserverCaptureWallMs: 210,
    });
    expect(calculateBenchmarkWallTimes({
      ...marks,
      rendererActiveAtMs: null,
      adapterDiagnosticCompletedAtMs: null,
    })).toMatchObject({
      navigationToActiveRendererWallMs: null,
      activeRendererToAdapterDiagnosticWallMs: null,
      navigationToAdapterDiagnosticWallMs: null,
    });
    expect(calculateBenchmarkWallTimes({
      ...marks,
      rendererActiveAtMs: 200,
    }).navigationToActiveRendererWallMs).toBeNull();
    expect(JSON.parse(JSON.stringify(calculateBenchmarkWallTimes(marks)))).toHaveProperty(
      "navigationToFirstVerifiedObserverCaptureWallMs",
      210,
    );
  });

  it("measures cadence only inside complete pointer gestures and reports inter-gesture intervals separately", () => {
    const analysis = analyzeOrbitCadence(orbitEvents, orbitFrames, 4);
    expect(analysis.invalidReasons).toEqual([]);
    expect(analysis.observedGestureCount).toBe(4);
    expect(analysis.workloadDurationMs).toBe(7_000);
    expect(analysis.totalActiveDragDurationMs).toBe(4_000);
    expect(analysis.interGestureDurationMs).toEqual([1_000, 1_000, 1_000]);
    expect(analysis.activeGestureCadence.sampleCount).toBe(9);
    expect(analysis.activeGestureCadence.medianMs).toBe(500);
    expect(analysis.activeGestureCadence.intervalsOver50Ms).toBe(9);
    expect(analysis.interGestureCadence.sampleCount).toBe(12);
    expect(analysis.excludedFrameIntervalCount).toBe(2);
    expect(analysis.gestures.every((gesture) => gesture.pointerMoveCount === 1)).toBe(true);
    expect(analysis.activeGestureCadence.sampleCount).not.toBe(orbitFrames.length - 1);
  });

  it("handles a short workload ending before the old 2.5-second window without counting idle frames", () => {
    const shortEvents = orbitEvents.map((event) => ({ ...event, timeMs: event.timeMs / 5 }));
    const shortFrames = orbitFrames.map((frame) => ({ ...frame, timestampMs: frame.timestampMs / 5 }));
    const analysis = analyzeOrbitCadence(shortEvents, shortFrames, 4);
    expect(analysis.workloadDurationMs).toBe(1_400);
    expect(analysis.totalActiveDragDurationMs).toBe(800);
    expect(analysis.activeGestureCadence.sampleCount).toBe(9);
    expect(analysis.excludedFrameIntervalCount).toBe(2);
    expect(analysis.invalidReasons).toEqual([]);
  });

  it("rejects incomplete or non-moving pointer gestures instead of padding cadence with idle frames", () => {
    const missingPointerUp = orbitEvents.filter((event) => !(event.gestureId === 4 && event.type === "pointerup"));
    const incomplete = analyzeOrbitCadence(missingPointerUp, orbitFrames, 4);
    expect(incomplete.invalidReasons).toContain("pointer gesture 4 did not have one complete down/up lifecycle");

    const noMovement = orbitEvents.filter((event) => !(event.gestureId === 2 && event.type === "pointermove"));
    expect(analyzeOrbitCadence(noMovement, orbitFrames, 4).invalidReasons)
      .toContain("pointer gesture 2 had no pointer movement");

    const duplicateDown = [
      ...orbitEvents,
      { type: "pointerdown" as const, timeMs: 10, pointerId: 7, gestureId: 1 },
    ];
    expect(analyzeOrbitCadence(duplicateDown, orbitFrames, 4).invalidReasons)
      .toContain("pointer gesture 1 did not have one complete down/up lifecycle");
    expect(analyzeOrbitCadence(orbitEvents.slice().reverse(), orbitFrames, 4).invalidReasons)
      .toContain("pointer event timestamps were not monotonic");
    expect(analyzeOrbitCadence(orbitEvents, orbitFrames.slice().reverse(), 4).invalidReasons)
      .toContain("requestAnimationFrame timestamps were not strictly monotonic");

    const noActiveFrames = analyzeOrbitCadence(orbitEvents, [
      { timestampMs: -100 },
      { timestampMs: 0 },
      { timestampMs: 7_000 },
      { timestampMs: 7_100 },
    ], 4);
    expect(noActiveFrames.activeGestureCadence.sampleCount).toBe(0);
    expect(noActiveFrames.invalidReasons).toContain("one or more pointer gestures contained no complete requestAnimationFrame interval");
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

  it("derives Ground Glass restoration tolerance from repeated captures and catches a global +8/255 shift", () => {
    const baseline = uniformPng(8, 8, 80);
    const region = { left: 0, top: 0, right: 8, bottom: 8 };
    const tolerance = deriveImageRestorationTolerance([
      comparePixelRegions(baseline, baseline, region, 1),
      comparePixelRegions(baseline, baseline, region, 1),
    ]);
    expect(tolerance).toEqual({
      changedChannelThreshold: 1,
      baselineCaptureCount: 3,
      maximumChangedPixelFraction: 0,
      maximumMeanAbsoluteRgbDifference: 0,
      maximumAbsoluteMeanSignedLuminanceDifference: 0,
    });

    const uniformlyDrifted = uniformPng(8, 8, 88);
    const drift = comparePixelRegions(baseline, uniformlyDrifted, region, tolerance.changedChannelThreshold);
    expect(drift.changedPixelFraction).toBe(1);
    expect(drift.meanAbsoluteRgbDifference).toBe(8);
    expect(drift.meanSignedLuminanceDifference).toBeCloseTo(8);
    expect(comparePixelRegions(baseline, uniformlyDrifted, region, 16).changedPixelFraction).toBe(0);
    expect(imageMatchesRestorationTolerance(drift, tolerance)).toBe(false);
  });

  it("catches localized restoration changes below the old 16-level pixel threshold", () => {
    const baseline = uniformPng(8, 8, 80);
    const localizedChange = changedPngPixel(baseline, 27, 2);
    const region = { left: 0, top: 0, right: 8, bottom: 8 };
    const repeatedDifference = comparePixelRegions(baseline, baseline, region, 1);
    const tolerance = deriveImageRestorationTolerance([repeatedDifference, repeatedDifference]);
    const lowThresholdDifference = comparePixelRegions(baseline, localizedChange, region, 1);
    const oldThresholdDifference = comparePixelRegions(baseline, localizedChange, region, 16);
    expect(lowThresholdDifference.changedPixelCount).toBe(1);
    expect(lowThresholdDifference.changedPixelFraction).toBe(1 / 64);
    expect(oldThresholdDifference.changedPixelCount).toBe(0);
    expect(imageMatchesRestorationTolerance(lowThresholdDifference, tolerance)).toBe(false);
  });

  it("accepts only changes within the measured repeated-capture noise", () => {
    const baseline = uniformPng(4, 4, 100);
    const repeatedCapture = changedPngPixel(baseline, 5, 1);
    const region = { left: 0, top: 0, right: 4, bottom: 4 };
    const baselineVariation = comparePixelRegions(baseline, repeatedCapture, region, 1);
    const tolerance = deriveImageRestorationTolerance([baselineVariation, baselineVariation]);
    expect(imageMatchesRestorationTolerance(baselineVariation, tolerance)).toBe(true);
    const globalChange = uniformPng(4, 4, 101);
    expect(imageMatchesRestorationTolerance(
      comparePixelRegions(baseline, globalChange, region, 1),
      tolerance,
    )).toBe(false);
  });

  it("serializes a JSON-safe report while preserving null unsupported measurements", () => {
    const timing = calculateBenchmarkWallTimes({
      contextPageSetupStartedAtMs: 10,
      navigationStartedAtMs: 20,
      documentReadyAtMs: 35,
      rendererActiveAtMs: null,
      adapterDiagnosticCompletedAtMs: null,
      firstVerifiedObserverCaptureAtMs: null,
    });
    const value = { schemaVersion: 2, timing, observerGpuTimeMs: null, invalidTrials: ["native backend fallback"] };
    const serialized = serializeBenchmarkReport(value);
    expect(JSON.parse(serialized)).toEqual(value);
    expect(JSON.parse(serialized).timing).toMatchObject({
      contextPageSetupWallMs: 10,
      navigationToDocumentReadyWallMs: 15,
      navigationToActiveRendererWallMs: null,
      navigationToFirstVerifiedObserverCaptureWallMs: null,
    });
  });

  it("isolates benchmark discovery from the development and production E2E suites", () => {
    expect(developmentConfig.testDir).toBe("./src/tests/e2e");
    expect(productionConfig.testDir).toBe("./src/tests/e2e");
    expect(benchmarkConfig.testDir).toBe("./src/tests/benchmarks");
    expect(benchmarkConfig.testMatch).toEqual(["**/*.bench.ts"]);
  });
});
