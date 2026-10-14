import { describe, expect, it } from "vitest";
import type { DecodedPng, ImageDifferenceSummary, MountedObserverEvidence, PixelRegion } from "../benchmarks/observerBackendBenchmark";
import {
  compareBaselineAndCompositedRegion,
  evaluateVisualParityAcceptance,
  readNativeObserverAfterAdapterProbe,
  waitForNativeAdapterAvailability,
  type OverlayResponseMetric,
  type VisualParityAcceptanceInput,
} from "../benchmarks/observerVisualParityDiagnostics";

const imageDifference = (meanAbsoluteRgbDifference = 2): ImageDifferenceSummary => ({
  meanAbsoluteRgbDifference,
  changedPixelCount: 20,
  changedPixelFraction: 0.02,
  meanSignedLuminanceDifference: 0,
});

const region: PixelRegion = { left: 0, top: 0, right: 2_000, bottom: 2_000 };

const solidImage = (value: number): DecodedPng => ({
  width: 2,
  height: 1,
  channels: 4,
  pixels: Buffer.from([value, value, value, 255, value, value, value, 255]),
});

const response = (
  area: "wholeCanvas" | "subjectRoi" | "background",
  overrides: Partial<OverlayResponseMetric> = {},
): OverlayResponseMetric => {
  const pixels = area === "wholeCanvas" ? 600 : area === "subjectRoi" ? 400 : 200;
  const intersection = Math.floor(pixels * 0.9);
  const union = pixels * 2 - intersection;
  return {
    region,
    activePixelUnion: union,
    activePixelIntersection: intersection,
    webglActivePixels: pixels,
    webgpuActivePixels: pixels,
    intersectionOverUnion: intersection / union,
    meanAbsoluteResponseDifference: 4,
    ...overrides,
  };
};

const validAcceptanceInput = (): VisualParityAcceptanceInput => {
  const baselineBackgroundRegions = Object.fromEntries(["topLeft", "topRight"].map((name) => [name, {
    eligible: true,
    pixelCount: 2_000,
    baselineDifference: imageDifference(2),
  }]));
  const backgroundRegions = Object.fromEntries(["topLeft", "topRight"].map((name) => [name, {
    eligible: true,
    difference: imageDifference(3),
  }]));
  const zeroBackgroundResponse = response("background", {
    activePixelUnion: 0,
    activePixelIntersection: 0,
    webglActivePixels: 0,
    webgpuActivePixels: 0,
    intersectionOverUnion: 0,
    meanAbsoluteResponseDifference: 0,
  });
  const overlayContribution = Object.fromEntries(["focusOnly", "dofOnly", "combined"].map((name) => [name, {
    wholeCanvas: response("wholeCanvas"),
    subjectRoi: response("subjectRoi"),
    backgroundRegions: {
      topLeft: response("background"),
      topRight: name === "focusOnly" ? zeroBackgroundResponse : response("background"),
    },
  }]));
  const compositedStates = Object.fromEntries(["no-overlays", "focus-plane-only", "dof-planes-only", "combined-overlays"].map((name) => [name, {
    wholeCanvas: imageDifference(5),
    subjectRoi: imageDifference(3),
    backgroundRegions,
  }]));
  return {
    baselineBackgroundRegions,
    compositedStates,
    overlayContribution,
    subjectEvidence: {
      webgl: { meaningful: true, sampleCount: 4_000, distinctColorBuckets: 100, luminanceStandardDeviation: 40 },
      webgpu: { meaningful: true, sampleCount: 4_000, distinctColorBuckets: 101, luminanceStandardDeviation: 39 },
    },
    overlayGeometry: {
      webgl: { focusVertices: 4, nearDofVertices: 4, farDofVertices: 4 },
      webgpu: { focusVertices: 4, nearDofVertices: 4, farDofVertices: 4 },
    },
    restoredNoOverlay: { webgl: imageDifference(0.5), webgpu: imageDifference(0.5) },
    consistency: { webgl: true, webgpu: true },
  };
};

const nativeEvidence = (overrides: MountedObserverEvidence = {}): MountedObserverEvidence => ({
  "data-observer-renderer-status": "active",
  "data-observer-renderer-generation": "17",
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
  ...overrides,
});

describe("Observer visual parity diagnostics", () => {
  it("compares composited regions from the selected state's actual pair, while retaining the clean baseline comparison", () => {
    const result = compareBaselineAndCompositedRegion(
      solidImage(10),
      solidImage(10),
      solidImage(80),
      solidImage(10),
      { left: 0, top: 0, right: 2, bottom: 1 },
    );

    expect(result.baselineDifference?.meanAbsoluteRgbDifference).toBe(0);
    expect(result.compositedDifference?.meanAbsoluteRgbDifference).toBeGreaterThan(0);
  });

  it("fails overall when whole-canvas overlay response passes but the façade response fails", () => {
    const input = validAcceptanceInput();
    const focus = input.overlayContribution.focusOnly;
    expect(focus).toBeDefined();
    const acceptance = evaluateVisualParityAcceptance({
      ...input,
      overlayContribution: {
        ...input.overlayContribution,
        focusOnly: {
          ...focus,
          subjectRoi: response("subjectRoi", { meanAbsoluteResponseDifference: 9 }),
        },
      },
    });

    expect(acceptance.status).toBe("fail");
    expect(acceptance.criteria.filter((criterion) => criterion.id.startsWith("overlay:focusOnly:wholeCanvas:")).every((criterion) => criterion.status === "pass"))
      .toBe(true);
    expect(acceptance.criteria.find((criterion) => criterion.id === "overlay:focusOnly:subjectRoi:response-difference")?.status)
      .toBe("fail");
    expect(acceptance.failures.map((criterion) => criterion.id)).toContain("overlay:focusOnly:subjectRoi:response-difference");
  });

  it("reports a required façade with missing evidence as a failure instead of silently omitting it", () => {
    const input = validAcceptanceInput();
    const acceptance = evaluateVisualParityAcceptance({
      ...input,
      overlayContribution: {
        ...input.overlayContribution,
        combined: { ...input.overlayContribution.combined, subjectRoi: null },
      },
    });
    expect(acceptance.failures.map((criterion) => criterion.id)).toContain("overlay:combined:subjectRoi:evidence");
    expect(acceptance.failures.map((criterion) => criterion.id)).toContain("overlay:combined:subjectRoi:participation");
  });

  it("collects independent background, whole-canvas, façade, and mask failures in one result", () => {
    const input = validAcceptanceInput();
    const acceptance = evaluateVisualParityAcceptance({
      ...input,
      baselineBackgroundRegions: {
        ...input.baselineBackgroundRegions,
        topLeft: {
          ...input.baselineBackgroundRegions.topLeft,
          baselineDifference: imageDifference(12),
        },
      },
      overlayContribution: {
        ...input.overlayContribution,
        focusOnly: {
          ...input.overlayContribution.focusOnly,
          wholeCanvas: response("wholeCanvas", { meanAbsoluteResponseDifference: 14 }),
          subjectRoi: response("subjectRoi", {
            activePixelIntersection: 100,
            activePixelUnion: 700,
            intersectionOverUnion: 100 / 700,
            meanAbsoluteResponseDifference: 12,
          }),
        },
      },
    });

    const failureIds = acceptance.failures.map((criterion) => criterion.id);
    expect(failureIds).toEqual(expect.arrayContaining([
      "baseline-background:topLeft",
      "overlay:focusOnly:wholeCanvas:response-difference",
      "overlay:focusOnly:subjectRoi:mask-alignment",
      "overlay:focusOnly:subjectRoi:response-difference",
    ]));
  });

  it("fails closed when backend-specific rendered, geometry, restoration, or ROI evidence is absent", () => {
    const input = validAcceptanceInput();
    const acceptance = evaluateVisualParityAcceptance({
      ...input,
      compositedStates: {
        ...input.compositedStates,
        "combined-overlays": {
          ...input.compositedStates["combined-overlays"],
          backgroundRegions: { topLeft: input.compositedStates["combined-overlays"].backgroundRegions.topLeft! },
        },
      },
      subjectEvidence: { webgl: input.subjectEvidence.webgl! },
      overlayGeometry: { webgl: input.overlayGeometry.webgl! },
      restoredNoOverlay: { webgl: input.restoredNoOverlay.webgl! },
      consistency: { webgl: true },
    });

    expect(acceptance.failures.map((criterion) => criterion.id)).toEqual(expect.arrayContaining([
      "composited:combined-overlays:background:topRight",
      "subject:webgpu:façade-rendered-content",
      "geometry:webgpu:focusPlane",
      "geometry:webgpu:nearDofPlane",
      "geometry:webgpu:farDofPlane",
      "restoration:webgpu:evidence",
      "capture-consistency:webgpu",
    ]));
  });

  it("marks a genuinely inactive optional background region not applicable but rejects a required subject with no pixels", () => {
    const input = validAcceptanceInput();
    const zero = response("subjectRoi", {
      activePixelUnion: 0,
      activePixelIntersection: 0,
      webglActivePixels: 0,
      webgpuActivePixels: 0,
      intersectionOverUnion: 0,
      meanAbsoluteResponseDifference: 0,
    });
    const acceptance = evaluateVisualParityAcceptance({
      ...input,
      overlayContribution: {
        ...input.overlayContribution,
        focusOnly: {
          ...input.overlayContribution.focusOnly,
          subjectRoi: zero,
        },
      },
    });
    expect(acceptance.criteria.find((criterion) => criterion.id === "overlay:focusOnly:background:topRight:participation")?.status)
      .toBe("not-applicable");
    expect(acceptance.criteria.find((criterion) => criterion.id === "overlay:focusOnly:subjectRoi:participation")?.status)
      .toBe("fail");
  });

  it("fails a required background teaching region when both backends unexpectedly contribute no pixels", () => {
    const input = validAcceptanceInput();
    const zero = response("background", {
      activePixelUnion: 0,
      activePixelIntersection: 0,
      webglActivePixels: 0,
      webgpuActivePixels: 0,
      intersectionOverUnion: 0,
      meanAbsoluteResponseDifference: 0,
    });
    const acceptance = evaluateVisualParityAcceptance({
      ...input,
      overlayContribution: {
        ...input.overlayContribution,
        dofOnly: {
          ...input.overlayContribution.dofOnly,
          backgroundRegions: {
            ...input.overlayContribution.dofOnly.backgroundRegions,
            topRight: zero,
          },
        },
      },
    });
    const criterion = acceptance.criteria.find((entry) => entry.id === "overlay:dofOnly:background:topRight:participation");
    expect(criterion?.status).toBe("fail");
    expect(criterion?.reason).toContain("required teaching region has no overlay contribution");
  });
});

describe("native Observer qualification waits for adapter evidence", () => {
  it("reads authoritative mounted evidence after pending adapter status resolves to available", async () => {
    let adapterAvailability = "pending";
    let reads = 0;
    let now = 0;
    const result = await readNativeObserverAfterAdapterProbe(
      async () => {
        reads += 1;
        return nativeEvidence({ "data-observer-adapter-availability": adapterAvailability });
      },
      () => waitForNativeAdapterAvailability(
        async () => adapterAvailability,
        {
          timeoutMs: 500,
          pollIntervalMs: 100,
          now: () => now,
          wait: async () => {
            now += 100;
            adapterAvailability = "available";
          },
        },
      ),
    );

    expect(reads).toBe(2);
    expect(result.initial["data-observer-adapter-availability"]).toBe("pending");
    expect(result.final["data-observer-adapter-availability"]).toBe("available");
    expect(result.mismatches).toEqual([]);
  });

  it.each(["unavailable", "api-absent", "request-rejected", "timed-out"] as const)(
    "records terminal adapter status %s after waiting and rejects native qualification",
    async (adapterAvailability) => {
      let reads = 0;
      const result = await readNativeObserverAfterAdapterProbe(
        async () => {
          reads += 1;
          return nativeEvidence({ "data-observer-adapter-availability": adapterAvailability });
        },
        () => waitForNativeAdapterAvailability(async () => adapterAvailability),
      );
      expect(reads).toBe(2);
      expect(result.final["data-observer-adapter-availability"]).toBe(adapterAvailability);
      expect(result.mismatches.some((mismatch) => mismatch.includes("adapter availability was not established"))).toBe(true);
      expect(result.backendMismatches).toContain("WebGPU adapter was not reported available");
    },
  );

  it("records adapter timeout and rejects a renderer that changes to application fallback while waiting", async () => {
    let now = 0;
    const timedOut = await readNativeObserverAfterAdapterProbe(
      async () => nativeEvidence({ "data-observer-adapter-availability": "pending" }),
      () => waitForNativeAdapterAvailability(async () => "pending", {
        timeoutMs: 150,
        pollIntervalMs: 100,
        now: () => now,
        wait: async (milliseconds) => { now += milliseconds; },
      }),
    );
    expect(timedOut.adapterWaitError).toMatch(/Timed out waiting/);

    let reads = 0;
    const changedDuringWait = await readNativeObserverAfterAdapterProbe(
      async () => {
        reads += 1;
        return nativeEvidence(reads === 1
          ? { "data-observer-adapter-availability": "pending" }
          : {
            "data-observer-adapter-availability": "available",
            "data-observer-renderer-generation": "18",
            "data-observer-renderer-family": "webgl-renderer",
            "data-observer-execution-backend": "webgl2",
            "data-observer-application-fallback": "app-webgl",
          });
      },
      async () => {},
    );
    expect(changedDuringWait.mountIdentityMismatches).toContain(
      "mounted renderer identity changed while awaiting adapter evidence: data-observer-renderer-generation",
    );
    expect(changedDuringWait.backendMismatches).toEqual(expect.arrayContaining([
      "mounted renderer family is not WebGPURenderer",
      "mounted execution backend is not native WebGPU",
      "native trial used application-level fallback",
    ]));
  });
});
