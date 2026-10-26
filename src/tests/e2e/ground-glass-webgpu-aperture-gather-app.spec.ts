import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { REVISION, PerspectiveCamera } from "three";
import { gunzipSync } from "node:zlib";
import type {
  GroundGlassB1BoundaryProbeReadback,
  GroundGlassApertureGatherCaptureReadback,
} from "../../render/webgpu/groundGlassWebGpuTestSeam";
import type { GroundGlassApertureGatherQualityMode } from "../../render/webgpu/groundGlassApertureGatherPolicy";
import { mapGroundGlassPhysicalEllipseToSourcePixels } from "../../render/webgpu/groundGlassApertureGatherReference";
import {
  evaluateGroundGlassApertureGatherR3,
  type GroundGlassApertureGatherR3Thresholds,
  type GroundGlassApertureGatherR3Capture,
  type GroundGlassApertureGatherR3CaptureMatrix,
  type GroundGlassR3QualityMode,
} from "../../render/webgpu/groundGlassApertureGatherQuality";
import {
  evaluateGroundGlassM5qDimensions,
  GROUND_GLASS_M5Q_EVALUATOR_REVISION,
  type GroundGlassM5qEvidenceContext,
  type GroundGlassM5qFrozenThresholds,
  type GroundGlassM5qPairedCapEvidence,
  type GroundGlassM5qQualification,
} from "../../render/webgpu/groundGlassM5qQualification";
import { clickStageAt } from "./helpers/groundGlass";
import { setStepRangeInput } from "./helpers/stepRangeInput";
import {
  facade,
  focusTarget,
  getArchitectureReferenceObjectProbePoint,
  referenceObjects,
} from "../../scenes/architectureRiseGeometry";
import {
  computePhaseJKnownPointFootprint,
  createPhaseJOpticalState,
  projectPhaseJKnownPointToSourcePixel,
} from "./fixtures/ground-glass-webgpu-optical-state-cases";

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

type M5qCandidate = Readonly<{
  id: string;
  focusDistanceMm: number;
  apertureFNumber: 5.6;
  frontRiseMm: 0 | 20;
  cropMagnification: 1 | 4;
}>;

/** Bounded, reachable Architecture Rise app candidates; these are search inputs, not passes. */
const M5Q_CANDIDATES: readonly M5qCandidate[] = Object.freeze([
  { id: "ar-f3200-f5p6-full-rise0", focusDistanceMm: 3200, apertureFNumber: 5.6, frontRiseMm: 0, cropMagnification: 1 },
  { id: "ar-f5200-f5p6-full-rise0", focusDistanceMm: 5200, apertureFNumber: 5.6, frontRiseMm: 0, cropMagnification: 1 },
  { id: "ar-f8890-f5p6-full-rise0", focusDistanceMm: 8890, apertureFNumber: 5.6, frontRiseMm: 0, cropMagnification: 1 },
  { id: "ar-f8890-f5p6-full-rise20", focusDistanceMm: 8890, apertureFNumber: 5.6, frontRiseMm: 20, cropMagnification: 1 },
  { id: "ar-f13000-f5p6-full-rise20", focusDistanceMm: 13000, apertureFNumber: 5.6, frontRiseMm: 20, cropMagnification: 1 },
  { id: "ar-f3200-f5p6-loupe4-rise0", focusDistanceMm: 3200, apertureFNumber: 5.6, frontRiseMm: 0, cropMagnification: 4 },
  { id: "ar-f5200-f5p6-loupe4-rise0", focusDistanceMm: 5200, apertureFNumber: 5.6, frontRiseMm: 0, cropMagnification: 4 },
  { id: "ar-f8890-f5p6-loupe4-rise20", focusDistanceMm: 8890, apertureFNumber: 5.6, frontRiseMm: 20, cropMagnification: 4 },
]);

/** Frozen after the eight-state exploratory catalog and before confirmation. */
const M5Q_FROZEN_THRESHOLDS = Object.freeze({
  revision: "m5q-architecture-rise-r186-v3",
  evidenceScope: "single-native-state",
  frozenBeforeConfirmatory: true,
  minimumInteriorFarPixels: 1_000,
  minimumDepthEdgePixels: 100,
  minimumNearFarBoundaryPairs: 100,
  minimumNearCoveragePixels: 100,
  minimumFractionalCoveragePixels: 32,
  minimumNearFarBoundaryCoveragePixels: 20,
  minimumSpreadOutsideSharpNearPixels: 20,
  minimumFallbackBoundaryPairs: 100,
  minimumStrongOverrunPx: 4,
  minimumFallbackPixels: 100,
  minimumMeaningfulBlurFallbackPixels: 20,
  minimumSignedBoundaryPairs: 100,
  minimumSignedBoundarySidePixels: 100,
  minimumCappedPixels: 100,
  maximumReferenceRmse: 0.001,
  maximumReferenceFullFrameRmse: 0.001,
  maximumReferenceChannelError: 0.01,
  maximumReferenceInteriorFarRmse: 0.001,
  maximumReferenceDepthEdgeRmse: 0.001,
  maximumB1FullFrameRmse: 0.05,
  maximumB1InteriorFarRmse: 0.05,
  maximumB1DepthEdgeRmse: 0.05,
  maximumB1SignedBoundaryRmse: 0.1,
  maximumB1FallbackRmse: 0.05,
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
} satisfies GroundGlassApertureGatherR3Thresholds & GroundGlassM5qFrozenThresholds);

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
  maximumRadiusPx?: number,
): Promise<GroundGlassApertureGatherCaptureReadback> => {
  const triggered = await page.evaluate(({ captureToken, mode, retainBuffers, maxRadiusPx }) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestApertureGatherCapture) return false;
    control.apertureGatherCaptureReadback = null;
    control.apertureGatherCaptureRequest = {
      token: captureToken,
      qualityMode: mode,
      retainReadbackBuffers: retainBuffers,
      ...(maxRadiusPx !== undefined ? { maximumRadiusPx: maxRadiusPx } : {}),
    };
    control.requestApertureGatherCapture();
    return true;
  }, { captureToken: token, mode: qualityMode, retainBuffers: retainReadbackBuffers, maxRadiusPx: maximumRadiusPx });
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

const setM5qCandidateState = async (page: Page, candidate: M5qCandidate): Promise<void> => {
  const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  await aperture.getByRole("radio", { name: "f/5.6", exact: true }).check();
  const setReachableRangeValue = async (label: string, target: number): Promise<void> => {
    const slider = page.getByRole("slider", { name: label });
    const metadata = await slider.evaluate((element) => {
      const input = element as HTMLInputElement;
      return { min: Number(input.min), max: Number(input.max), step: Number(input.step) };
    });
    const stepsFromMinimum = (target - metadata.min) / metadata.step;
    if (!Number.isFinite(target) || target < metadata.min || target > metadata.max
        || !Number.isFinite(stepsFromMinimum) || Math.abs(stepsFromMinimum - Math.round(stepsFromMinimum)) >= 1e-8) {
      throw new Error(`${label} target ${target} is outside or not aligned to the public range control`);
    }
    await slider.evaluate((element, nextValue) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!setter) throw new Error("The public range input value setter is unavailable");
      setter.call(input, String(nextValue));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, target);
    await expect(slider).toHaveValue(String(target));
  };
  const priorRequestId = await paneFor(page).getAttribute("data-frame-request-id");
  await setReachableRangeValue("Focus distance", candidate.focusDistanceMm);
  await setReachableRangeValue("Rise", candidate.frontRiseMm);

  const stage = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
  await stage.scrollIntoViewIfNeeded();
  const isZoomed = await stage.getAttribute("data-zoomed") === "true";
  if (candidate.cropMagnification === 4 && !isZoomed) {
    await clickStageAt(page, stage, 0.5, 0.5);
  } else if (candidate.cropMagnification === 1 && isZoomed) {
    await page.getByRole("button", { name: "Reset Ground Glass view", exact: true }).click();
  }
  await expect(stage).toHaveAttribute("data-zoomed", candidate.cropMagnification === 4 ? "true" : "false");
  if (candidate.cropMagnification === 4) {
    await expect(stage).toHaveAttribute("data-focus-loupe-window-width", "0.25");
  }
  await expectFreshM5Frame(page);
  if (priorRequestId !== null) {
    await expect(paneFor(page)).not.toHaveAttribute("data-frame-request-id", priorRequestId);
  }
};

const m5qKnownSurfaces = () => {
  const foreground = referenceObjects.find((object) => object.role === "foreground");
  const midground = referenceObjects.find((object) => object.role === "midground");
  const far = referenceObjects.find((object) => object.role === "far");
  if (!foreground || !midground || !far) throw new Error("Architecture Rise canonical reference surfaces are incomplete");
  return [
    { id: "foreground-plinth-front", pointMm: getArchitectureReferenceObjectProbePoint(foreground) },
    { id: "midground-plinth-front", pointMm: getArchitectureReferenceObjectProbePoint(midground) },
    { id: "facade-front-focus-target", pointMm: { ...focusTarget.worldPosition, z: facade.frontFacadeZ } },
    { id: "far-plinth-front", pointMm: getArchitectureReferenceObjectProbePoint(far) },
  ] as const;
};

const measureM5qCanonicalPoints = (
  candidate: M5qCandidate,
  capture: GroundGlassApertureGatherCaptureReadback,
) => {
  const camera = new PerspectiveCamera();
  const opticalState = createPhaseJOpticalState(
    candidate.frontRiseMm === 20 ? "architecture-rise" : "architecture-initial",
    camera,
    capture.sourceWidthPx,
    capture.sourceHeightPx,
    capture.maximumRadiusPx,
    undefined,
    {
      apertureFNumber: candidate.apertureFNumber,
      focusDistanceMm: candidate.focusDistanceMm,
      cropMagnification: candidate.cropMagnification,
    },
  );
  const readbacks = capture.readbackBuffers;
  if (!readbacks) throw new Error(`Candidate ${candidate.id} did not retain its native physical readback`);
  return m5qKnownSurfaces().map((surface) => {
    const footprint = computePhaseJKnownPointFootprint(opticalState, surface.pointMm);
    const pixelEllipse = mapGroundGlassPhysicalEllipseToSourcePixels({
      majorRadiusMm: footprint.majorRadiusMm,
      minorRadiusMm: footprint.minorRadiusMm,
      orientationRad: footprint.orientationRad,
      film: capture.sampledFilmDimensionsMm,
      source: { widthPx: capture.sourceWidthPx, heightPx: capture.sourceHeightPx },
    });
    const projected = projectPhaseJKnownPointToSourcePixel(
      opticalState,
      surface.pointMm,
      capture.sourceWidthPx,
      capture.sourceHeightPx,
    );
    const offset = projected.inBounds ? (projected.y * capture.sourceWidthPx + projected.x) * 4 : -1;
    const rasterValidity = offset >= 0 ? readbacks.validity[offset] ?? 0 : null;
    const storedRasterSignedCoCMm = offset >= 0 ? readbacks.physicalRgba[offset] ?? null : null;
    const rasterSignedCoCMm = rasterValidity === 1 ? storedRasterSignedCoCMm : null;
    const canonicalSign = Math.sign(footprint.signedCoCDiameterMm);
    const rasterSign = rasterSignedCoCMm === null ? null : Math.sign(rasterSignedCoCMm);
    return {
      surfaceId: surface.id,
      worldPositionMm: surface.pointMm,
      canonical: {
        valid: footprint.valid,
        signedCoCDiameterMm: footprint.signedCoCDiameterMm,
        majorRadiusMm: footprint.majorRadiusMm,
        minorRadiusMm: footprint.minorRadiusMm,
        orientationRad: footprint.orientationRad,
        sourcePixelEllipse: pixelEllipse,
      },
      projectedPixel: { x: projected.x, y: projected.y, inBounds: projected.inBounds },
      reconstructedRasterSample: {
        validityCode: rasterValidity,
        storedPhysicalValueMm: storedRasterSignedCoCMm,
        signedCoCDiameterMm: rasterSignedCoCMm,
        signedCoCAbsoluteErrorMm: rasterSignedCoCMm === null
          ? null : Math.abs(rasterSignedCoCMm - footprint.signedCoCDiameterMm),
        signMatches: rasterSign === null || canonicalSign === 0 ? null : rasterSign === canonicalSign,
        depthValue: offset >= 0 ? readbacks.depth[offset] ?? null : null,
      },
    };
  });
};

const summarizeM5qCandidate = (
  candidate: M5qCandidate,
  capture: GroundGlassApertureGatherCaptureReadback,
  canonicalPoints: ReturnType<typeof measureM5qCanonicalPoints>,
  mountedRendererRevision: string,
) => {
  const buffers = capture.readbackBuffers;
  if (!buffers) throw new Error(`Candidate ${candidate.id} did not retain readbacks`);
  const width = capture.sourceWidthPx;
  const height = capture.sourceHeightPx;
  const validCounts = { near: 0, far: 0, neutral: 0, invalid: 0 };
  let maximumAbsoluteCoCMm = 0;
  let validFarSourceDifference = 0;
  let validFarSourceDifferencePixels = 0;
  let interiorFarSourceDifference = 0;
  let interiorFarPixels = 0;
  let depthEdgePixels = 0;
  let signedBoundaryPairs = 0;
  let sourceContrastAtSignedBoundary = 0;
  let signedBoundarySourceContrastPairs = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      const coc = buffers.physicalRgba[offset]!;
      const valid = buffers.validity[pixel] === 1;
      const signedFar = valid && coc > 0.00001;
      const signedNear = valid && coc < -0.00001;
      if (!valid) validCounts.invalid += 1;
      else if (signedFar) validCounts.far += 1;
      else if (signedNear) validCounts.near += 1;
      else validCounts.neutral += 1;
      maximumAbsoluteCoCMm = Math.max(maximumAbsoluteCoCMm, valid ? Math.abs(coc) : 0);

      let isDepthEdge = false;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height) continue;
        const other = ny * width + nx;
        if (buffers.validity[other] === 1
            && Math.abs(buffers.depth[pixel]! - buffers.depth[other]!) > 0.0001) isDepthEdge = true;
        const otherCoc = buffers.physicalRgba[other * 4]!;
        const otherNear = buffers.validity[other] === 1 && otherCoc < -0.00001;
        const otherFar = buffers.validity[other] === 1 && otherCoc > 0.00001;
        if ((signedNear && otherFar) || (signedFar && otherNear)) {
          signedBoundaryPairs += 1;
          const sourceOffset = other * 4;
          sourceContrastAtSignedBoundary += (
            Math.abs(buffers.sourceRgba[offset]! - buffers.sourceRgba[sourceOffset]!)
            + Math.abs(buffers.sourceRgba[offset + 1]! - buffers.sourceRgba[sourceOffset + 1]!)
            + Math.abs(buffers.sourceRgba[offset + 2]! - buffers.sourceRgba[sourceOffset + 2]!)
          ) / 3;
          signedBoundarySourceContrastPairs += 1;
        }
      }
      if (isDepthEdge) depthEdgePixels += 1;
      if (!signedFar) continue;
      let sourceDifference = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        sourceDifference += Math.abs(buffers.farGatherRgba[offset + channel]! - buffers.sourceRgba[offset + channel]!);
      }
      sourceDifference /= 3;
      validFarSourceDifference += sourceDifference;
      validFarSourceDifferencePixels += 1;
      if (!isDepthEdge && x >= 2 && y >= 2 && x < width - 2 && y < height - 2) {
        interiorFarSourceDifference += sourceDifference;
        interiorFarPixels += 1;
      }
    }
  }
  let nearNonzeroPixels = 0;
  let nearFractionalPixels = 0;
  for (let pixel = 0; pixel < capture.nearGatherWidthPx * capture.nearGatherHeightPx; pixel += 1) {
    const alpha = buffers.nearRgba[pixel * 4 + 3]!;
    if (alpha > 0) nearNonzeroPixels += 1;
    if (alpha > 0 && alpha < 1) nearFractionalPixels += 1;
  }
  return {
    opticalStateId: candidate.id,
    configuration: candidate,
    evidenceSource: "registered-app-adapter" as const,
    sceneSourceRevision: capture.sceneSourceRevision,
    requestId: capture.requestId,
    rendererGenerationId: capture.rendererGenerationId,
    runtime: {
      rendererFamily: capture.rendererFamily,
      actualExecutionApi: capture.actualExecutionApi,
      internalFallback: capture.internalFallback,
      rendererRevision: mountedRendererRevision,
    },
    capture: {
      captureId: capture.captureId,
      qualityMode: capture.qualityMode,
      sampleCount: capture.sampleCount,
      sourceDimensions: { widthPx: width, heightPx: height },
      sampledFilmDimensionsMm: capture.sampledFilmDimensionsMm,
      maximumRadiusPx: capture.maximumRadiusPx,
      effectiveOpticalRequestFingerprint: capture.effectiveOpticalRequestFingerprint,
      cameraStateFingerprint: capture.cameraStateFingerprint,
      physicalDataFingerprint: capture.physicalDataFingerprint,
    },
    canonicalGeometry: {
      lensFocalLengthMm: 150,
      focusDistanceMm: candidate.focusDistanceMm,
      apertureFNumber: candidate.apertureFNumber,
      cropMagnification: candidate.cropMagnification,
      frontRiseMm: candidate.frontRiseMm,
      points: canonicalPoints,
      priorSurfaceCorrespondenceEvidence: {
        source: "Phase J native Architecture Rise M4 probe",
        facadeTargetOffsetMm: 10,
        interpretation: "The teaching focus target is 10 mm in front of the canonical facade; raster samples are reconstructed-depth evidence.",
      },
    },
    screeningMetrics: {
      population: { validNearPixels: validCounts.near, validFarPixels: validCounts.far, validNeutralPixels: validCounts.neutral,
        invalidPixels: validCounts.invalid, depthEdgePixels, signedNearFarPairs: signedBoundaryPairs },
      maximumValidAbsoluteCoCDiameterMm: maximumAbsoluteCoCMm,
      meanFull32FarSourceRgbDifference: validFarSourceDifferencePixels
        ? validFarSourceDifference / validFarSourceDifferencePixels : null,
      validFarSourceDifferencePixelCount: validFarSourceDifferencePixels,
      meanInteriorFull32FarSourceRgbDifference: interiorFarPixels ? interiorFarSourceDifference / interiorFarPixels : null,
      interiorFarPixelCount: interiorFarPixels,
      meanSourceRgbContrastAtSignedBoundary: signedBoundarySourceContrastPairs
        ? sourceContrastAtSignedBoundary / signedBoundarySourceContrastPairs : null,
      nearNonzeroPixels,
      nearFractionalPixels,
      reportedMaximumUncappedRadiusPx: capture.radius.maximumUncappedRadiusPx,
      reportedCappedPixelCountAtCaptureCap: capture.radius.cappedPixelCount,
    },
    selectionInputs: ["canonical signed CoC and pixel ellipse", "valid physical/depth ROI support", "Full32 reference blur signal", "signed boundary/source edge support", "fractional near coverage"],
    candidateQualityOutputConsulted: false,
    disposition: "exploratory-only" as const,
  };
};

const writeM5qArtifact = async (
  testInfo: TestInfo,
  filename: string,
  value: unknown,
): Promise<void> => {
  const path = testInfo.outputPath(filename);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
  await testInfo.attach(filename, { path, contentType: "application/json" });
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

type M5qCaptureMatrixRun = Readonly<{
  r3: ReturnType<typeof evaluateGroundGlassApertureGatherR3>;
  captureSummary: readonly Readonly<{
    captureId: string;
    requestId: string;
    rendererGenerationId: string;
    qualityMode: GroundGlassR3QualityMode;
    maximumRadiusPx: number;
  }>[];
  runtime: GroundGlassM5qEvidenceContext["runtime"];
  sensitivityBuffers: Readonly<{
    full32Far: Float32Array;
    half32B1: Float32Array;
    half32Near: Float32Array;
  }> | null;
}>;

const captureM5qMatrix = async (
  page: Page,
  candidate: M5qCandidate,
  maximumRadiusPx: number,
  tokenPrefix: string,
  mountedRendererRevision: string,
  retainSensitivityBuffers = false,
): Promise<M5qCaptureMatrixRun> => {
  const captures: Partial<Record<GroundGlassR3QualityMode, GroundGlassApertureGatherCaptureReadback>> = {};
  const summary: Array<{
    captureId: string;
    requestId: string;
    rendererGenerationId: string;
    qualityMode: GroundGlassR3QualityMode;
    maximumRadiusPx: number;
  }> = [];
  let runtime: GroundGlassM5qEvidenceContext["runtime"] | null = null;
  for (const qualityMode of ["half32", "full32", "full64"] as const) {
    const capture = await captureGather(
      page,
      qualityMode,
      `${tokenPrefix}-${qualityMode}-${Date.now()}`,
      true,
      maximumRadiusPx,
    );
    await expectCaptureMatchesCurrentFrame(page, capture, false);
    expect(capture.qualityMode).toBe(qualityMode);
    expect(capture.sampleCount).toBe(qualityMode === "full64" ? 64 : 32);
    expect(capture.maximumRadiusPx).toBe(maximumRadiusPx);
    expect(capture.sceneSourceRevision).toBe("architecture-rise-raw-rtt-v1");
    expect(mountedRendererRevision).toBe(`r${REVISION}`);
    captures[qualityMode] = capture;
    runtime = {
      rendererFamily: capture.rendererFamily,
      actualExecutionApi: capture.actualExecutionApi,
      internalFallback: capture.internalFallback,
      applicationFallback: false,
      rendererRevision: mountedRendererRevision,
    };
    summary.push({
      captureId: capture.captureId,
      requestId: capture.requestId,
      rendererGenerationId: capture.rendererGenerationId,
      qualityMode,
      maximumRadiusPx: capture.maximumRadiusPx,
    });
  }
  if (!captures.half32 || !captures.full32 || !captures.full64 || !runtime) {
    throw new Error(`Incomplete M5Q capture matrix for ${candidate.id}`);
  }
  const r3 = evaluateGroundGlassApertureGatherR3({
    half32: toR3Capture(captures.half32),
    full32: toR3Capture(captures.full32),
    full64: toR3Capture(captures.full64),
  } satisfies GroundGlassApertureGatherR3CaptureMatrix, M5Q_FROZEN_THRESHOLDS);
  expect(r3.provenance.status, JSON.stringify(r3.provenance)).toBe("matched");
  const halfBuffers = captures.half32.readbackBuffers;
  const full32Buffers = captures.full32.readbackBuffers;
  if (!halfBuffers || !full32Buffers) throw new Error(`M5Q matrix ${candidate.id} lost retained readbacks`);
  return {
    r3,
    captureSummary: summary,
    runtime,
    sensitivityBuffers: retainSensitivityBuffers ? {
      full32Far: Float32Array.from(full32Buffers.farGatherRgba),
      half32B1: Float32Array.from(halfBuffers.b1FarRgba),
      half32Near: Float32Array.from(halfBuffers.nearBeforeB1Rgba),
    } : null,
  };
};

const rmseForRgbaChannels = (
  left: Float32Array,
  right: Float32Array,
  channels: readonly number[],
): number | null => {
  if (left.length === 0 || left.length !== right.length || left.length % 4 !== 0) return null;
  let squaredError = 0;
  let sampleCount = 0;
  for (let pixel = 0; pixel < left.length / 4; pixel += 1) {
    for (const channel of channels) {
      const delta = left[pixel * 4 + channel]! - right[pixel * 4 + channel]!;
      if (!Number.isFinite(delta)) return null;
      squaredError += delta * delta;
      sampleCount += 1;
    }
  }
  return sampleCount > 0 ? Math.sqrt(squaredError / sampleCount) : null;
};

const makeM5qEvidenceContext = (
  candidate: M5qCandidate,
  run: M5qCaptureMatrixRun,
  candidateSelectionReason: string,
): GroundGlassM5qEvidenceContext => ({
  opticalStateId: candidate.id,
  sceneId: run.r3.captureProvenance.full32.sceneId,
  evidenceSource: "registered-app-adapter",
  m5ExecutionPath: "ground-glass-webgpu-adapter",
  sceneSourceRevision: run.r3.captureProvenance.full32.sceneSourceRevision,
  candidateSelectionReason,
  runtime: run.runtime,
});

const makeM5qPairedCapEvidence = (
  opticalStateId: string,
  stressed: M5qCaptureMatrixRun,
  control: M5qCaptureMatrixRun,
  stressedCapPx: number,
  controlCapPx: number,
): GroundGlassM5qPairedCapEvidence => {
  const stressedR3 = stressed.r3;
  const controlR3 = control.r3;
  const stressBuffers = stressed.sensitivityBuffers;
  const controlBuffers = control.sensitivityBuffers;
  const evidence = {
    opticalStateId,
    stressedCapPx,
    controlCapPx,
    maximumUncappedRadiusPx: stressedR3.radiusCapEvidence.maximumUncappedRadiusPx,
    stressedCappedPixelCount: stressedR3.radiusCapEvidence.cappedPixelCount,
    controlCappedPixelCount: controlR3.radiusCapEvidence.cappedPixelCount,
    captureIds: {
      stressedHalf32: stressedR3.captureIds.half32,
      stressedFull32: stressedR3.captureIds.full32,
      stressedFull64: stressedR3.captureIds.full64,
      controlHalf32: controlR3.captureIds.half32,
      controlFull32: controlR3.captureIds.full32,
      controlFull64: controlR3.captureIds.full64,
    },
    fingerprints: {
      stressed: {
        depth: stressedR3.provenance.fingerprints.half32.depth ?? "",
        physical: stressedR3.provenance.fingerprints.half32.physical ?? "",
        validity: stressedR3.provenance.fingerprints.half32.validity ?? "",
        sourceColor: stressedR3.provenance.fingerprints.half32.sourceColor ?? "",
        camera: stressedR3.captureProvenance.half32.cameraStateFingerprint,
      },
      control: {
        depth: controlR3.provenance.fingerprints.half32.depth ?? "",
        physical: controlR3.provenance.fingerprints.half32.physical ?? "",
        validity: controlR3.provenance.fingerprints.half32.validity ?? "",
        sourceColor: controlR3.provenance.fingerprints.half32.sourceColor ?? "",
        camera: controlR3.captureProvenance.half32.cameraStateFingerprint,
      },
    },
    sameCapReferences: {
      stressed: {
        fullFrameRmse: stressedR3.referenceConvergence.fullFrame.rmse,
        fullFramePixelCount: stressedR3.referenceConvergence.fullFrame.pixelCount,
        maximumChannelError: stressedR3.referenceConvergence.fullFrame.maximumChannelError,
        interiorFarRmse: stressedR3.referenceConvergence.interiorFar.rmse,
        interiorFarPixelCount: stressedR3.referenceConvergence.interiorFar.pixelCount,
        depthEdgeRmse: stressedR3.referenceConvergence.depthEdge.rmse,
        depthEdgePixelCount: stressedR3.referenceConvergence.depthEdge.pixelCount,
      },
      control: {
        fullFrameRmse: controlR3.referenceConvergence.fullFrame.rmse,
        fullFramePixelCount: controlR3.referenceConvergence.fullFrame.pixelCount,
        maximumChannelError: controlR3.referenceConvergence.fullFrame.maximumChannelError,
        interiorFarRmse: controlR3.referenceConvergence.interiorFar.rmse,
        interiorFarPixelCount: controlR3.referenceConvergence.interiorFar.pixelCount,
        depthEdgeRmse: controlR3.referenceConvergence.depthEdge.rmse,
        depthEdgePixelCount: controlR3.referenceConvergence.depthEdge.pixelCount,
      },
    },
    crossCapSensitivity: {
      full32FarRmse: stressBuffers && controlBuffers
        ? rmseForRgbaChannels(stressBuffers.full32Far, controlBuffers.full32Far, [0, 1, 2]) : null,
      half32B1Rmse: stressBuffers && controlBuffers
        ? rmseForRgbaChannels(stressBuffers.half32B1, controlBuffers.half32B1, [0, 1, 2]) : null,
      nearRgbRmse: stressBuffers && controlBuffers
        ? rmseForRgbaChannels(stressBuffers.half32Near, controlBuffers.half32Near, [0, 1, 2]) : null,
      nearAlphaRmse: stressBuffers && controlBuffers
        ? rmseForRgbaChannels(stressBuffers.half32Near, controlBuffers.half32Near, [3]) : null,
      fallbackBoundaryGradientDelta: stressedR3.fallbackMetrics.boundaryGradient.meanRelativeError !== null
        && controlR3.fallbackMetrics.boundaryGradient.meanRelativeError !== null
        ? Math.abs(stressedR3.fallbackMetrics.boundaryGradient.meanRelativeError
          - controlR3.fallbackMetrics.boundaryGradient.meanRelativeError) : null,
    },
  } satisfies GroundGlassM5qPairedCapEvidence;
  return evidence;
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
  requireNontrivialNearCoverage = true,
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
  if (requireNontrivialNearCoverage) expect(result.nearCoverageNontrivial).toBe(true);
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

test("native M5Q explores a bounded Architecture Rise optical-state catalog before confirmation", async ({ page }, testInfo) => {
  test.skip(!M5_REQUIRED,
    "Requires headed native WebGPU, the M3 Raw pilot, the M4 physical research gate, and the separate M5 gather research gate");
  test.setTimeout(900_000);
  expect(REVISION).toBe("186");
  expect(M5Q_CANDIDATES.length).toBeLessThanOrEqual(8);
  const pageErrors = await prepareNativeM5F8Page(page);
  const mountedRuntimeEvidence = await captureB1BoundaryProbe(page, `m5q-exploration-runtime-${Date.now()}`);
  expect(mountedRuntimeEvidence.rendererFamily).toBe("webgpu-renderer");
  expect(mountedRuntimeEvidence.actualExecutionApi).toBe("webgpu");
  expect(mountedRuntimeEvidence.internalFallback).toBe("none");
  expect(mountedRuntimeEvidence.rendererRevision).toBe(`r${REVISION}`);
  const candidateRecords: ReturnType<typeof summarizeM5qCandidate>[] = [];

  for (const candidate of M5Q_CANDIDATES) {
    await setM5qCandidateState(page, candidate);
    const capture = await captureGather(page, "full32", `m5q-explore-${candidate.id}-${Date.now()}`, true);
    await expectCaptureMatchesCurrentFrame(page, capture, false);
    expect(capture.sceneSourceRevision.trim()).not.toBe("");
    expect(capture.rendererFamily).toBe("webgpu-renderer");
    expect(capture.actualExecutionApi).toBe("webgpu");
    expect(capture.internalFallback).toBe("none");
    expect(capture.qualityMode).toBe("full32");
    expect(capture.sampleCount).toBe(32);
    expect(capture.sampledFilmDimensionsMm.widthMm).toBeCloseTo(127 / candidate.cropMagnification, 3);
    const canonicalPoints = measureM5qCanonicalPoints(candidate, capture);
    const summary = summarizeM5qCandidate(candidate, capture, canonicalPoints, mountedRuntimeEvidence.rendererRevision);
    expect(summary.screeningMetrics.population.validFarPixels
      + summary.screeningMetrics.population.validNearPixels).toBeGreaterThan(0);
    candidateRecords.push(summary);
  }

  const byCandidateId = new Map(candidateRecords.map((record) => [record.opticalStateId, record]));
  const farAndEdges = byCandidateId.get("ar-f3200-f5p6-full-rise0");
  const maximumBlurAndRadius = byCandidateId.get("ar-f3200-f5p6-loupe4-rise0");
  const signedBoundary = byCandidateId.get("ar-f5200-f5p6-full-rise0");
  if (!signedBoundary) throw new Error("The selected Q3/Q4 Architecture Rise candidate is missing");
  const signedBoundaryPoints = signedBoundary.canonicalGeometry.points;
  const canonicalSignedPoint = (candidate: typeof signedBoundary, surfaceId: string) => {
    const point = candidate.canonicalGeometry.points.find((entry) => entry.surfaceId === surfaceId);
    if (!point) throw new Error(`Missing canonical M5Q surface evidence for ${surfaceId}`);
    if (!point.canonical.valid) throw new Error(`Canonical M5Q CoC is invalid for ${surfaceId}`);
    return point.canonical.signedCoCDiameterMm;
  };
  const signedPoint = (surfaceId: string) => canonicalSignedPoint(signedBoundary, surfaceId);
  expect(signedPoint("foreground-plinth-front")).toBeLessThan(-0.00001);
  expect(signedPoint("midground-plinth-front")).toBeLessThan(-0.00001);
  expect(signedPoint("facade-front-focus-target")).toBeGreaterThan(0.00001);
  expect(signedPoint("far-plinth-front")).toBeGreaterThan(0.00001);
  const q3AlternativeIds = [
    "ar-f8890-f5p6-full-rise0",
    "ar-f8890-f5p6-full-rise20",
    "ar-f8890-f5p6-loupe4-rise20",
  ] as const;
  const q3Alternatives = q3AlternativeIds.map((candidateId) => {
    const candidate = byCandidateId.get(candidateId);
    if (!candidate) throw new Error(`Missing M5Q Q3 alternative ${candidateId}`);
    return {
      opticalStateId: candidate.opticalStateId,
      signedNearFarPairs: candidate.screeningMetrics.population.signedNearFarPairs,
      meanSourceRgbContrastAtSignedBoundary: candidate.screeningMetrics.meanSourceRgbContrastAtSignedBoundary,
      meanInteriorFull32FarSourceRgbDifference: candidate.screeningMetrics.meanInteriorFull32FarSourceRgbDifference,
      canonicalFacadeSignedCoCDiameterMm: canonicalSignedPoint(candidate, "facade-front-focus-target"),
    };
  });
  const q3FullFrameAlternatives = q3Alternatives.filter(({ opticalStateId }) => opticalStateId.includes("full-rise"));
  const q3CropAlternative = q3Alternatives.find(({ opticalStateId }) => opticalStateId === "ar-f8890-f5p6-loupe4-rise20");
  if (!q3CropAlternative) throw new Error("Missing cropped M5Q Q3 alternative");
  const q3SelectionTradeoff =
    `The selected 5,200 mm full-film state has ${signedBoundary.screeningMetrics.population.signedNearFarPairs} valid signed pairs and interior Full32/source signal ${signedBoundary.screeningMetrics.meanInteriorFull32FarSourceRgbDifference}. The 8,890 mm full-film alternatives have more signed pairs (${q3FullFrameAlternatives.map(({ signedNearFarPairs }) => signedNearFarPairs).join(" and ")}) and about 0.209 boundary contrast, but their canonical façade point is only ${q3FullFrameAlternatives[0].canonicalFacadeSignedCoCDiameterMm.toFixed(6)} mm from focus and their interior Full32/source signal is about ${q3FullFrameAlternatives[0].meanInteriorFull32FarSourceRgbDifference?.toFixed(6)} (about 47x weaker). The 8,890 mm 4x-crop alternative has ${q3CropAlternative.signedNearFarPairs} signed pairs and ${q3CropAlternative.meanSourceRgbContrastAtSignedBoundary} boundary contrast, but zero reconstructed-depth edge pixels and an interior Full32/source signal of ${q3CropAlternative.meanInteriorFull32FarSourceRgbDifference?.toFixed(6)}. Q3 therefore prioritizes canonical sign separation, measurable expected blur and depth-edge support over maximum raster pair count; no B0/B1 quality score is used for selection.`;
  const selection = {
    policy: "Geometry and signal support only; Full32 is used as an expected-blur signal. B0/B1 quality, fallback error, and confirmatory thresholds are not consulted.",
    Q1_Q6: {
      opticalStateId: maximumBlurAndRadius?.opticalStateId ?? null,
      reason: maximumBlurAndRadius
        ? `Largest measured Full32/source interior far signal (${maximumBlurAndRadius.screeningMetrics.meanInteriorFull32FarSourceRgbDifference}) with ${maximumBlurAndRadius.screeningMetrics.interiorFarPixelCount} pixels; quality metrics are not used.`
        : "No candidate had measurable interior far signal.",
      support: maximumBlurAndRadius?.screeningMetrics ?? null,
    },
    Q2_Q7: {
      opticalStateId: farAndEdges?.opticalStateId ?? null,
      reason: farAndEdges
        ? `Strong Full32/source interior far signal (${farAndEdges.screeningMetrics.meanInteriorFull32FarSourceRgbDifference}) with ${farAndEdges.screeningMetrics.population.depthEdgePixels} reconstructed-depth edge pixels and ${farAndEdges.screeningMetrics.population.signedNearFarPairs} valid signed-boundary pairs; fallback and profile quality remain unexamined.`
        : "No candidate combined measurable far signal and reconstructed-depth edge support.",
      support: farAndEdges?.screeningMetrics ?? null,
    },
    Q3_Q4: {
      opticalStateId: signedBoundary?.opticalStateId ?? null,
      reason: signedBoundary
        ? `${q3SelectionTradeoff} Canonical signs are foreground ${signedPoint("foreground-plinth-front").toFixed(6)} mm, midground ${signedPoint("midground-plinth-front").toFixed(6)} mm, façade ${signedPoint("facade-front-focus-target").toFixed(6)} mm, and far ${signedPoint("far-plinth-front").toFixed(6)} mm. Raster point correspondence remains separately reported.`
        : "No candidate provided signed-boundary support.",
      tradeoffAgainstHigherBoundarySupportAlternatives: q3Alternatives,
      canonicalSignEvidence: signedBoundaryPoints.map((point) => ({
        surfaceId: point.surfaceId,
        valid: point.canonical.valid,
        signedCoCDiameterMm: point.canonical.signedCoCDiameterMm,
        rasterValidityCode: point.reconstructedRasterSample.validityCode,
        rasterSignedCoCDiameterMm: point.reconstructedRasterSample.signedCoCDiameterMm,
      })),
      support: signedBoundary?.screeningMetrics ?? null,
    },
    Q5: {
      opticalStateId: maximumBlurAndRadius?.opticalStateId ?? null,
      reason: maximumBlurAndRadius
        ? `Largest uncapped raster radius observed in the mounted app catalog (${maximumBlurAndRadius.screeningMetrics.reportedMaximumUncappedRadiusPx}px); paired stress-cap confirmation is still required.`
        : "No candidate reported a valid physical far radius.",
      support: maximumBlurAndRadius?.screeningMetrics ?? null,
    },
    dispositions: [
      { opticalStateId: maximumBlurAndRadius?.opticalStateId ?? null, status: "selected", dimensions: ["Q1", "Q5", "Q6"] },
      { opticalStateId: farAndEdges?.opticalStateId ?? null, status: "selected", dimensions: ["Q2", "Q7"] },
      { opticalStateId: signedBoundary?.opticalStateId ?? null, status: "selected", dimensions: ["Q3", "Q4"] },
      ...candidateRecords.filter((record) => ![maximumBlurAndRadius, farAndEdges, signedBoundary].some((selected) =>
        selected?.opticalStateId === record.opticalStateId)).map((record) => ({
        opticalStateId: record.opticalStateId,
        status: "not-selected" as const,
        reason: record.opticalStateId === "ar-f8890-f5p6-full-rise0"
          || record.opticalStateId === "ar-f8890-f5p6-full-rise20"
          ? `Has ${record.screeningMetrics.population.signedNearFarPairs} valid signed pairs and boundary contrast ${record.screeningMetrics.meanSourceRgbContrastAtSignedBoundary}, but was not selected for Q3: the canonical façade point is only ${canonicalSignedPoint(record, "facade-front-focus-target").toFixed(6)} mm from focus and the interior Full32/source signal (${record.screeningMetrics.meanInteriorFull32FarSourceRgbDifference}) is much weaker than the selected 5,200 mm state.`
          : record.opticalStateId === "ar-f8890-f5p6-loupe4-rise20"
            ? `Has ${record.screeningMetrics.population.signedNearFarPairs} valid signed pairs and boundary contrast ${record.screeningMetrics.meanSourceRgbContrastAtSignedBoundary}, but zero reconstructed-depth edge pixels in this crop; its interior Full32/source signal (${record.screeningMetrics.meanInteriorFull32FarSourceRgbDifference}) is also much weaker than the selected 5,200 mm state.`
          : record.screeningMetrics.meanInteriorFull32FarSourceRgbDifference === null
            ? "No valid interior-far signal was measured."
            : record.screeningMetrics.population.signedNearFarPairs < M5Q_FROZEN_THRESHOLDS.minimumSignedBoundaryPairs
              ? `Signed-boundary support (${record.screeningMetrics.population.signedNearFarPairs} pairs) is below the frozen ${M5Q_FROZEN_THRESHOLDS.minimumSignedBoundaryPairs}-pair floor for Q3.`
              : record.screeningMetrics.population.signedNearFarPairs === 0
                ? "The selected crop has no adjacent valid signed near/far pairs for Q3."
                : "A selected state provides stronger support for the bounded M5Q dimension; this state remains exploratory-only.",
      })),
    ],
  };
  const report = {
    schemaVersion: 1,
    stage: "exploratory-candidate-discovery",
    candidateSearch: {
      candidateSceneFamily: "registered Architecture Rise application adapter",
      supportedLensMm: 150,
      aperture: "f/5.6 (widest public camera setting)",
      focusRangeMm: { min: 3200, max: 13000, stepMm: 10 },
      cropMagnifications: [1, 4],
      maximumExploratoryCandidates: 8,
      maximumConfirmatoryOpticalStates: 3,
      qualityMode: "Full32 for screening only",
      scopeClarification: "Only these eight registered Architecture Rise app-adapter states were ranked for M5Q confirmatory selection. Macro/Interior Phase J-L fixture states are enumerated separately in GROUND_GLASS_M5Q_QUALIFICATION_SUMMARY.json.fixtureNativeEvidence.candidateDisposition; they were not ranked against M5Q thresholds and are not pooled into app-adapter Q1-Q7 decisions.",
      fixtureEvidenceReference: "GROUND_GLASS_M5Q_QUALIFICATION_SUMMARY.json.fixtureNativeEvidence",
      controlledFixture: "No M5Q-thresholded controlled signed-boundary or fractional-Near fixture was added; existing Phase J-L evidence remains separately labeled.",
    },
    nativeRuntime: {
      rendererFamily: candidateRecords[0]?.runtime.rendererFamily ?? "unknown",
      actualExecutionApi: candidateRecords[0]?.runtime.actualExecutionApi ?? "unknown",
      internalFallback: candidateRecords[0]?.runtime.internalFallback ?? "unknown",
      rendererRevision: candidateRecords[0]?.runtime.rendererRevision ?? null,
      applicationFallback: false,
    },
    candidates: candidateRecords,
    selection,
    candidateQualityMetricsConsulted: false,
    limitations: [
      "Exploratory Full32 outputs are finite-sample expected-blur signals, not photographic ground truth or B1 quality results.",
      "Canonical point CoC is computed from registered scene geometry; raster CoC and depth remain reconstructed-depth evidence. Point-to-raster correspondence uncertainty is reported per point.",
      "No confirmatory threshold or Q dimension is decided by this catalog.",
    ],
  };
  await writeM5qArtifact(testInfo, "m5q-candidate-catalog.json", report);
  expect(candidateRecords.map(({ opticalStateId }) => opticalStateId)).toEqual(M5Q_CANDIDATES.map(({ id }) => id));
  expect(pageErrors).toEqual([]);
});

test("native M5Q applies frozen per-dimension R3 gates to independent optical states", async ({ page }, testInfo) => {
  test.skip(!M5_REQUIRED,
    "Requires headed native WebGPU, the M3 Raw pilot, the M4 physical research gate, and the separate M5 gather research gate");
  test.setTimeout(900_000);
  expect(REVISION).toBe("186");
  const pageErrors = await prepareNativeM5F8Page(page);
  const mountedRuntimeEvidence = await captureB1BoundaryProbe(page, `m5q-confirm-runtime-${Date.now()}`);
  expect(mountedRuntimeEvidence.rendererFamily).toBe("webgpu-renderer");
  expect(mountedRuntimeEvidence.actualExecutionApi).toBe("webgpu");
  expect(mountedRuntimeEvidence.internalFallback).toBe("none");
  expect(mountedRuntimeEvidence.rendererRevision).toBe(`r${REVISION}`);
  const q1Candidate = M5Q_CANDIDATES.find(({ id }) => id === "ar-f3200-f5p6-loupe4-rise0");
  const q2Candidate = M5Q_CANDIDATES.find(({ id }) => id === "ar-f3200-f5p6-full-rise0");
  const q3Candidate = M5Q_CANDIDATES.find(({ id }) => id === "ar-f5200-f5p6-full-rise0");
  if (!q1Candidate || !q2Candidate || !q3Candidate) throw new Error("Frozen M5Q optical-state selection is incomplete");

  await setM5qCandidateState(page, q1Candidate);
  const q5Stress = await captureM5qMatrix(page, q1Candidate, 2, "m5q-q5-cap2", mountedRuntimeEvidence.rendererRevision, true);
  const q1Control = await captureM5qMatrix(page, q1Candidate, 60, "m5q-q1-control60", mountedRuntimeEvidence.rendererRevision, true);
  const q1Context = makeM5qEvidenceContext(
    q1Candidate,
    q1Control,
    "Selected from the eight-state Full32-only search for the largest measured interior-far Full32/source signal and largest uncapped pixel radius; B0/B1 quality was not consulted.",
  );
  const q1ControlQualification = evaluateGroundGlassM5qDimensions({
    context: q1Context,
    r3: q1Control.r3,
    thresholds: M5Q_FROZEN_THRESHOLDS,
  });
  const pairedCapEvidence = makeM5qPairedCapEvidence(q1Candidate.id, q5Stress, q1Control, 2, 60);
  const q5StressQualification = evaluateGroundGlassM5qDimensions({
    context: makeM5qEvidenceContext(
      q1Candidate,
      q5Stress,
      "Same geometry-selected state as Q1, rerun under a 2 px test-only stress cap and matched 60 px control cap.",
    ),
    r3: q5Stress.r3,
    thresholds: M5Q_FROZEN_THRESHOLDS,
    pairedCapEvidence,
  });

  await setM5qCandidateState(page, q2Candidate);
  const q2Run = await captureM5qMatrix(page, q2Candidate, 60, "m5q-q2-fallback-q7-profile60", mountedRuntimeEvidence.rendererRevision);
  const q2Context = makeM5qEvidenceContext(
    q2Candidate,
    q2Run,
    "Selected for high interior-far Full32/source signal together with reconstructed-depth edge support; fallback and profile quality were not available during selection.",
  );
  const q2Qualification = evaluateGroundGlassM5qDimensions({
    context: q2Context,
    r3: q2Run.r3,
    thresholds: M5Q_FROZEN_THRESHOLDS,
  });

  await setM5qCandidateState(page, q3Candidate);
  const q3Run = await captureM5qMatrix(page, q3Candidate, 60, "m5q-q3-signed-q4-near60", mountedRuntimeEvidence.rendererRevision);
  const q3Context = makeM5qEvidenceContext(
    q3Candidate,
    q3Run,
    "Selected for 540 valid adjacent signed near/far pairs, substantial nonzero near support, and independently computed opposite canonical surface CoC signs; raster correspondence remains reconstructed-depth evidence.",
  );
  const q3Qualification = evaluateGroundGlassM5qDimensions({
    context: q3Context,
    r3: q3Run.r3,
    thresholds: M5Q_FROZEN_THRESHOLDS,
  });

  const allCaptureSummaries = [
    ...q5Stress.captureSummary,
    ...q1Control.captureSummary,
    ...q2Run.captureSummary,
    ...q3Run.captureSummary,
  ];
  expect(new Set(allCaptureSummaries.map(({ captureId }) => captureId)).size).toBe(12);
  expect(new Set(allCaptureSummaries.map(({ rendererGenerationId }) => rendererGenerationId)).size).toBe(1);
  const qualificationByDimension = {
    Q1: q1ControlQualification.dimensions.Q1,
    Q2: q2Qualification.dimensions.Q2,
    Q3: q3Qualification.dimensions.Q3,
    Q4: q3Qualification.dimensions.Q4,
    Q5: q5StressQualification.dimensions.Q5,
    Q6: q1ControlQualification.dimensions.Q6,
    Q7: q2Qualification.dimensions.Q7,
  } satisfies GroundGlassM5qQualification["dimensions"];
  expect(q5StressQualification.evaluatorRevision).toBe(GROUND_GLASS_M5Q_EVALUATOR_REVISION);
  expect(q3Qualification.dimensions.Q3.evaluatorRevision).toBe(GROUND_GLASS_M5Q_EVALUATOR_REVISION);
  const report = {
    schemaVersion: 2,
    evaluatorRevision: GROUND_GLASS_M5Q_EVALUATOR_REVISION,
    stage: "independent-native-confirmatory-matrices",
    thresholdContract: M5Q_FROZEN_THRESHOLDS,
    selectedStates: {
      Q1_Q5_Q6: { opticalStateId: q1Candidate.id, capsPx: [2, 60], reason: q1Context.candidateSelectionReason },
      Q2_Q7: { opticalStateId: q2Candidate.id, capsPx: [60], reason: q2Context.candidateSelectionReason },
      Q3_Q4: { opticalStateId: q3Candidate.id, capsPx: [60], reason: q3Context.candidateSelectionReason },
    },
    nativeRuntime: {
      rendererFamily: q1Control.runtime.rendererFamily,
      actualExecutionApi: q1Control.runtime.actualExecutionApi,
      internalFallback: q1Control.runtime.internalFallback,
      applicationFallback: q1Control.runtime.applicationFallback,
      rendererRevision: q1Control.runtime.rendererRevision,
      sourceRevision: q1Control.r3.captureProvenance.full32.sceneSourceRevision,
    },
    confirmatoryCaptures: allCaptureSummaries,
    pairedCapSensitivity: pairedCapEvidence.crossCapSensitivity,
    qualificationByDimension,
    qualificationByOpticalState: {
      "q1-q5-q6-control-cap": q1ControlQualification,
      "q5-stress-cap": q5StressQualification,
      "q2-q7": q2Qualification,
      "q3-q4": q3Qualification,
    },
    R3ByOpticalState: {
      "q1-q5-q6-control-cap": q1Control.r3,
      "q5-stress-cap": q5Stress.r3,
      "q2-q7": q2Run.r3,
      "q3-q4": q3Run.r3,
    },
    conclusion: {
      universalB1QualityPass: false,
      productionAuthorization: false,
      limitations: [
        "Native qualification applies only to these registered Architecture Rise adapter states, source revision and renderer revision.",
        "A missing support or failed quality gate remains explicit for its own dimension; no dimension inherits another state’s pass.",
        "The 2 px stress cap is a test-only configuration and does not change the normal 60 px renderer cap.",
        "No fractional Near alpha was present in the exploratory catalog; confirmatory near checks remain useful negative evidence and cannot establish fractional coverage when absent.",
      ],
    },
  };
  await writeM5qArtifact(testInfo, "m5q-confirmatory-qualification.json", report);
  expect(pageErrors).toEqual([]);
});

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
