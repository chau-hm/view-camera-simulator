import { expect, test, type Page } from "@playwright/test";
import { REVISION } from "three";
import { gunzipSync } from "node:zlib";
import type {
  GroundGlassB1BoundaryProbeReadback,
  GroundGlassApertureGatherCaptureReadback,
} from "../../render/webgpu/groundGlassWebGpuTestSeam";
import type { GroundGlassApertureGatherQualityMode } from "../../render/webgpu/groundGlassApertureGatherPolicy";
import {
  evaluateGroundGlassApertureGatherR3,
  type GroundGlassApertureGatherR3Capture,
  type GroundGlassApertureGatherR3CaptureMatrix,
  type GroundGlassR3QualityMode,
} from "../../render/webgpu/groundGlassApertureGatherQuality";
import { clickStageAt } from "./helpers/groundGlass";
import { setStepRangeInput } from "./helpers/stepRangeInput";

type CaptureReadbackBuffers = NonNullable<GroundGlassApertureGatherCaptureReadback["readbackBuffers"]>;
type PackedCaptureReadbacks = Readonly<{
  capture: Omit<GroundGlassApertureGatherCaptureReadback, "readbackBuffers"> & { readbackBuffers: null };
  fields: readonly Readonly<{
    name: keyof CaptureReadbackBuffers;
    offset: number;
    byteLength: number;
    type: "Float32Array" | "Uint8Array" | "Int32Array";
  }>[];
  gzipBase64: string;
}>;

const nativeRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const rawPilotEnabled = process.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true";
const physicalResearchEnabled = process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "1";
const gatherResearchEnabled = process.env.GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH === "1";
const M5_REQUIRED = nativeRequired && rawPilotEnabled && physicalResearchEnabled && gatherResearchEnabled;
const M4_RAW_BASELINE_REQUIRED = nativeRequired && rawPilotEnabled && physicalResearchEnabled && !gatherResearchEnabled;

/**
 * Frozen after the separate exploratory capture. Convergence and near tolerances
 * match existing M5 CPU/GPU conformance limits; ROI minima require bounded
 * populations, one fractional near pixel, and at least 100 adjacent sign pairs.
 * A 4 px overrun is deliberately over ten times Phase L's 0.336 px observation.
 * The 0.01 source-target RGB blur signal is needed before blur-preservation claims;
 * this contract is limited to one captured state and is not a production threshold.
 */
const M5_R3_CONFIRMATORY_THRESHOLDS = Object.freeze({
  revision: "architecture-rise-f8-r3-review-fix-v2",
  evidenceScope: "single-native-state",
  frozenBeforeConfirmatory: true,
  minimumInteriorFarPixels: 100,
  minimumDepthEdgePixels: 100,
  minimumNearFarBoundaryPairs: 100,
  minimumNearCoveragePixels: 100,
  minimumFractionalCoveragePixels: 1,
  minimumNearFarBoundaryCoveragePixels: 100,
  minimumSpreadOutsideSharpNearPixels: 100,
  minimumFallbackBoundaryPairs: 100,
  minimumStrongOverrunPx: 4,
  maximumReferenceRmse: 0.001,
  maximumReferenceChannelError: 0.01,
  maximumReferenceInteriorFarRmse: 0.001,
  maximumReferenceDepthEdgeRmse: 0.001,
  maximumB1FullFrameRmse: 0.05,
  maximumB1InteriorFarRmse: 0.05,
  maximumB1DepthEdgeRmse: 0.05,
  maximumB1SignedBoundaryRmse: 0.1,
  maximumBlurGradientRelativeError: 0.25,
  maximumMeaningfulBlurFallbackFraction: 0.1,
  maximumFallbackBoundaryGradientRelativeError: 0.25,
  maximumFallbackSourceError: 0.001,
  maximumNearCpuRgbRmse: 0.001,
  maximumNearCpuAlphaRmse: 0.001,
  maximumNearB1RgbMaximumError: 0.001,
  maximumNearB1AlphaMaximumError: 0.001,
  minimumMeaningfulBlurRgbDifference: 0.01,
  depthEdgeThreshold: 0.0001,
} as const);

const paneFor = (page: Page) => page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
const pilotFor = (page: Page) => page.getByTestId("ground-glass-webgpu-pilot");

const waitForCurrentFrame = async (page: Page): Promise<void> => {
  const pane = paneFor(page);
  await expect.poll(async () => {
    const requestId = await pane.getAttribute("data-frame-request-id");
    return Boolean(
      requestId
      && requestId === await pane.getAttribute("data-last-completed-request-id")
      && await pane.getAttribute("data-frame-result-status") === "completed",
    );
  }, { timeout: 120_000 }).toBe(true);
};

const captureGather = async (
  page: Page,
  qualityMode: GroundGlassApertureGatherQualityMode,
  token: string,
  retainReadbackBuffers = false,
): Promise<GroundGlassApertureGatherCaptureReadback> => {
  const triggered = await page.evaluate(({ captureToken, mode, retainBuffers }) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestApertureGatherCapture) return false;
    control.apertureGatherCaptureReadback = null;
    control.apertureGatherCaptureRequest = {
      token: captureToken,
      qualityMode: mode,
      retainReadbackBuffers: retainBuffers,
    };
    control.requestApertureGatherCapture();
    return true;
  }, { captureToken: token, mode: qualityMode, retainBuffers: retainReadbackBuffers });
  expect(triggered, "The development-only M5 capture seam is registered on the mounted adapter").toBe(true);
  const deadline = Date.now() + 180_000;
  let captured = false;
  while (Date.now() < deadline) {
    const state = await page.evaluate((captureToken) => ({
      captured: window.__groundGlassWebGpuM3TestControl?.apertureGatherCaptureReadback?.token === captureToken,
      status: document.querySelector<HTMLElement>("[data-aperture-gather-status]")
        ?.getAttribute("data-aperture-gather-status") ?? "unknown",
      failure: document.querySelector<HTMLElement>("[data-aperture-gather-status]")
        ?.getAttribute("data-aperture-gather-failure-reason") ?? "no reason recorded",
    }), token);
    if (state.captured) {
      captured = true;
      break;
    }
    if (state.status === "failed" || state.status === "unsupported") {
      throw new Error(`M5 capture ${state.status}: ${state.failure}`);
    }
    await page.waitForTimeout(250);
  }
  expect(captured, `M5 capture ${token} must publish before the bounded capture timeout`).toBe(true);
  const readback = await page.evaluate(async (captureToken) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    const result = control?.apertureGatherCaptureReadback;
    if (!control || result?.token !== captureToken) return null;
    if (!result.readbackBuffers) return { capture: { ...result, readbackBuffers: null }, fields: [], gzipBase64: "" };
    const entries = Object.entries(result.readbackBuffers) as [
      keyof CaptureReadbackBuffers,
      Float32Array | Uint8Array | Int32Array,
    ][];
    let totalBytes = 0;
    const fields = entries.map(([name, values]) => {
      const field = {
        name,
        offset: totalBytes,
        byteLength: values.byteLength,
        type: values.constructor.name as "Float32Array" | "Uint8Array" | "Int32Array",
      };
      totalBytes += values.byteLength;
      return field;
    });
    const packed = new Uint8Array(totalBytes);
    for (const [name, values] of entries) {
      const field = fields.find((candidate) => candidate.name === name);
      if (!field) throw new Error(`Missing packed M5 capture field ${name}`);
      packed.set(new Uint8Array(values.buffer, values.byteOffset, values.byteLength), field.offset);
    }
    const compressedBuffer = await new Response(
      new Blob([packed]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer();
    const compressed = new Uint8Array(compressedBuffer);
    const base64Chunks: string[] = [];
    for (let offset = 0; offset < compressed.length; offset += 0x6000) {
      base64Chunks.push(btoa(String.fromCharCode(...compressed.subarray(offset, offset + 0x6000))));
    }
    const copied = {
      capture: { ...result, readbackBuffers: null },
      fields,
      gzipBase64: base64Chunks.join(""),
    };
    control.apertureGatherCaptureReadback = null;
    return copied;
  }, token);
  if (!readback) throw new Error(`M5 did not return capture ${token}`);
  const packed = readback as unknown as PackedCaptureReadbacks;
  if (!retainReadbackBuffers || !packed.gzipBase64) {
    return packed.capture as GroundGlassApertureGatherCaptureReadback;
  }
  const raw = new Uint8Array(gunzipSync(Buffer.from(packed.gzipBase64, "base64")));
  const readbackBuffers = Object.fromEntries(packed.fields.map((field) => {
    const bytes = raw.buffer.slice(field.offset, field.offset + field.byteLength);
    if (field.type === "Float32Array") return [field.name, new Float32Array(bytes)];
    if (field.type === "Int32Array") return [field.name, new Int32Array(bytes)];
    return [field.name, new Uint8Array(bytes)];
  })) as CaptureReadbackBuffers;
  return { ...packed.capture, readbackBuffers };
};

const toR3Capture = (
  capture: GroundGlassApertureGatherCaptureReadback,
): GroundGlassApertureGatherR3Capture => {
  const buffers = capture.readbackBuffers;
  if (!buffers) throw new Error(`R3 capture ${capture.captureId} did not retain its requested readbacks`);
  return {
    captureId: capture.captureId,
    requestId: capture.requestId,
    sceneId: capture.sceneId,
    sceneSourceRevision: capture.sceneSourceRevision,
    effectiveOpticalRequestFingerprint: capture.effectiveOpticalRequestFingerprint,
    cameraStateFingerprint: capture.cameraStateFingerprint,
    readbackOrigin: capture.readbackOrigin,
    qualityMode: capture.qualityMode as GroundGlassR3QualityMode,
    sourceDimensions: { widthPx: capture.sourceWidthPx, heightPx: capture.sourceHeightPx },
    gatherDimensions: { widthPx: capture.farGatherWidthPx, heightPx: capture.farGatherHeightPx },
    sampledFilmDimensionsMm: capture.sampledFilmDimensionsMm,
    sampleCount: capture.sampleCount as 32 | 64,
    maximumRadiusPx: capture.maximumRadiusPx,
    colorDomain: capture.colorDomain,
    targetFormats: {
      sourceColor: capture.targetFormats.sourceColor ?? "",
      physical: capture.targetFormats.physical ?? "",
      validity: capture.targetFormats.validity ?? "",
      far: capture.targetFormats.far ?? "",
      near: capture.targetFormats.near ?? "",
      b1: capture.targetFormats.b1 ?? "",
    },
    reportedRadiusEvidence: {
      maximumUncappedRadiusPx: capture.radius.maximumUncappedRadiusPx,
      cappedPixelCount: capture.radius.cappedPixelCount,
    },
    readbackBuffers: {
      sourceRgba: Float32Array.from(buffers.sourceRgba),
      depth: Float32Array.from(buffers.depth),
      physicalRgba: Float32Array.from(buffers.physicalRgba),
      validity: Uint8Array.from(buffers.validity),
      farGatherRgba: Float32Array.from(buffers.farGatherRgba),
      b1FarRgba: Float32Array.from(buffers.b1FarRgba),
      nearBeforeB1Rgba: Float32Array.from(buffers.nearBeforeB1Rgba),
      nearAfterB1Rgba: Float32Array.from(buffers.nearAfterB1Rgba),
      nearCpuReferenceRgba: Float32Array.from(buffers.nearCpuReferenceRgba),
      observedSelectedGatherIds: Int32Array.from(buffers.observedSelectedGatherIds),
      observedGatherCenterSourceIds: Int32Array.from(buffers.observedGatherCenterSourceIds),
      b1DecisionRgba: Uint8Array.from(buffers.b1Decision),
    },
  };
};

const captureB1BoundaryProbe = async (
  page: Page,
  token: string,
): Promise<GroundGlassB1BoundaryProbeReadback> => {
  const triggered = await page.evaluate((probeToken) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestGroundGlassB1BoundaryProbe) return false;
    control.groundGlassB1BoundaryProbeReadback = null;
    control.groundGlassB1BoundaryProbeRequest = { token: probeToken };
    control.requestGroundGlassB1BoundaryProbe();
    return true;
  }, token);
  expect(triggered, "The test-only B1 boundary probe is registered on the mounted native adapter").toBe(true);

  const deadline = Date.now() + 180_000;
  let captured = false;
  while (Date.now() < deadline) {
    const state = await page.evaluate((probeToken) => ({
      captured: window.__groundGlassWebGpuM3TestControl?.groundGlassB1BoundaryProbeReadback?.token === probeToken,
      status: document.querySelector<HTMLElement>("[data-aperture-gather-status]")
        ?.getAttribute("data-aperture-gather-status") ?? "unknown",
      failure: document.querySelector<HTMLElement>("[data-aperture-gather-status]")
        ?.getAttribute("data-aperture-gather-failure-reason") ?? "no reason recorded",
    }), token);
    if (state.captured) {
      captured = true;
      break;
    }
    if (state.status === "failed" || state.status === "unsupported") {
      throw new Error(`B1 boundary probe ${state.status}: ${state.failure}`);
    }
    await page.waitForTimeout(250);
  }
  expect(captured, `B1 boundary probe ${token} must publish before the bounded timeout`).toBe(true);
  const readback = await page.evaluate((probeToken) => {
    const result = window.__groundGlassWebGpuM3TestControl?.groundGlassB1BoundaryProbeReadback;
    return result?.token === probeToken ? result : null;
  }, token);
  if (!readback) throw new Error(`B1 boundary probe did not return ${token}`);
  return readback;
};

const expectNativeM5Identity = async (page: Page): Promise<void> => {
  const pane = paneFor(page);
  const pilot = pilotFor(page);
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(pilot).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-physical-coc-status", "completed", { timeout: 120_000 });
  const gatherStatus = await pilot.getAttribute("data-aperture-gather-status");
  if (gatherStatus === "unsupported" || gatherStatus === "failed") {
    throw new Error(`Native M5 state is ${gatherStatus}: ${
      await pilot.getAttribute("data-aperture-gather-quality-gate-reason")
      ?? await pilot.getAttribute("data-aperture-gather-failure-reason")
      ?? "no reason recorded"
    }`);
  }
  await expect(pilot).toHaveAttribute("data-aperture-gather-status", "completed", { timeout: 120_000 });
};

const expectCaptureMatchesCurrentFrame = async (
  page: Page,
  result: GroundGlassApertureGatherCaptureReadback,
): Promise<void> => {
  const pane = paneFor(page);
  const pilot = pilotFor(page);
  expect(result.sceneId).toBe("architecture-rise");
  expect(result.requestId).toBe(await pane.getAttribute("data-frame-request-id"));
  expect(result.requestId).toBe(await pilot.getAttribute("data-frame-request-id"));
  expect(result.channelId).toBe("default");
  expect(result.rendererGenerationId).toBe(await pane.getAttribute("data-renderer-generation"));
  expect(result.rendererFamily).toBe("webgpu-renderer");
  expect(result.actualExecutionApi).toBe("webgpu");
  expect(result.internalFallback).toBe("none");
  expect(result.readbackOrigin).not.toBe("unresolved");
  expect(result.cpuB1Conformance.status, JSON.stringify(result.cpuB1Conformance)).toBe("passed");
  expect(result.sourceToGatherMappingConformance.status).toBe("passed");
  expect(result.sourceToGatherMappingConformance.mismatchCount).toBe(0);
  expect(result.cpuB1Conformance.selectedCenterProvenanceMismatchCount).toBe(0);
  expect(result.cpuB1Conformance.eligibilityMismatchCount).toBe(0);
  expect(result.cpuB1Conformance.fallbackReasonMismatchCount).toBe(0);
  expect(result.cpuB1Conformance.selectedPathMismatchCount).toBe(0);
  expect(result.cpuB1Conformance.fallbackSourceMaximumError).toBeLessThanOrEqual(0.001);
  expect(result.farGatherCpuReference.rgbRmse).toBeLessThanOrEqual(0.001);
  expect(result.farGatherCpuReference.rgbMaximumError).toBeLessThanOrEqual(0.001);
  expect(result.farGatherCpuReference.pixelsOverMaximumErrorTolerance).toBe(0);
  expect(result.radius.physicalValuesUnchanged).toBe(true);
  expect(result.nearCoverageNontrivial).toBe(true);
  expect(result.nearRgbInvariantMaximumError).toBeLessThanOrEqual(0.001);
  expect(result.nearAlphaInvariantMaximumError).toBeLessThanOrEqual(0.001);
  expect(result.completedPasses).toEqual(expect.arrayContaining([
    "sourceIdentity",
    "gatherIdentity",
    "gatherCenterProvenance",
    "selectedProvenance",
    "farGather",
    "nearGather",
    "farReconstructionB1",
    "researchComposite",
  ]));
  expect(result.targetFormats).toMatchObject({
    sourceColor: "rgba8unorm",
    physical: "rgba16float",
    validity: "rgba8unorm",
    far: "rgba16float",
    near: "rgba16float",
    b1: "rgba16float",
    composite: "rgba16float",
    provenance: "rgba32float",
    decisions: "rgba8unorm",
  });
  expect(result.performance.gpuTimestampQueries).toBe("not-collected");
  expect(Number.isFinite(result.performance.readPixelsWaitWallMs)).toBe(true);
  expect(Number.isFinite(result.performance.readbackConversionCpuMs)).toBe(true);
  expect(Number.isFinite(result.performance.cpuReferenceWallClockMs)).toBe(true);
  expect(result.resourceInventory.memoryScope).toBe("m5-owned-target-attachments-only");
  expect(result.resourceInventory.m5OwnedRenderTargetCount).toBe(10);
  expect(result.resourceInventory.adapterOwnedFullscreenMaterialCount).toBe(10);
  expect(result.resourceInventory.adapterOwnedFullscreenSceneCount).toBe(10);
  expect(result.resourceInventory.adapterOwnedFullscreenGeometryCount).toBe(1);
  expect(result.resourceInventory.targetAllocations).toHaveLength(10);
  expect(result.resourceInventory.estimatedTargetAttachmentBytes).toBe(
    result.resourceInventory.targetAllocations.reduce((total, allocation) => total + allocation.estimatedBytes, 0),
  );
  expect(result.performance.operations.map(({ name }) => name)).toEqual(expect.arrayContaining([
    "farGather",
    "nearGather",
    "b1Reconstruction",
    "b1Decision",
    "researchComposite",
    "depthReadback",
  ]));
  for (const operation of result.performance.operations) {
    expect(Number.isFinite(operation.timing.rendererCallCpuMs)).toBe(true);
    expect(Number.isFinite(operation.timing.queueCompletionWaitMs)).toBe(true);
    expect(Number.isFinite(operation.timing.wallClockMs)).toBe(true);
  }
  await expect(pilot).toHaveAttribute("data-aperture-gather-quality-gate-status", "not-evaluated");
};

const expectFreshM5Frame = async (page: Page): Promise<string> => {
  const pane = paneFor(page);
  const pilot = pilotFor(page);
  await waitForCurrentFrame(page);
  await expectNativeM5Identity(page);
  const requestId = await pane.getAttribute("data-frame-request-id");
  if (!requestId) throw new Error("The accepted Ground Glass frame request ID is missing");
  await expect(pilot).toHaveAttribute("data-aperture-gather-request-id", requestId, { timeout: 120_000 });
  await expect(pilot).toHaveAttribute(
    "data-aperture-gather-quality-gate-status", "not-evaluated", { timeout: 120_000 },
  );
  return requestId;
};

const prepareNativeM5F8Page = async (page: Page): Promise<string[]> => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {};
  });
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const pane = paneFor(page);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expectNativeM5Identity(page);
  await page.getByRole("radiogroup", { name: "Aperture", exact: true })
    .getByRole("radio", { name: "f/8", exact: true }).check();
  await waitForCurrentFrame(page);
  await expectNativeM5Identity(page);
  return pageErrors;
};

test("native M5 app adapter captures B1 provenance, source fallback, and near coverage for matched quality modes", async ({ page }, testInfo) => {
  test.skip(!M5_REQUIRED,
    "Requires headed native WebGPU, the M3 Raw pilot, the M4 physical research gate, and the separate M5 gather research gate");
  test.setTimeout(900_000);
  expect(REVISION).toBe("186");

  const pageErrors = await prepareNativeM5F8Page(page);

  const boundaryProbe = await captureB1BoundaryProbe(page, `m5-b1-boundary-${Date.now()}`);
  expect(boundaryProbe.rendererFamily).toBe("webgpu-renderer");
  expect(boundaryProbe.actualExecutionApi).toBe("webgpu");
  expect(boundaryProbe.internalFallback).toBe("none");
  expect(boundaryProbe.rendererRevision).toBe(`r${REVISION}`);
  expect(boundaryProbe.targetFormats).toMatchObject({
    sourceColor: "rgba8unorm",
    physical: "rgba16float",
    validity: "rgba8unorm",
    farGather: "rgba16float",
    provenance: "rgba32float",
    b1: "rgba16float",
    decision: "rgba8unorm",
  });
  expect(boundaryProbe.cases).toHaveLength(10);
  const byCase = new Map(boundaryProbe.cases.map((probeCase) => [probeCase.id, probeCase]));
  const maximumHalfCase = byCase.get("physical-positive-half-maximum-and-gather-rgba-maximum");
  expect(maximumHalfCase?.storedPhysicalHalfBits[0]).toBe(0x7bff);
  expect(maximumHalfCase?.storedGatherHalfBits).toEqual([0x7bff, 0x7bff, 0x7bff, 0x3c00]);
  expect(maximumHalfCase?.gpuDecisionRgba8[0]).toBe(1);
  expect(maximumHalfCase?.cpuEligible).toBe(1);
  expect(maximumHalfCase?.gpuDecisionRgba8[1]).toBe(maximumHalfCase?.cpuFallbackReason);
  expect(maximumHalfCase?.gpuB1Rgba).toEqual(maximumHalfCase?.cpuB1Rgba);
  expect(maximumHalfCase?.gpuCpuMaximumError).toBeLessThanOrEqual(0.001);
  const belowMaximumCase = byCase.get("physical-largest-half-value-below-maximum");
  expect(belowMaximumCase?.storedPhysicalHalfBits[0]).toBe(0x7bfe);
  expect(belowMaximumCase?.gpuDecisionRgba8[0]).toBe(1);
  const outOfRangeCase = byCase.get("m4-unrepresentable-overflow-preserves-validity-code-two");
  expect(outOfRangeCase?.storedPhysicalHalfBits[0]).toBe(0x7bff);
  expect(outOfRangeCase?.inputValidityCode).toBe(2);
  expect(outOfRangeCase?.gpuDecisionRgba8[0]).toBe(0);
  expect(outOfRangeCase?.gpuDecisionRgba8[1]).toBe(3);
  for (const probeCase of boundaryProbe.cases) {
    expect(probeCase.gpuDecisionRgba8[0], `${probeCase.id} GPU eligibility matches CPU`)
      .toBe(probeCase.cpuEligible);
    expect(probeCase.gpuDecisionRgba8[1], `${probeCase.id} GPU reason matches CPU`)
      .toBe(probeCase.cpuFallbackReason);
    expect(probeCase.gpuDecisionRgba8[2], `${probeCase.id} GPU path matches CPU`)
      .toBe(probeCase.cpuSelectedPath);
    expect(probeCase.gpuCpuMaximumError, `${probeCase.id} GPU output matches CPU`)
      .toBeLessThanOrEqual(0.001);
  }
  const expectedFallbacks: ReadonlyArray<readonly [string, number]> = [
    ["physical-negative-half-maximum-is-near-side", 4],
    ["m4-unrepresentable-overflow-preserves-validity-code-two", 3],
    ["physical-nan", 3],
    ["physical-positive-infinity", 3],
    ["physical-negative-infinity", 3],
    ["m4-validity-code-two-remains-authoritative", 3],
    ["far-gather-nan-channel-fails-closed", 5],
    ["far-gather-infinity-channel-fails-closed", 5],
  ];
  for (const [caseId, expectedReason] of expectedFallbacks) {
    const probeCase = byCase.get(caseId);
    expect(probeCase, `B1 boundary case ${caseId} is present`).toBeDefined();
    expect(probeCase?.gpuDecisionRgba8[0], `${caseId} falls back to source`).toBe(0);
    expect(probeCase?.gpuDecisionRgba8[1], `${caseId} preserves the decision reason`).toBe(expectedReason);
    expect(probeCase?.cpuFallbackReason, `${caseId} matches the CPU oracle`).toBe(expectedReason);
    expect(probeCase?.gpuCpuMaximumError, `${caseId} GPU and CPU outputs match`).toBeLessThanOrEqual(0.001);
    for (let channel = 0; channel < 4; channel += 1) {
      expect(Math.abs((probeCase?.gpuB1Rgba[channel] ?? Number.NaN)
        - (probeCase?.cpuB1Rgba[channel] ?? Number.NaN)), `${caseId} channel ${channel} matches CPU`)
        .toBeLessThanOrEqual(0.001);
    }
  }
  await testInfo.attach("ground-glass-m5-b1-binary16-boundary.json", {
    body: JSON.stringify(boundaryProbe, null, 2),
    contentType: "application/json",
  });

  const captures: GroundGlassApertureGatherCaptureReadback[] = [];
  const r3CaptureByMode: Partial<Record<GroundGlassR3QualityMode, GroundGlassApertureGatherR3Capture>> = {};
  for (const qualityMode of ["half32", "full32", "full64"] as const) {
    const result = await captureGather(page, qualityMode, `m5-${qualityMode}-${Date.now()}`, true);
    await expectCaptureMatchesCurrentFrame(page, result);
    await expect(pilotFor(page)).toHaveAttribute("data-aperture-gather-status", "completed");
    expect(result.qualityMode).toBe(qualityMode);
    expect(result.sampleCount).toBe(qualityMode.endsWith("64") ? 64 : 32);
    expect(result.sourceWidthPx).toBeGreaterThan(0);
    expect(result.sourceHeightPx).toBeGreaterThan(0);
    expect(result.farGatherWidthPx).toBe(qualityMode.startsWith("full")
      ? result.sourceWidthPx
      : Math.max(1, Math.round(result.sourceWidthPx / 2)));
    expect(result.farGatherHeightPx).toBe(qualityMode.startsWith("full")
      ? result.sourceHeightPx
      : Math.max(1, Math.round(result.sourceHeightPx / 2)));
    r3CaptureByMode[qualityMode] = toR3Capture(result);
    captures.push({ ...result, readbackBuffers: null });
  }
  const exploratoryR3 = evaluateGroundGlassApertureGatherR3({
    half32: r3CaptureByMode.half32!,
    full32: r3CaptureByMode.full32!,
    full64: r3CaptureByMode.full64!,
  } satisfies GroundGlassApertureGatherR3CaptureMatrix);
  expect(exploratoryR3.provenance.status, JSON.stringify(exploratoryR3.provenance)).toBe("matched");
  expect(exploratoryR3.qualityDecision.status).toBe("not-evaluated");
  expect(new Set(captures.map((capture) => capture.physicalDataFingerprint)).size).toBe(1);
  expect(pageErrors).toEqual([]);
  await testInfo.attach("ground-glass-m5-native-b1-captures.json", {
    body: JSON.stringify(captures.map((capture) => ({
      requestId: capture.requestId,
      generationId: capture.rendererGenerationId,
      qualityMode: capture.qualityMode,
      sampleCount: capture.sampleCount,
      source: [capture.sourceWidthPx, capture.sourceHeightPx],
      farGather: [capture.farGatherWidthPx, capture.farGatherHeightPx],
      formats: capture.targetFormats,
      performance: capture.performance,
      resourceInventory: capture.resourceInventory,
      b1: capture.cpuB1Conformance,
      farGatherCpuReference: capture.farGatherCpuReference,
      sourceToGatherMapping: capture.sourceToGatherMappingConformance,
      nearCoveragePixelCount: capture.nearCoveragePixelCount,
      nearCoverageNontrivial: capture.nearCoverageNontrivial,
      nearRgbInvariantMaximumError: capture.nearRgbInvariantMaximumError,
      nearAlphaInvariantMaximumError: capture.nearAlphaInvariantMaximumError,
      radius: capture.radius,
      physicalDataFingerprint: capture.physicalDataFingerprint,
    })), null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("ground-glass-m5-r3-exploratory-report.json", {
    body: JSON.stringify(exploratoryR3, null, 2),
    contentType: "application/json",
  });
});

test("native M5 app adapter applies frozen R3 thresholds to an independent matched capture", async ({ page }, testInfo) => {
  test.skip(!M5_REQUIRED,
    "Requires headed native WebGPU, the M3 Raw pilot, the M4 physical research gate, and the separate M5 gather research gate");
  test.setTimeout(900_000);
  expect(REVISION).toBe("186");
  const pageErrors = await prepareNativeM5F8Page(page);
  const captureByMode: Partial<Record<GroundGlassR3QualityMode, GroundGlassApertureGatherR3Capture>> = {};
  for (const qualityMode of ["half32", "full32", "full64"] as const) {
    const capture = await captureGather(page, qualityMode, `m5-r3-confirm-${qualityMode}-${Date.now()}`, true);
    await expectCaptureMatchesCurrentFrame(page, capture);
    expect(capture.qualityMode).toBe(qualityMode);
    captureByMode[qualityMode] = toR3Capture(capture);
  }
  const confirmatoryR3 = evaluateGroundGlassApertureGatherR3({
    half32: captureByMode.half32!,
    full32: captureByMode.full32!,
    full64: captureByMode.full64!,
  } satisfies GroundGlassApertureGatherR3CaptureMatrix, M5_R3_CONFIRMATORY_THRESHOLDS);
  expect(confirmatoryR3.provenance.status, JSON.stringify(confirmatoryR3.provenance)).toBe("matched");
  expect(confirmatoryR3.referenceConvergence.status).toBe("converged");
  expect(confirmatoryR3.qualityDecision.thresholdRevision).toBe(M5_R3_CONFIRMATORY_THRESHOLDS.revision);
  expect(confirmatoryR3.qualityDecision.thresholdsFrozenBeforeConfirmatory).toBe(true);
  expect(confirmatoryR3.qualityDecision.status).toBe("insufficient-roi-support");
  expect(confirmatoryR3.qualityDecision.reasons).toEqual(expect.arrayContaining([
    expect.stringContaining("strongly overrun"),
    expect.stringContaining("fractional near coverage"),
    expect.stringContaining("reference blur signal is below"),
  ]));
  expect(confirmatoryR3.radiusCapEvidence.maximumOverrunPx).toBe(0);
  expect(confirmatoryR3.interiorFarMetrics.expectedBlurMeanRgbDifference).toBeLessThan(
    M5_R3_CONFIRMATORY_THRESHOLDS.minimumMeaningfulBlurRgbDifference,
  );
  expect(confirmatoryR3.fallbackMetrics.boundaryGradient.meanRelativeError).toBeGreaterThan(1);
  expect(confirmatoryR3.signedBoundaryEvidence.status).toBe("present");
  expect(confirmatoryR3.qualityDecision.status).not.toBe("bounded-qualified");
  expect(pageErrors).toEqual([]);

  await testInfo.attach("m5-r3-capture-provenance.json", {
    body: JSON.stringify({
      captureProvenance: confirmatoryR3.captureProvenance,
      requestIds: confirmatoryR3.requestIds,
      inputFingerprints: confirmatoryR3.provenance.fingerprints,
      matched: confirmatoryR3.provenance.status,
    }, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("m5-r3-reference-convergence.json", {
    body: JSON.stringify(confirmatoryR3.referenceConvergence, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("m5-r3-b0-b1-quality-matrix.json", {
    body: JSON.stringify({ fullFrame: confirmatoryR3.fullFrameMetrics, interiorFar: confirmatoryR3.interiorFarMetrics,
      depthEdge: confirmatoryR3.depthEdgeMetrics, blurSpread: confirmatoryR3.blurSpreadMetrics,
      fallback: confirmatoryR3.fallbackMetrics, foregroundLeakage: confirmatoryR3.foregroundLeakageMetrics }, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("m5-r3-roi-support.json", {
    body: JSON.stringify({ interiorFar: confirmatoryR3.interiorFarMetrics, depthEdges: confirmatoryR3.depthEdgeMetrics,
      nearInvariance: confirmatoryR3.nearInvariance, radiusCap: confirmatoryR3.radiusCapEvidence,
      signedBoundary: confirmatoryR3.signedBoundaryEvidence }, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("m5-r3-quality-decision.json", {
    body: JSON.stringify({ thresholds: M5_R3_CONFIRMATORY_THRESHOLDS, decision: confirmatoryR3.qualityDecision }, null, 2),
    contentType: "application/json",
  });
});

test("native M3/M4 Raw baseline records frame and physical pass timing with M5 disabled", async ({ page }, testInfo) => {
  test.skip(!M4_RAW_BASELINE_REQUIRED,
    "Requires headed native WebGPU, M3 Raw, and M4 physical research with the M5 gather gate disabled");
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {};
  });
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const pane = paneFor(page);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await waitForCurrentFrame(page);
  await page.getByRole("radiogroup", { name: "Aperture", exact: true })
    .getByRole("radio", { name: "f/8", exact: true }).check();
  await waitForCurrentFrame(page);
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  const pilot = pilotFor(page);
  await expect(pilot).toHaveAttribute("data-physical-coc-status", "completed", { timeout: 120_000 });
  const requestId = await pane.getAttribute("data-frame-request-id");
  expect(requestId).toBeTruthy();
  await expect(pilot).toHaveAttribute("data-physical-coc-request-id", requestId ?? "");
  const baseline = await page.evaluate((currentRequestId) => {
    const events = window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [];
    const framePerformance = events.filter((event) => event.kind === "frame-performance")
      .map((event) => event.evidence)
      .findLast((evidence) => evidence.requestId === currentRequestId) ?? null;
    return {
      framePerformance,
      gatherResearchEvents: events.filter((event) => event.kind === "gather-research"),
    };
  }, requestId);
  expect(baseline.framePerformance).not.toBeNull();
  expect(baseline.framePerformance?.physicalCocFootprint).not.toBeNull();
  expect(baseline.framePerformance?.physicalValidity).not.toBeNull();
  expect(baseline.framePerformance?.sourceWidthPx).toBeGreaterThan(0);
  expect(baseline.framePerformance?.sourceHeightPx).toBeGreaterThan(0);
  expect(baseline.gatherResearchEvents).toEqual([]);
  await testInfo.attach("ground-glass-m4-raw-no-m5-performance-baseline.json", {
    body: JSON.stringify(baseline, null, 2),
    contentType: "application/json",
  });
});

test("native M5 rejects stale captures and recovers from a local gather failure", async ({ page }, testInfo) => {
  test.skip(!M5_REQUIRED,
    "Requires headed native WebGPU and the M3/M4/M5 development research gates");
  test.setTimeout(600_000);
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {};
  });
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const pane = paneFor(page);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expectNativeM5Identity(page);
  await page.locator("label.scene-toolbar__quality select").selectOption("low");
  await expectFreshM5Frame(page);

  const staleToken = `m5-stale-${Date.now()}`;
  await page.evaluate((token) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestApertureGatherCapture) throw new Error("M5 capture trigger unavailable");
    control.holdApertureGatherReadback = true;
    control.apertureGatherCaptureRequest = { token, qualityMode: "half16" };
    control.apertureGatherCaptureReadback = null;
    control.requestApertureGatherCapture();
  }, staleToken);
  await expect.poll(() => page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.apertureGatherReadbackBarrierReached === true,
  ), { timeout: 120_000 }).toBe(true);

  const staleRequestId = await pane.getAttribute("data-frame-request-id");
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const focusCurrent = Number(await focus.inputValue());
  const focusStep = Number(await focus.getAttribute("step"));
  const focusMaximum = Number(await focus.getAttribute("max"));
  const nextFocus = focusCurrent + focusStep <= focusMaximum ? focusCurrent + focusStep : focusCurrent - focusStep;
  await setStepRangeInput(page, "Focus distance", nextFocus);
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 30_000 })
    .not.toBe(await pane.getAttribute("data-last-completed-request-id"));
  const latestRequestId = await pane.getAttribute("data-frame-request-id");
  const currentToken = `m5-current-${Date.now()}`;
  await page.evaluate((token) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control) throw new Error("M5 test control unavailable");
    control.apertureGatherCaptureRequest = { token, qualityMode: "half16" };
    control.apertureGatherCaptureReadback = null;
    control.releaseApertureGatherReadback?.();
  }, currentToken);
  await expect.poll(async () => page.evaluate((token) =>
    window.__groundGlassWebGpuM3TestControl?.apertureGatherCaptureReadback?.token === token,
  currentToken), { timeout: 180_000 }).toBe(true);
  const currentCapture = await page.evaluate((token) => {
    const result = window.__groundGlassWebGpuM3TestControl?.apertureGatherCaptureReadback;
    return result?.token === token ? result : null;
  }, currentToken);
  expect(currentCapture?.requestId).toBe(latestRequestId);
  expect(currentCapture?.requestId).not.toBe(staleRequestId);
  expect(await page.evaluate((token) =>
    window.__groundGlassWebGpuM3TestControl?.apertureGatherCaptureReadback?.token === token,
  staleToken)).toBe(false);
  await expect(pilotFor(page)).toHaveAttribute("data-aperture-gather-request-id", latestRequestId ?? "");
  await expectCaptureMatchesCurrentFrame(page, currentCapture!);
  await waitForCurrentFrame(page);
  expect(nextFocus).not.toBe(focusCurrent);

  await page.evaluate(() => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestApertureGatherCapture) throw new Error("M5 capture trigger unavailable");
    control.failurePoint = "aperture-far-after-submit";
    control.requestApertureGatherCapture();
  });
  await expect(pilotFor(page)).toHaveAttribute("data-aperture-gather-status", "failed", { timeout: 120_000 });
  await waitForCurrentFrame(page);
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");

  await page.evaluate(() => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestApertureGatherCapture) throw new Error("M5 capture trigger unavailable");
    control.requestApertureGatherCapture();
  });
  await expect(pilotFor(page)).toHaveAttribute("data-aperture-gather-status", "completed", { timeout: 120_000 });
  await expectFreshM5Frame(page);

  let requestId = await pane.getAttribute("data-frame-request-id");
  await page.getByRole("radiogroup", { name: "Aperture", exact: true })
    .getByRole("radio", { name: "f/16", exact: true }).check();
  await expect.poll(() => pane.getAttribute("data-frame-request-id")).not.toBe(requestId);
  requestId = await expectFreshM5Frame(page);

  await setStepRangeInput(page, "Rise", 20);
  await expect.poll(() => pane.getAttribute("data-frame-request-id")).not.toBe(requestId);
  requestId = await expectFreshM5Frame(page);

  const stage = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
  await stage.scrollIntoViewIfNeeded();
  await clickStageAt(page, stage, 0.7, 0.35);
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  await expect.poll(() => pane.getAttribute("data-frame-request-id")).not.toBe(requestId);
  requestId = await expectFreshM5Frame(page);

  await page.setViewportSize({ width: 1060, height: 800 });
  await expect.poll(() => pane.getAttribute("data-frame-request-id")).not.toBe(requestId);
  requestId = await expectFreshM5Frame(page);

  await page.locator("label.scene-toolbar__quality select").selectOption("high");
  await expect.poll(() => pane.getAttribute("data-frame-request-id")).not.toBe(requestId);
  await expectFreshM5Frame(page);

  const retiredAdapter = await pilotFor(page).elementHandle();
  const retiredCanvas = await pilotFor(page).locator("canvas").elementHandle();
  if (!retiredAdapter || !retiredCanvas) throw new Error("M5 adapter/canvas handles are unavailable for SPA cleanup proof");
  const retiredGenerationId = await retiredAdapter.getAttribute("data-renderer-generation");
  if (!retiredGenerationId) throw new Error("M5 adapter renderer generation is unavailable for cleanup timing evidence");
  await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect.poll(() => page.evaluate((element) => !element.isConnected, retiredCanvas)).toBe(true);
  await expect.poll(() => retiredAdapter.getAttribute("data-cleanup-outcome"), { timeout: 120_000 })
    .toBe("confirmed");
  const cleanupEvent = await page.evaluate((generationId) =>
    window.__groundGlassWebGpuM3TestControl?.adapterEvents
      ?.filter((event) => event.kind === "cleanup" && event.generationId === generationId)
      .at(-1) ?? null,
  retiredGenerationId);
  expect(cleanupEvent?.kind).toBe("cleanup");
  if (cleanupEvent?.kind !== "cleanup") throw new Error("Confirmed M5 cleanup timing event was not recorded");
  expect(cleanupEvent.outcome).toBe("confirmed");
  expect(Number.isFinite(cleanupEvent.wallClockMs)).toBe(true);
  expect(cleanupEvent.wallClockMs).toBeGreaterThanOrEqual(0);
  await testInfo.attach("ground-glass-m5-native-cleanup-timing.json", {
    body: JSON.stringify(cleanupEvent, null, 2),
    contentType: "application/json",
  });
  await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/architecture-rise"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expectFreshM5Frame(page);
});
