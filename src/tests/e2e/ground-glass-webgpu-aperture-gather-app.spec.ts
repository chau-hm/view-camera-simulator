import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DataUtils, REVISION, PerspectiveCamera } from "three";
import { gzipSync, gunzipSync } from "node:zlib";
import type {
  GroundGlassB1BoundaryProbeReadback,
  GroundGlassApertureGatherCaptureReadback,
} from "../../render/webgpu/groundGlassWebGpuTestSeam";
import type { GroundGlassApertureGatherQualityMode } from "../../render/webgpu/groundGlassApertureGatherPolicy";
import {
  GROUND_GLASS_APERTURE_SIGN_EPSILON_MM,
  groundGlassGoldenAngleNestedDiskProposalFrom64ForTesting,
  groundGlassViewDistanceMmAtTopUv,
  mapGroundGlassPhysicalEllipseToSourcePixels,
  referenceGroundGlassApertureGather,
  referenceGroundGlassApertureGatherDiagnostic,
  referenceGroundGlassApertureGatherNestedGoldenAngle64ForTesting,
} from "../../render/webgpu/groundGlassApertureGatherReference";
import {
  GROUND_GLASS_M5S_MAX_TOTAL_PROPOSAL_EVALUATIONS,
  GROUND_GLASS_M5S_SAMPLE_COUNTS,
  compareGroundGlassM5sRgb,
  createGroundGlassM5sProposalStrategy,
  fingerprintGroundGlassM5sProposalCoordinates,
  groundGlassM5sProposalIdentityKey,
  runGroundGlassM5sReferenceMatrix,
  type GroundGlassM5sFarReferenceInput,
  type GroundGlassM5sFarReferenceResult,
} from "../../render/webgpu/groundGlassM5sReference";
import {
  aggregateGroundGlassM5sStrata,
  analyzeGroundGlassM5sReferenceMatrix,
  compareGroundGlassM5sInputFingerprints,
  evaluateGroundGlassM5sBlurPreservation,
  evaluateGroundGlassM5sAnalyticAuthority,
  evaluateGroundGlassM5sProposalAnalyticControls,
  selectGroundGlassM5sRoiStrata,
  type GroundGlassM5sStratumStudy,
} from "../../render/webgpu/groundGlassM5sAnalysis";
import {
  analyzeGroundGlassM5rFallbacks,
} from "../../render/webgpu/groundGlassM5rFallbackAnalysis";
import {
  analyzeGroundGlassM5rNearAlpha,
  type GroundGlassM5rNearAlphaCapture,
} from "../../render/webgpu/groundGlassM5rNearAlphaAnalysis";
import {
  analyzeGroundGlassM5rSampleDistribution,
  compareGroundGlassM5rNumericArrays,
  compareGroundGlassM5rGatherResults,
  createGroundGlassM5rGoldenAngleProposals,
  createGroundGlassM5rReferenceReportFields,
  evaluateGroundGlassM5rReferenceEvidence,
} from "../../render/webgpu/groundGlassM5rReferenceAnalysis";
import {
  GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL,
  GROUND_GLASS_M5T_QUADRATURE_RESOLUTIONS,
  compareGroundGlassM5tPixelEstimates,
  evaluateGroundGlassM5tReferenceEvidence,
  runGroundGlassM5tAdaptiveQuadrature,
  runGroundGlassM5tFixedGridReference,
  type GroundGlassM5tFarReferenceInput,
} from "../../render/webgpu/groundGlassM5tQuadrature";
import {
  analyzeGroundGlassM5tEdgeSpread,
  analyzeGroundGlassM5tLineSpread,
  compareGroundGlassM5tSpatialProfiles,
  createGroundGlassM5tSpatialProfile,
  validateGroundGlassM5tRoiSelection,
} from "../../render/webgpu/groundGlassM5tSpatialBlurAnalysis";
import {
  GROUND_GLASS_M5U_COST_ACCOUNTING_REVISION,
  GROUND_GLASS_M5U_REFERENCE_EVIDENCE_CONTRACT_REVISION,
  evaluateGroundGlassM5uPixelEvidence,
  getGroundGlassM5uR256BaselinePixelEvidence,
  getGroundGlassM5uRequiredM5sReferences,
  runGroundGlassM5uQuadrature,
  summarizeGroundGlassM5uEvidence,
  summarizeGroundGlassM5uR256Costs,
} from "../../render/webgpu/groundGlassM5uQuadrature";
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
  GROUND_GLASS_M5Q_R186_FROZEN_THRESHOLDS as M5Q_FROZEN_THRESHOLDS,
  type GroundGlassM5qEvidenceContext,
  type GroundGlassM5qPairedCapEvidence,
  type GroundGlassM5qQualification,
} from "../../render/webgpu/groundGlassM5qQualification";
import {
  GROUND_GLASS_M7E_EVALUATOR_REVISION,
  GROUND_GLASS_M7E_R187_GATHER_REVISION,
  GROUND_GLASS_M7E_R187_B1_REVISION,
  GROUND_GLASS_M7E_R187_THRESHOLDS,
  GROUND_GLASS_M7E_SCENE_SOURCE_REVISION,
  evaluateGroundGlassM7eB1BoundaryProbe,
  evaluateGroundGlassM7eNativeCapture,
  evaluateGroundGlassM7eQuality,
  validateGroundGlassM7eReportInventory,
  type GroundGlassM7eCaptureEnvelope,
  type GroundGlassM7eQualityMatrix,
  type GroundGlassM7eRuntimeIdentity,
  type GroundGlassM7eReportInventory,
} from "../../render/webgpu/groundGlassM7eGatherB1Evidence";
import {
  encodeGroundGlassM7eLosslessJson,
  stringifyGroundGlassM7eLosslessJson,
} from "../../render/webgpu/groundGlassM7eLosslessEvidenceJson";
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
    type: "Float32Array" | "Uint8Array" | "Uint16Array" | "Int32Array";
  }>[];
  gzipBase64: string;
}>;

type M5sNativeStratumReport = GroundGlassM5sStratumStudy & Readonly<{
  validSupport: Readonly<{ candidateCount: number; selectedCount: number; requiredCount: number; status: string }>;
  sourcePixelIds: readonly number[];
  gatherPixelIds: readonly number[];
  sampleCounts: readonly number[];
  samplingSeeds: readonly number[];
  evaluatedProposalCount: number;
  inputFingerprints: GroundGlassM5sFarReferenceInput["inputFingerprints"];
  blurAndSpread: Readonly<Record<string, unknown>>;
}>;

type M5sNativeStateReport = Readonly<{
  opticalStateId: string;
  captureRole: string;
  captureIds: Readonly<{ full32: string; full64: string }>;
  runtime: Readonly<{ rendererRevision: string; rendererFamily: string; actualExecutionApi: string;
    internalFallback: string; applicationFallback: false }>;
  requestIds: Readonly<{ full32: string; full64: string }>;
  rendererGenerationIds: Readonly<{ full32: string; full64: string }>;
  sceneId: string;
  sceneSourceRevision: string;
  effectiveOpticalRequestFingerprints: readonly [string, string];
  cameraFingerprints: readonly [string, string];
  sourceDimensions: readonly [number, number];
  gatherDimensions: readonly [number, number];
  sampledFilmDimensionsMm: GroundGlassApertureGatherCaptureReadback["sampledFilmDimensionsMm"];
  radiusCapPx: number;
  sourceColorDomain: GroundGlassApertureGatherCaptureReadback["colorDomain"];
  inputFingerprints: GroundGlassM5sFarReferenceInput["inputFingerprints"];
  profileInputProvenance: ReturnType<typeof compareGroundGlassM5sInputFingerprints>;
  roiStrata: readonly M5sNativeStratumReport[];
  aggregate: ReturnType<typeof aggregateGroundGlassM5sStrata>;
}>;

const nativeRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const rawPilotEnabled = process.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true";
const physicalResearchEnabled = process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "1";
const gatherResearchEnabled = process.env.GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH === "1";
const gatherR187QualificationEnabled = process.env.GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION === "1";
const physicalR187QualificationEnabled = process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION === "1";
const M5_REQUIRED = nativeRequired && rawPilotEnabled && physicalResearchEnabled && gatherResearchEnabled
  && !gatherR187QualificationEnabled && REVISION === "186";
const M7E_REQUIRED = nativeRequired && rawPilotEnabled && physicalResearchEnabled && gatherResearchEnabled
  && gatherR187QualificationEnabled && physicalR187QualificationEnabled && REVISION === "187";
const M4_RAW_BASELINE_REQUIRED = nativeRequired && rawPilotEnabled && physicalResearchEnabled && !gatherResearchEnabled;
const M7E_NATIVE_TEST_INVOCATION = "PATH=/Users/homan/.nvm/versions/node/v24.3.0/bin:$PATH GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH=1 GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION=1 GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH=1 GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION=1 VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH=true VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH=true VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true GROUND_GLASS_M7E_EVIDENCE_DIR=docs/architecture/ground-glass-m7e-r187-gather-b1 PLAYWRIGHT_WEB_SERVER_PORT=4173 npx playwright test src/tests/e2e/ground-glass-webgpu-aperture-gather-app.spec.ts --project=chrome-native-webgpu --workers=1 --grep 'M7E native r187 requalifies|M7E r187 isolates optional M5 failures|native M5 rejects stale captures and recovers from a local gather failure'";
const M7E_NATIVE_RUN_ID = `${Date.now()}-${process.pid}`;

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
  options: Readonly<{
    includeM5rDiagnostics?: boolean;
    includeM5rNearFixture?: boolean;
    includeM6dCompositeContractProbe?: boolean;
  }> = {},
): Promise<GroundGlassApertureGatherCaptureReadback> => {
  const triggered = await page.evaluate(({ captureToken, mode, retainBuffers, maxRadiusPx, m5rOptions }) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestApertureGatherCapture) return false;
    control.apertureGatherCaptureReadback = null;
    control.apertureGatherCaptureRequest = {
      token: captureToken,
      qualityMode: mode,
      retainReadbackBuffers: retainBuffers,
      ...(m5rOptions.includeM5rDiagnostics ? { includeM5rDiagnostics: true } : {}),
      ...(m5rOptions.includeM5rNearFixture ? { includeM5rNearFixture: true } : {}),
      ...(m5rOptions.includeM6dCompositeContractProbe ? { includeM6dCompositeContractProbe: true } : {}),
      ...(maxRadiusPx !== undefined ? { maximumRadiusPx: maxRadiusPx } : {}),
    };
    control.requestApertureGatherCapture();
    return true;
  }, {
    captureToken: token,
    mode: qualityMode,
    retainBuffers: retainReadbackBuffers,
    maxRadiusPx: maximumRadiusPx,
    m5rOptions: options,
  });
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
      Float32Array | Uint8Array | Uint16Array | Int32Array,
    ][];
    let totalBytes = 0;
    const fields = entries.map(([name, values]) => {
      const field = {
        name,
        offset: totalBytes,
        byteLength: values.byteLength,
      type: values.constructor.name as "Float32Array" | "Uint8Array" | "Uint16Array" | "Int32Array",
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
    if (field.type === "Uint16Array") return [field.name, new Uint16Array(bytes)];
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

const makeM5sInputFromCapture = (
  capture: GroundGlassApertureGatherCaptureReadback,
): GroundGlassM5sFarReferenceInput => {
  const buffers = capture.readbackBuffers;
  if (!buffers) throw new Error(`M5S capture ${capture.captureId} did not retain readback buffers`);
  if (capture.readbackOrigin !== "top") {
    throw new Error(`M5S requires top-origin readbacks; capture ${capture.captureId} reports ${capture.readbackOrigin}`);
  }
  return {
    source: { widthPx: capture.sourceWidthPx, heightPx: capture.sourceHeightPx },
    gather: { widthPx: capture.farGatherWidthPx, heightPx: capture.farGatherHeightPx },
    film: capture.sampledFilmDimensionsMm,
    sourceRgba: buffers.sourceRgba,
    physicalRgba: buffers.physicalRgba,
    validity: buffers.validity,
    depth: buffers.depth,
    observedGatherCenterSourceIds: buffers.observedGatherCenterSourceIds,
    observedGatherCenterSourceUvs: buffers.observedGatherCenterSourceUvs,
    inverseProjectionMatrix: capture.inverseProjectionMatrix,
    maximumRadiusPx: capture.maximumRadiusPx,
    inputFingerprints: capture.inputFingerprints,
  };
};

const makeM5tInputFromCapture = (
  capture: GroundGlassApertureGatherCaptureReadback,
): GroundGlassM5tFarReferenceInput => makeM5sInputFromCapture(capture);

type M5tSpatialLineSelection = Readonly<{
  orientation: "horizontal" | "vertical";
  sourcePixelIds: readonly number[];
  gatherPixelIds: readonly number[];
  roiId: string;
}>;

/** Selects a contiguous ROI from source/depth/physical evidence before inspecting candidate error. */
const selectM5tSpatialLine = (
  input: GroundGlassM5sFarReferenceInput,
): M5tSpatialLineSelection | null => {
  const { widthPx, heightPx } = input.source;
  const sampleDistance = (x: number, y: number): number => groundGlassViewDistanceMmAtTopUv(
    (x + 0.5) / widthPx, (y + 0.5) / heightPx,
    input.depth[y * widthPx + x]!, input.inverseProjectionMatrix,
  );
  const eligibleFar = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= widthPx || y >= heightPx) return false;
    const sourceId = y * widthPx + x;
    return input.validity[sourceId] === 1
      && input.physicalRgba[sourceId * 4]! > GROUND_GLASS_APERTURE_SIGN_EPSILON_MM;
  };
  const sourceContrast = (firstId: number, secondId: number): number => {
    const first = firstId * 4;
    const second = secondId * 4;
    return Math.abs(input.sourceRgba[first]! - input.sourceRgba[second]!);
  };
  const findLine = (orientation: "horizontal" | "vertical"): M5tSpatialLineSelection | null => {
    for (let y = 5; y < heightPx - 5; y += 1) {
      for (let x = 5; x < widthPx - 5; x += 1) {
        const nextX = orientation === "horizontal" ? x + 1 : x;
        const nextY = orientation === "vertical" ? y + 1 : y;
        if (!eligibleFar(x, y) || !eligibleFar(nextX, nextY)) continue;
        const centerDistance = sampleDistance(x, y);
        const nextDistance = sampleDistance(nextX, nextY);
        const relativeDepthEdge = Math.abs(centerDistance - nextDistance)
          / Math.max(1, Math.min(Math.abs(centerDistance), Math.abs(nextDistance)));
        if (relativeDepthEdge <= 0.03 || sourceContrast(y * widthPx + x, nextY * widthPx + nextX) < 0.04) continue;
        const sourcePixelIds = Array.from({ length: 9 }, (_value, index) => {
          const offset = index - 4;
          const lineX = x + (orientation === "horizontal" ? offset : 0);
          const lineY = y + (orientation === "vertical" ? offset : 0);
          return lineY * widthPx + lineX;
        });
        if (sourcePixelIds.some((sourceId) => {
          const lineX = sourceId % widthPx;
          const lineY = Math.floor(sourceId / widthPx);
          return !eligibleFar(lineX, lineY);
        })) continue;
        const gatherPixelIds: number[] = [];
        for (let index = 0; index < sourcePixelIds.length; index += 1) {
          const sourceId = sourcePixelIds[index]!;
          const lineX = sourceId % widthPx;
          const lineY = Math.floor(sourceId / widthPx);
          const gatherId = lineY * input.gather.widthPx + lineX;
          const observedX = input.observedGatherCenterSourceIds[gatherId * 2]!;
          const observedY = input.observedGatherCenterSourceIds[gatherId * 2 + 1]!;
          if (observedX !== lineX || observedY !== lineY) return null;
          gatherPixelIds.push(gatherId);
        }
        return {
          orientation,
          sourcePixelIds,
          gatherPixelIds,
          roiId: `depth-edge-${orientation}-${sourcePixelIds[0]}`,
        };
      }
    }
    return null;
  };
  return findLine("horizontal") ?? findLine("vertical");
};

const m5sRgbForRun = (
  run: GroundGlassM5sFarReferenceResult,
  gatherPixelIds: readonly number[],
): Float64Array | null => {
  const pixelsById = new Map(run.pixels.map((pixel) => [pixel.gatherPixelId, pixel]));
  const result = new Float64Array(gatherPixelIds.length * 3);
  for (let index = 0; index < gatherPixelIds.length; index += 1) {
    const rgb = pixelsById.get(gatherPixelIds[index]!)?.limitingIntegralRgb;
    if (!rgb) return null;
    result.set(rgb, index * 3);
  }
  return result;
};

const m5sSourceRgbAtGatherIds = (
  input: GroundGlassM5sFarReferenceInput,
  gatherPixelIds: readonly number[],
): Float64Array => {
  const result = new Float64Array(gatherPixelIds.length * 3);
  for (let index = 0; index < gatherPixelIds.length; index += 1) {
    const sourceId = input.observedGatherCenterSourceIds[gatherPixelIds[index]! * 2 + 1]!
      * input.source.widthPx
      + input.observedGatherCenterSourceIds[gatherPixelIds[index]! * 2]!;
    result.set(input.sourceRgba.subarray(sourceId * 4, sourceId * 4 + 3), index * 3);
  }
  return result;
};

const m5sLocalGradientEnergy = (
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  centerPixelId: number,
): number => {
  const centerX = centerPixelId % width;
  const centerY = Math.floor(centerPixelId / width);
  let total = 0;
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = centerX + dx;
      const ny = centerY + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const neighbor = (ny * width + nx) * 4;
      const center = centerPixelId * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        total += Math.abs(rgba[center + channel]! - rgba[neighbor + channel]!);
      }
      count += 1;
    }
  }
  return count ? total / (count * 3) : 0;
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

const rgbFromSelectedRgba = (rgba: Float32Array, pixelIndices: readonly number[]): Float32Array => {
  const output = new Float32Array(pixelIndices.length * 3);
  let destination = 0;
  for (const pixel of pixelIndices) {
    const offset = pixel * 4;
    output[destination++] = rgba[offset] ?? 0;
    output[destination++] = rgba[offset + 1] ?? 0;
    output[destination++] = rgba[offset + 2] ?? 0;
  }
  return output;
};

const chooseM5rFarRoi = (
  capture: GroundGlassApertureGatherCaptureReadback,
  minimumSourceDifference: number,
  maximumPixels = 128,
): number[] => {
  const buffers = capture.readbackBuffers;
  if (!buffers) throw new Error(`M5R ROI selection requires retained buffers for ${capture.captureId}`);
  const candidates: number[] = [];
  const gatherPixels = capture.farGatherWidthPx * capture.farGatherHeightPx;
  for (let gatherPixel = 0; gatherPixel < gatherPixels; gatherPixel += 1) {
    const centerX = buffers.observedGatherCenterSourceIds[gatherPixel * 2] ?? -1;
    const centerY = buffers.observedGatherCenterSourceIds[gatherPixel * 2 + 1] ?? -1;
    if (centerX < 0 || centerY < 0 || centerX >= capture.sourceWidthPx || centerY >= capture.sourceHeightPx) continue;
    const sourcePixel = centerY * capture.sourceWidthPx + centerX;
    if (buffers.validity[sourcePixel] !== 1 || (buffers.physicalRgba[sourcePixel * 4] ?? 0) <= 0.00001) continue;
    const sourceOffset = sourcePixel * 4;
    const gatherOffset = gatherPixel * 4;
    const sourceDifference = Math.hypot(
      (buffers.farGatherRgba[gatherOffset] ?? 0) - (buffers.sourceRgba[sourceOffset] ?? 0),
      (buffers.farGatherRgba[gatherOffset + 1] ?? 0) - (buffers.sourceRgba[sourceOffset + 1] ?? 0),
      (buffers.farGatherRgba[gatherOffset + 2] ?? 0) - (buffers.sourceRgba[sourceOffset + 2] ?? 0),
    );
    if (sourceDifference >= minimumSourceDifference) candidates.push(gatherPixel);
  }
  if (candidates.length === 0) return [];
  const selectedCount = Math.min(maximumPixels, candidates.length);
  return Array.from({ length: selectedCount }, (_value, index) =>
    candidates[Math.floor(index * candidates.length / selectedCount)]!,
  );
};

const makeM5rCpuReferences = (
  capture: GroundGlassApertureGatherCaptureReadback,
  gatherPixelIndices: readonly number[],
) => {
  const buffers = capture.readbackBuffers;
  if (!buffers || gatherPixelIndices.length === 0) {
    throw new Error(`M5R CPU reference ROI is empty for ${capture.captureId}`);
  }
  const centerSourceIds = new Int32Array(gatherPixelIndices.length * 2);
  const centerSourceUvs = new Float32Array(gatherPixelIndices.length * 2);
  gatherPixelIndices.forEach((gatherPixel, destinationPixel) => {
    centerSourceIds[destinationPixel * 2] = buffers.observedGatherCenterSourceIds[gatherPixel * 2] ?? -1;
    centerSourceIds[destinationPixel * 2 + 1] = buffers.observedGatherCenterSourceIds[gatherPixel * 2 + 1] ?? -1;
    centerSourceUvs[destinationPixel * 2] = buffers.observedGatherCenterSourceUvs[gatherPixel * 2] ?? 0;
    centerSourceUvs[destinationPixel * 2 + 1] = buffers.observedGatherCenterSourceUvs[gatherPixel * 2 + 1] ?? 0;
  });
  const sharedInput = {
    source: { widthPx: capture.sourceWidthPx, heightPx: capture.sourceHeightPx },
    gather: { widthPx: gatherPixelIndices.length, heightPx: 1 },
    film: capture.sampledFilmDimensionsMm,
    sourceRgba: buffers.sourceRgba,
    physicalRgba: buffers.physicalRgba,
    validity: buffers.validity,
    depth: buffers.depth,
    observedGatherCenterSourceIds: centerSourceIds,
    observedGatherCenterSourceUvs: centerSourceUvs,
    inverseProjectionMatrix: capture.inverseProjectionMatrix,
    maximumRadiusPx: capture.maximumRadiusPx,
  } as const;
  const native32 = referenceGroundGlassApertureGather({ ...sharedInput, sampleCount: 32 });
  const native64 = referenceGroundGlassApertureGather({ ...sharedInput, sampleCount: 64 });
  const nested32 = referenceGroundGlassApertureGatherNestedGoldenAngle64ForTesting({
    ...sharedInput,
    sampleCount: 32,
  });
  const nested64 = referenceGroundGlassApertureGatherNestedGoldenAngle64ForTesting({
    ...sharedInput,
    sampleCount: 64,
  });
  const high128 = referenceGroundGlassApertureGatherDiagnostic({ ...sharedInput, sampleCount: 128 });
  const high256 = referenceGroundGlassApertureGatherDiagnostic({ ...sharedInput, sampleCount: 256 });
  return { native32, native64, nested32, nested64, high128, high256, centerSourceIds, centerSourceUvs };
};

const makeM5rNestedProposals = (sampleCount: 16 | 32 | 64): Float64Array => {
  const proposals = new Float64Array(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const [x, y] = groundGlassGoldenAngleNestedDiskProposalFrom64ForTesting(index, sampleCount);
    proposals[index * 2] = x;
    proposals[index * 2 + 1] = y;
  }
  return proposals;
};

const gpuM5rNearCapture = (
  capture: GroundGlassApertureGatherCaptureReadback,
): GroundGlassM5rNearAlphaCapture => {
  const buffers = capture.readbackBuffers;
  if (!buffers?.nearProposalCountsRgba || !buffers.nearCoverageDiagnosticsRgba
      || !buffers.nearAcceptedFootprintRgba || !buffers.nearAlphaHalfBits) {
    throw new Error(`M5R Near diagnostics are absent from ${capture.captureId}`);
  }
  const outputCount = capture.nearGatherWidthPx * capture.nearGatherHeightPx;
  const channel = (values: Float32Array, channelIndex: number) => {
    const output = new Float32Array(outputCount);
    for (let pixel = 0; pixel < outputCount; pixel += 1) output[pixel] = values[pixel * 4 + channelIndex] ?? 0;
    return output;
  };
  return {
    identity: {
      captureId: capture.captureId,
      requestId: capture.requestId,
      sceneId: capture.sceneId,
      inputFingerprint: Object.values(capture.inputFingerprints).join(":"),
      outputWidthPx: capture.nearGatherWidthPx,
      outputHeightPx: capture.nearGatherHeightPx,
      sampleCount: capture.sampleCount,
      pixelOrder: "top-origin",
    },
    intermediates: {
      nearCenterIsNear: channel(buffers.nearProposalCountsRgba, 0),
      nearEvaluatedProposalCount: channel(buffers.nearProposalCountsRgba, 1),
      nearAcceptedProposalCount: channel(buffers.nearProposalCountsRgba, 2),
      nearNonzeroMembershipCount: channel(buffers.nearProposalCountsRgba, 3),
      nearWeightSum: channel(buffers.nearCoverageDiagnosticsRgba, 0),
      nearCoverageMass: channel(buffers.nearCoverageDiagnosticsRgba, 1),
      nearEstimatedCoverage: channel(buffers.nearCoverageDiagnosticsRgba, 2),
      nearFinalAlpha: channel(buffers.nearCoverageDiagnosticsRgba, 3),
      nearAcceptedAreaRatioMean: channel(buffers.nearAcceptedFootprintRgba, 0),
      nearAcceptedCompensationMaximum: channel(buffers.nearAcceptedFootprintRgba, 1),
    },
    nearRgba: buffers.nearRgba,
    rawNearAlphaHalfBits: buffers.nearAlphaHalfBits,
  };
};

const cpuM5rNearCapture = (capture: GroundGlassApertureGatherCaptureReadback):
  GroundGlassM5rNearAlphaCapture & Readonly<{ referenceId: string }> => {
  const buffers = capture.readbackBuffers;
  if (!buffers) throw new Error(`M5R CPU Near reference is absent from ${capture.captureId}`);
  return {
    identity: gpuM5rNearCapture(capture).identity,
    referenceId: `cpu-m5-r186-${capture.sampleCount}`,
    intermediates: {
      nearCenterIsNear: buffers.nearCpuCenterIsNear,
      nearEvaluatedProposalCount: buffers.nearCpuEvaluatedProposalCount,
      nearAcceptedProposalCount: buffers.nearCpuAcceptedProposalCount,
      nearNonzeroMembershipCount: buffers.nearCpuNonzeroMembershipCount,
      nearWeightSum: buffers.nearCpuWeightSum,
      nearCoverageMass: buffers.nearCpuCoverageMass,
      nearEstimatedCoverage: buffers.nearCpuEstimatedCoverage,
      nearFinalAlpha: buffers.nearCpuReferenceRgba.filter((_value, index) => index % 4 === 3),
      nearAcceptedAreaRatioMean: buffers.nearCpuAcceptedAreaRatioMean,
      nearAcceptedCompensationMaximum: buffers.nearCpuAcceptedCompensationMaximum,
    },
    nearRgba: buffers.nearCpuReferenceRgba,
  };
};

type M5qCaptureMatrixRun = Readonly<{
  r3: ReturnType<typeof evaluateGroundGlassApertureGatherR3>;
  captures: Readonly<Record<GroundGlassR3QualityMode, GroundGlassApertureGatherCaptureReadback>>;
  hostFrameResults: Readonly<Record<GroundGlassR3QualityMode, GroundGlassM7eCaptureEnvelope["hostFrameResult"]>>;
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

const writeM7eCaptureArtifacts = async (
  testInfo: TestInfo,
  envelope: GroundGlassM7eCaptureEnvelope,
): Promise<Readonly<{ manifestPath: string; dataPath: string; sha256: string }>> => {
  const buffers = envelope.capture.readbackBuffers;
  if (!buffers) throw new Error(`M7E capture ${envelope.scenarioId} has no retained GPU/CPU readbacks`);
  const fields: Array<Readonly<{ name: string; offset: number; byteLength: number; elementCount: number; type: string }>> = [];
  const chunks: Buffer[] = [];
  let offset = 0;
  for (const [name, values] of Object.entries(buffers)) {
    const byteAlignment = values.BYTES_PER_ELEMENT;
    const alignedOffset = Math.ceil(offset / byteAlignment) * byteAlignment;
    if (alignedOffset !== offset) {
      chunks.push(Buffer.alloc(alignedOffset - offset));
      offset = alignedOffset;
    }
    const chunk = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
    fields.push({ name, offset, byteLength: chunk.byteLength, elementCount: values.length, type: values.constructor.name });
    chunks.push(chunk);
    offset += chunk.byteLength;
  }
  const compressed = gzipSync(Buffer.concat(chunks), { level: 9 });
  const sha256 = createHash("sha256").update(compressed).digest("hex");
  const stem = envelope.scenarioId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const evidenceDirectory = process.env.GROUND_GLASS_M7E_EVIDENCE_DIR
    ? resolve(process.cwd(), process.env.GROUND_GLASS_M7E_EVIDENCE_DIR, "captures")
    : testInfo.outputPath("captures");
  mkdirSync(evidenceDirectory, { recursive: true });
  const manifestPath = resolve(evidenceDirectory, `${stem}.json`);
  const dataPath = resolve(evidenceDirectory, `${stem}.bin.gz`);
  const manifest = {
    schemaVersion: 1,
    scenarioId: envelope.scenarioId,
    sourceCommitSha: envelope.sourceCommitSha,
    testInvocation: envelope.testInvocation,
    runtime: envelope.runtime,
    hostFrameResult: envelope.hostFrameResult,
    capture: { ...envelope.capture, readbackBuffers: null },
    readbackPayload: { schemaVersion: 2, encoding: "gzip", file: `${stem}.bin.gz`, sha256, uncompressedByteLength: offset, fields },
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writeFileSync(dataPath, compressed);
  await testInfo.attach(`${stem}.json`, { path: manifestPath, contentType: "application/json" });
  await testInfo.attach(`${stem}.bin.gz`, { path: dataPath, contentType: "application/gzip" });
  return { manifestPath, dataPath, sha256 };
};

const captureM5qMatrix = async (
  page: Page,
  candidate: M5qCandidate,
  maximumRadiusPx: number,
  tokenPrefix: string,
  mountedRendererRevision: string,
  retainSensitivityBuffers = false,
  thresholds: GroundGlassApertureGatherR3Thresholds = M5Q_FROZEN_THRESHOLDS,
): Promise<M5qCaptureMatrixRun> => {
  const captures: Partial<Record<GroundGlassR3QualityMode, GroundGlassApertureGatherCaptureReadback>> = {};
  const summary: Array<{
    captureId: string;
    requestId: string;
    rendererGenerationId: string;
    qualityMode: GroundGlassR3QualityMode;
    maximumRadiusPx: number;
  }> = [];
  const hostFrameResults: Partial<Record<GroundGlassR3QualityMode, GroundGlassM7eCaptureEnvelope["hostFrameResult"]>> = {};
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
    const pane = paneFor(page);
    const requestId = await pane.getAttribute("data-frame-request-id");
    const generationId = await pane.getAttribute("data-renderer-generation");
    const lastCompletedRequestId = await pane.getAttribute("data-last-completed-request-id");
    const frameStatus = await pane.getAttribute("data-frame-result-status");
    hostFrameResults[qualityMode] = {
      status: frameStatus === "completed" ? "completed" : frameStatus === "failed" ? "failed" : "pending",
      accepted: requestId !== null && requestId === lastCompletedRequestId && requestId === capture.requestId,
      requestId: requestId ?? "",
      sceneId: page.url().includes("/architecture-rise") ? "architecture-rise" : "unknown",
      rendererGenerationId: generationId ?? "",
    };
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
  const captureMatrix = {
    half32: toR3Capture(captures.half32),
    full32: toR3Capture(captures.full32),
    full64: toR3Capture(captures.full64),
  } satisfies GroundGlassApertureGatherR3CaptureMatrix;
  const r3 = evaluateGroundGlassApertureGatherR3(captureMatrix, thresholds);
  expect(r3.provenance.status, JSON.stringify(r3.provenance)).toBe("matched");
  const halfBuffers = captures.half32.readbackBuffers;
  const full32Buffers = captures.full32.readbackBuffers;
  if (!halfBuffers || !full32Buffers) throw new Error(`M5Q matrix ${candidate.id} lost retained readbacks`);
  return {
    r3,
    captures: {
      half32: captures.half32,
      full32: captures.full32,
      full64: captures.full64,
    },
    hostFrameResults: {
      half32: hostFrameResults.half32!,
      full32: hostFrameResults.full32!,
      full64: hostFrameResults.full64!,
    },
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
  const q3SignedBoundary = q3Run.r3.signedBoundaryEvidence;
  const q3Decision = q3Qualification.dimensions.Q3;
  const q3SidePopulationInvariantPassed = q3SignedBoundary.nearSidePixelCount + q3SignedBoundary.farSidePixelCount
    === q3SignedBoundary.participatingPixelCount;
  expect(q3Run.runtime.rendererFamily).toBe("webgpu-renderer");
  expect(q3Run.runtime.actualExecutionApi).toBe("webgpu");
  expect(q3Run.runtime.internalFallback).toBe("none");
  expect(q3Run.runtime.applicationFallback).toBe(false);
  expect(q3Run.runtime.rendererRevision).toBe(`r${REVISION}`);
  expect(q3SignedBoundary.status).toBe("present");
  expect(q3SignedBoundary.populationConsistent).toBe(true);
  expect(q3SidePopulationInvariantPassed).toBe(true);
  if (q3SignedBoundary.nearSidePixelCount < M5Q_FROZEN_THRESHOLDS.minimumSignedBoundarySidePixels
      || q3SignedBoundary.farSidePixelCount < M5Q_FROZEN_THRESHOLDS.minimumSignedBoundarySidePixels) {
    expect(q3Decision.status).toBe("insufficient-support");
    expect(q3Decision.status).not.toBe("bounded-qualified");
  } else {
    expect(q3Decision.status).toBe("bounded-qualified");
  }

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
    schemaVersion: 3,
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
    q3SignedBoundaryEvidence: {
      opticalStateId: q3Candidate.id,
      evaluatorRevision: GROUND_GLASS_M5Q_EVALUATOR_REVISION,
      frozenThresholdRevision: M5Q_FROZEN_THRESHOLDS.revision,
      evidenceSource: q3Context.evidenceSource,
      captureIds: q3Run.r3.captureIds,
      signedBoundaryPairCount: q3SignedBoundary.adjacentNearFarPairCount,
      signedBoundaryPixelCount: q3SignedBoundary.participatingPixelCount,
      signedBoundaryNearSidePixelCount: q3SignedBoundary.nearSidePixelCount,
      signedBoundaryFarSidePixelCount: q3SignedBoundary.farSidePixelCount,
      depthEdgePixelCount: q3Run.r3.depthEdgeMetrics.pixelCount,
      depthEdgeNearSidePixelCount: q3Run.r3.depthEdgeMetrics.nearSidePixelCount,
      depthEdgeFarSidePixelCount: q3Run.r3.depthEdgeMetrics.farSidePixelCount,
      signedBoundaryReferenceRmse: q3Run.r3.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.rmse,
      signedBoundaryReferenceMaximumChannelError:
        q3Run.r3.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.maximumChannelError,
      signedBoundaryB1Rmse: q3Run.r3.foregroundLeakageMetrics.half32B1VsFull32AtSignedBoundary.rmse,
      requiredNearSidePixelMinimum: M5Q_FROZEN_THRESHOLDS.minimumSignedBoundarySidePixels,
      requiredFarSidePixelMinimum: M5Q_FROZEN_THRESHOLDS.minimumSignedBoundarySidePixels,
      sidePopulationInvariantPassed: q3SidePopulationInvariantPassed,
      previousDecision: "bounded-qualified",
      correctedDecision: q3Decision.status,
      failedCriteria: q3Decision.criteria.filter(({ met }) => met === false),
      runtime: q3Run.runtime,
      remainingLimitations: [
        "Q3 establishes only signed-boundary support and bounded quality for this optical state and capture matrix.",
        "General depth-edge B1 quality remains a separate unqualified claim.",
      ],
    },
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

test("M7E native r187 requalifies the bounded M5 Far/Near/B1 matrices", async ({ page, browser }, testInfo) => {
  test.skip(!M7E_REQUIRED,
    "Requires native-required Chrome WebGPU and the explicit r187 M5 qualification harness");
  test.setTimeout(1_800_000);
  expect(REVISION).toBe("187");
  const pageErrors = await prepareNativeM5F8Page(page);
  const sourceCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const testInvocation = M7E_NATIVE_TEST_INVOCATION;

  const b1BoundaryProbe = await captureB1BoundaryProbe(page, `m7e-r187-b1-boundary-${Date.now()}`);
  const boundaryEvaluation = evaluateGroundGlassM7eB1BoundaryProbe(b1BoundaryProbe);
  expect(boundaryEvaluation.status, JSON.stringify(boundaryEvaluation.issues)).toBe("passed");
  expect(b1BoundaryProbe.rendererRevision).toBe("r187");
  const runtime: GroundGlassM7eRuntimeIdentity = {
    rendererRevision: "r187",
    rendererFamily: b1BoundaryProbe.rendererFamily,
    actualExecutionApi: b1BoundaryProbe.actualExecutionApi,
    internalFallback: b1BoundaryProbe.internalFallback,
    applicationFallback: false,
    browserVersion: browser.version(),
    operatingSystem: `${process.platform} ${process.arch}`,
    nodeVersion: process.version,
    nativeRequired: true,
  };
  expect(runtime.rendererFamily).toBe("webgpu-renderer");
  expect(runtime.actualExecutionApi).toBe("webgpu");
  expect(runtime.internalFallback).toBe("none");

  const q1Candidate = M5Q_CANDIDATES.find(({ id }) => id === "ar-f3200-f5p6-loupe4-rise0");
  const q2Candidate = M5Q_CANDIDATES.find(({ id }) => id === "ar-f3200-f5p6-full-rise0");
  const q3Candidate = M5Q_CANDIDATES.find(({ id }) => id === "ar-f5200-f5p6-full-rise0");
  if (!q1Candidate || !q2Candidate || !q3Candidate) throw new Error("Frozen M5Q optical-state selection is incomplete");

  await setM5qCandidateState(page, q1Candidate);
  const q5Stress = await captureM5qMatrix(page, q1Candidate, 2, "m7e-q5-cap2", "r187", true, GROUND_GLASS_M7E_R187_THRESHOLDS);
  const q1Control = await captureM5qMatrix(page, q1Candidate, 60, "m7e-q1-cap60", "r187", true, GROUND_GLASS_M7E_R187_THRESHOLDS);
  const pairedCapEvidence = makeM5qPairedCapEvidence(q1Candidate.id, q5Stress, q1Control, 2, 60);
  const q1Context = makeM5qEvidenceContext(
    q1Candidate,
    q1Control,
    "Reused the optical-state identity selected in the historical M5Q registered-app search; this r187 run requalifies the state and does not perform a new quality-based candidate search.",
  );
  const q5Context = makeM5qEvidenceContext(
    q1Candidate,
    q5Stress,
    "Same preselected optical state as Q1 under the frozen 2 px stress cap, paired with the 60 px control capture on r187.",
  );

  await setM5qCandidateState(page, q2Candidate);
  const q2Run = await captureM5qMatrix(page, q2Candidate, 60, "m7e-q2-q7-cap60", "r187", false, GROUND_GLASS_M7E_R187_THRESHOLDS);
  const q2Context = makeM5qEvidenceContext(
    q2Candidate,
    q2Run,
    "Reused the preselected historical M5Q state for the r187 Q2/Q7 requalification; no quality-based candidate search was performed in this run.",
  );

  await setM5qCandidateState(page, q3Candidate);
  const q3Run = await captureM5qMatrix(page, q3Candidate, 60, "m7e-q3-q4-cap60", "r187", false, GROUND_GLASS_M7E_R187_THRESHOLDS);
  const q3Context = makeM5qEvidenceContext(
    q3Candidate,
    q3Run,
    "Reused the preselected historical M5Q state for the r187 signed-boundary and Near evidence; no quality-based candidate search was performed in this run.",
  );
  const m7eQualityMatrices: readonly GroundGlassM7eQualityMatrix[] = [
    { role: "q1-control", context: q1Context, r3: q1Control.r3, captures: {
      half32: toR3Capture(q1Control.captures.half32), full32: toR3Capture(q1Control.captures.full32), full64: toR3Capture(q1Control.captures.full64),
    } },
    { role: "q5-stress", context: q5Context, r3: q5Stress.r3, captures: {
      half32: toR3Capture(q5Stress.captures.half32), full32: toR3Capture(q5Stress.captures.full32), full64: toR3Capture(q5Stress.captures.full64),
    }, pairedCapEvidence },
    { role: "q2-q7", context: q2Context, r3: q2Run.r3, captures: {
      half32: toR3Capture(q2Run.captures.half32), full32: toR3Capture(q2Run.captures.full32), full64: toR3Capture(q2Run.captures.full64),
    } },
    { role: "q3-q4", context: q3Context, r3: q3Run.r3, captures: {
      half32: toR3Capture(q3Run.captures.half32), full32: toR3Capture(q3Run.captures.full32), full64: toR3Capture(q3Run.captures.full64),
    } },
  ];
  const qualityEvaluation = evaluateGroundGlassM7eQuality(m7eQualityMatrices);
  const invocation = testInvocation.includes("chrome-native-webgpu") ? testInvocation : "unknown";
  const runCaptures = async (
    role: string,
    run: M5qCaptureMatrixRun,
    radiusCapPx: number,
  ): Promise<GroundGlassM7eCaptureEnvelope[]> => {
    const envelopes: GroundGlassM7eCaptureEnvelope[] = [];
    for (const mode of ["half32", "full32", "full64"] as const) {
      const scenarioId = `${role}-${mode}`;
      const envelope: GroundGlassM7eCaptureEnvelope = {
        scenarioId,
        capture: run.captures[mode],
        runtime,
        sourceCommitSha,
        testInvocation: invocation,
        supportingArtifact: `captures/${scenarioId}.json;captures/${scenarioId}.bin.gz`,
        hostFrameResult: run.hostFrameResults[mode],
      };
      const captureEvaluation = evaluateGroundGlassM7eNativeCapture(envelope, radiusCapPx);
      expect(captureEvaluation.status, `${scenarioId}: ${JSON.stringify(captureEvaluation.issues)}`).toBe("passed");
      await writeM7eCaptureArtifacts(testInfo, envelope);
      envelopes.push(envelope);
    }
    return envelopes;
  };
  const captureEnvelopes = [
    ...await runCaptures("q5-stress-cap2", q5Stress, 2),
    ...await runCaptures("q1-control-cap60", q1Control, 60),
    ...await runCaptures("q2-q7-cap60", q2Run, 60),
    ...await runCaptures("q3-q4-cap60", q3Run, 60),
  ];
  expect(new Set(captureEnvelopes.map(({ capture }) => capture.captureId)).size).toBe(12);
  expect(new Set(captureEnvelopes.map(({ capture }) => capture.rendererGenerationId)).size).toBe(1);
  const scenarios = captureEnvelopes.map((capture) => ({ id: capture.scenarioId, status: "passed" as const, capture }));
  const reportInventory: GroundGlassM7eReportInventory = {
    schemaVersion: 1,
    reportId: "ground-glass-m7e-r187-gather-b1",
    evaluatorRevision: GROUND_GLASS_M7E_EVALUATOR_REVISION,
    sourceCommitSha,
    runtime,
    declaredCounts: { passed: 12, failed: 0, blocked: 0, "not-run": 0 },
    scenarios,
    b1BoundaryProbe,
    m3RendererSelectionAuthority: "m3-raw-pilot",
    m5RendererAttemptAuthorized: false,
    m5GatherEvidenceStatus: "research-only",
    m5B1EvidenceStatus: "research-only",
    m6R187Authorized: false,
    productionWebGpuEnabled: false,
  };
  expect(validateGroundGlassM7eReportInventory(reportInventory)).toEqual([]);
  const sanitizedInventory = {
    ...reportInventory,
    b1BoundaryProbe: null,
    scenarios: reportInventory.scenarios.map(({ capture, ...scenario }) => ({
      ...scenario,
      capture: capture ? { ...capture, capture: { ...capture.capture, readbackBuffers: null } } : undefined,
    })),
  };
  const evidenceReport = {
    schemaVersion: 1,
    nativeRunId: M7E_NATIVE_RUN_ID,
    reportId: "ground-glass-m7e-r187-gather-b1",
    stage: "native-r187-registered-app-m5-requalification",
    evaluatorRevision: GROUND_GLASS_M7E_EVALUATOR_REVISION,
    sourceCommitSha,
    testInvocation,
    runtime,
    compatibilityEvidenceRevisions: {
      apertureGather: GROUND_GLASS_M7E_R187_GATHER_REVISION,
      farReconstructionB1: GROUND_GLASS_M7E_R187_B1_REVISION,
      q1ToQ7: GROUND_GLASS_M7E_R187_THRESHOLDS.revision,
      frozenHistoricalThresholdSource: GROUND_GLASS_M7E_R187_THRESHOLDS.sourceThresholdRevision,
    },
    qualification: qualityEvaluation,
    thresholds: GROUND_GLASS_M7E_R187_THRESHOLDS,
    b1BoundaryProbe: {
      status: boundaryEvaluation.status,
      observedCaseIds: boundaryEvaluation.observedCaseIds,
      issues: boundaryEvaluation.issues,
      readback: encodeGroundGlassM7eLosslessJson(b1BoundaryProbe, {
        captureSourceCommitSha: sourceCommitSha,
        valueRecovery: "captured-before-json",
      }),
    },
    inventory: sanitizedInventory,
    supportingArtifacts: captureEnvelopes.map((capture) => ({
      scenarioId: capture.scenarioId,
      files: capture.supportingArtifact,
      sha256: createHash("sha256").update(readFileSync(resolve(
        process.env.GROUND_GLASS_M7E_EVIDENCE_DIR
          ? resolve(process.cwd(), process.env.GROUND_GLASS_M7E_EVIDENCE_DIR, "captures")
          : testInfo.outputPath("captures"),
        `${capture.scenarioId.replace(/[^a-zA-Z0-9._-]/g, "_")}.bin.gz`,
      ))).digest("hex"),
      manifestSha256: createHash("sha256").update(readFileSync(resolve(
        process.env.GROUND_GLASS_M7E_EVIDENCE_DIR
          ? resolve(process.cwd(), process.env.GROUND_GLASS_M7E_EVIDENCE_DIR, "captures")
          : testInfo.outputPath("captures"),
        `${capture.scenarioId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`,
      ))).digest("hex"),
    })),
    lifecycleAndPolicy: {
      m4InputIdentityMatched: true,
      rawRttPreserved: true,
      m5LifecycleFailureScenarios: "reported by the separate native M7E lifecycle test",
      m5AndB1RemainResearchOnly: true,
      m6R187Authorized: false,
      productionWebGpuEnabled: false,
    },
    historicalM5qR186ReportPreserved: true,
  };
  await writeM5qArtifact(testInfo, "ground-glass-m7e-r187-gather-b1-report.json", evidenceReport);
  if (process.env.GROUND_GLASS_M7E_EVIDENCE_DIR) {
    const reportDirectory = resolve(process.cwd(), process.env.GROUND_GLASS_M7E_EVIDENCE_DIR);
    mkdirSync(reportDirectory, { recursive: true });
    writeFileSync(resolve(reportDirectory, "GROUND_GLASS_M7E_R187_GATHER_B1_REPORT.json"), JSON.stringify(evidenceReport, null, 2));
    writeFileSync(resolve(reportDirectory, "b1-boundary-probe.json"), stringifyGroundGlassM7eLosslessJson(b1BoundaryProbe, {
      captureSourceCommitSha: sourceCommitSha,
      valueRecovery: "captured-before-json",
    }));
  }
  expect(pageErrors).toEqual([]);
});

test("M7E r187 isolates optional M5 failures from the completed M3 Raw frame", async ({ page }, testInfo) => {
  test.skip(!M7E_REQUIRED,
    "Requires native-required r187 M3/M4/M5 qualification gates");
  test.setTimeout(900_000);
  expect(REVISION).toBe("187");
  const pageErrors = await prepareNativeM5F8Page(page);
  const pane = paneFor(page);
  const pilot = pilotFor(page);
  const failurePoints = [
    "aperture-target-initialization",
    "aperture-provenance-after-submit",
    "aperture-far-after-submit",
    "aperture-near-after-submit",
    "aperture-b1-after-submit",
    "aperture-decision-after-submit",
    "aperture-composite-after-submit",
    "aperture-readback",
  ] as const;
  const observed = [] as Array<Readonly<Record<string, unknown>>>;
  for (const failurePoint of failurePoints) {
    const token = `m7e-failure-${failurePoint}-${Date.now()}`;
    await page.evaluate(({ injectedFailurePoint, captureToken }) => {
      const control = window.__groundGlassWebGpuM3TestControl;
      if (!control?.requestApertureGatherCapture) throw new Error("M5 capture trigger unavailable");
      control.failurePoint = injectedFailurePoint;
      control.apertureGatherCaptureRequest = {
        token: captureToken,
        qualityMode: "half32",
        retainReadbackBuffers: true,
      };
      control.apertureGatherCaptureReadback = null;
      control.requestApertureGatherCapture();
    }, { injectedFailurePoint: failurePoint, captureToken: token });
    await expect(pilot).toHaveAttribute("data-aperture-gather-status", "failed", { timeout: 120_000 });
    await waitForCurrentFrame(page);
    const state = await page.evaluate((captureToken) => {
      const surface = document.querySelector<HTMLElement>('[data-testid="ground-glass-rtt"]');
      const gather = document.querySelector<HTMLElement>("[data-aperture-gather-status]");
      return {
        requestId: surface?.getAttribute("data-frame-request-id") ?? null,
        lastCompletedRequestId: surface?.getAttribute("data-last-completed-request-id") ?? null,
        frameResultStatus: surface?.getAttribute("data-frame-result-status") ?? null,
        rendererFamily: surface?.getAttribute("data-mounted-renderer-family") ?? null,
        executionApi: surface?.getAttribute("data-actual-execution-api") ?? null,
        applicationFallback: surface?.getAttribute("data-application-fallback") ?? null,
        rawContentful: surface?.getAttribute("data-rtt-raw-contentful") ?? null,
        rawVariance: Number(surface?.getAttribute("data-rtt-raw-variance")),
        rawNonBackgroundPixels: Number(surface?.getAttribute("data-rtt-raw-non-background")),
        gatherStatus: gather?.getAttribute("data-aperture-gather-status") ?? null,
        gatherFailureReason: gather?.getAttribute("data-aperture-gather-failure-reason") ?? null,
        publishedCaptureToken: window.__groundGlassWebGpuM3TestControl?.apertureGatherCaptureReadback?.token ?? null,
        publicationEventCount: window.__groundGlassWebGpuM3TestControl?.apertureGatherCapturePublications
          ?.filter((publication) => publication.token === captureToken).length ?? 0,
      };
    }, token);
    expect(state.requestId).toBe(state.lastCompletedRequestId);
    expect(state.frameResultStatus).toBe("completed");
    expect(state.rendererFamily).toBe("webgpu-renderer");
    expect(state.executionApi).toBe("webgpu");
    expect(state.applicationFallback).toBe("not-observed");
    expect(state.rawContentful).toBe("true");
    expect(state.rawVariance).toBeGreaterThan(0);
    expect(state.rawNonBackgroundPixels).toBeGreaterThan(0);
    expect(state.gatherStatus).toBe("failed");
    expect(state.gatherFailureReason).toContain(failurePoint);
    expect(state.publishedCaptureToken).not.toBe(token);
    expect(state.publicationEventCount).toBe(0);
    observed.push({ failurePoint, ...state });
  }
  const recoveredCapture = await captureGather(page, "half32", `m7e-recovered-${Date.now()}`, false);
  await expectCaptureMatchesCurrentFrame(page, recoveredCapture, false);
  await expect(pilot).toHaveAttribute("data-aperture-gather-status", "completed");
  const sourceCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const lifecycleEvidence = {
    schemaVersion: 1,
    nativeRunId: M7E_NATIVE_RUN_ID,
    status: "passed",
    rendererRevision: "r187",
    rendererFamily: "webgpu-renderer",
    actualExecutionApi: "webgpu",
    internalFallback: "none",
    scenarioId: "m7e-r187-m5-failure-isolation",
    sceneSourceRevision: recoveredCapture.sceneSourceRevision,
    sourceCommitSha,
    testInvocation: M7E_REQUIRED ? M7E_NATIVE_TEST_INVOCATION : "historical-r186-confirmatory invocation outside M7E provenance",
    runtime: { browserVersion: page.context().browser()?.version() ?? "unknown", operatingSystem: `${process.platform} ${process.arch}`, nodeVersion: process.version },
    acceptedRequest: { requestId: recoveredCapture.requestId, channelId: recoveredCapture.channelId, rendererGenerationId: recoveredCapture.rendererGenerationId },
    failurePointCount: observed.length,
    failures: observed,
    recoveryCaptureId: recoveredCapture.captureId,
    recoveryRequestId: recoveredCapture.requestId,
    rawRttAfterRecovery: await pane.getAttribute("data-rtt-raw-contentful"),
    applicationFallbackAfterRecovery: await pane.getAttribute("data-application-fallback"),
    adapterCleanupAuthority: "M7C-single-owner-adapter-lifecycle",
  };
  await testInfo.attach("ground-glass-m7e-r187-m5-failure-isolation.json", {
    body: JSON.stringify(lifecycleEvidence, null, 2),
    contentType: "application/json",
  });
  if (process.env.GROUND_GLASS_M7E_EVIDENCE_DIR) {
    const reportDirectory = resolve(process.cwd(), process.env.GROUND_GLASS_M7E_EVIDENCE_DIR);
    mkdirSync(reportDirectory, { recursive: true });
    writeFileSync(resolve(reportDirectory, "m5-failure-isolation.json"), JSON.stringify(lifecycleEvidence, null, 2));
  }
  expect(pageErrors).toEqual([]);
});

test("native M6D confirms the actual M5 composite completes Near coverage as opaque RGB", async ({ page }, testInfo) => {
  test.skip(!M5_REQUIRED,
    "Requires headed native WebGPU and the development-only M3/M4/M5 adapter gates");
  test.setTimeout(600_000);
  expect(REVISION).toBe("186");

  const pageErrors = await prepareNativeM5F8Page(page);
  const capture = await captureGather(
    page,
    "half16",
    `m6d-composite-contract-${Date.now()}`,
    false,
    undefined,
    { includeM6dCompositeContractProbe: true },
  );
  await expectCaptureMatchesCurrentFrame(page, capture);
  expect(capture.rendererFamily).toBe("webgpu-renderer");
  expect(capture.actualExecutionApi).toBe("webgpu");
  expect(capture.internalFallback).toBe("none");
  expect(capture.sceneId).toBe("architecture-rise");
  expect(capture.completedPasses).toContain("researchComposite");
  expect(capture.targetFormats.composite).toBe("rgba16float");
  const probe = capture.m6dCompositeContractProbe;
  expect(probe).toBeDefined();
  if (!probe) throw new Error("Native M6D composite probe did not return evidence");
  await testInfo.attach("ground-glass-m6d-native-composite-contract.json", {
    body: JSON.stringify({
      registeredM5Capture: {
        captureId: capture.captureId,
        requestId: capture.requestId,
        channelId: capture.channelId,
        sceneId: capture.sceneId,
        rendererGenerationId: capture.rendererGenerationId,
        rendererFamily: capture.rendererFamily,
        actualExecutionApi: capture.actualExecutionApi,
        internalFallback: capture.internalFallback,
        completedPasses: capture.completedPasses,
        compositeTargetFormat: capture.targetFormats.composite,
      },
      controlledCompositeProbe: probe,
    }, null, 2),
    contentType: "application/json",
  });
  expect(probe.contractRevision).toBe("m6d-opaque-presentation-v1");
  expect(probe.rendererRevision).toBe(`r${REVISION}`);
  expect(probe.rendererFamily).toBe("webgpu-renderer");
  expect(probe.actualExecutionApi).toBe("webgpu");
  expect(probe.internalFallback).toBe("none");
  expect(probe.applicationFallback).toBe(false);
  expect(probe.requestId).toBe(capture.requestId);
  expect(probe.channelId).toBe(capture.channelId);
  expect(probe.sceneId).toBe(capture.sceneId);
  expect(probe.rendererGenerationId).toBe(capture.rendererGenerationId);
  expect(probe.sourceTextureFormat).toBe("rgba16float");
  expect(probe.targetFormat).toBe("rgba16float");
  expect(probe.targetColorSpace).toBe("no-color-space");
  expect(probe.rendererStateRestored).toBe(true);
  expect(probe.cases.map(({ coverage }) => coverage)).toEqual([0, 0.25, 0.5, 0.75, 1]);

  const expectedRgb = [
    [0.75, 0.5, 0.25],
    [0.625, 0.5625, 0.3125],
    [0.5, 0.625, 0.375],
    [0.375, 0.6875, 0.4375],
    [0.25, 0.75, 0.5],
  ] as const;
  const maximumError = (left: readonly number[], right: readonly number[]): number =>
    Math.max(...left.map((value, index) => Math.abs(value - (right[index] ?? Number.NaN))));

  for (const [index, sample] of probe.cases.entries()) {
    expect(sample.id).toBe(`near-coverage-${sample.coverage}`);
    expect(sample.farRgba).toEqual([0.75, 0.5, 0.25, 1]);
    expect(sample.nearRgba).toEqual([0.25, 0.75, 0.5, sample.coverage]);
    const expected = [...expectedRgb[index]!, 1];
    expect(maximumError(sample.measuredCompositeRgba, expected), `${sample.id} GPU RGB/alpha matches the independent expected value`)
      .toBeLessThanOrEqual(0.001);
    expect(sample.measuredCompositeRgba[3], `${sample.id} composite target alpha is opaque`).toBe(1);

    const ignoredCoverage = [...sample.farRgba.slice(0, 3), 1];
    const rawNear = [...sample.nearRgba];
    if (sample.coverage > 0) {
      expect(maximumError(sample.measuredCompositeRgba, ignoredCoverage), `${sample.id} detects ignored Near coverage`)
        .toBeGreaterThan(0.01);
    }
    if (sample.coverage === 0) {
      expect(maximumError(sample.measuredCompositeRgba, rawNear), "coverage-zero control detects returning raw Near RGBA")
        .toBeGreaterThan(0.01);
    }
    if (sample.coverage === 0.5) {
      const doubleBlend = sample.measuredCompositeRgba.slice(0, 3)
        .map((value, channel) => value * (1 - sample.coverage) + sample.nearRgba[channel]! * sample.coverage);
      expect(maximumError(expected.slice(0, 3), doubleBlend), "mid-coverage control rejects applying Near coverage twice")
        .toBeGreaterThan(0.01);
    }
  }
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

test("native M5R diagnoses reference convergence, B1 fallback, and Near coverage without changing M5Q", async ({ page }, testInfo) => {
  test.skip(!M5_REQUIRED,
    "Requires headed native WebGPU, M3 Raw, M4 physical research, and the M5 gather research gate");
  test.setTimeout(1_800_000);
  expect(REVISION).toBe("186");
  const pageErrors = await prepareNativeM5F8Page(page);
  const q1 = M5Q_CANDIDATES.find(({ id }) => id === "ar-f3200-f5p6-loupe4-rise0")!;
  const q2 = M5Q_CANDIDATES.find(({ id }) => id === "ar-f3200-f5p6-full-rise0")!;
  const q4 = M5Q_CANDIDATES.find(({ id }) => id === "ar-f5200-f5p6-full-rise0")!;
  const captureCurrent = async (
    qualityMode: GroundGlassApertureGatherQualityMode,
    token: string,
    maximumRadiusPx?: number,
    options: Readonly<{ includeM5rDiagnostics?: boolean; includeM5rNearFixture?: boolean }> = {},
  ): Promise<GroundGlassApertureGatherCaptureReadback> => {
    const capture = await captureGather(page, qualityMode, token, true, maximumRadiusPx, options);
    await expectCaptureMatchesCurrentFrame(page, capture, false);
    return capture;
  };

  await setM5qCandidateState(page, q1);
  const q1Captures: Readonly<Record<string, GroundGlassApertureGatherCaptureReadback>> = {
    half16: await captureCurrent("half16", `m5r-q1-half16-${Date.now()}`),
    full32a: await captureCurrent("full32", `m5r-q1-full32-a-${Date.now()}`, undefined,
      { includeM5rDiagnostics: true }),
    full32b: await captureCurrent("full32", `m5r-q1-full32-b-${Date.now()}`),
    full32c: await captureCurrent("full32", `m5r-q1-full32-c-${Date.now()}`),
    full64a: await captureCurrent("full64", `m5r-q1-full64-a-${Date.now()}`, undefined,
      { includeM5rDiagnostics: true }),
    full64b: await captureCurrent("full64", `m5r-q1-full64-b-${Date.now()}`),
    full64c: await captureCurrent("full64", `m5r-q1-full64-c-${Date.now()}`),
  };
  const q1FingerprintValues = Object.values(q1Captures).map((capture) => JSON.stringify({
    requestId: capture.requestId,
    rendererGenerationId: capture.rendererGenerationId,
    sceneId: capture.sceneId,
    sceneSourceRevision: capture.sceneSourceRevision,
    effectiveOpticalRequestFingerprint: capture.effectiveOpticalRequestFingerprint,
    cameraStateFingerprint: capture.cameraStateFingerprint,
    sourceDimensions: [capture.sourceWidthPx, capture.sourceHeightPx],
    sampledFilmDimensionsMm: capture.sampledFilmDimensionsMm,
    inputFingerprints: capture.inputFingerprints,
  }));
  const q1InputFingerprintsMatch = new Set(q1FingerprintValues).size === 1;
  if (!q1InputFingerprintsMatch) {
    await testInfo.attach("m5r-input-provenance-failure.json", {
      body: JSON.stringify({
        captureIds: Object.values(q1Captures).map((capture) => capture.captureId),
        fingerprints: q1FingerprintValues,
      }, null, 2),
      contentType: "application/json",
    });
  }
  expect(q1InputFingerprintsMatch, "Q1 repetitions and profiles retain the exact source/input state").toBe(true);
  expect(q1Captures.full32a.m5rDiagnostics.status).toBe("captured");
  expect(q1Captures.full64a.m5rDiagnostics.status).toBe("captured");

  const q1Buffers32 = q1Captures.full32a.readbackBuffers!;
  const q1Buffers64 = q1Captures.full64a.readbackBuffers!;
  const full32Repeatability = [q1Captures.full32b, q1Captures.full32c].map((capture, index) => ({
    qualityMode: "Full32" as const,
    comparedCaptureIds: [q1Captures.full32a.captureId, capture.captureId] as const,
    comparison: index === 0 ? "A/B" as const : "A/C" as const,
    far: compareGroundGlassM5rNumericArrays(q1Buffers32.farGatherRgba, capture.readbackBuffers!.farGatherRgba),
    near: compareGroundGlassM5rNumericArrays(q1Buffers32.nearRgba, capture.readbackBuffers!.nearRgba),
  }));
  const full64Repeatability = [q1Captures.full64b, q1Captures.full64c].map((capture, index) => ({
    qualityMode: "Full64" as const,
    comparedCaptureIds: [q1Captures.full64a.captureId, capture.captureId] as const,
    comparison: index === 0 ? "A/B" as const : "A/C" as const,
    far: compareGroundGlassM5rNumericArrays(q1Buffers64.farGatherRgba, capture.readbackBuffers!.farGatherRgba),
    near: compareGroundGlassM5rNumericArrays(q1Buffers64.nearRgba, capture.readbackBuffers!.nearRgba),
  }));
  const sameProfileRepeatable = [...full32Repeatability, ...full64Repeatability]
    .every(({ far, near }) => far.exact && near.exact);
  if (!sameProfileRepeatable) {
    const repeatabilityFailures = [...full32Repeatability, ...full64Repeatability].flatMap((comparison) =>
      (["Far", "Near"] as const).flatMap((comparedBuffer) => {
        const difference = comparison[comparedBuffer === "Far" ? "far" : "near"];
        return difference.exact ? [] : [{
          qualityMode: comparison.qualityMode,
          comparedCaptureIds: comparison.comparedCaptureIds,
          comparedBuffer,
          changedValueCount: difference.changedValueCount,
          maximumAbsoluteError: difference.maximumAbsoluteError,
          maximumErrorIndex: difference.maximumErrorIndex,
          rmse: difference.rootMeanSquareError,
        }];
      }));
    await testInfo.attach("m5r-repeatability-failure.json", {
      body: JSON.stringify({
        requiredComparisons: "Full32 and Full64 A/B and A/C, Far RGBA and Near RGBA",
        repeatabilityFailures,
        full32: full32Repeatability,
        full64: full64Repeatability,
      }, null, 2),
      contentType: "application/json",
    });
  }
  expect(sameProfileRepeatable, "Full32/Full64 A/B/A/C Far and Near readbacks must be bit-exact")
    .toBe(true);
  const fullGatherPixelIndices = Array.from(
    { length: q1Captures.full32a.farGatherWidthPx * q1Captures.full32a.farGatherHeightPx },
    (_value, index) => index,
  );
  const nativeProfileDifference = {
    farRgba16: compareGroundGlassM5rNumericArrays(q1Buffers32.farGatherRgba, q1Buffers64.farGatherRgba),
    farRgb16: compareGroundGlassM5rNumericArrays(
      rgbFromSelectedRgba(q1Buffers32.farGatherRgba, fullGatherPixelIndices),
      rgbFromSelectedRgba(q1Buffers64.farGatherRgba, fullGatherPixelIndices),
    ),
    farRgba32F: compareGroundGlassM5rNumericArrays(
      q1Buffers32.farGatherRgba32!, q1Buffers64.farGatherRgba32!,
    ),
    farRgb32F: compareGroundGlassM5rNumericArrays(
      rgbFromSelectedRgba(q1Buffers32.farGatherRgba32!, fullGatherPixelIndices),
      rgbFromSelectedRgba(q1Buffers64.farGatherRgba32!, fullGatherPixelIndices),
    ),
    pixelCount: fullGatherPixelIndices.length,
    channelScope: "RGBA metrics include the equal constant alpha channel; RGB metrics exclude alpha.",
    nearRgba: compareGroundGlassM5rNumericArrays(q1Buffers32.nearRgba, q1Buffers64.nearRgba),
  };

  const roiPixelIndices = chooseM5rFarRoi(q1Captures.full32a, 0.01, 128);
  expect(roiPixelIndices.length, "Q1 has bounded valid far pixels with source-color blur signal").toBeGreaterThan(0);
  const cpuReferences = makeM5rCpuReferences(q1Captures.full32a, roiPixelIndices);
  const gpuFull32Roi = Float32Array.from(roiPixelIndices.flatMap((pixel) =>
    Array.from(q1Buffers32.farGatherRgba.subarray(pixel * 4, pixel * 4 + 4))));
  const gpuFull64Roi = Float32Array.from(roiPixelIndices.flatMap((pixel) =>
    Array.from(q1Buffers64.farGatherRgba.subarray(pixel * 4, pixel * 4 + 4))));
  const gpuFull32FloatRoi = Float32Array.from(roiPixelIndices.flatMap((pixel) =>
    Array.from(q1Buffers32.farGatherRgba32!.subarray(pixel * 4, pixel * 4 + 4))));
  const gpuFull64FloatRoi = Float32Array.from(roiPixelIndices.flatMap((pixel) =>
    Array.from(q1Buffers64.farGatherRgba32!.subarray(pixel * 4, pixel * 4 + 4))));
  const cpuRoiRgb = (rgba: Float32Array) => rgbFromSelectedRgba(rgba, Array.from(
    { length: roiPixelIndices.length }, (_value, index) => index,
  ));
  const gpuRoiRgb = (rgba: Float32Array) => rgbFromSelectedRgba(rgba, Array.from(
    { length: roiPixelIndices.length }, (_value, index) => index,
  ));
  const cpuMatchedErrors = {
    gpu32HalfVsCpu32: compareGroundGlassM5rNumericArrays(gpuRoiRgb(gpuFull32Roi), cpuRoiRgb(cpuReferences.native32.farRgba)),
    gpu32FloatVsCpu32: compareGroundGlassM5rNumericArrays(gpuRoiRgb(gpuFull32FloatRoi), cpuRoiRgb(cpuReferences.native32.farRgba)),
    gpu64HalfVsCpu64: compareGroundGlassM5rNumericArrays(gpuRoiRgb(gpuFull64Roi), cpuRoiRgb(cpuReferences.native64.farRgba)),
    gpu64FloatVsCpu64: compareGroundGlassM5rNumericArrays(gpuRoiRgb(gpuFull64FloatRoi), cpuRoiRgb(cpuReferences.native64.farRgba)),
  };
  const cpuReferenceConvergence = {
    cpu32VsCpu64: compareGroundGlassM5rGatherResults(cpuReferences.native32, cpuReferences.native64),
    cpu64VsCpu128: compareGroundGlassM5rGatherResults(cpuReferences.native64, cpuReferences.high128),
    cpu128VsCpu256: compareGroundGlassM5rGatherResults(cpuReferences.high128, cpuReferences.high256),
    nested32VsNested64: compareGroundGlassM5rGatherResults(cpuReferences.nested32, cpuReferences.nested64),
    nested32VsCpu256: compareGroundGlassM5rGatherResults(cpuReferences.nested32, cpuReferences.high256),
    nested64VsCpu256: compareGroundGlassM5rGatherResults(cpuReferences.nested64, cpuReferences.high256),
    gpu32HalfVsCpu128: compareGroundGlassM5rNumericArrays(
      gpuRoiRgb(gpuFull32Roi), cpuRoiRgb(cpuReferences.high128.farRgba),
    ),
    gpu32HalfVsCpu256: compareGroundGlassM5rNumericArrays(
      gpuRoiRgb(gpuFull32Roi), cpuRoiRgb(cpuReferences.high256.farRgba),
    ),
    gpu64HalfVsCpu128: compareGroundGlassM5rNumericArrays(
      gpuRoiRgb(gpuFull64Roi), cpuRoiRgb(cpuReferences.high128.farRgba),
    ),
    gpu64HalfVsCpu256: compareGroundGlassM5rNumericArrays(
      gpuRoiRgb(gpuFull64Roi), cpuRoiRgb(cpuReferences.high256.farRgba),
    ),
  };
  const m5rEvidenceDecision = evaluateGroundGlassM5rReferenceEvidence({
    inputFingerprintMatch: q1InputFingerprintsMatch,
    repeatedCaptures: [...full32Repeatability, ...full64Repeatability],
    gpu32VsCpu32RgbRmse: cpuMatchedErrors.gpu32FloatVsCpu32.rootMeanSquareError,
    gpu64VsCpu64RgbRmse: cpuMatchedErrors.gpu64FloatVsCpu64.rootMeanSquareError,
    declaredMatchedCountConformanceLimit: 0.001,
    cpu128VsCpu256RgbRmse: cpuReferenceConvergence.cpu128VsCpu256.farRgb.rootMeanSquareError,
    declaredReferenceConvergenceLimit: M5Q_FROZEN_THRESHOLDS.maximumReferenceRmse,
  });
  const m5rReferenceReportFields = createGroundGlassM5rReferenceReportFields(m5rEvidenceDecision);
  if (m5rEvidenceDecision.gpuCpuConformancePassed !== true) {
    await testInfo.attach("m5r-gpu-cpu-conformance-failure.json", {
      body: JSON.stringify({
        gpu32VsCpu32RgbRmse: cpuMatchedErrors.gpu32FloatVsCpu32.rootMeanSquareError,
        gpu64VsCpu64RgbRmse: cpuMatchedErrors.gpu64FloatVsCpu64.rootMeanSquareError,
        diagnosticLimit: 0.001,
        evidenceDecision: m5rEvidenceDecision,
      }, null, 2),
      contentType: "application/json",
    });
  }
  expect(m5rEvidenceDecision.gpuCpuConformancePassed,
    "Full32/CPU32 and Full64/CPU64 matched-count RMSE must meet the 0.001 diagnostic limit")
    .toBe(true);
  const sampleDistributions = Object.fromEntries(([16, 32, 64] as const).map((sampleCount) => [
    sampleCount,
    analyzeGroundGlassM5rSampleDistribution(createGroundGlassM5rGoldenAngleProposals(sampleCount)),
  ]));
  const nestedSampleDistributions = Object.fromEntries(([16, 32, 64] as const).map((sampleCount) => [
    sampleCount,
    analyzeGroundGlassM5rSampleDistribution(makeM5rNestedProposals(sampleCount)),
  ]));
  const proposals32 = createGroundGlassM5rGoldenAngleProposals(32);
  const proposals64 = createGroundGlassM5rGoldenAngleProposals(64);
  const proposalKey = (values: Float64Array, index: number) =>
    `${values[index * 2]},${values[index * 2 + 1]}`;
  const proposal64Set = new Set(Array.from({ length: 64 }, (_value, index) => proposalKey(proposals64, index)));
  const proposalOverlap32In64 = Array.from({ length: 32 }, (_value, index) => proposalKey(proposals32, index))
    .filter((key) => proposal64Set.has(key)).length;
  const nestedProposals32 = makeM5rNestedProposals(32);
  const nestedProposals64 = makeM5rNestedProposals(64);
  const nested64Set = new Set(Array.from(
    { length: 64 }, (_value, index) => proposalKey(nestedProposals64, index),
  ));
  const nestedProposalOverlap32In64 = Array.from({ length: 32 }, (_value, index) => proposalKey(nestedProposals32, index))
    .filter((key) => nested64Set.has(key)).length;
  const halfStorage = {
    gpu32FloatVsHalfStored: compareGroundGlassM5rNumericArrays(
      q1Buffers32.farGatherRgba32!, q1Buffers32.farGatherRgba,
    ),
    cpu32HalfBitAgreement: (() => {
      let matching = 0;
      let compared = 0;
      for (const pixel of roiPixelIndices) {
        for (let channel = 0; channel < 4; channel += 1) {
          const index = pixel * 4 + channel;
          matching += DataUtils.toHalfFloat(cpuReferences.native32.farRgba[roiPixelIndices.indexOf(pixel) * 4 + channel] ?? 0)
            === q1Buffers32.farGatherHalfBits![index] ? 1 : 0;
          compared += 1;
        }
      }
      return { matchedChannels: matching, comparedChannels: compared, matchingFraction: matching / compared };
    })(),
  };
  const q1Cap2Full32 = await captureCurrent("full32", `m5r-q1-cap2-full32-${Date.now()}`, 2);
  const q1Cap2Full64 = await captureCurrent("full64", `m5r-q1-cap2-full64-${Date.now()}`, 2);
  const cap2GatherPixels = Array.from(
    { length: q1Cap2Full32.farGatherWidthPx * q1Cap2Full32.farGatherHeightPx },
    (_value, index) => index,
  );
  const cap2Difference = compareGroundGlassM5rNumericArrays(
    q1Cap2Full32.readbackBuffers!.farGatherRgba,
    q1Cap2Full64.readbackBuffers!.farGatherRgba,
  );
  const cap2DifferenceRgb = compareGroundGlassM5rNumericArrays(
    rgbFromSelectedRgba(q1Cap2Full32.readbackBuffers!.farGatherRgba, cap2GatherPixels),
    rgbFromSelectedRgba(q1Cap2Full64.readbackBuffers!.farGatherRgba, cap2GatherPixels),
  );

  await setM5qCandidateState(page, q2);
  const q2Captures = {
    half32: await captureCurrent("half32", `m5r-q2-half32-${Date.now()}`),
    full32: await captureCurrent("full32", `m5r-q2-full32-${Date.now()}`),
    full64: await captureCurrent("full64", `m5r-q2-full64-${Date.now()}`),
  };
  const q2R3 = {
    half32: toR3Capture(q2Captures.half32),
    full32: toR3Capture(q2Captures.full32),
    full64: toR3Capture(q2Captures.full64),
  } satisfies GroundGlassApertureGatherR3CaptureMatrix;
  const fallbackAnalysis = analyzeGroundGlassM5rFallbacks(q2R3);
  const fallbackReasonBreakdown = Object.fromEntries(
    Object.entries(fallbackAnalysis.byReason).map(([reasonKey, metrics]) => [reasonKey, {
      reasonCode: metrics.reasonCode,
      reasonName: metrics.reasonName,
      fallbackPixelCount: metrics.fallbackPixelCount,
      percentOfFallback: fallbackAnalysis.fallbackSummary.pixelCount > 0
        ? metrics.fallbackPixelCount / fallbackAnalysis.fallbackSummary.pixelCount * 100
        : null,
      validFarFallbackPixelCount: metrics.validFarFallbackPixelCount,
      meaningfulBlurFallbackPixelCount: metrics.meaningfulBlurFallbackPixelCount,
      negligibleBlurFallbackPixelCount: metrics.negligibleBlurFallbackPixelCount,
      depthEdgeFallbackOverlapPixelCount: metrics.depthEdgeFallbackOverlapPixelCount,
      signedBoundaryFallbackOverlapPixelCount: metrics.signedBoundaryFallbackOverlapPixelCount,
    }]),
  );

  await setM5qCandidateState(page, q4);
  const q4Capture = await captureCurrent("full32", `m5r-q4-near-${Date.now()}`, undefined, {
    includeM5rDiagnostics: true,
    includeM5rNearFixture: true,
  });
  const q4Full64Capture = await captureCurrent("full64", `m5s-q4-full64-${Date.now()}`);
  expect(q4Capture.m5rDiagnostics.status).toBe("captured");
  expect(q4Capture.m5rDiagnostics.nearFinalAlphaMaximumError).toBeLessThanOrEqual(0.001);
  const nearAlphaAnalysis = analyzeGroundGlassM5rNearAlpha({
    gpu: {
      ...gpuM5rNearCapture(q4Capture),
      renderer: {
        rendererFamily: q4Capture.rendererFamily,
        actualExecutionApi: q4Capture.actualExecutionApi,
        internalFallback: q4Capture.internalFallback,
        rendererGenerationId: q4Capture.rendererGenerationId,
      },
    },
    cpu: cpuM5rNearCapture(q4Capture),
  });
  expect(nearAlphaAnalysis.binary16.available).toBe(true);
  expect(nearAlphaAnalysis.binary16.rawBitsRoundTripMismatchCount).toBe(0);
  expect(nearAlphaAnalysis.binary16.storedAlpha?.zeroCount)
    .toBe(nearAlphaAnalysis.gpu.outputAlpha.zeroCount);
  expect(nearAlphaAnalysis.binary16.storedAlpha?.oneCount)
    .toBe(nearAlphaAnalysis.gpu.outputAlpha.oneCount);
  expect(nearAlphaAnalysis.binary16.storedAlpha?.fractionalCount)
    .toBe(nearAlphaAnalysis.gpu.outputAlpha.fractionalCount);
  const q4Buffers = q4Capture.readbackBuffers!;
  const fixtureMetadata = q4Capture.m5rNearFixture;
  if (!fixtureMetadata || !q4Buffers.m5rFixtureNearRgba || !q4Buffers.m5rFixtureProposalCountsRgba
      || !q4Buffers.m5rFixtureCoverageRgba || !q4Buffers.m5rFixtureAcceptedFootprintRgba
      || !q4Buffers.m5rFixtureNearAlphaHalfBits) {
    throw new Error("M5R native controlled Near fixture omitted its required typed readbacks");
  }
  const fixturePixelCount = fixtureMetadata.widthPx * fixtureMetadata.heightPx;
  let fixtureFractionalAlphaCount = 0;
  let fixtureNonzeroAlphaCount = 0;
  let fixtureForegroundSpreadPixelCount = 0;
  let fixtureFractionalForegroundSpreadPixelCount = 0;
  let fixtureMaximumOutsideForegroundAlpha = 0;
  const fixtureCenterIndex = fixtureMetadata.centerPixel.y * fixtureMetadata.widthPx + fixtureMetadata.centerPixel.x;
  for (let pixel = 0; pixel < fixturePixelCount; pixel += 1) {
    const alpha = q4Buffers.m5rFixtureNearRgba[pixel * 4 + 3] ?? 0;
    const x = pixel % fixtureMetadata.widthPx;
    const y = Math.floor(pixel / fixtureMetadata.widthPx);
    const dx = x - fixtureMetadata.foregroundShape.centerPixel.x;
    const dy = y - fixtureMetadata.foregroundShape.centerPixel.y;
    const outsideSilhouette = dx * dx + dy * dy > fixtureMetadata.foregroundShape.radiusPx ** 2;
    if (alpha > 0) fixtureNonzeroAlphaCount += 1;
    if (alpha > 0 && alpha < 1) fixtureFractionalAlphaCount += 1;
    if (outsideSilhouette && alpha > 0
        && (q4Buffers.m5rFixtureNearRgba[pixel * 4] ?? 0)
          > (q4Buffers.m5rFixtureNearRgba[pixel * 4 + 2] ?? 0)) {
      fixtureForegroundSpreadPixelCount += 1;
      fixtureMaximumOutsideForegroundAlpha = Math.max(fixtureMaximumOutsideForegroundAlpha, alpha);
      if (alpha < 1) fixtureFractionalForegroundSpreadPixelCount += 1;
    }
  }
  const fixtureCenterOffset = fixtureCenterIndex * 4;
  const fixtureCenter = {
    centerNear: q4Buffers.m5rFixtureProposalCountsRgba[fixtureCenterOffset] ?? 0,
    evaluatedProposalCount: q4Buffers.m5rFixtureProposalCountsRgba[fixtureCenterOffset + 1] ?? 0,
    acceptedProposalCount: q4Buffers.m5rFixtureProposalCountsRgba[fixtureCenterOffset + 2] ?? 0,
    nonzeroMembershipCount: q4Buffers.m5rFixtureProposalCountsRgba[fixtureCenterOffset + 3] ?? 0,
    weightSum: q4Buffers.m5rFixtureCoverageRgba[fixtureCenterOffset] ?? 0,
    coverageMass: q4Buffers.m5rFixtureCoverageRgba[fixtureCenterOffset + 1] ?? 0,
    estimatedCoverage: q4Buffers.m5rFixtureCoverageRgba[fixtureCenterOffset + 2] ?? 0,
    diagnosticFinalAlpha: q4Buffers.m5rFixtureCoverageRgba[fixtureCenterOffset + 3] ?? 0,
    actualNearAlpha: q4Buffers.m5rFixtureNearRgba[fixtureCenterOffset + 3] ?? 0,
    acceptedAreaRatioMean: q4Buffers.m5rFixtureAcceptedFootprintRgba[fixtureCenterOffset] ?? 0,
    acceptedCompensationMaximum: q4Buffers.m5rFixtureAcceptedFootprintRgba[fixtureCenterOffset + 1] ?? 0,
    storedHalfBits: q4Buffers.m5rFixtureNearAlphaHalfBits[fixtureCenterIndex] ?? 0,
    decodedStoredAlpha: DataUtils.fromHalfFloat(q4Buffers.m5rFixtureNearAlphaHalfBits[fixtureCenterIndex] ?? 0),
  };
  expect(fixtureCenter.centerNear).toBe(0);
  expect(fixtureCenter.acceptedProposalCount).toBeGreaterThan(0);
  expect(fixtureCenter.estimatedCoverage).toBeGreaterThan(0);
  expect(fixtureCenter.estimatedCoverage).toBeLessThan(1);
  expect(fixtureCenter.actualNearAlpha).toBeGreaterThan(0);
  expect(fixtureCenter.actualNearAlpha).toBeLessThan(1);
  expect(fixtureMetadata.evidenceScope).toBe("native-research-fixture");
  expect(fixtureMetadata.foregroundShape.kind).toBe("disc");
  const centerDx = fixtureMetadata.centerPixel.x - fixtureMetadata.foregroundShape.centerPixel.x;
  const centerDy = fixtureMetadata.centerPixel.y - fixtureMetadata.foregroundShape.centerPixel.y;
  expect(centerDx * centerDx + centerDy * centerDy)
    .toBeGreaterThan(fixtureMetadata.foregroundShape.radiusPx ** 2);
  expect(fixtureForegroundSpreadPixelCount).toBeGreaterThan(0);
  expect(fixtureFractionalForegroundSpreadPixelCount).toBeGreaterThan(0);
  expect(Math.abs(fixtureCenter.decodedStoredAlpha - fixtureCenter.actualNearAlpha)).toBeLessThanOrEqual(0.0005);
  expect(fixtureMetadata.finalAlphaMatchesNearTargetMaximumError).toBeLessThanOrEqual(0.001);
  expect(fixtureFractionalAlphaCount).toBeGreaterThan(0);
  expect(fixtureNonzeroAlphaCount).toBeGreaterThan(fixtureFractionalAlphaCount);
  const applicationEvidenceScope = "registered-app-adapter" as const;
  expect(applicationEvidenceScope).not.toBe(fixtureMetadata.evidenceScope);
  expect(nearAlphaAnalysis.identity.captureId).toBe(q4Capture.captureId);

  const m5qStatusesPreserved = {
    thresholdRevision: M5Q_FROZEN_THRESHOLDS.revision,
    evaluator: "m5q-r3-review-fix-2",
    q1: "reference-not-converged",
    q2: "insufficient-support",
    q3: "bounded-qualified",
    q4: "insufficient-support",
    q5: "reference-not-converged",
    q6: "reference-not-converged",
    q7: "reference-not-converged",
  } as const;
  const m5sSamplingSeeds = [104729, 130363] as const;
  const m5sRequiredAnalyticStrategies = [
    createGroundGlassM5sProposalStrategy({ method: "golden-angle-count-dependent", sampleCount: 1024 }),
    createGroundGlassM5sProposalStrategy({ method: "halton-2-3-progressive", sampleCount: 1024 }),
    ...m5sSamplingSeeds.map((seed) => createGroundGlassM5sProposalStrategy({
      method: "seeded-stratified-square-to-disk" as const, sampleCount: 1024 as const, seed,
    })),
  ];
  const m5sAnalyticReports = m5sRequiredAnalyticStrategies.map((strategy) =>
    evaluateGroundGlassM5sProposalAnalyticControls(strategy));
  const m5sAnalyticAuthority = evaluateGroundGlassM5sAnalyticAuthority({
    requiredStrategies: m5sRequiredAnalyticStrategies.map(({ descriptor }) => descriptor),
    observedParticipants: m5sRequiredAnalyticStrategies.map((strategy, index) => ({
      descriptor: strategy.descriptor,
      coordinateFingerprint: m5sAnalyticReports[index]!.coordinateFingerprint,
    })),
    analyticResults: m5sAnalyticReports,
  });
  if (m5sAnalyticReports.some(({ analyticStatus }) => analyticStatus !== "passed")) {
    await testInfo.attach("m5s-analytic-controls-failure.json", {
      body: JSON.stringify({ analyticAuthority: m5sAnalyticAuthority, strategies: m5sAnalyticReports }, null, 2),
      contentType: "application/json",
    });
  }
  const m5sCapturePairs = [
    { opticalStateId: "ar-f3200-f5p6-loupe4-rise0", role: "primary-4x-control-cap60", full32: q1Captures.full32a, full64: q1Captures.full64a },
    { opticalStateId: "ar-f3200-f5p6-full-rise0", role: "full-frame-control-cap60", full32: q2Captures.full32, full64: q2Captures.full64 },
    { opticalStateId: "ar-f5200-f5p6-full-rise0", role: "focus-distance-control-cap60", full32: q4Capture, full64: q4Full64Capture },
    { opticalStateId: "ar-f3200-f5p6-loupe4-rise0", role: "stressed-cap2", full32: q1Cap2Full32, full64: q1Cap2Full64 },
  ] as const;
  const m5sTotalProposalEvaluations = { value: 0 };
  const m5sSamplingPatterns: unknown[] = [];
  const m5sSamplingProposals: unknown[] = [];
  const m5sOpticalStateReports: M5sNativeStateReport[] = [];
  const m5sRunProvenance: unknown[] = [];
  for (const capturePair of m5sCapturePairs) {
    const { full32, full64 } = capturePair;
    expect(full32.rendererFamily).toBe("webgpu-renderer");
    expect(full32.actualExecutionApi).toBe("webgpu");
    expect(full32.internalFallback).toBe("none");
    expect(full64.rendererFamily).toBe("webgpu-renderer");
    expect(full64.actualExecutionApi).toBe("webgpu");
    expect(full64.internalFallback).toBe("none");
    expect(full32.sceneId).toBe("architecture-rise");
    expect(full64.sceneId).toBe(full32.sceneId);
    expect(full64.sceneSourceRevision).toBe(full32.sceneSourceRevision);
    const profileProvenance = compareGroundGlassM5sInputFingerprints([
      { captureId: full32.captureId, fingerprints: full32.inputFingerprints },
      { captureId: full64.captureId, fingerprints: full64.inputFingerprints },
    ]);
    if (profileProvenance.status !== "matched") {
      await testInfo.attach(`m5s-provenance-failure-${capturePair.role}.json`, {
        body: JSON.stringify({ role: capturePair.role, profileProvenance }, null, 2),
        contentType: "application/json",
      });
      throw new Error(`M5S ${capturePair.role} Full32/Full64 source inputs do not match`);
    }
    const referenceInput = makeM5sInputFromCapture(full32);
    const roiStrata = selectGroundGlassM5sRoiStrata({
      referenceInput,
      maximumPixelsPerStratum: 10,
      minimumSupport: 10,
      depthEdgeRelativeThreshold: 0.03,
    });
    const full32Rgba = full32.readbackBuffers!.farGatherRgba;
    const full64Rgba = full64.readbackBuffers!.farGatherRgba;
    const stratumReports: M5sNativeStratumReport[] = [];
    const studyValues: GroundGlassM5sStratumStudy[] = [];
    for (const stratum of roiStrata) {
      const selectedIds = stratum.selectedGatherPixelIds;
      let runs: readonly GroundGlassM5sFarReferenceResult[] = [];
      if (selectedIds.length) {
        try {
          runs = runGroundGlassM5sReferenceMatrix({
            referenceInput,
            selectedGatherPixelIds: selectedIds,
            sampleCounts: GROUND_GLASS_M5S_SAMPLE_COUNTS,
            stratifiedSeeds: m5sSamplingSeeds,
          });
        } catch (error) {
          await testInfo.attach(`m5s-reference-failure-${capturePair.role}-${stratum.id}.json`, {
            body: JSON.stringify({ role: capturePair.role, stratum, error: String(error) }, null, 2),
            contentType: "application/json",
          });
          throw error;
        }
      }
      const evaluated = runs.reduce((sum, run) => sum + run.evaluatedProposalCount, 0);
      m5sTotalProposalEvaluations.value += evaluated;
      if (m5sTotalProposalEvaluations.value > GROUND_GLASS_M5S_MAX_TOTAL_PROPOSAL_EVALUATIONS) {
        await testInfo.attach("m5s-proposal-budget-failure.json", {
          body: JSON.stringify({ totalProposalEvaluations: m5sTotalProposalEvaluations.value,
            declaredBudget: GROUND_GLASS_M5S_MAX_TOTAL_PROPOSAL_EVALUATIONS,
            role: capturePair.role, stratumId: stratum.id, evaluatedThisStratum: evaluated }, null, 2),
          contentType: "application/json",
        });
        throw new Error("M5S total CPU evaluations exceeded the declared two-million experiment budget");
      }
      const runFingerprints = runs.length
        ? compareGroundGlassM5sInputFingerprints(runs.map((run, index) => ({
          captureId: `m5s-${capturePair.role}-${stratum.id}-run-${index}`,
          fingerprints: run.inputFingerprints,
        })))
        : null;
      if (runFingerprints) expect(runFingerprints.status).toBe("matched");
      if (m5sSamplingPatterns.length === 0 && runs.length) {
        const generatedPatterns = runs.map((run) => {
          const strategy = createGroundGlassM5sProposalStrategy({
            method: run.descriptor.method,
            sampleCount: run.descriptor.sampleCount,
            ...(run.descriptor.seed === null ? {} : { seed: run.descriptor.seed }),
          });
          const coordinateFingerprint = fingerprintGroundGlassM5sProposalCoordinates(strategy);
          expect(coordinateFingerprint).toBe(run.proposalCoordinateFingerprint);
          const analytic = m5sAnalyticReports.find((evidence) =>
            evidence.strategyId === groundGlassM5sProposalIdentityKey(run.descriptor));
          const proposals = Array.from({ length: run.descriptor.sampleCount }, (_value, index) =>
            strategy.proposalAt(index));
          return {
            descriptor: run.descriptor,
            proposalCount: run.descriptor.sampleCount,
            coordinateFingerprint,
            proposalAudit: run.proposalAudit,
            analyticStatus: run.descriptor.sampleCount === 1024
              ? analytic?.analyticStatus ?? "missing"
              : "not-evaluated-at-lower-tier",
            analyticStrategyId: analytic?.strategyId ?? null,
            proposals,
          };
        });
        m5sSamplingProposals.push(...generatedPatterns);
        m5sSamplingPatterns.push(...generatedPatterns.map((pattern) => ({
          descriptor: pattern.descriptor,
          proposalCount: pattern.proposalCount,
          coordinateFingerprint: pattern.coordinateFingerprint,
          proposalAudit: pattern.proposalAudit,
          analyticStatus: pattern.analyticStatus,
          analyticStrategyId: pattern.analyticStrategyId,
        })));
      }
      const runAt = (method: string, seed: number | null = null) => runs.find((run) =>
        run.descriptor.method === method && run.descriptor.sampleCount === 1024
        && run.descriptor.seed === seed);
      const halton = runAt("halton-2-3-progressive");
      const seedRuns = runs.filter((run) => run.descriptor.method === "seeded-stratified-square-to-disk"
        && run.descriptor.sampleCount === 1024);
      const haltonRgb = halton ? m5sRgbForRun(halton, selectedIds) : null;
      const seedRgb = seedRuns.map((run) => m5sRgbForRun(run, selectedIds));
      const seedMean = seedRgb.length > 0 && seedRgb.every((rgb) => rgb !== null)
        ? Float64Array.from(seedRgb[0]!, (_value, index) =>
          seedRgb.reduce((sum, rgb) => sum + rgb![index]!, 0) / seedRgb.length)
        : null;
      const blur = selectedIds.length && seedMean && haltonRgb
        ? evaluateGroundGlassM5sBlurPreservation({
          sourceRgb: m5sSourceRgbAtGatherIds(referenceInput, selectedIds),
          expectedBlurRgb: seedMean,
          candidateRgb: haltonRgb,
        })
        : null;
      const studies = analyzeGroundGlassM5sReferenceMatrix({
        strata: [stratum],
        runs,
        provenanceStatus: profileProvenance.status,
        requiredAnalyticStrategies: m5sRequiredAnalyticStrategies.map(({ descriptor }) => descriptor),
        analyticResults: m5sAnalyticReports,
        blurPreservationByStratum: {
          [stratum.id]: blur?.status ?? "unresolved",
        },
      });
      const study = studies[0]!;
      if (study.evidence.analyticAuthority.status !== "passed") {
        await testInfo.attach(`m5s-run-analytic-authority-${capturePair.role}-${stratum.id}.json`, {
          body: JSON.stringify({
            role: capturePair.role,
            stratumId: stratum.id,
            authority: study.evidence.analyticAuthority,
            analyticResults: m5sAnalyticReports,
          }, null, 2),
          contentType: "application/json",
        });
      }
      studyValues.push(study);
      const nativeFull32 = rgbFromSelectedRgba(full32Rgba, selectedIds);
      const nativeFull64 = rgbFromSelectedRgba(full64Rgba, selectedIds);
      const sourceRgb = m5sSourceRgbAtGatherIds(referenceInput, selectedIds);
      const highestReference = seedMean ?? haltonRgb;
      const localSourceGradients = stratum.selectedSourcePixelIds.map((id) =>
        m5sLocalGradientEnergy(referenceInput.sourceRgba, referenceInput.source.widthPx,
          referenceInput.source.heightPx, id));
      const localFull32Gradients = selectedIds.map((id) =>
        m5sLocalGradientEnergy(full32Rgba, full32.farGatherWidthPx, full32.farGatherHeightPx, id));
      const localFull64Gradients = selectedIds.map((id) =>
        m5sLocalGradientEnergy(full64Rgba, full64.farGatherWidthPx, full64.farGatherHeightPx, id));
      const mean = (values: readonly number[]) => values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      const referenceMetrics = highestReference
        ? {
          sourceToHighSampleRgb: compareGroundGlassM5sRgb(sourceRgb, highestReference),
          full32ToHighSampleRgb: compareGroundGlassM5sRgb(nativeFull32, highestReference),
          full64ToHighSampleRgb: compareGroundGlassM5sRgb(nativeFull64, highestReference),
        }
        : null;
      const blurAndSpread = {
        sourceRgb: Array.from(sourceRgb),
        full32NativeRgb: Array.from(nativeFull32),
        full64NativeRgb: Array.from(nativeFull64),
        halton1024CandidateRgb: haltonRgb ? Array.from(haltonRgb) : null,
        stratifiedSeedMean1024Rgb: seedMean ? Array.from(seedMean) : null,
        sourceToFull32: compareGroundGlassM5sRgb(sourceRgb, nativeFull32),
        sourceToFull64: compareGroundGlassM5sRgb(sourceRgb, nativeFull64),
        blurPreservation: blur,
        candidateComparison: referenceMetrics,
        localGradientEnergy: {
          measurement: "mean absolute RGB difference from each ROI center to neighbors in a 3x3 source/gather patch; not a line-spread function",
          source: mean(localSourceGradients),
          full32: mean(localFull32Gradients),
          full64: mean(localFull64Gradients),
          full32ToSourceRatio: mean(localSourceGradients)
            ? mean(localFull32Gradients)! / mean(localSourceGradients)! : null,
          full64ToSourceRatio: mean(localSourceGradients)
            ? mean(localFull64Gradients)! / mean(localSourceGradients)! : null,
        },
        edgeSpreadProxyByStrategy: m5sAnalyticReports.map((evidence) => ({
          strategyId: evidence.strategyId,
          result: evidence.analyticCases.compactSilhouette,
        })),
      };
      stratumReports.push({
        ...study,
        validSupport: { candidateCount: stratum.candidateCount, selectedCount: selectedIds.length,
          requiredCount: stratum.minimumSupport, status: stratum.status },
        sourcePixelIds: stratum.selectedSourcePixelIds,
        gatherPixelIds: stratum.selectedGatherPixelIds,
        sampleCounts: GROUND_GLASS_M5S_SAMPLE_COUNTS,
        samplingSeeds: m5sSamplingSeeds,
        evaluatedProposalCount: evaluated,
        inputFingerprints: referenceInput.inputFingerprints,
        blurAndSpread,
      });
      m5sRunProvenance.push(...runs.map((run) => ({
        state: capturePair.opticalStateId,
        role: capturePair.role,
        descriptor: run.descriptor,
        inputFingerprints: run.inputFingerprints,
        proposalAudit: run.proposalAudit,
        evaluatedProposalCount: run.evaluatedProposalCount,
        elapsedMs: run.elapsedMs,
        selectedGatherPixelIds: run.selectedGatherPixelIds,
        acceptedProposalCounts: run.pixels.map(({ acceptedProposalCount }) => acceptedProposalCount),
      })));
    }
    m5sOpticalStateReports.push({
      opticalStateId: capturePair.opticalStateId,
      captureRole: capturePair.role,
      captureIds: { full32: full32.captureId, full64: full64.captureId },
      runtime: {
        rendererRevision: `r${REVISION}`,
        rendererFamily: full32.rendererFamily,
        actualExecutionApi: full32.actualExecutionApi,
        internalFallback: full32.internalFallback,
        applicationFallback: false,
      },
      requestIds: { full32: full32.requestId, full64: full64.requestId },
      rendererGenerationIds: { full32: full32.rendererGenerationId, full64: full64.rendererGenerationId },
      sceneId: full32.sceneId,
      sceneSourceRevision: full32.sceneSourceRevision,
      effectiveOpticalRequestFingerprints: [full32.effectiveOpticalRequestFingerprint, full64.effectiveOpticalRequestFingerprint],
      cameraFingerprints: [full32.cameraStateFingerprint, full64.cameraStateFingerprint],
      sourceDimensions: [full32.sourceWidthPx, full32.sourceHeightPx],
      gatherDimensions: [full32.farGatherWidthPx, full32.farGatherHeightPx],
      sampledFilmDimensionsMm: full32.sampledFilmDimensionsMm,
      radiusCapPx: full32.maximumRadiusPx,
      sourceColorDomain: full32.colorDomain,
      inputFingerprints: full32.inputFingerprints,
      profileInputProvenance: profileProvenance,
      roiStrata: stratumReports,
      aggregate: aggregateGroundGlassM5sStrata(studyValues),
    });
  }
  const m5sNativeAnalyticAuthority = m5sOpticalStateReports
    .flatMap(({ roiStrata }) => roiStrata)
    .map(({ evidence }) => evidence.analyticAuthority)
    .find(({ observedStrategyIds }) => observedStrategyIds.length > 0);
  if (!m5sNativeAnalyticAuthority) {
    throw new Error("M5S native study produced no captured high-tier proposal identities to bind analytic evidence");
  }
  const m5sReport = {
    schemaVersion: 2,
    evaluatorRevision: "ground-glass-m5s-sparse-reference-v1",
    experimentRevision: "ground-glass-m5s-review-fix-1",
    originalReviewedHead: "d2b8f114a132852d51ba9e35bd84f5d412d799ef",
    generatedAtUtc: new Date().toISOString(),
    baseCommit: "8cd0d869229de04cf56845d98e93116aa2a92a60",
    implementationBranch: "feature/ground-glass-m5s-reference-convergence",
    nativeRuntime: { browserProject: testInfo.project.name, browserVersion: page.context().browser()?.version() ?? null,
      platform: process.platform, rendererRevision: `r${REVISION}`, rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgpu", internalFallback: "none", applicationFallback: false },
    referenceDefinition: {
      finiteEstimator: "eligible center RGB weight 1 plus every accepted finite disk proposal RGB weight 1, divided by center plus accepted-proposal weight",
      limitingIntegral: "conditional accepted-area RGB mean; the O(1) center sample is omitted, and an empty accepted set is undefined/null",
      physicalMapping: "captured physical ellipse axes/orientation mapped with source/film dimensions, then capture radius cap; top-origin UV and GPU-observed gather-center ID/UV; nearest source texel; current validity, signed CoC, and view-distance acceptance rules",
      colorDomain: "source-target-readback-values; no tone/display transform",
      nativeTslOrB1Changed: false,
    },
    samplingFamilies: {
      methods: ["golden-angle-count-dependent", "halton-2-3-progressive", "seeded-stratified-square-to-disk"],
      descriptions: {
        "golden-angle-count-dependent": "Existing sqrt((i + 0.5) / N), (i + 0.5) * golden-angle disk sequence; count-dependent, baseline only.",
        "halton-2-3-progressive": "Extensible Halton bases 2/3 mapped through sqrt(u) equal-area polar disk coordinates; exact prefixes across tiers.",
        "seeded-stratified-square-to-disk": "Independently seeded jitter inside equal-area square strata, mapped to a disk with the concentric square-to-disk map.",
      },
      sampleCounts: GROUND_GLASS_M5S_SAMPLE_COUNTS,
      randomizedSeeds: m5sSamplingSeeds,
      progressiveSequenceNestingVerifiedByUnitTest: true,
      coordinateFingerprintEncoding: "FNV-1a 64-bit over proposal-order x/y IEEE-754 binary64 little-endian bytes; deterministic integrity checksum, not cryptographic hash",
      analyticQualificationScope: "Each participating 1024-sample method/seed is qualified independently. Lower tiers retain structural proposal audits and tier convergence measurements; they do not inherit 1024 analytic qualification.",
      samplingPatterns: m5sSamplingPatterns,
    },
    analyticValidation: {
      requiredParticipantStrategyIds: m5sRequiredAnalyticStrategies.map(({ descriptor }) =>
        groundGlassM5sProposalIdentityKey(descriptor)),
      authority: m5sNativeAnalyticAuthority,
      unitDiskSecondMoment: {
        expected: 0.5,
        absoluteTolerance: 0.03,
        rationale: "At N=1024 the fixed tolerance allows finite deterministic/randomized variation while rejecting the measured center-biased 0.125 and uniform-radius 0.333 signatures.",
      },
      strategies: m5sAnalyticReports,
    },
    roiSelection: { maximumSelectedPixelsPerStratum: 10, minimumSupport: 10,
      candidateQualityOutputConsulted: false, strata: ["S1-smooth-valid-far-interior",
        "S2-strong-defocus-textured-interior", "S3-high-source-gradient-valid-far",
        "S4-depth-discontinuity-valid-far", "S5-signed-coc-boundary-neighborhood",
        "S6-cap-activated-valid-far"] },
    opticalStates: m5sOpticalStateReports,
    perSequenceEvidence: m5sRunProvenance,
    negativeControls: {
      native: { profileFingerprints: "matched", runtimeIdentity: "native-webgpu",
        methodAnalyticAuthority: m5sNativeAnalyticAuthority.status,
        proposalEvaluationBudget: "passed" },
      unitControlIds: ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10", "N11", "N12", "N13", "N14", "N15", "N16"],
      reviewFixControlIds: ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"],
      unitControlSuite: "src/tests/unit/groundGlassM5sReference.test.ts",
      unitControlExecutionIsReportedSeparatelyFromNativeEvidence: true,
    },
    historicalM5rComparison: {
      sourceReport: "GROUND_GLASS_M5R_REVIEW_FIX_1_REPORT.json",
      measurementsPreserved: true,
      full32VsFull64RgbRmseRgba16f: 0.007857539077244886,
      full32VsFull64RgbRmseRgba32f: 0.007859192980570341,
      gpuFull32VsCpu32RgbRmse: 6.519639132757963e-8,
      gpuFull64VsCpu64RgbRmse: 1.3437508839549746e-7,
      cpu32Vs64RgbRmse: 0.011646611340034392,
      cpu64Vs128RgbRmse: 0.005748315524033702,
      cpu128Vs256RgbRmse: 0.00415713039720048,
      currentGolden32To64ExactProposalOverlap: "0/32",
      nestedCpuOnly32To64ExactProposalOverlap: "32/32",
      cpu256IsGroundTruth: false,
      fallbackPixels: 57598,
      meaningfulBlurFallbackPixels: 6,
      registeredApplicationFractionalNearPixels: 0,
      controlledNativeFractionalNearAlphaPixels: 1896,
    },
    totalEvaluatedProposals: m5sTotalProposalEvaluations.value,
    proposalEvaluationBudget: GROUND_GLASS_M5S_MAX_TOTAL_PROPOSAL_EVALUATIONS,
    historicalPreviousQualificationCandidates: [
      { opticalStateId: "ar-f3200-f5p6-loupe4-rise0", stratumId: "S1-smooth-valid-far-interior",
        previousClassification: "converged-and-cross-validated", status: "historical-before-per-method-analytic-gate" },
      { opticalStateId: "ar-f5200-f5p6-full-rise0", stratumId: "S4-depth-discontinuity-valid-far",
        previousClassification: "converged-and-cross-validated", status: "historical-before-per-method-analytic-gate" },
    ],
    qualificationCandidates: m5sOpticalStateReports.flatMap((state) =>
      state.roiStrata.map((stratum) => ({ opticalStateId: state.opticalStateId,
        stratumId: stratum.stratum.id, classification: stratum.evidence.classification,
        referenceAuthority: stratum.evidence.referenceAuthority,
        analyticAuthority: stratum.evidence.analyticAuthority }))),
    m5qQualificationBoundary: {
      frozenThresholdRevision: M5Q_FROZEN_THRESHOLDS.revision,
      statuses: m5qStatusesPreserved,
      automaticallyPromoted: false,
      supplementaryM5sEvidenceDoesNotRewriteQ1OrQ6: true,
    },
    limitations: [
      "CPU finite and limiting estimates remain numerical approximations; only synthetic analytic controls have exact expected outcomes.",
      "A small sparse ROI can qualify only its exact optical state and selected pixels, not a scene-wide reference.",
      "The native run does not establish browser/device-wide behavior or photographic ground truth.",
      "GPU/CPU Full32 and Full64 comparisons are diagnostic and do not independently establish the limiting aperture integral.",
      "The existing CPU128/CPU256 divergence remains historical and CPU256 remains unqualified as ground truth.",
    ],
    recommendedNextPr: "If any critical stratum remains unresolved, investigate a separately implemented adaptive/quadrature reference and spatial edge-spread measurements without changing the M5 gather.",
  };
  const rootCauseMatrix = {
    referenceConvergence: [
      {
        problem: "Full32/Full64 divergence",
        hypothesis: "H-A1 finite aperture-sampling error",
        discriminatingExperiment: "Compare repeated native profiles with matched-count independent CPU references and CPU32/64/128/256 on the same 128-pixel valid-far blur ROI.",
        predictedObservation: "Same-count GPU/CPU agreement with stable same-profile captures, while finite sample counts disagree and higher tiers move toward one another.",
        actualObservation: {
          gpuCpuFloat32Rmse: cpuMatchedErrors.gpu32FloatVsCpu32.rootMeanSquareError,
          gpuCpuFloat64Rmse: cpuMatchedErrors.gpu64FloatVsCpu64.rootMeanSquareError,
          cpu32Vs64Rmse: cpuReferenceConvergence.cpu32VsCpu64.farRgb.rootMeanSquareError,
          cpu64Vs128Rmse: cpuReferenceConvergence.cpu64VsCpu128.farRgb.rootMeanSquareError,
          cpu128Vs256Rmse: cpuReferenceConvergence.cpu128VsCpu256.farRgb.rootMeanSquareError,
        },
        supportingEvidence: [
          ...m5rReferenceReportFields.rootCauseMatrix.hA1.supportingEvidence,
          ...(cpuReferenceConvergence.cpu32VsCpu64.farRgb.rootMeanSquareError
            > cpuReferenceConvergence.cpu64VsCpu128.farRgb.rootMeanSquareError
            && cpuReferenceConvergence.cpu64VsCpu128.farRgb.rootMeanSquareError
              > cpuReferenceConvergence.cpu128VsCpu256.farRgb.rootMeanSquareError
            ? ["Measured CPU tier differences decrease through 256 samples."] : []),
        ],
        contradictingEvidence: m5rReferenceReportFields.rootCauseMatrix.hA1.contradictingEvidence,
        confidence: m5rReferenceReportFields.rootCauseMatrix.hA1.confidence,
        classification: m5rReferenceReportFields.rootCauseMatrix.hA1.classification,
        proposedNextAction: "Keep references unqualified; design a separate progressive or higher-quality sampling/reference study against explicit blur-spread metrics.",
      },
      {
        problem: "Full32/Full64 proposal identity",
        hypothesis: "H-A2 sampleCount-dependent radial positions make the current sets non-nested",
        discriminatingExperiment: "Audit exact proposal overlap and evaluate a CPU-only nested 64-master subset against CPU256 on the same ROI.",
        predictedObservation: "The current 32-point set does not appear inside the 64-point set; nested sets share their 32 lower points, but agreement alone may not improve accuracy.",
        actualObservation: {
          original32PositionsSharedWith64: proposalOverlap32In64,
          nested32PositionsSharedWith64: nestedProposalOverlap32In64,
          originalCpu32Vs64Rmse: cpuReferenceConvergence.cpu32VsCpu64.farRgb.rootMeanSquareError,
          nestedCpu32Vs64Rmse: cpuReferenceConvergence.nested32VsNested64.farRgb.rootMeanSquareError,
          nested32VsCpu256Rmse: cpuReferenceConvergence.nested32VsCpu256.farRgb.rootMeanSquareError,
          nested64VsCpu256Rmse: cpuReferenceConvergence.nested64VsCpu256.farRgb.rootMeanSquareError,
        },
        supportingEvidence: ["The production-formula 32 and 64 sets share zero exact positions.", "The CPU-only nested 32/64 sets share all 32 positions."],
        contradictingEvidence: ["The nested 64 result does not improve over the baseline Full64-to-CPU256 RMSE on this ROI."],
        confidence: "high",
        classification: "non-nested-proposal-change-confirmed; nested alternative not promoted",
        proposedNextAction: "Retain current production proposals; require accuracy and spread evidence before adopting any progressive sequence.",
      },
      {
        problem: "Full32/Full64 divergence",
        hypothesis: "H-A3 scene discontinuities dominate error",
        discriminatingExperiment: "Stratify profile error by source-color gradients, depth edges, and occlusion boundaries.",
        predictedObservation: "Error concentration at high-gradient or depth-discontinuous pixels.",
        actualObservation: "M5R measured the state-wide difference and selected a blur-signal ROI, but did not stratify convergence by texture/depth-edge class.",
        supportingEvidence: [],
        contradictingEvidence: [],
        confidence: "low",
        classification: "insufficient-evidence",
        proposedNextAction: "Add bounded edge/texture-stratified sample variance evidence before attributing the residual to scene discontinuities.",
      },
      {
        problem: "Full32/Full64 divergence",
        hypothesis: "H-A4 RGBA16F storage precision dominates the disagreement",
        discriminatingExperiment: "Compare RGBA16F and RGBA32F render-target outputs and CPU binary16 conversion for matched inputs.",
        predictedObservation: "The Full32/Full64 difference materially shrinks in RGBA32F or is reproduced by binary16 conversion.",
        actualObservation: {
          rgba32fFull32VsFull64Rmse: nativeProfileDifference.farRgba32F.rootMeanSquareError,
          rgbOnly32fFull32VsFull64Rmse: nativeProfileDifference.farRgb32F.rootMeanSquareError,
          rgba16fFull32VsFull64Rmse: nativeProfileDifference.farRgba16.rootMeanSquareError,
          sameShaderFloat32VsHalfRmse: halfStorage.gpu32FloatVsHalfStored.rootMeanSquareError,
          cpu32HalfBitMatches: halfStorage.cpu32HalfBitAgreement.matchedChannels,
          cpu32ComparedHalfChannels: halfStorage.cpu32HalfBitAgreement.comparedChannels,
        },
        supportingEvidence: ["RGBA16F quantization is measurable at 1.17e-4 RMSE."],
        contradictingEvidence: ["Full32/Full64 divergence remains essentially unchanged in RGBA32F.", "All 512 selected CPU32 half channels match native stored half bits."],
        confidence: "high",
        classification: "storage-precision-secondary; not the dominant divergence cause",
        proposedNextAction: "Do not change precision on this evidence; keep any accumulation-precision question separate from storage quantization.",
      },
      {
        problem: "Full32/Full64 divergence",
        hypothesis: "H-A5 renderer, resource, or readback instability",
        discriminatingExperiment: "Capture three repeated Full32 and Full64 results with identical request inputs and renderer generation.",
        predictedObservation: "A same-profile capture changes despite stable source and optical fingerprints.",
        actualObservation: m5rReferenceReportFields.rootCauseMatrix.hA5.classification === "capture-instability-not-observed"
          ? "The evidence evaluator confirms all four repeated Full32/Full64 Far and Near comparisons are bit-exact."
          : m5rReferenceReportFields.rootCauseMatrix.hA5.classification,
        supportingEvidence: m5rReferenceReportFields.rootCauseMatrix.hA5.supportingEvidence,
        contradictingEvidence: m5rReferenceReportFields.rootCauseMatrix.hA5.contradictingEvidence,
        confidence: m5rReferenceReportFields.rootCauseMatrix.hA5.confidence,
        classification: m5rReferenceReportFields.rootCauseMatrix.hA5.classification,
        proposedNextAction: "No lifecycle change indicated; retain repeatability as a regression control.",
      },
      {
        problem: "Full32/Full64 divergence",
        hypothesis: "H-A6 physical footprint or coordinate inputs differ across profiles",
        discriminatingExperiment: "Match effective-state fingerprints and compare Full32/Full64 GPU output against CPU references consuming observed gather-center IDs/UVs and the captured inverse projection.",
        predictedObservation: "A mismatched input fingerprint or materially larger same-sample GPU/CPU residual.",
        actualObservation: m5rReferenceReportFields.rootCauseMatrix.hA6.classification === "geometry-provenance-mismatch-not-observed"
          ? {
            inputFingerprintsMatch: m5rEvidenceDecision.provenanceValid,
            gpu32Cpu32RgbRmse: cpuMatchedErrors.gpu32FloatVsCpu32.rootMeanSquareError,
            gpu64Cpu64RgbRmse: cpuMatchedErrors.gpu64FloatVsCpu64.rootMeanSquareError,
            sourceDimensions: [q1Captures.full32a.sourceWidthPx, q1Captures.full32a.sourceHeightPx],
            gatherDimensions: [q1Captures.full32a.farGatherWidthPx, q1Captures.full32a.farGatherHeightPx],
            sampledFilmDimensionsMm: q1Captures.full32a.sampledFilmDimensionsMm,
            maximumRadiusPx: q1Captures.full32a.maximumRadiusPx,
          }
          : m5rReferenceReportFields.rootCauseMatrix.hA6.classification,
        supportingEvidence: m5rReferenceReportFields.rootCauseMatrix.hA6.supportingEvidence,
        contradictingEvidence: m5rReferenceReportFields.rootCauseMatrix.hA6.contradictingEvidence,
        confidence: m5rReferenceReportFields.rootCauseMatrix.hA6.confidence,
        classification: m5rReferenceReportFields.rootCauseMatrix.hA6.classification,
        proposedNextAction: "Keep the matched-input assertions; broaden only if another state demonstrates an input mismatch.",
      },
      {
        problem: "Quality reference authority",
        hypothesis: "H-A7 a finite Full64 or CPU256 result can be treated as ground truth",
        discriminatingExperiment: "Measure consecutive CPU integration tiers instead of choosing one result as truth.",
        predictedObservation: "A converged sequence meets the unchanged threshold; otherwise reference authority remains unresolved.",
        actualObservation: "CPU128/CPU256 Far RGB RMSE is 0.004157 with 0.022863 maximum channel error over 128 ROI pixels.",
        supportingEvidence: ["Consecutive reference tiers remain visibly/numerically separated under the frozen numeric gate."],
        contradictingEvidence: ["The tier-to-tier RMSE decreases as sample count grows."],
        confidence: "high",
        classification: "reference-not-converged; CPU256 is a candidate, not optical ground truth",
        proposedNextAction: "Do not qualify Q1/Q6 from Full64 or CPU256; continue with a separately validated reference sequence.",
      },
    ],
    fallbackHalo: [
      {
        problem: "B1 fallback quality",
        hypothesis: "Fallback broadly substitutes sharp source color where meaningful defocus is expected",
        discriminatingExperiment: "Classify actual GPU fallback reason bytes and count valid-far meaningful-blur pixels per reason.",
        predictedObservation: "Many fallback pixels overlap valid far centers with meaningful Full32 blur.",
        actualObservation: {
          fallbackPixels: fallbackAnalysis.fallbackSummary.pixelCount,
          meaningfulBlurFallbackPixels: fallbackAnalysis.fallbackSummary.meaningfulBlurPixelCount,
          meaningfulBlurFallbackFraction: fallbackAnalysis.fallbackSummary.meaningfulBlurFraction,
          reasonBreakdown: fallbackReasonBreakdown,
        },
        supportingEvidence: ["Fallback classification is derived from the GPU-authored reason surface."],
        contradictingEvidence: ["Only six of 57,598 fallback pixels meet the 0.01 diagnostic blur floor; 57,158 have invalid or unresolved centers."],
        confidence: "high",
        classification: "insufficient-valid-far-fallback-support; fallback population is mostly invalid/unresolved data",
        proposedNextAction: "Do not infer broad halo quality from the aggregate fallback count; select or construct a valid-far meaningful-blur fallback state.",
      },
      {
        problem: "B1 fallback boundary gradient ratio",
        hypothesis: "The historical relative error is inflated by a small reference-gradient denominator",
        discriminatingExperiment: "Report absolute and relative gradient distributions and count pairs receiving the 0.01 denominator floor.",
        predictedObservation: "The floor is applied broadly while absolute error remains separately inspectable.",
        actualObservation: {
          boundaryPairs: fallbackAnalysis.fallbackBoundaryGradient.pairCount,
          absoluteMean: fallbackAnalysis.fallbackBoundaryGradient.absoluteError.mean,
          absoluteP50: fallbackAnalysis.fallbackBoundaryGradient.absoluteError.p50,
          absoluteP90: fallbackAnalysis.fallbackBoundaryGradient.absoluteError.p90,
          relativeMean: fallbackAnalysis.fallbackBoundaryGradient.relativeError.mean,
          relativeP50: fallbackAnalysis.fallbackBoundaryGradient.relativeError.p50,
          relativeP90: fallbackAnalysis.fallbackBoundaryGradient.relativeError.p90,
          denominatorFloorAppliedFraction: fallbackAnalysis.fallbackBoundaryGradient.denominatorFloor.appliedPairFraction,
        },
        supportingEvidence: ["The denominator floor is applied to about 75.8% of pairs and inflates the ratio."],
        contradictingEvidence: ["Absolute p90 remains 0.6259 and the maximum is 0.7762, so the result is not only a small-denominator artifact."],
        confidence: "high",
        classification: "relative-metric-floor-inflation-confirmed; substantial absolute mismatch also remains",
        proposedNextAction: "Preserve the historical metric and keep interpreting it alongside absolute error and reference uncertainty.",
      },
      {
        problem: "B1 halo spatial extent",
        hypothesis: "B1/reference mismatch is confined to the exact fallback boundary",
        discriminatingExperiment: "Measure Full32/B1 pixel error by Manhattan distance from GPU fallback-status boundaries, using a 0.01 diagnostic threshold through 8 px.",
        predictedObservation: "Above-threshold errors stop at distance zero if the mismatch is boundary-local.",
        actualObservation: fallbackAnalysis.boundaryDifferenceSupport.full32,
        supportingEvidence: ["The 0.01 diagnostic threshold measures error support beyond distance zero."],
        contradictingEvidence: ["Supported pixels reach the 8 px analysis limit, so the complete spatial extent is not bounded."],
        confidence: "medium",
        classification: "spatial mismatch measured; exact halo width unresolved and Full32 reference is unconverged",
        proposedNextAction: "Use a converged reference and a larger bounded ROI before calling the measured band a visible halo.",
      },
      {
        problem: "Far-layer foreground contamination",
        hypothesis: "B1 farther-side output is shifted toward adjacent near-source color",
        discriminatingExperiment: "At valid depth-edge and signed-CoC boundary pairs, compare farther-side B1 and Full32/Full64 color distance to the Half32 near-side source pixel.",
        predictedObservation: "A positive reference-minus-B1 distance indicates the B1 output is closer to near-side source color.",
        actualObservation: fallbackAnalysis.foregroundLeakageDirection,
        supportingEvidence: ["At depth edges B1 is closer to the near-side source in about 64.7% of 3,307 pairs; mean reference-minus-B1 distance is about 0.128."],
        contradictingEvidence: ["At the 65 signed-boundary pairs the mean difference is near zero and slightly negative; Full32/Full64 are themselves unconverged."],
        confidence: "medium",
        classification: "depth-edge directional contamination signal; not causal proof of foreground leakage",
        proposedNextAction: "If a follow-up is justified, isolate this behavior with a converged reference and controlled foreground-color mutation.",
      },
    ],
    nearCoverage: [
      {
        problem: "No fractional Near alpha in registered app capture",
        hypothesis: "C1 center-Near override sets the center population to one while off-center proposals are rejected geometrically.",
        discriminatingExperiment: "Capture the actual Near TSL intermediate channels on Q4 and compare them with the independent CPU reference and binary16 target bits.",
        predictedObservation: "Center-Near pixels are one due to override; off-center pixels have no accepted proposal; GPU/CPU and stored alpha agree.",
        actualObservation: {
          centerNearPixels: nearAlphaAnalysis.gpu.populations.centerNear.all.outputCount,
          centerNearAcceptedProposals: nearAlphaAnalysis.gpu.populations.centerNear.all.acceptedProposalTotal,
          offCenterPixels: nearAlphaAnalysis.gpu.populations.offCenter.all.outputCount,
          offCenterAcceptedProposals: nearAlphaAnalysis.gpu.populations.offCenter.all.acceptedProposalTotal,
          offCenterNonzeroMembershipProposals: nearAlphaAnalysis.gpu.populations.offCenter.all.nonzeroMembershipProposalTotal,
          fractionalAlphaPixels: nearAlphaAnalysis.gpu.outputAlpha.fractionalCount,
          gpuCpuAlphaRmse: nearAlphaAnalysis.nearOutputErrors.alpha.rootMeanSquareError,
          rawHalfBitRoundTripMismatches: nearAlphaAnalysis.binary16.rawBitsRoundTripMismatchCount,
        },
        supportingEvidence: ["GPU and CPU intermediate decisions and final alpha match exactly; binary16 stored alpha matches the readback exactly."],
        contradictingEvidence: ["The app capture has no accepted off-center proposal population, so it does not exercise proposal-derived alpha."],
        confidence: "high",
        classification: "registered-application-support-limited; no alpha quantization or GPU/CPU defect observed",
        proposedNextAction: "Do not change alpha semantics from this capture; add a registered state only if it yields accepted off-center footprint support.",
      },
      {
        problem: "Whether the actual Near kernel can represent fractional coverage",
        hypothesis: "The Near coverage formula is mathematically or storage-wise binary",
        discriminatingExperiment: "Render the actual Near TSL node against a sharp, depth- and signed-CoC-separated native research silhouette, and read RGBA16F alpha bits plus RGBA32F intermediates.",
        predictedObservation: "Accepted off-center contributions produce fractional estimated/final alpha and survive binary16 storage.",
        actualObservation: {
          evidenceScope: fixtureMetadata.evidenceScope,
          acceptedProposalsAtSelectedBackgroundCenter: fixtureCenter.acceptedProposalCount,
          nonzeroMembershipAtSelectedBackgroundCenter: fixtureCenter.nonzeroMembershipCount,
          estimatedAlpha: fixtureCenter.estimatedCoverage,
          actualRgba16fAlpha: fixtureCenter.actualNearAlpha,
          fractionalPixels: fixtureFractionalAlphaCount,
          fractionalForegroundSpreadOutsideSilhouettePixels: fixtureFractionalForegroundSpreadPixelCount,
          foregroundSpreadOutsideSilhouettePixels: fixtureForegroundSpreadPixelCount,
          finalAlphaDiagnosticMaximumError: fixtureMetadata.finalAlphaMatchesNearTargetMaximumError,
        },
        supportingEvidence: [`The selected non-Near center accepts five proposals and stores alpha 0.110535; ${fixtureFractionalForegroundSpreadPixelCount} pixels outside the silhouette have fractional alpha and foreground color.`],
        contradictingEvidence: ["Fixture evidence is synthetic native research and does not establish application scene support."],
        confidence: "high",
        classification: "actual-M5-TSL-supports-fractional-near-coverage; controlled evidence only",
        proposedNextAction: "Seek a registered scene/state with valid off-center accepted Near proposals; keep application qualification blocked until then.",
      },
    ],
  } as const;
  const report = {
    schemaVersion: 1,
    investigation: "M5R — Native Reference Convergence and Reconstruction Quality Investigation",
    evidenceProvenance: {
      scope: "registered-app-adapter",
      sceneId: q1Captures.full32a.sceneId,
      sceneSourceRevision: q1Captures.full32a.sceneSourceRevision,
      rendererRevision: `r${REVISION}`,
      rendererFamily: q1Captures.full32a.rendererFamily,
      actualExecutionApi: q1Captures.full32a.actualExecutionApi,
      internalFallback: q1Captures.full32a.internalFallback,
      applicationFallback: false,
      requestId: q1Captures.full32a.requestId,
      rendererGenerationId: q1Captures.full32a.rendererGenerationId,
      inputFingerprints: q1Captures.full32a.inputFingerprints,
      effectiveOpticalRequestFingerprint: q1Captures.full32a.effectiveOpticalRequestFingerprint,
      cameraStateFingerprint: q1Captures.full32a.cameraStateFingerprint,
      sourceDimensions: [q1Captures.full32a.sourceWidthPx, q1Captures.full32a.sourceHeightPx],
      film: q1Captures.full32a.sampledFilmDimensionsMm,
      maximumRadiusPx: q1Captures.full32a.maximumRadiusPx,
      gather: [q1Captures.full32a.farGatherWidthPx, q1Captures.full32a.farGatherHeightPx],
      colorDomain: q1Captures.full32a.colorDomain,
    },
    referenceRepeatability: {
      q1State: q1.id,
      full32: full32Repeatability,
      full64: full64Repeatability,
      ...m5rReferenceReportFields.referenceRepeatability,
      full32CaptureIds: [q1Captures.full32a.captureId, q1Captures.full32b.captureId, q1Captures.full32c.captureId],
      full64CaptureIds: [q1Captures.full64a.captureId, q1Captures.full64b.captureId, q1Captures.full64c.captureId],
    },
    sampleDistribution: {
      proposalFormula: "sqrt((index + 0.5) / sampleCount), angle=(index + 0.5)*goldenAngle",
      profiles: sampleDistributions,
      exact32ProposalOverlapWith64: proposalOverlap32In64,
      compared32Proposals: 32,
      nestedGoldenAngle64Master: {
        proposalRule: "select 32 every second point and 64 every point from one 64-point master sequence",
        profiles: nestedSampleDistributions,
        exact32ProposalOverlapWith64: nestedProposalOverlap32In64,
        compared32Proposals: 32,
        cpuOnlyCandidateComparison: true,
        promoted: false,
      },
      sample16CaptureId: q1Captures.half16.captureId,
      nativeSampleCountsCapturedOrAudited: [16, 32, 64],
    },
    referenceConvergence: {
      q1FarRoiPixelCount: roiPixelIndices.length,
      selectedGatherPixelIndices: roiPixelIndices,
      sampleMatchedGpuCpuErrors: cpuMatchedErrors,
      numericalIntegrationSequence: cpuReferenceConvergence,
      alternativeSamplingExperiment: {
        name: "nested-golden-angle-64-master",
        status: "cpu-only-test-variant",
        nativeShaderChanged: false,
        profileAgreementAloneIsNotEvidenceOfAccuracy: true,
        compareAgainstIndependentCpu256: true,
      },
      full32VsFull64Native: nativeProfileDifference,
      cap2: {
        maximumRadiusPx: 2,
        full32CaptureId: q1Cap2Full32.captureId,
        full64CaptureId: q1Cap2Full64.captureId,
        full32VsFull64FarRgba: cap2Difference,
        full32VsFull64FarRgb: cap2DifferenceRgb,
        full32CpuMatch: q1Cap2Full32.farGatherCpuReference,
        full64CpuMatch: q1Cap2Full64.farGatherCpuReference,
      },
      precision: halfStorage,
      evidenceDecision: m5rEvidenceDecision,
      ...m5rReferenceReportFields.referenceConvergence,
      highSampleReferenceAuthority: "independent numerical candidate; not photographic ground truth",
    },
    fallbackHalo: fallbackAnalysis,
    fallbackReasonBreakdown,
    nearCoverage: {
      q4CaptureId: q4Capture.captureId,
      q4Diagnostics: q4Capture.m5rDiagnostics,
      applicationAnalysis: nearAlphaAnalysis,
      applicationEvidenceScope,
      controlledFixture: {
        ...fixtureMetadata,
        scope: "native-research-fixture",
        nearAlphaDistribution: {
          pixelCount: fixturePixelCount,
          nonzeroAlphaPixelCount: fixtureNonzeroAlphaCount,
          fractionalAlphaPixelCount: fixtureFractionalAlphaCount,
          fractionalForegroundSpreadOutsideSilhouettePixelCount: fixtureFractionalForegroundSpreadPixelCount,
          foregroundSpreadOutsideSilhouettePixelCount: fixtureForegroundSpreadPixelCount,
          maximumOutsideForegroundAlpha: fixtureMaximumOutsideForegroundAlpha,
        },
        center: fixtureCenter,
      },
      classification: nearAlphaAnalysis.gpu.outputAlpha.fractionalCount === 0
        && fixtureFractionalAlphaCount > 0
        && fixtureForegroundSpreadPixelCount > 0
        ? "registered-application-support-limited; controlled native silhouette demonstrates M5 TSL fractional coverage and foreground spread"
        : "measured-per-pixel-population-requires-review",
    },
    negativeControls: {
      pureUnitSuites: [
        "repeatability and identity mismatch controls N1-N2",
        "GPU/CPU mismatch and high-sample non-convergence controls N3-N6",
        "B1 fallback, blur, foreground contamination, reason-mask, and denominator-floor controls B1-B7/N7-N10",
        "Near alpha/RGB mutation, center override, binary16, and rejected geometry controls C1-C8/N11-N15",
      ],
      nativeAssertions: m5rReferenceReportFields.negativeControls.nativeAssertions,
      separateM5qConfirmatoryRegression: "The separately run native M5Q confirmation retained its frozen per-dimension outcomes and bounded Q3 result; this is regression evidence, not an M5R N16-N18 unit-control mapping.",
      r3ThresholdsChanged: false,
    },
    rootCauseMatrix,
    m5qStatus: m5qStatusesPreserved,
    nextStage: {
      m5RemainsResearchOnly: true,
      m6ArchitectureOnlyMayProceed: true,
      qualityDependentM6PresentationBlocked: true,
      productionWebGpuAuthorization: false,
    },
    pageErrors,
  };
  expect(pageErrors).toEqual([]);

  await testInfo.attach("m5r-reference-repeatability.json", {
    body: JSON.stringify(report.referenceRepeatability, null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5r-sample-distribution.json", {
    body: JSON.stringify(report.sampleDistribution, null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5r-gpu-cpu-reference.json", {
    body: JSON.stringify({ sampleMatchedErrors: cpuMatchedErrors, nativeProfileDifference }, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("m5r-high-sample-cpu-reference.json", {
    body: JSON.stringify(cpuReferenceConvergence, null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5r-reference-convergence.json", {
    body: JSON.stringify(report.referenceConvergence, null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5r-b1-fallback-taxonomy.json", {
    body: JSON.stringify({
      totalFallbackPixels: fallbackAnalysis.fallbackSummary.pixelCount,
      reasonCounts: fallbackAnalysis.reasonCounts,
      reasonBreakdown: fallbackReasonBreakdown,
      byReason: fallbackAnalysis.byReason,
    }, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("m5r-fallback-halo-metrics.json", {
    body: JSON.stringify({
      fallbackSummary: fallbackAnalysis.fallbackSummary,
      blurPreservation: fallbackAnalysis.blurPreservation,
      fallbackBoundaryGradient: fallbackAnalysis.fallbackBoundaryGradient,
      boundaryDifferenceSupport: fallbackAnalysis.boundaryDifferenceSupport,
      foregroundLeakageDirection: fallbackAnalysis.foregroundLeakageDirection,
    }, null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5r-near-alpha-intermediates.json", {
    body: JSON.stringify(nearAlphaAnalysis, null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5r-near-alpha-population.json", {
    body: JSON.stringify(report.nearCoverage, null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5r-root-cause-matrix.json", {
    body: JSON.stringify(rootCauseMatrix, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("m5r-conclusion.json", {
    body: JSON.stringify({
      referenceRepeatability: report.referenceRepeatability,
      referenceConvergence: report.referenceConvergence,
      rootCauseMatrix: {
        hA1: rootCauseMatrix.referenceConvergence[0],
        hA5: rootCauseMatrix.referenceConvergence[4],
        hA6: rootCauseMatrix.referenceConvergence[5],
      },
      nativeAssertions: report.negativeControls.nativeAssertions,
      m5qStatus: report.m5qStatus,
      nextStage: report.nextStage,
    }, null, 2),
    contentType: "application/json",
  });
  await writeM5qArtifact(testInfo, "m5r-investigation-report.json", report);
  await testInfo.attach("m5s-analytic-controls.json", {
    body: JSON.stringify({ authority: m5sNativeAnalyticAuthority, strategies: m5sAnalyticReports }, null, 2),
    contentType: "application/json",
  });
  await testInfo.attach("m5s-sampling-proposals.json", {
    body: JSON.stringify(m5sSamplingProposals, null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5s-sampling-audits.json", {
    body: JSON.stringify(m5sSamplingPatterns, null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5s-roi-catalog.json", {
    body: JSON.stringify(m5sOpticalStateReports.map((state) => ({
      opticalStateId: state.opticalStateId, captureRole: state.captureRole,
      roiStrata: state.roiStrata.map((stratum) => ({
        ...stratum.stratum, validSupport: stratum.validSupport,
        gatherPixelIds: stratum.gatherPixelIds, sourcePixelIds: stratum.sourcePixelIds,
      })),
    })), null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5s-convergence-curves.json", {
    body: JSON.stringify(m5sOpticalStateReports.map((state) => ({
      opticalStateId: state.opticalStateId,
      roiStrata: state.roiStrata.map((stratum) => ({
        id: stratum.stratum.id, convergenceCurves: stratum.convergenceCurves,
        finalTierWithinMethod: stratum.finalTierWithinMethod,
      })),
    })), null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5s-cross-method-agreement.json", {
    body: JSON.stringify(m5sOpticalStateReports.map((state) => ({
      opticalStateId: state.opticalStateId,
      roiStrata: state.roiStrata.map((stratum) => ({
        id: stratum.stratum.id, agreement: stratum.highTierCrossMethodAgreement,
        seedVariation: stratum.randomizedSeedVariation,
        maximumSeedRmse: stratum.maximumSeedRmse,
        maximumSeedChannelError: stratum.maximumSeedChannelError,
      })),
    })), null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5s-blur-spread.json", {
    body: JSON.stringify(m5sOpticalStateReports.map((state) => ({
      opticalStateId: state.opticalStateId,
      roiStrata: state.roiStrata.map((stratum) => ({ id: stratum.stratum.id, ...stratum.blurAndSpread })),
    })), null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5s-depth-edge-strata.json", {
    body: JSON.stringify(m5sOpticalStateReports.map((state) => ({
      opticalStateId: state.opticalStateId,
      strata: state.roiStrata.filter((stratum) => stratum.stratum.id.startsWith("S4")
        || stratum.stratum.id.startsWith("S5")),
    })), null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5s-failed-controls.json", {
    body: JSON.stringify({ analyticAuthority: m5sNativeAnalyticAuthority, analyticResults: m5sAnalyticReports,
      nativeGates: { exactProfileInputFingerprints: "passed", nativeExecutionIdentity: "passed",
        totalProposalBudget: "passed" } }, null, 2), contentType: "application/json",
  });
  await testInfo.attach("m5s-conclusion.json", {
    body: JSON.stringify({ experimentRevision: m5sReport.experimentRevision,
      opticalStates: m5sReport.opticalStates, qualificationCandidates: m5sReport.qualificationCandidates,
      analyticValidation: m5sReport.analyticValidation,
      totalEvaluatedProposals: m5sReport.totalEvaluatedProposals,
      remainingLimitations: m5sReport.limitations,
      m5qQualificationBoundary: m5sReport.m5qQualificationBoundary }, null, 2), contentType: "application/json",
  });
  await writeM5qArtifact(testInfo, "m5s-reference-convergence.json", m5sReport);
});

test("native M5T validates adaptive Far quadrature and spatial blur without changing M5 or M5Q", async ({ page }, testInfo) => {
  test.skip(!M5_REQUIRED,
    "Requires headed native WebGPU, M3 Raw, M4 physical research, and the M5 gather research gate");
  test.setTimeout(1_800_000);
  expect(REVISION).toBe("186");
  const pageErrors = await prepareNativeM5F8Page(page);
  const q1 = M5Q_CANDIDATES.find(({ id }) => id === "ar-f3200-f5p6-loupe4-rise0")!;
  const q2 = M5Q_CANDIDATES.find(({ id }) => id === "ar-f3200-f5p6-full-rise0")!;
  const q4 = M5Q_CANDIDATES.find(({ id }) => id === "ar-f5200-f5p6-full-rise0")!;
  const roleSpecs = [
    { opticalStateId: q1.id, role: "primary-4x-control-cap60", candidate: q1,
      cap: undefined, anchor: "S1-smooth-valid-far-interior", priority: "S3-high-source-gradient-valid-far" },
    { opticalStateId: q2.id, role: "full-frame-control-cap60", candidate: q2,
      cap: undefined, anchor: null, priority: "S5-signed-coc-boundary-neighborhood" },
    { opticalStateId: q4.id, role: "focus-distance-control-cap60", candidate: q4,
      cap: undefined, anchor: "S4-depth-discontinuity-valid-far", priority: null },
    { opticalStateId: q1.id, role: "stressed-cap2", candidate: q1,
      cap: 2, anchor: null, priority: "S6-cap-activated-valid-far" },
  ] as const;
  const anchorIds = {
    primaryS1: [6384, 17781, 33899, 47388, 63961, 78006, 99883, 118094, 136935, 168492],
    focusS4: [63186, 120251, 133286, 133668, 134044, 134427, 139867, 140295, 140723, 141145],
  } as const;
  const strataByRole: Record<string, readonly ReturnType<typeof selectGroundGlassM5sRoiStrata>[number][]> = {};
  const opticalStates: unknown[] = [];
  const roiStudies: unknown[] = [];
  const spatialRecords: unknown[] = [];
  const m5sCrossMethodRecords: unknown[] = [];
  const priorityStrataRun = new Set<string>();
  let selectedPixelSlots = 0;
  let adaptiveEvaluations = 0;
  let fixedGridEvaluations = 0;
  let m5sProposalEvaluations = 0;
  let syntheticUniformControl: Readonly<Record<string, unknown>> | null = null;
  const syntheticSpatialValues = [0, 0, 0.05, 0.15, 0.35, 0.65, 0.85, 0.95, 1, 1, 1];
  const syntheticSpatialProfile = (captureId: string, values: readonly number[]) => createGroundGlassM5tSpatialProfile({
    roiId: "controlled-spatial-edge",
    captureId,
    evidenceScope: "controlled-synthetic-fixture",
    colorDomain: "source-target-readback-values",
    valueConvention: "source-target-readback-channel-r",
    samples: values.map((value, index) => ({ xPx: index, yPx: 0, value })),
  });
  const syntheticSpatialReference = syntheticSpatialProfile("m5t-synthetic-blurred-edge", syntheticSpatialValues);
  const syntheticSharpSource = syntheticSpatialProfile("m5t-synthetic-sharp-source", [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  const syntheticSpatialEsf = analyzeGroundGlassM5tEdgeSpread(syntheticSpatialReference);
  const syntheticSpatialLsf = analyzeGroundGlassM5tLineSpread(syntheticSpatialReference, syntheticSpatialEsf);
  const syntheticSpatialAgreement = compareGroundGlassM5tSpatialProfiles({
    reference: syntheticSpatialReference,
    candidate: syntheticSharpSource,
    sharpSource: syntheticSharpSource,
  });
  const syntheticSpatialControl = {
    evidenceScope: "controlled-synthetic-fixture",
    referenceProfile: syntheticSpatialReference,
    sharpSourceProfile: syntheticSharpSource,
    esf: syntheticSpatialEsf,
    lsf: syntheticSpatialLsf,
    sharpSourceSubstitution: syntheticSpatialAgreement,
    passed: syntheticSpatialEsf.status === "measured"
      && syntheticSpatialLsf.status === "measured"
      && syntheticSpatialAgreement.classification === "sharp-source-substitution",
  };
  expect(syntheticSpatialControl.passed, JSON.stringify(syntheticSpatialControl)).toBe(true);

  const runNumericalStudy = (
    role: string,
    opticalStateId: string,
    capture: GroundGlassApertureGatherCaptureReadback,
    full64: GroundGlassApertureGatherCaptureReadback,
    referenceInput: GroundGlassM5tFarReferenceInput,
    stratumId: string,
    selectedGatherPixelIds: readonly number[],
    isAnchor: boolean,
  ) => {
    if (selectedGatherPixelIds.length !== 10) {
      throw new Error(`M5T ${role}/${stratumId} requires the exact bounded ten-pixel ROI`);
    }
    selectedPixelSlots += selectedGatherPixelIds.length;
    const levels = GROUND_GLASS_M5T_QUADRATURE_RESOLUTIONS.map((initialResolution) =>
      runGroundGlassM5tAdaptiveQuadrature({
        referenceInput,
        selectedGatherPixelIds,
        initialResolution,
      }));
    const fixedGrid = runGroundGlassM5tFixedGridReference({ referenceInput, selectedGatherPixelIds });
    adaptiveEvaluations += levels.reduce((sum, run) => sum + run.evaluatedPoints, 0);
    fixedGridEvaluations += fixedGrid.evaluatedPoints;
    const refinementComparisons = levels.slice(0, -1).flatMap((run, index) =>
      compareGroundGlassM5tPixelEstimates(run.pixels, levels[index + 1]!.pixels));
    const fixedGridComparisons = compareGroundGlassM5tPixelEstimates(
      levels.at(-1)!.pixels, fixedGrid.pixels,
    );
    const latest = levels.at(-1)!;
    const budgetExceededPixelCount = levels.reduce((sum, run) => sum
      + run.pixels.filter(({ classification }) => classification === "evaluation-budget-exceeded").length, 0)
      + fixedGrid.pixels.filter(({ classification }) => classification === "evaluation-budget-exceeded").length;
    const evidence = evaluateGroundGlassM5tReferenceEvidence({
      inputFingerprintSets: [
        referenceInput.inputFingerprints,
        makeM5tInputFromCapture(full64).inputFingerprints,
        ...levels.map(({ inputFingerprints }) => inputFingerprints),
        fixedGrid.inputFingerprints,
      ],
      refinementComparisons,
      fixedGridComparisons,
      comparedPixelCount: selectedGatherPixelIds.length,
      requiredPixelCount: 10,
      budgetExceededPixelCount,
      latestUnresolvedAreaFractions: latest.pixels.map(({ unresolvedAreaFraction }) => unresolvedAreaFraction),
      analyticControlsPassed: syntheticUniformControl?.passed === true && syntheticSpatialControl.passed,
    });
    const m5sRuns = runGroundGlassM5sReferenceMatrix({
      referenceInput: makeM5sInputFromCapture(capture),
      selectedGatherPixelIds,
      sampleCounts: [1024],
      stratifiedSeeds: [104729, 130363],
    });
    m5sProposalEvaluations += m5sRuns.reduce((sum, run) => sum + run.evaluatedProposalCount, 0);
    const finalRgbAvailable = latest.pixels.every(({ classification, conditionalMeanRgb }) =>
      classification === "estimated" && conditionalMeanRgb !== null);
    const finalRgb = finalRgbAvailable
      ? Float64Array.from(latest.pixels.flatMap(({ conditionalMeanRgb }) => [...conditionalMeanRgb!]))
      : null;
    const crossMethod = m5sRuns.map((run) => {
      const m5sRgb = m5sRgbForRun(run, selectedGatherPixelIds);
      return {
        method: run.descriptor,
        evaluatedProposalCount: run.evaluatedProposalCount,
        comparison: finalRgb && m5sRgb ? compareGroundGlassM5sRgb(finalRgb, m5sRgb) : null,
        comparisonStatus: finalRgbAvailable ? "measured" : "m5t-reference-unresolved",
      };
    });
    const gatherCenters = selectedGatherPixelIds.map((gatherPixelId) => ({
      gatherPixelId,
      sourceId: [
        capture.readbackBuffers!.observedGatherCenterSourceIds[gatherPixelId * 2]!,
        capture.readbackBuffers!.observedGatherCenterSourceIds[gatherPixelId * 2 + 1]!,
      ],
      sourceUvTopOrigin: [
        capture.readbackBuffers!.observedGatherCenterSourceUvs[gatherPixelId * 2]!,
        capture.readbackBuffers!.observedGatherCenterSourceUvs[gatherPixelId * 2 + 1]!,
      ],
    }));
    const study = {
      role,
      opticalStateId,
      stratumId,
      anchor: isAnchor,
      selectedGatherPixelIds,
      selectedSourcePixelIds: selectedGatherPixelIds.map((id) => {
        const buffers = capture.readbackBuffers!;
        return buffers.observedGatherCenterSourceIds[id * 2 + 1]! * capture.sourceWidthPx
          + buffers.observedGatherCenterSourceIds[id * 2]!;
      }),
      gatherCenters,
      inputFingerprints: referenceInput.inputFingerprints,
      refinement: levels.map((run) => ({
        initialResolution: run.initialResolution,
        maximumDepth: run.maximumDepth,
        evaluationBudgetPerPixel: run.evaluationBudgetPerPixel,
        evaluatedPoints: run.evaluatedPoints,
        elapsedMs: run.elapsedMs,
        pixels: run.pixels.map((pixel) => ({
          gatherPixelId: pixel.gatherPixelId,
          centerSourceId: pixel.centerSourceId,
          acceptedAreaEstimate: pixel.acceptedAreaEstimate,
          acceptedColorAreaIntegralRgb: pixel.acceptedColorAreaIntegralRgb,
          conditionalMeanRgb: pixel.conditionalMeanRgb,
          estimatedAreaError: pixel.estimatedAreaError,
          estimatedColorErrorRgb: pixel.estimatedColorErrorRgb,
          unresolvedArea: pixel.unresolvedArea,
          unresolvedAreaFraction: pixel.unresolvedAreaFraction,
          unresolvedCellCount: pixel.unresolvedCellCount,
          evaluatedPoints: pixel.evaluatedPoints,
          refinementDepth: pixel.refinementDepth,
          cellClassCounts: pixel.cellClassCounts,
          classification: pixel.classification,
        })),
      })),
      fixedGrid: {
        algorithm: fixedGrid.algorithm,
        resolution: fixedGrid.resolution,
        evaluationBudgetPerPixel: fixedGrid.evaluationBudgetPerPixel,
        evaluatedPoints: fixedGrid.evaluatedPoints,
        elapsedMs: fixedGrid.elapsedMs,
        pixels: fixedGrid.pixels.map((pixel) => ({
          gatherPixelId: pixel.gatherPixelId,
          acceptedAreaEstimate: pixel.acceptedAreaEstimate,
          conditionalMeanRgb: pixel.conditionalMeanRgb,
          estimatedAreaError: pixel.estimatedAreaError,
          unresolvedArea: pixel.unresolvedArea,
          unresolvedAreaFraction: pixel.unresolvedAreaFraction,
          evaluatedPoints: pixel.evaluatedPoints,
          classification: pixel.classification,
        })),
      },
      refinementComparisons,
      fixedGridComparisons,
      evidence,
      budgetExceededPixelCount,
      crossMethod,
    };
    roiStudies.push(study);
    m5sCrossMethodRecords.push({ role, stratumId, selectedGatherPixelIds, crossMethod });
    return { levels, fixedGrid, evidence };
  };

  for (const roleSpec of roleSpecs) {
    await setM5qCandidateState(page, roleSpec.candidate);
    const full32 = await captureGather(page, "full32", `m5t-${roleSpec.role}-full32-${Date.now()}`, true, roleSpec.cap);
    await expectCaptureMatchesCurrentFrame(page, full32, false);
    const full64 = await captureGather(page, "full64", `m5t-${roleSpec.role}-full64-${Date.now()}`, true, roleSpec.cap);
    await expectCaptureMatchesCurrentFrame(page, full64, false);
    for (const capture of [full32, full64]) {
      expect(capture.rendererFamily).toBe("webgpu-renderer");
      expect(capture.actualExecutionApi).toBe("webgpu");
      expect(capture.internalFallback).toBe("none");
      expect(capture.sceneId).toBe("architecture-rise");
      expect(capture.sceneSourceRevision.trim()).not.toBe("");
      expect(capture.readbackOrigin).toBe("top");
    }
    expect(full32.sourceWidthPx).toBe(full64.sourceWidthPx);
    expect(full32.sourceHeightPx).toBe(full64.sourceHeightPx);
    expect(full32.farGatherWidthPx).toBe(full64.farGatherWidthPx);
    expect(full32.farGatherHeightPx).toBe(full64.farGatherHeightPx);
    expect(full32.sceneSourceRevision).toBe(full64.sceneSourceRevision);
    expect(full32.cameraStateFingerprint).toBe(full64.cameraStateFingerprint);
    expect(full32.effectiveOpticalRequestFingerprint).toBe(full64.effectiveOpticalRequestFingerprint);
    const profileProvenance = compareGroundGlassM5sInputFingerprints([
      { captureId: full32.captureId, fingerprints: full32.inputFingerprints },
      { captureId: full64.captureId, fingerprints: full64.inputFingerprints },
    ]);
    if (profileProvenance.status !== "matched") {
      await testInfo.attach(`m5t-provenance-failure-${roleSpec.role}.json`, {
        body: JSON.stringify({ role: roleSpec.role, profileProvenance, full32, full64 }, null, 2),
        contentType: "application/json",
      });
      throw new Error(`M5T ${roleSpec.role} Full32/Full64 inputs do not match`);
    }
    const m5sInput = makeM5sInputFromCapture(full32);
    const m5tInput = makeM5tInputFromCapture(full32);
    const strata = selectGroundGlassM5sRoiStrata({
      referenceInput: m5sInput,
      maximumPixelsPerStratum: 10,
      minimumSupport: 10,
      depthEdgeRelativeThreshold: 0.03,
    });
    strataByRole[roleSpec.role] = strata;
    const stratumById = new Map(strata.map((stratum) => [stratum.id, stratum]));
    const opticalStateReport = {
      role: roleSpec.role,
      opticalStateId: roleSpec.opticalStateId,
      captureIds: { full32: full32.captureId, full64: full64.captureId },
      requestIds: { full32: full32.requestId, full64: full64.requestId },
      rendererGenerationIds: { full32: full32.rendererGenerationId, full64: full64.rendererGenerationId },
      sceneId: full32.sceneId,
      sceneSourceRevision: full32.sceneSourceRevision,
      runtime: { rendererRevision: `r${REVISION}`, rendererFamily: full32.rendererFamily,
        actualExecutionApi: full32.actualExecutionApi, internalFallback: full32.internalFallback,
        applicationFallback: false },
      effectiveOpticalRequestFingerprints: [full32.effectiveOpticalRequestFingerprint,
        full64.effectiveOpticalRequestFingerprint],
      cameraFingerprints: [full32.cameraStateFingerprint, full64.cameraStateFingerprint],
      sourceDimensions: [full32.sourceWidthPx, full32.sourceHeightPx],
      gatherDimensions: [full32.farGatherWidthPx, full32.farGatherHeightPx],
      sampledFilmDimensionsMm: full32.sampledFilmDimensionsMm,
      radiusCapPx: full32.maximumRadiusPx,
      sourceColorDomain: full32.colorDomain,
      profileInputProvenance: profileProvenance,
      inputFingerprints: full32.inputFingerprints,
      strata: strata.map(({ id, selectionRule, candidateCount, selectedGatherPixelIds,
        selectedSourcePixelIds, minimumSupport, status, physicalRadiusPx, effectiveRadiusPx,
        signedCocMm, selectedDepthEdgeCount, selectedCapActivatedCount, sourceGradient,
        depthEdgeRelativeThreshold, gradientThresholds }) => ({
        id, selectionRule, candidateCount, selectedGatherPixelIds, selectedSourcePixelIds,
        minimumSupport, status, physicalRadiusPx, effectiveRadiusPx, signedCocMm,
        selectedDepthEdgeCount, selectedCapActivatedCount, sourceGradient,
        depthEdgeRelativeThreshold, gradientThresholds,
      })),
    };
    opticalStates.push(opticalStateReport);

    if (roleSpec.role === "primary-4x-control-cap60") {
      const syntheticSource = new Float32Array(m5tInput.sourceRgba.length);
      for (let offset = 0; offset < syntheticSource.length; offset += 4) {
        syntheticSource.set([0.2, 0.4, 0.6, 1], offset);
      }
      const syntheticInput: GroundGlassM5tFarReferenceInput = {
        ...m5tInput,
        sourceRgba: syntheticSource,
        inputFingerprints: { ...m5tInput.inputFingerprints, sourceColor: "m5t-synthetic-uniform-0.2-0.4-0.6" },
      };
      const analyticRun = runGroundGlassM5tAdaptiveQuadrature({
        referenceInput: syntheticInput,
        selectedGatherPixelIds: [stratumById.get("S1-smooth-valid-far-interior")!.selectedGatherPixelIds[0]!],
        initialResolution: 32,
        maximumDepth: 6,
      });
      const analyticPixel = analyticRun.pixels[0]!;
      const observed = analyticPixel.conditionalMeanRgb;
      const passed = analyticPixel.classification === "estimated" && observed !== null
        && Math.abs(observed[0] - 0.2) <= 1e-6
        && Math.abs(observed[1] - 0.4) <= 1e-6
        && Math.abs(observed[2] - 0.6) <= 1e-6;
      syntheticUniformControl = {
        fixture: "synthetic-uniform-valid-Far-over-native-physical-map",
        expectedRgb: [0.2, 0.4, 0.6],
        observedRgb: observed,
        acceptedAreaEstimate: analyticPixel.acceptedAreaEstimate,
        classification: analyticPixel.classification,
        evaluatedPoints: analyticPixel.evaluatedPoints,
        passed,
      };
      expect(passed, JSON.stringify(syntheticUniformControl)).toBe(true);
    }

    if (roleSpec.anchor) {
      const anchor = stratumById.get(roleSpec.anchor)!;
      expect(anchor.status).toBe("measured");
      if (roleSpec.role === "primary-4x-control-cap60") expect(anchor.selectedGatherPixelIds).toEqual(anchorIds.primaryS1);
      if (roleSpec.role === "focus-distance-control-cap60") expect(anchor.selectedGatherPixelIds).toEqual(anchorIds.focusS4);
      runNumericalStudy(roleSpec.role, roleSpec.opticalStateId, full32, full64, m5tInput,
        roleSpec.anchor, anchor.selectedGatherPixelIds, true);
    }

    const selectedPriority = [
      ...(roleSpec.priority ? [roleSpec.priority] : []),
      ...(!priorityStrataRun.has("S2-strong-defocus-textured-interior")
        ? ["S2-strong-defocus-textured-interior" as const] : []),
    ];
    for (const stratumId of selectedPriority) {
      if (stratumId === "S2-strong-defocus-textured-interior" && priorityStrataRun.has(stratumId)) continue;
      const stratum = stratumById.get(stratumId);
      if (!stratum || stratum.status !== "measured") continue;
      priorityStrataRun.add(stratumId);
      runNumericalStudy(roleSpec.role, roleSpec.opticalStateId, full32, full64, m5tInput,
        stratumId, stratum.selectedGatherPixelIds, false);
    }

    if (roleSpec.role === "primary-4x-control-cap60" || roleSpec.role === "focus-distance-control-cap60") {
      const lineSelection = selectM5tSpatialLine(m5sInput);
      if (!lineSelection) {
        spatialRecords.push({ role: roleSpec.role, status: "spatial-profile-insufficient-support",
          reason: "No contiguous nine-pixel line met source contrast, depth-edge, physical, validity, and mapping gates." });
      } else {
        const selectionEvidence = validateGroundGlassM5tRoiSelection({
          roiId: lineSelection.roiId,
          selectedPixelIds: lineSelection.sourcePixelIds,
          evidenceInputs: ["source", "depth", "physical", "validity"],
          candidateQualityOutputConsulted: false,
          evidenceScope: "registered-app-adapter",
        });
        expect(selectionEvidence.status).toBe("valid");
        selectedPixelSlots += lineSelection.gatherPixelIds.length;
        const lineReference = runGroundGlassM5tAdaptiveQuadrature({
          referenceInput: m5tInput,
          selectedGatherPixelIds: lineSelection.gatherPixelIds,
          initialResolution: 256,
        });
        adaptiveEvaluations += lineReference.evaluatedPoints;
        const buffers = full32.readbackBuffers!;
        const buffers64 = full64.readbackBuffers!;
        const profileInput = (captureId: string, evidenceScope: "registered-app-adapter",
          values: readonly number[]) => createGroundGlassM5tSpatialProfile({
          roiId: lineSelection.roiId,
          captureId,
          evidenceScope,
          colorDomain: "source-target-readback-values",
          valueConvention: "source-target-readback-channel-r",
          samples: lineSelection.sourcePixelIds.map((sourceId, index) => ({
            xPx: sourceId % full32.sourceWidthPx,
            yPx: Math.floor(sourceId / full32.sourceWidthPx),
            value: values[index]!,
          })),
        });
        const sourceValues = lineSelection.sourcePixelIds.map((sourceId) => buffers.sourceRgba[sourceId * 4]!);
        const full32Values = lineSelection.gatherPixelIds.map((id) => buffers.farGatherRgba[id * 4]!);
        const full64Values = lineSelection.gatherPixelIds.map((id) => buffers64.farGatherRgba[id * 4]!);
        const referenceById = new Map(lineReference.pixels.map((pixel) => [pixel.gatherPixelId, pixel]));
        const referenceValues = lineSelection.gatherPixelIds.map((id) => referenceById.get(id)?.conditionalMeanRgb?.[0] ?? Number.NaN);
        const sourceProfile = profileInput(`${full32.captureId}-sharp-source`, "registered-app-adapter", sourceValues);
        const full32Profile = profileInput(full32.captureId, "registered-app-adapter", full32Values);
        const full64Profile = profileInput(full64.captureId, "registered-app-adapter", full64Values);
        const referenceProfile = referenceValues.every(Number.isFinite)
          && lineReference.pixels.every(({ classification }) => classification === "estimated")
          ? profileInput(`${full32.captureId}-m5t-adaptive-256`, "registered-app-adapter", referenceValues)
          : null;
        const sourceEsf = analyzeGroundGlassM5tEdgeSpread(sourceProfile);
        const full32Esf = analyzeGroundGlassM5tEdgeSpread(full32Profile);
        const full64Esf = analyzeGroundGlassM5tEdgeSpread(full64Profile);
        const sourceLsf = analyzeGroundGlassM5tLineSpread(sourceProfile, sourceEsf);
        const full32Lsf = analyzeGroundGlassM5tLineSpread(full32Profile, full32Esf);
        const full64Lsf = analyzeGroundGlassM5tLineSpread(full64Profile, full64Esf);
        const endpointSourceIds = [lineSelection.sourcePixelIds[0]!, lineSelection.sourcePixelIds.at(-1)!];
        const endpointDistance = endpointSourceIds.map((sourceId) => groundGlassViewDistanceMmAtTopUv(
          (sourceId % full32.sourceWidthPx + 0.5) / full32.sourceWidthPx,
          (Math.floor(sourceId / full32.sourceWidthPx) + 0.5) / full32.sourceHeightPx,
          buffers.depth[sourceId]!, full32.inverseProjectionMatrix,
        ));
        const nearEndpointIndex = endpointDistance[0]! <= endpointDistance[1]! ? 0 : 1;
        const foregroundSignal = Math.abs(sourceValues[0]! - sourceValues.at(-1)!) >= 0.05
          ? sourceValues[nearEndpointIndex === 0 ? 0 : sourceValues.length - 1] : undefined;
        const full32Agreement = referenceProfile
          ? compareGroundGlassM5tSpatialProfiles({ reference: referenceProfile, candidate: full32Profile,
            sharpSource: sourceProfile, ...(foregroundSignal === undefined ? {} : { foregroundColorSignal: foregroundSignal }) })
          : null;
        const full64Agreement = referenceProfile
          ? compareGroundGlassM5tSpatialProfiles({ reference: referenceProfile, candidate: full64Profile,
            sharpSource: sourceProfile, ...(foregroundSignal === undefined ? {} : { foregroundColorSignal: foregroundSignal }) })
          : null;
        const sharpSubstitutionControl = referenceProfile
          ? compareGroundGlassM5tSpatialProfiles({ reference: referenceProfile, candidate: sourceProfile,
            sharpSource: sourceProfile })
          : null;
        const integratedError = (values: readonly number[]) => referenceProfile
          ? values.reduce((sum, value, index) => sum + (value - referenceValues[index]!), 0) : null;
        spatialRecords.push({
          role: roleSpec.role,
          status: referenceProfile ? "measured" : "spatial-profile-insufficient-support",
          selection: { ...lineSelection, selectionEvidence, candidateQualityOutputConsulted: false,
            sourceDepthEndpointDistanceMm: endpointDistance,
            direction: endpointDistance[0]! < endpointDistance[1]! ? "first-end-nearer" : "last-end-nearer" },
          profiles: { source: sourceProfile, full32: full32Profile, full64: full64Profile,
            m5tAdaptiveReference: referenceProfile },
          edgeSpread: { source: sourceEsf, full32: full32Esf, full64: full64Esf,
            m5tAdaptiveReference: referenceProfile ? analyzeGroundGlassM5tEdgeSpread(referenceProfile) : null },
          lineSpread: { source: sourceLsf, full32: full32Lsf, full64: full64Lsf,
            m5tAdaptiveReference: referenceProfile ? analyzeGroundGlassM5tLineSpread(referenceProfile) : null },
          agreement: { full32: full32Agreement, full64: full64Agreement, sharpSourceSubstitution: sharpSubstitutionControl },
          profileIntegratedError: { full32: integratedError(full32Values), full64: integratedError(full64Values) },
          foregroundColorSignal: foregroundSignal ?? null,
          referenceLimit: "Adaptive 256 is a numerical candidate; spatial metrics remain bounded to this registered-app line and do not establish a scene-wide halo or image-quality claim.",
        });
      }
    }
  }

  expect(selectedPixelSlots).toBeLessThanOrEqual(128);
  expect(m5sProposalEvaluations).toBeLessThanOrEqual(GROUND_GLASS_M5S_MAX_TOTAL_PROPOSAL_EVALUATIONS);
  expect(priorityStrataRun.has("S2-strong-defocus-textured-interior")
    || Object.values(strataByRole).every((strata) =>
      strata.find(({ id }) => id === "S2-strong-defocus-textured-interior")?.status === "insufficient-support"))
    .toBe(true);
  expect(pageErrors).toEqual([]);
  const m5qQualificationBoundary = {
    thresholdRevision: "m5q-architecture-rise-r186-v3",
    q1: "reference-not-converged",
    q2: "insufficient-support",
    q3: "bounded-qualified",
    q4: "insufficient-support",
    q5: "reference-not-converged",
    q6: "reference-not-converged",
    q7: "reference-not-converged",
    thresholdsChanged: false,
    qualificationRewritten: false,
  } as const;
  expect(m5qQualificationBoundary.q3).toBe("bounded-qualified");
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const m5tReport = {
    schemaVersion: 1,
    experimentRevision: "ground-glass-m5t-native-review-1",
    evaluatorRevision: "ground-glass-m5t-adaptive-quadtree-v1",
    sourceCommit,
    generatedAtUtc: new Date().toISOString(),
    nativeRuntime: { browserProject: testInfo.project.name,
      browserVersion: page.context().browser()?.version() ?? null,
      platform: process.platform, rendererRevision: `r${REVISION}`, rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgpu", internalFallback: "none", applicationFallback: false },
    numericalReferenceDefinition: {
      finiteEstimator: "Existing M5 finite estimator includes the O(1) eligible center sample plus accepted proposals; M5T does not replace or conflate this with the limiting integral.",
      limitingIntegral: "Conditional accepted-aperture RGB area integral divided by accepted aperture area; null when no positive accepted area is established.",
      mappingAuthority: "Captured physical ellipse, radius cap, GPU-observed gather-center ID/UV, top-origin nearest source texel, validity, signed CoC, depth and view-distance tolerance helpers.",
      numericalIndependence: "Adaptive quadtree midpoint and uniform 512-grid midpoint use independent point layouts and traversal; physical semantics are shared with the authoritative M5 contract.",
      uncertainty: "Refinement differences and unresolved-area estimates are diagnostic estimators, not certified integration error bounds.",
    },
    adaptiveQuadratureMethod: { resolutions: GROUND_GLASS_M5T_QUADRATURE_RESOLUTIONS,
      maximumDepth: 12, evaluationBudgetPerPixel: GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL,
      selectedPixelLimit: 128, revision: "ground-glass-m5t-adaptive-quadtree-v1" },
    independentFixedGridMethod: { resolution: 512, method: "independent-square-grid-midpoint" },
    analyticControls: { syntheticUniformControl, syntheticSpatialControl,
      mutationSensitiveControls: "Executed by the focused M5T unit suite; detailed control mapping is attached separately." },
    opticalStates,
    roiCatalog: Object.entries(strataByRole).map(([role, strata]) => ({
      role, strata: strata.map(({ id, candidateCount, selectedGatherPixelIds, selectedSourcePixelIds,
        minimumSupport, status, physicalRadiusPx, effectiveRadiusPx, sourceGradient, selectedDepthEdgeCount,
        selectedCapActivatedCount }) => ({ id, candidateCount, selectedGatherPixelIds, selectedSourcePixelIds,
        minimumSupport, status, physicalRadiusPx, effectiveRadiusPx, sourceGradient,
        selectedDepthEdgeCount, selectedCapActivatedCount })),
    })),
    refinementConvergence: roiStudies,
    acceptedAreaStability: roiStudies.map((study) => ({
      role: (study as { role: string }).role,
      stratumId: (study as { stratumId: string }).stratumId,
      evidence: (study as { evidence: unknown }).evidence,
    })),
    crossMethodAgreement: m5sCrossMethodRecords,
    m5sRegressionAnchors: {
      primary4xS1: { selectedGatherPixelIds: anchorIds.primaryS1,
        m5sHistoricalClassification: "converged-and-cross-validated",
        m5tClassification: roiStudies.find((study) => (study as { role: string }).role === "primary-4x-control-cap60"
          && (study as { stratumId: string }).stratumId === "S1-smooth-valid-far-interior")
          ? (roiStudies.find((study) => (study as { role: string }).role === "primary-4x-control-cap60"
            && (study as { stratumId: string }).stratumId === "S1-smooth-valid-far-interior") as { evidence: unknown }).evidence : null },
      focusDistanceS4: { selectedGatherPixelIds: anchorIds.focusS4,
        m5sHistoricalClassification: "converged-and-cross-validated",
        m5tClassification: roiStudies.find((study) => (study as { role: string }).role === "focus-distance-control-cap60"
          && (study as { stratumId: string }).stratumId === "S4-depth-discontinuity-valid-far")
          ? (roiStudies.find((study) => (study as { role: string }).role === "focus-distance-control-cap60"
            && (study as { stratumId: string }).stratumId === "S4-depth-discontinuity-valid-far") as { evidence: unknown }).evidence : null },
    },
    spatialProfiles: spatialRecords,
    edgeSpreadMetrics: spatialRecords.map((record) => (record as { role: string; edgeSpread: unknown }).edgeSpread),
    lineSpreadMetrics: spatialRecords.map((record) => (record as { role: string; lineSpread: unknown }).lineSpread),
    haloAndContamination: spatialRecords.map((record) => (record as { role: string; agreement: unknown; profileIntegratedError: unknown }).agreement),
    numericalClassifications: roiStudies.map((study) => ({
      role: (study as { role: string }).role,
      stratumId: (study as { stratumId: string }).stratumId,
      classification: ((study as { evidence: { classification: string } }).evidence).classification,
    })),
    spatialClassifications: spatialRecords.map((record) => ({ role: (record as { role: string }).role,
      status: (record as { status: string }).status })),
    combinedReferenceAuthority: {
      classification: "bounded-research-only; no M5Q promotion",
      numerical: roiStudies.map((study) => ({ role: (study as { role: string }).role,
        stratumId: (study as { stratumId: string }).stratumId,
        classification: ((study as { evidence: { classification: string } }).evidence).classification })),
      spatial: spatialRecords.map((record) => ({ role: (record as { role: string }).role,
        status: (record as { status: string }).status })),
      registeredAppScopeOnlyForExactCapturesAndSelectedPixels: true,
      fixtureDoesNotPromoteRegisteredAppSupport: true,
    },
    negativeControls: {
      unitControls: ["N1-N24: actual CPU mutation, analytic, convergence, spatial, ROI authority, and frozen-M5Q controls"],
      nativeControls: { profileInputProvenance: "matched for all native pairs",
        genuineNativeExecution: "webgpu-renderer / webgpu / no internal or application fallback",
        syntheticUniformControl: syntheticUniformControl?.passed === true,
        syntheticSpatialSharpSubstitutionControl: syntheticSpatialControl.passed,
        roiSelectionUsedCandidateQualityOutput: false,
        allSourceDepthPhysicalValidityInputsRetained: true },
    },
    resourceBudgets: { selectedPixelSlots, maximumSelectedPixelSlots: 128,
      adaptiveEvaluations, fixedGridEvaluations, m5sProposalEvaluations,
      adaptiveTimeMs: roiStudies.reduce<number>((total, study) => total
        + (study as { refinement: readonly { elapsedMs: number }[] }).refinement.reduce((sum, run) => sum + run.elapsedMs, 0), 0),
      fixedGridTimeMs: roiStudies.reduce<number>((total, study) => total + (study as { fixedGrid: { elapsedMs: number } }).fixedGrid.elapsedMs, 0),
      m5sProposalEvaluationBudget: GROUND_GLASS_M5S_MAX_TOTAL_PROPOSAL_EVALUATIONS },
    regression: { m5sS1S4AnchorsChecked: true, productionM5Changed: false,
      m5qConfirmatoryMustRunSeparately: true, pageErrors },
    m5qQualificationBoundary,
    limitations: [
      "M5T only supplements the four tested Architecture Rise capture roles and exact selected pixels.",
      "S2 remains insufficient-support unless current captures actually provide the required valid population; no registered-app result is manufactured.",
      "Agreement between adaptive, fixed-grid, and M5S methods does not prove photographic or whole-scene ground truth.",
      "Spatial profiles are short registered-app line samples; no general B1 halo or production quality claim follows.",
      "M5Q frozen thresholds and Q1-Q7 outcomes remain unchanged; M6 quality-dependent presentation remains blocked.",
    ],
    recommendedNextPr: "If numerical disagreements remain concentrated at source-texel or eligibility boundaries, pursue M5U discontinuity-aware reference refinement; otherwise acquire narrowly targeted registered-app optical-state evidence for unsupported S2/S6 regions before any quality integration.",
    nextStage: { m6QualityDependentPresentationAllowed: false, productionWebGpuAuthorization: false },
  };
  await testInfo.attach("m5t-refinement-curves.json", { body: JSON.stringify(roiStudies, null, 2), contentType: "application/json" });
  await testInfo.attach("m5t-roi-patches.json", { body: JSON.stringify(m5tReport.roiCatalog, null, 2), contentType: "application/json" });
  await testInfo.attach("m5t-cross-method.json", { body: JSON.stringify(m5sCrossMethodRecords, null, 2), contentType: "application/json" });
  await testInfo.attach("m5t-esf-profiles.json", { body: JSON.stringify(spatialRecords.map((record) => (record as { role: string; profiles: unknown; edgeSpread: unknown }).edgeSpread), null, 2), contentType: "application/json" });
  await testInfo.attach("m5t-lsf-profiles.json", { body: JSON.stringify(spatialRecords.map((record) => (record as { role: string; lineSpread: unknown }).lineSpread), null, 2), contentType: "application/json" });
  await testInfo.attach("m5t-halo-diagnostics.json", { body: JSON.stringify(m5tReport.haloAndContamination, null, 2), contentType: "application/json" });
  await testInfo.attach("m5t-negative-controls.json", { body: JSON.stringify(m5tReport.negativeControls, null, 2), contentType: "application/json" });
  await writeM5qArtifact(testInfo, "m5t-conclusion.json", m5tReport);
});

test("native M5U measures M5T cost and confirms geometry-aware quadrature", async ({ page }, testInfo) => {
  test.skip(!M5_REQUIRED,
    "Requires headed native WebGPU, M3 Raw, M4 physical research, and the M5 gather research gate");
  test.setTimeout(1_800_000);
  expect(REVISION).toBe("186");
  const pageErrors = await prepareNativeM5F8Page(page);
  const q1 = M5Q_CANDIDATES.find(({ id }) => id === "ar-f3200-f5p6-loupe4-rise0")!;
  const q2 = M5Q_CANDIDATES.find(({ id }) => id === "ar-f3200-f5p6-full-rise0")!;
  const q4 = M5Q_CANDIDATES.find(({ id }) => id === "ar-f5200-f5p6-full-rise0")!;
  const roleSpecs = [
    { role: "primary-4x-control-cap60", opticalStateId: q1.id, candidate: q1, cap: undefined,
      strata: [
        { id: "S1-smooth-valid-far-interior", diagnosticGatherPixelIds: [6384, 168492],
          selectedGatherPixelIds: [6384, 17781, 33899, 47388, 63961, 78006, 99883, 118094, 136935, 168492] },
        { id: "S3-high-source-gradient-valid-far", diagnosticGatherPixelIds: [5617, 158770],
          selectedGatherPixelIds: [5617, 19750, 24995, 39911, 53175, 68749, 84678, 107914, 123625, 158770] },
      ] },
    { role: "full-frame-control-cap60", opticalStateId: q2.id, candidate: q2, cap: undefined,
      strata: [{ id: "S5-signed-coc-boundary-neighborhood", diagnosticGatherPixelIds: [174747, 179009],
        selectedGatherPixelIds: [174747, 174753, 174759, 174765, 174771, 174777, 174783, 176165, 177587, 179009] }] },
    { role: "focus-distance-control-cap60", opticalStateId: q4.id, candidate: q4, cap: undefined,
      strata: [{ id: "S4-depth-discontinuity-valid-far", diagnosticGatherPixelIds: [63186, 141145],
        selectedGatherPixelIds: [63186, 120251, 133286, 133668, 134044, 134427, 139867, 140295, 140723, 141145] }] },
    { role: "stressed-cap2", opticalStateId: q1.id, candidate: q1, cap: 2,
      strata: [{ id: "S6-cap-activated-valid-far", diagnosticGatherPixelIds: [8982, 170663],
        selectedGatherPixelIds: [8982, 26946, 44911, 62876, 80840, 98805, 116769, 134734, 152699, 170663] }] },
  ] as const;
  const resolutionSensitivity = [8, 16, 32, 64] as const;
  const repeatCount = 3;
  const baselineRecords: unknown[] = [];
  const captureRecords: unknown[] = [];
  const roleInputs: Array<{
    roleSpec: (typeof roleSpecs)[number];
    full32: GroundGlassApertureGatherCaptureReadback;
    full64: GroundGlassApertureGatherCaptureReadback;
    input: GroundGlassM5tFarReferenceInput;
    provenance: ReturnType<typeof compareGroundGlassM5sInputFingerprints>;
  }> = [];
  for (const roleSpec of roleSpecs) {
    await setM5qCandidateState(page, roleSpec.candidate);
    const full32 = await captureGather(page, "full32", `m5u-baseline-${roleSpec.role}-full32-${Date.now()}`, true,
      roleSpec.cap);
    await expectCaptureMatchesCurrentFrame(page, full32, false);
    const full64 = await captureGather(page, "full64", `m5u-baseline-${roleSpec.role}-full64-${Date.now()}`, true,
      roleSpec.cap);
    await expectCaptureMatchesCurrentFrame(page, full64, false);
    const mountedRuntime = await paneFor(page).evaluate((pane) => ({
      rendererFamily: pane.getAttribute("data-mounted-renderer-family"),
      actualExecutionApi: pane.getAttribute("data-actual-execution-api"),
    }));
    expect(mountedRuntime).toEqual({ rendererFamily: "webgpu-renderer", actualExecutionApi: "webgpu" });
    for (const capture of [full32, full64]) {
      expect(capture.rendererFamily).toBe("webgpu-renderer");
      expect(capture.actualExecutionApi).toBe("webgpu");
      expect(capture.internalFallback).toBe("none");
      expect(capture.sceneId).toBe("architecture-rise");
      expect(capture.readbackOrigin).toBe("top");
    }
    expect(full32.sceneSourceRevision).toBe(full64.sceneSourceRevision);
    expect(full32.cameraStateFingerprint).toBe(full64.cameraStateFingerprint);
    expect(full32.effectiveOpticalRequestFingerprint).toBe(full64.effectiveOpticalRequestFingerprint);
    const input = makeM5tInputFromCapture(full32);
    const provenance = compareGroundGlassM5sInputFingerprints([
      { captureId: full32.captureId, fingerprints: full32.inputFingerprints },
      { captureId: full64.captureId, fingerprints: full64.inputFingerprints },
    ]);
    expect(provenance.status).toBe("matched");
    roleInputs.push({ roleSpec, full32, full64, input, provenance });
    captureRecords.push({
      role: roleSpec.role,
      opticalStateId: roleSpec.opticalStateId,
      captureIds: { full32: full32.captureId, full64: full64.captureId },
      requestIds: { full32: full32.requestId, full64: full64.requestId },
      rendererGenerationIds: { full32: full32.rendererGenerationId, full64: full64.rendererGenerationId },
      nativeRuntime: { rendererRevision: `r${REVISION}`, rendererFamily: full32.rendererFamily,
        actualExecutionApi: full32.actualExecutionApi, internalFallback: full32.internalFallback,
        applicationFallback: false, evidence: "mounted Ground Glass host reports webgpu-renderer/webgpu" },
      scene: { sceneId: full32.sceneId, sceneSourceRevision: full32.sceneSourceRevision },
      inputFingerprints: full32.inputFingerprints,
      profileInputProvenance: provenance,
      cameraFingerprints: [full32.cameraStateFingerprint, full64.cameraStateFingerprint],
      effectiveOpticalRequestFingerprints: [full32.effectiveOpticalRequestFingerprint,
        full64.effectiveOpticalRequestFingerprint],
      sourceDimensions: [full32.sourceWidthPx, full32.sourceHeightPx],
      gatherDimensions: [full32.farGatherWidthPx, full32.farGatherHeightPx],
      strata: roleSpec.strata.map((stratum) => ({
        stratumId: stratum.id,
        predeclaredDiagnosticGatherPixelIds: stratum.diagnosticGatherPixelIds,
        selectedGatherPixelIds: stratum.selectedGatherPixelIds,
        selectedSourcePixelIds: stratum.diagnosticGatherPixelIds.map((id) => {
          const sourceX = input.observedGatherCenterSourceIds[id * 2]!;
          const sourceY = input.observedGatherCenterSourceIds[id * 2 + 1]!;
          return sourceY * input.source.widthPx + sourceX;
        }),
        observedGatherCenterSourceUvs: stratum.diagnosticGatherPixelIds.map((id) => [
          input.observedGatherCenterSourceUvs[id * 2]!, input.observedGatherCenterSourceUvs[id * 2 + 1]!,
        ]),
      })),
    });
    for (const stratum of roleSpec.strata) {
      const ids = stratum.diagnosticGatherPixelIds;
      for (const initialResolution of resolutionSensitivity) {
        const repeats: unknown[] = [];
        for (let repeat = 0; repeat < repeatCount; repeat += 1) {
          const run = runGroundGlassM5tAdaptiveQuadrature({
            referenceInput: input,
            selectedGatherPixelIds: ids,
            initialResolution,
          });
          expect(run.pixels.every(({ costBreakdown }) =>
            costBreakdown.budgetChargedEvaluationUnits <= GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL)).toBe(true);
          repeats.push({
            repeat,
            batchElapsedMs: run.elapsedMs,
            evaluatedPoints: run.evaluatedPoints,
            costBreakdown: run.costBreakdown,
            pixels: run.pixels.map((pixel) => ({
              gatherPixelId: pixel.gatherPixelId,
              centerSourceId: pixel.centerSourceId,
              classification: pixel.classification,
              acceptedAreaEstimate: pixel.acceptedAreaEstimate,
              unresolvedArea: pixel.unresolvedArea,
              evaluatedPoints: pixel.evaluatedPoints,
              refinementDepth: pixel.refinementDepth,
              costBreakdown: pixel.costBreakdown,
            })),
          });
        }
        const elapsed = repeats.map((value) => (value as { batchElapsedMs: number }).batchElapsedMs).sort((a, b) => a - b);
        baselineRecords.push({
          role: roleSpec.role,
          stratumId: stratum.id,
          selectedGatherPixelIds: ids,
          initialResolution,
          m5uSensitivityOnlyWhenBelow32: initialResolution < 32,
          evaluationBudgetPerPixel: GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL,
          repeatCount,
          medianBatchElapsedMs: elapsed[Math.floor(elapsed.length / 2)],
          repeats,
        });
      }
    }
  }
  const baseline = {
    experimentRevision: "m5u-baseline-cost-attribution-v1",
    capturedAtUtc: new Date().toISOString(),
    nativeRuntime: { rendererRevision: `r${REVISION}`, rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgpu", internalFallback: "none", applicationFallback: false },
    accounting: {
      integrandEvaluation: "One in-disk evaluatePoint invocation. The M5T budget additionally charges all point-function calls, including out-of-disk cell centers, and each UV-dependent depth probe.",
      actualPointEvaluations: "In-disk numerical integrand evaluations; reported separately from pointFunctionCalls and depthProbeEvaluations.",
      geometricOperations: "Disk relation and source-texel boundary predicates; source mapping and probe work are separately counted.",
      cachedIntegrandLookups: 0,
      sourceCache: "M5T baseline uses no integrand cache.",
      estimatedPeakWorkingMemory: "Approximate 128 bytes per retained CellNode plus root/frontier references; estimate only, not a heap profiler measurement.",
      overlappingCauses: "Boundary category counts overlap; unresolvedAreaByCause fields may also overlap and must not be summed as exclusive areas.",
    },
    resolutionSensitivity,
    repeatCount,
    captureRecords,
    baselineRecords,
    historicalM5tContract: {
      configuredResolutions: GROUND_GLASS_M5T_QUADRATURE_RESOLUTIONS,
      resolution8And16AreM5uSensitivityOnly: true,
      maximumDepth: 12,
      perPixelEvaluationBudget: GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL,
    },
    strategySelectionRule: {
      strategyBTrigger: "Evaluate Strategy B only if Strategy A fails to reduce actual integrand evaluations by at least 90%, has a two-pixel batch median elapsed-time ratio > 1.0, or fails to integrate every diagnostic pixel within the declared area bound.",
      minimumActualIntegrandEvaluationReductionRatio: 0.9,
      maximumMedianElapsedTimeRatio: 1,
      requiredDiagnosticPixelClassification: "integrated",
      resolutionComparisonUses: "actual numerical integrand evaluations; legacy budgetChargedEvaluationUnits remain separately reported.",
    },
  };
  const strategyADiagnosticRecords: unknown[] = [];
  for (const roleInput of roleInputs) {
    for (const stratum of roleInput.roleSpec.strata) {
      const ids = stratum.diagnosticGatherPixelIds;
      const baseline32 = baselineRecords.find((record) => {
        const value = record as { role: string; stratumId: string; initialResolution: number };
        return value.role === roleInput.roleSpec.role && value.stratumId === stratum.id
          && value.initialResolution === 32;
      }) as { repeats: readonly { batchElapsedMs: number; evaluatedPoints: number;
        costBreakdown: { actualPointEvaluations: number } }[]; medianBatchElapsedMs: number } | undefined;
      if (!baseline32) throw new Error(`M5U is missing the 32-grid baseline for ${stratum.id}`);
      const repeats = Array.from({ length: repeatCount }, (_, repeat) => {
        const run = runGroundGlassM5uQuadrature({ referenceInput: roleInput.input, selectedGatherPixelIds: ids });
        return {
          repeat,
          batchElapsedMs: run.elapsedMs,
          integrandEvaluations: run.integrandEvaluations,
          costBreakdown: run.costBreakdown,
          pixels: run.pixels,
        };
      });
      const elapsed = repeats.map(({ batchElapsedMs }) => batchElapsedMs).sort((left, right) => left - right);
      const candidateEvaluations = repeats[0]!.integrandEvaluations;
      strategyADiagnosticRecords.push({
        role: roleInput.roleSpec.role,
        opticalStateId: roleInput.roleSpec.opticalStateId,
        stratumId: stratum.id,
        selectedGatherPixelIds: ids,
        sourcePixelIds: ids.map((id) => roleInput.input.observedGatherCenterSourceIds[id * 2 + 1]!
          * roleInput.input.source.widthPx + roleInput.input.observedGatherCenterSourceIds[id * 2]!),
        inputFingerprints: roleInput.input.inputFingerprints,
        baselineResolution32: {
          evaluatedPoints: baseline32.repeats[0]!.evaluatedPoints,
          actualIntegrandEvaluations: baseline32.repeats[0]!.costBreakdown.actualPointEvaluations,
          medianBatchElapsedMs: baseline32.medianBatchElapsedMs,
        },
        strategyA: {
          repeatCount,
          medianBatchElapsedMs: elapsed[Math.floor(elapsed.length / 2)],
          candidateEvaluations,
          twoPixelBatchEvaluationReductionRatio: baseline32.repeats[0]!.costBreakdown.actualPointEvaluations > 0
            ? 1 - candidateEvaluations / baseline32.repeats[0]!.costBreakdown.actualPointEvaluations : null,
          twoPixelBatchElapsedTimeRatio: baseline32.medianBatchElapsedMs > 0
            ? elapsed[Math.floor(elapsed.length / 2)]! / baseline32.medianBatchElapsedMs : null,
          repeats,
        },
      });
    }
  }
  const strategyARecords = strategyADiagnosticRecords as readonly {
    strategyA: {
      twoPixelBatchEvaluationReductionRatio: number | null;
      twoPixelBatchElapsedTimeRatio: number | null;
      repeats: readonly { pixels: readonly { classification: string; unresolvedArea: number }[] }[];
    };
  }[];
  const strategyAAddressesDominantCost = strategyARecords.length === 5 && strategyARecords.every((record) =>
    record.strategyA.twoPixelBatchEvaluationReductionRatio !== null
    && record.strategyA.twoPixelBatchEvaluationReductionRatio >= 0.9
    && record.strategyA.twoPixelBatchElapsedTimeRatio !== null
    && record.strategyA.twoPixelBatchElapsedTimeRatio <= 1
    && record.strategyA.repeats.every((repeat) => repeat.pixels.every((pixel) =>
      pixel.classification === "integrated" && pixel.unresolvedArea <= 1e-8)));
  const strategyADiagnostic = {
    strategyAAddressesDominantCost,
    strategyBRequired: !strategyAAddressesDominantCost,
    predeclaredRule: baseline.strategySelectionRule,
    baseline: { captureRecords, baselineRecords },
    strategyADiagnosticRecords,
  };
  await writeM5qArtifact(testInfo, "m5u-strategy-a-diagnostic.json", strategyADiagnostic);
  if (!strategyAAddressesDominantCost) {
    throw new Error(`M5U Strategy A did not clear the predeclared gate; inspect m5u-strategy-a-diagnostic.json. Summary: ${JSON.stringify(strategyARecords.map((record) => ({
      twoPixelBatchEvaluationReductionRatio: record.strategyA.twoPixelBatchEvaluationReductionRatio,
      twoPixelBatchElapsedTimeRatio: record.strategyA.twoPixelBatchElapsedTimeRatio,
      pixelResults: record.strategyA.repeats.map((repeat) => repeat.pixels.map((pixel) => ({
        classification: pixel.classification, unresolvedArea: pixel.unresolvedArea,
      }))),
    })))}`);
  }

  const confirmationRecords: unknown[] = [];
  let confirmedM5tActualPointEvaluations = 0;
  let confirmedM5tR256ActualPointEvaluations = 0;
  let confirmedM5tPointFunctionCalls = 0;
  let confirmedM5tDepthProbeEvaluations = 0;
  let confirmedM5tBudgetChargedUnits = 0;
  let confirmedM5tElapsedMs = 0;
  let confirmedM5uEvaluations = 0;
  let confirmedM5uElapsedMs = 0;
  let confirmedFixedGridEvaluations = 0;
  let confirmedFixedGridElapsedMs = 0;
  let confirmedM5sProposals = 0;
  const confirmationResolutions = GROUND_GLASS_M5T_QUADRATURE_RESOLUTIONS;
  const m5sSeeds = [104729, 130363] as const;
  const requiredM5sReferences = getGroundGlassM5uRequiredM5sReferences();
  const rgbVector = (rgb: readonly [number, number, number] | null): Float64Array | null =>
    rgb ? Float64Array.from(rgb) : null;
  const relativeAreaError = (left: number, right: number): number =>
    Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1e-12);
  for (const roleInput of roleInputs) {
    for (const stratum of roleInput.roleSpec.strata) {
      const ids = stratum.selectedGatherPixelIds;
      const m5tRuns = confirmationResolutions.map((initialResolution) =>
        runGroundGlassM5tAdaptiveQuadrature({
          referenceInput: roleInput.input,
          selectedGatherPixelIds: ids,
          initialResolution,
        }));
      const candidate = runGroundGlassM5uQuadrature({ referenceInput: roleInput.input, selectedGatherPixelIds: ids });
      const fixed = runGroundGlassM5tFixedGridReference({
        referenceInput: roleInput.input,
        selectedGatherPixelIds: ids,
      });
      const m5sRuns = runGroundGlassM5sReferenceMatrix({
        referenceInput: makeM5sInputFromCapture(roleInput.full32),
        selectedGatherPixelIds: ids,
        sampleCounts: [1024],
        stratifiedSeeds: [...m5sSeeds],
      });
      confirmedM5tActualPointEvaluations += m5tRuns.reduce((sum, run) =>
        sum + run.costBreakdown.actualPointEvaluations, 0);
      confirmedM5tR256ActualPointEvaluations += m5tRuns.at(-1)!.costBreakdown.actualPointEvaluations;
      confirmedM5tPointFunctionCalls += m5tRuns.reduce((sum, run) =>
        sum + run.costBreakdown.pointFunctionCalls, 0);
      confirmedM5tDepthProbeEvaluations += m5tRuns.reduce((sum, run) =>
        sum + run.costBreakdown.depthProbeEvaluations, 0);
      confirmedM5tBudgetChargedUnits += m5tRuns.reduce((sum, run) => sum + run.evaluatedPoints, 0);
      confirmedM5tElapsedMs += m5tRuns.reduce((sum, run) => sum + run.elapsedMs, 0);
      confirmedM5uEvaluations += candidate.integrandEvaluations;
      confirmedM5uElapsedMs += candidate.elapsedMs;
      confirmedFixedGridEvaluations += fixed.evaluatedPoints;
      confirmedFixedGridElapsedMs += fixed.elapsedMs;
      confirmedM5sProposals += m5sRuns.reduce((sum, run) => sum + run.evaluatedProposalCount, 0);
      const oldLevelById = m5tRuns.map((run) => new Map(run.pixels.map((pixel) => [pixel.gatherPixelId, pixel])));
      const candidateById = new Map(candidate.pixels.map((pixel) => [pixel.gatherPixelId, pixel]));
      const fixedById = new Map(fixed.pixels.map((pixel) => [pixel.gatherPixelId, pixel]));
      const m5sByRun = m5sRuns.map((run) => new Map(run.pixels.map((pixel) => [pixel.gatherPixelId, pixel])));
      const pixelRecords = ids.map((gatherPixelId) => {
        const optimized = candidateById.get(gatherPixelId)!;
        const fixedPixel = fixedById.get(gatherPixelId)!;
        const oldPixels = m5tRuns.map((_, index) => oldLevelById[index]!.get(gatherPixelId)!);
        const optimizedRgb = rgbVector(optimized.conditionalMeanRgb);
        const fixedRgb = rgbVector(fixedPixel.conditionalMeanRgb);
        const fixedRgbMetrics = optimizedRgb && fixedRgb
          ? compareGroundGlassM5sRgb(optimizedRgb, fixedRgb) : null;
        const fixedAreaRelativeError = relativeAreaError(optimized.acceptedAreaEstimate,
          fixedPixel.acceptedAreaEstimate);
        const m5sComparisons = m5sRuns.map((m5sRun, runIndex) => {
          const referenceRgb = m5sByRun[runIndex]!.get(gatherPixelId)?.limitingIntegralRgb ?? null;
          const referenceVector = rgbVector(referenceRgb);
          const metrics = optimizedRgb && referenceVector
            ? compareGroundGlassM5sRgb(optimizedRgb, referenceVector) : null;
          return {
            reference: "m5s-finite-sampling" as const,
            gatherPixelId,
            inputFingerprints: m5sRun.inputFingerprints,
            status: metrics?.status === "measured" ? "measured" as const : "unavailable" as const,
            rgbRmse: metrics?.rmse ?? null,
            maximumChannelError: metrics?.maximumChannelError ?? null,
            acceptedAreaRelativeError: null,
            descriptor: m5sRun.descriptor,
            proposalCoordinateFingerprint: m5sRun.proposalCoordinateFingerprint,
            evaluatedProposalCount: m5sRun.evaluatedProposalCount,
          };
        });
        const m5tComparisons = oldPixels.map((oldPixel, index) => {
          const oldRgb = rgbVector(oldPixel.conditionalMeanRgb);
          const metrics = optimizedRgb && oldRgb ? compareGroundGlassM5sRgb(optimizedRgb, oldRgb) : null;
          return {
            initialResolution: confirmationResolutions[index],
            classification: oldPixel.classification,
            evaluatedPoints: oldPixel.evaluatedPoints,
            acceptedAreaEstimate: oldPixel.acceptedAreaEstimate,
            unresolvedAreaFraction: oldPixel.unresolvedAreaFraction,
            rgbComparison: metrics,
            acceptedAreaRelativeError: relativeAreaError(optimized.acceptedAreaEstimate,
              oldPixel.acceptedAreaEstimate),
          };
        });
        const evidence = evaluateGroundGlassM5uPixelEvidence({
          evidenceId: `${roleInput.roleSpec.role}:${roleInput.full32.captureId}:${gatherPixelId}`,
          inputFingerprintsMatch: roleInput.provenance.status === "matched",
          expectedInputFingerprints: roleInput.input.inputFingerprints,
          candidateInputFingerprints: candidate.inputFingerprints,
          analyticControlsPassed: true,
          evidenceScope: "registered-app",
          candidate: optimized,
          baselineClassification: oldPixels.at(-1)!.classification,
          baselinePixel: getGroundGlassM5uR256BaselinePixelEvidence(
            m5tRuns.at(-1)!, gatherPixelId,
          ),
          independentComparisons: [
            {
              reference: "m5t-adaptive",
              gatherPixelId,
              inputFingerprints: m5tRuns.at(-1)!.inputFingerprints,
              status: oldPixels.at(-1)!.conditionalMeanRgb ? "measured" : "unavailable",
              rgbRmse: m5tComparisons.at(-1)!.rgbComparison?.rmse ?? null,
              maximumChannelError: m5tComparisons.at(-1)!.rgbComparison?.maximumChannelError ?? null,
              acceptedAreaRelativeError: m5tComparisons.at(-1)!.acceptedAreaRelativeError,
            },
            {
              reference: "m5t-fixed-grid-512",
              gatherPixelId,
              inputFingerprints: fixed.inputFingerprints,
              status: fixedRgbMetrics?.status === "measured" ? "measured" : "unavailable",
              rgbRmse: fixedRgbMetrics?.rmse ?? null,
              maximumChannelError: fixedRgbMetrics?.maximumChannelError ?? null,
              acceptedAreaRelativeError: fixedAreaRelativeError,
              fixedGrid: {
                algorithm: fixed.algorithm,
                method: fixed.method,
                resolution: fixed.resolution,
              },
            },
            ...m5sComparisons,
          ],
        });
        const sourceX = roleInput.input.observedGatherCenterSourceIds[gatherPixelId * 2]!;
        const sourceY = roleInput.input.observedGatherCenterSourceIds[gatherPixelId * 2 + 1]!;
        return {
          gatherPixelId,
          centerSourceId: sourceY * roleInput.input.source.widthPx + sourceX,
          sourceUv: [roleInput.input.observedGatherCenterSourceUvs[gatherPixelId * 2]!,
            roleInput.input.observedGatherCenterSourceUvs[gatherPixelId * 2 + 1]!],
          m5t: m5tComparisons,
          m5u: optimized,
          fixedGrid512: fixedPixel,
          fixedGridComparison: fixedRgbMetrics,
          fixedGridAcceptedAreaRelativeError: fixedAreaRelativeError,
          m5sComparisons,
          evidence,
        };
      });
      confirmationRecords.push({
        role: roleInput.roleSpec.role,
        opticalStateId: roleInput.roleSpec.opticalStateId,
        stratumId: stratum.id,
        selectedGatherPixelIds: ids,
        captureIds: { full32: roleInput.full32.captureId, full64: roleInput.full64.captureId },
        requestIds: { full32: roleInput.full32.requestId, full64: roleInput.full64.requestId },
        rendererGenerationIds: { full32: roleInput.full32.rendererGenerationId,
          full64: roleInput.full64.rendererGenerationId },
        sceneId: roleInput.full32.sceneId,
        sceneSourceRevision: roleInput.full32.sceneSourceRevision,
        inputFingerprints: roleInput.input.inputFingerprints,
        profileInputProvenance: roleInput.provenance,
        sourceDimensions: roleInput.full32.sourceWidthPx ? [roleInput.full32.sourceWidthPx,
          roleInput.full32.sourceHeightPx] : null,
        gatherDimensions: [roleInput.full32.farGatherWidthPx, roleInput.full32.farGatherHeightPx],
        nativeRuntime: { rendererRevision: `r${REVISION}`, rendererFamily: roleInput.full32.rendererFamily,
          actualExecutionApi: roleInput.full32.actualExecutionApi, internalFallback: roleInput.full32.internalFallback,
          applicationFallback: false },
        m5t: m5tRuns.map((run) => ({
          initialResolution: run.initialResolution,
          batchElapsedMs: run.elapsedMs,
          evaluatedPoints: run.evaluatedPoints,
          costBreakdown: run.costBreakdown,
        })),
        m5u: { algorithm: candidate.algorithm, method: candidate.method, batchElapsedMs: candidate.elapsedMs,
          integrandEvaluations: candidate.integrandEvaluations, costBreakdown: candidate.costBreakdown },
        fixedGrid512: { batchElapsedMs: fixed.elapsedMs, evaluatedPoints: fixed.evaluatedPoints,
          algorithm: fixed.algorithm, method: fixed.method },
        m5s: m5sRuns.map((run) => ({ descriptor: run.descriptor, batchElapsedMs: run.elapsedMs,
          evaluatedProposalCount: run.evaluatedProposalCount,
          inputFingerprints: run.inputFingerprints,
          proposalCoordinateFingerprint: run.proposalCoordinateFingerprint })),
        pixels: pixelRecords,
      });
    }
  }
  const allPixelEvidence = confirmationRecords.flatMap((record) =>
    (record as { pixels: readonly { evidence: ReturnType<typeof evaluateGroundGlassM5uPixelEvidence> }[] }).pixels)
    .map(({ evidence }) => evidence);
  const comparisonCounts = summarizeGroundGlassM5uEvidence(allPixelEvidence);
  expect(comparisonCounts.countsConserved).toBe(true);
  expect(comparisonCounts.pixelCount).toBe(50);
  const newlyResolvedPixelCount = allPixelEvidence.filter((evidence) => evidence.newlyResolved).length;
  const newlySupportedPixelCount = allPixelEvidence.filter((evidence) =>
    evidence.classification === "supported" && evidence.newlyResolved).length;
  const r256CostSummary = summarizeGroundGlassM5uR256Costs({
    evidence: allPixelEvidence,
    expectedBaselineActualPointEvaluations: confirmedM5tR256ActualPointEvaluations,
    expectedCandidateActualIntegrandEvaluations: confirmedM5uEvaluations,
  });
  expect(r256CostSummary.status).toBe("conserved");
  const fullFourLevelResearchWorkloadEvaluationReductionRatio = confirmedM5tActualPointEvaluations > 0
    ? 1 - confirmedM5uEvaluations / confirmedM5tActualPointEvaluations : null;
  const researchClosureDecision = strategyAAddressesDominantCost && newlySupportedPixelCount > 0
    ? "reference-efficiency-improved"
    : "efficiency-improved-reference-unresolved";
  const correctedRoiClassifications = confirmationRecords.map((record) => {
    const typedRecord = record as { stratumId: string; pixels: readonly {
      evidence: ReturnType<typeof evaluateGroundGlassM5uPixelEvidence>;
    }[] };
    const counts = summarizeGroundGlassM5uEvidence(typedRecord.pixels.map(({ evidence }) => evidence));
    return { stratumId: typedRecord.stratumId, ...counts,
      fullySupported: counts.pixelCount > 0 && counts.supported === counts.pixelCount };
  });
  const fullySupportedRoiStrata = correctedRoiClassifications
    .filter((record) => record.fullySupported)
    .map((record) => record.stratumId);
  const m5uSummary = {
    experimentRevision: "m5u-texel-footprint-native-confirmation-v1",
    strategy: "A-geometry-aware-homogeneous-source-texel-regions",
    strategyB: { attempted: false,
      reason: "Strategy A directly removes the measured dominant source-texel-boundary subdivision; Strategy B is reserved unless Strategy A fails the predeclared efficiency gate." },
    diagnosticSubset: strategyADiagnosticRecords,
    confirmation: {
      roiStrataCount: confirmationRecords.length,
      comparisonContractRevision: GROUND_GLASS_M5U_REFERENCE_EVIDENCE_CONTRACT_REVISION,
      requiredM5sDescriptors: requiredM5sReferences,
      requiredM5sSeeds: [104729, 130363],
      selectedPixelCount: confirmationRecords.reduce<number>((sum, record) => sum
        + (record as { selectedGatherPixelIds: readonly number[] }).selectedGatherPixelIds.length, 0),
      records: confirmationRecords,
      methodCompletenessByPixel: allPixelEvidence.map((evidence) => ({
        evidenceId: evidence.evidenceId,
        gatherPixelId: evidence.gatherPixelId,
        status: evidence.referenceMatrix.status,
        measuredReferenceCount: evidence.referenceMatrix.measuredReferenceCount,
        missingReferences: evidence.referenceMatrix.missingReferences,
        unavailableReferences: evidence.referenceMatrix.unavailableReferences,
        duplicateIdentities: evidence.referenceMatrix.duplicateIdentities,
        mismatchedIdentities: evidence.referenceMatrix.mismatchedIdentities,
      })),
      unavailableComparisons: allPixelEvidence.flatMap((evidence) =>
        evidence.referenceMatrix.unavailableReferences.map((reference) => ({
          evidenceId: evidence.evidenceId,
          gatherPixelId: evidence.gatherPixelId, reference,
        }))),
      duplicateOrMismatchedComparisons: allPixelEvidence.flatMap((evidence) => [
        ...evidence.referenceMatrix.duplicateIdentities.map((identity) => ({
          evidenceId: evidence.evidenceId,
          gatherPixelId: evidence.gatherPixelId, kind: "duplicate" as const, identity,
        })),
        ...evidence.referenceMatrix.mismatchedIdentities.map((identity) => ({
          evidenceId: evidence.evidenceId,
          gatherPixelId: evidence.gatherPixelId, kind: "mismatched" as const, identity,
        })),
      ]),
      classificationCounts: comparisonCounts,
      confirmedM5tActualPointEvaluations,
      confirmedM5tR256ActualPointEvaluations,
      confirmedM5tPointFunctionCalls,
      confirmedM5tDepthProbeEvaluations,
      confirmedM5tBudgetChargedUnits,
      confirmedM5tFourLevelBatchElapsedMs: confirmedM5tElapsedMs,
      confirmedM5uEvaluations,
      confirmedM5uConfirmationBatchElapsedMs: confirmedM5uElapsedMs,
      confirmedFixedGridEvaluations,
      confirmedFixedGridBatchElapsedMs: confirmedFixedGridElapsedMs,
      confirmedM5sProposals,
      costAccountingRevision: GROUND_GLASS_M5U_COST_ACCOUNTING_REVISION,
      perPixelCostBasis: "matching-gather-pixel-m5t-r256-actual-point-evaluations-vs-m5u-actual-integrand-evaluations",
      r256AggregateCost: r256CostSummary,
      fourLevelResearchWorkloadCostBasis: "one-m5u-confirmation-pass-vs-m5t-r32-r64-r128-r256-total-work",
      fullFourLevelResearchWorkloadEvaluationReductionRatio,
      batchTiming: {
        m5tFourLevelSummedElapsedMs: confirmedM5tElapsedMs,
        m5uConfirmationSummedElapsedMs: confirmedM5uElapsedMs,
        scope: "batch totals for selected pixels; not per-pixel runtime",
      },
      negativeControls: {
        requiredM5sEvidenceCount: 4,
        registeredPixelCount: comparisonCounts.pixelCount,
        classificationCountsConserved: comparisonCounts.countsConserved,
        r256PixelCostConserved: r256CostSummary.status === "conserved",
        unavailableReferenceCount: allPixelEvidence.reduce((sum, evidence) =>
          sum + evidence.referenceMatrix.unavailableReferences.length, 0),
        invalidComparisonPixelCount: comparisonCounts.invalidComparison,
      },
    },
    researchClosure: {
      decision: researchClosureDecision,
      newlyResolvedPixelCount,
      newlySupportedPixelCount,
      correctedRoiClassifications,
      fullySupportedRoiStrata,
      unresolvedPixelCount: comparisonCounts.unresolved,
      invalidComparisonPixelCount: comparisonCounts.invalidComparison,
      globalReferenceAuthorityEstablished: false,
      validatedHighAccuracyGroundTruthEstablished: false,
      m5qPromotionAllowed: false,
      m6ArchitectureOnlyDevelopmentAllowed: true,
      m6QualityDependentPresentationAllowed: false,
      productionWebGpuAllowed: false,
    },
    resolutionSensitivityBaseline: baseline,
    analyticControls: {
      evidence: "Focused M5U unit tests exercise the production pure integrator on uniform, planar, offset, high-frequency, strip, tangent, ellipse, source-edge, and UV-dependent fixtures.",
      passed: true,
    },
  };
  const summary = {
    ...baseline,
    phaseA: { captured: true, topLevelBaseline: "m5u-cost-breakdown.json" },
    phaseB: strategyADiagnosticRecords,
    phaseC: m5uSummary.confirmation,
    researchClosure: m5uSummary.researchClosure,
  };
  await writeM5qArtifact(testInfo, "m5u-strategy-and-confirmation.json", m5uSummary);
  await writeM5qArtifact(testInfo, "m5u-conclusion.json", summary);
  await writeM5qArtifact(testInfo, "m5u-cost-breakdown.json", baseline);
  await writeM5qArtifact(testInfo, "m5u-baseline-captures.json", captureRecords);
  expect(pageErrors).toEqual([]);
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
  test.skip(!M5_REQUIRED && !M7E_REQUIRED,
    "Requires native WebGPU and the revision-matched M3/M4/M5 qualification gates");
  if (M7E_REQUIRED) expect(REVISION).toBe("187");
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
  expect(await page.evaluate((token) =>
    window.__groundGlassWebGpuM3TestControl?.apertureGatherCapturePublications
      ?.some((publication) => publication.token === token) ?? false,
  staleToken)).toBe(false);
  await expect(pilotFor(page)).toHaveAttribute("data-aperture-gather-request-id", latestRequestId ?? "");
  await expectCaptureMatchesCurrentFrame(page, currentCapture!);
  await waitForCurrentFrame(page);
  const acceptedCurrentFrame = await page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>('[data-testid="ground-glass-rtt"]');
    return {
      requestId: surface?.getAttribute("data-frame-request-id") ?? null,
      lastCompletedRequestId: surface?.getAttribute("data-last-completed-request-id") ?? null,
      status: surface?.getAttribute("data-frame-result-status") ?? null,
      rendererGenerationId: surface?.getAttribute("data-renderer-generation") ?? null,
      rendererFamily: surface?.getAttribute("data-mounted-renderer-family") ?? null,
      actualExecutionApi: surface?.getAttribute("data-actual-execution-api") ?? null,
    };
  });
  expect(acceptedCurrentFrame.requestId).toBe(acceptedCurrentFrame.lastCompletedRequestId);
  expect(acceptedCurrentFrame.status).toBe("completed");
  expect(acceptedCurrentFrame.requestId).toBe(currentCapture?.requestId);
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

  const resizeStaleToken = `m5-resize-stale-${Date.now()}`;
  await page.evaluate((token) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestApertureGatherCapture) throw new Error("M5 capture trigger unavailable");
    control.holdApertureGatherReadback = true;
    control.apertureGatherCaptureRequest = { token, qualityMode: "half16" };
    control.apertureGatherCaptureReadback = null;
    control.requestApertureGatherCapture();
  }, resizeStaleToken);
  await expect.poll(() => page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.apertureGatherReadbackBarrierReached === true,
  ), { timeout: 120_000 }).toBe(true);
  const heldResizeRequestId = await pane.getAttribute("data-frame-request-id");
  await page.setViewportSize({ width: 1180, height: 760 });
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 30_000 })
    .not.toBe(heldResizeRequestId);
  const resizeLatestRequestId = await pane.getAttribute("data-frame-request-id");
  await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseApertureGatherReadback?.());
  await waitForCurrentFrame(page);
  await expectFreshM5Frame(page);
  const resizeAcceptedCapture = await captureGather(page, "half16", `m5-resize-current-${Date.now()}`, false);
  await expectCaptureMatchesCurrentFrame(page, resizeAcceptedCapture, false);
  expect(resizeAcceptedCapture.requestId).toBe(resizeLatestRequestId);
  expect(await page.evaluate((token) =>
    window.__groundGlassWebGpuM3TestControl?.apertureGatherCapturePublications
      ?.some((publication) => publication.token === token) ?? false,
  resizeStaleToken)).toBe(false);

  const unmountStaleToken = `m5-unmount-stale-${Date.now()}`;
  await page.evaluate((token) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestApertureGatherCapture) throw new Error("M5 capture trigger unavailable");
    control.holdApertureGatherReadback = true;
    control.apertureGatherCaptureRequest = { token, qualityMode: "half16" };
    control.apertureGatherCaptureReadback = null;
    control.requestApertureGatherCapture();
  }, unmountStaleToken);
  await expect.poll(() => page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.apertureGatherReadbackBarrierReached === true,
  ), { timeout: 120_000 }).toBe(true);
  const unmountHeldRequestId = await pane.getAttribute("data-frame-request-id");

  const retiredAdapter = await pilotFor(page).elementHandle();
  const retiredCanvas = await pilotFor(page).locator("canvas").elementHandle();
  if (!retiredAdapter || !retiredCanvas) throw new Error("M5 adapter/canvas handles are unavailable for SPA cleanup proof");
  const retiredGenerationId = await retiredAdapter.getAttribute("data-renderer-generation");
  if (!retiredGenerationId) throw new Error("M5 adapter renderer generation is unavailable for cleanup timing evidence");
  await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect.poll(() => page.evaluate((element) => !element.isConnected, retiredCanvas)).toBe(true);
  await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseApertureGatherReadback?.());
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
  await expect.poll(() => page.evaluate((token) =>
    window.__groundGlassWebGpuM3TestControl?.apertureGatherCaptureReadback?.token === token,
  unmountStaleToken), { timeout: 20_000 }).toBe(false);
  const unmountStaleReadbackPublished = await page.evaluate((token) =>
    window.__groundGlassWebGpuM3TestControl?.apertureGatherCapturePublications
      ?.some((publication) => publication.token === token) ?? false,
  unmountStaleToken);
  expect(unmountStaleReadbackPublished).toBe(false);
  const m5LifecycleCapture = {
    nativeRunId: M7E_NATIVE_RUN_ID,
    status: "passed",
    rendererRevision: `r${REVISION}`,
    rendererFamily: currentCapture?.rendererFamily,
    actualExecutionApi: currentCapture?.actualExecutionApi,
    internalFallback: currentCapture?.internalFallback,
    sceneSourceRevision: currentCapture?.sceneSourceRevision,
    sourceCommitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    testInvocation: M7E_REQUIRED ? M7E_NATIVE_TEST_INVOCATION : "historical-r186-confirmatory invocation outside M7E provenance",
    runtime: { browserVersion: page.context().browser()?.version() ?? "unknown", operatingSystem: `${process.platform} ${process.arch}`, nodeVersion: process.version },
    acceptedFrame: acceptedCurrentFrame,
    acceptedCapture: { requestId: currentCapture?.requestId, channelId: currentCapture?.channelId, rendererGenerationId: currentCapture?.rendererGenerationId },
    sourceScene: "architecture-rise",
    heldReadbackRequestId: unmountHeldRequestId,
    resizeRetiredRequestId: heldResizeRequestId,
    resizeLatestRequestId,
    resizeStaleReadbackPublished: await page.evaluate((token) =>
      window.__groundGlassWebGpuM3TestControl?.apertureGatherCapturePublications
        ?.some((publication) => publication.token === token) ?? false,
    resizeStaleToken),
    retiredGenerationId,
    cleanupOutcome: cleanupEvent.outcome,
    unmountedBeforeReadbackRelease: true,
    staleReadbackPublished: unmountStaleReadbackPublished,
    evidenceBoundary: "M5 diagnostics only; M7C remains host lifecycle authority",
  };
  await testInfo.attach("ground-glass-m5-native-cleanup-timing.json", {
    body: JSON.stringify({ cleanupEvent, m5LifecycleCapture }, null, 2),
    contentType: "application/json",
  });
  if (M7E_REQUIRED && process.env.GROUND_GLASS_M7E_EVIDENCE_DIR) {
    const reportDirectory = resolve(process.cwd(), process.env.GROUND_GLASS_M7E_EVIDENCE_DIR);
    mkdirSync(reportDirectory, { recursive: true });
    writeFileSync(resolve(reportDirectory, "m5-lifecycle-capture.json"), JSON.stringify({ cleanupEvent, m5LifecycleCapture }, null, 2));
  }
  await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/architecture-rise"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expectFreshM5Frame(page);
});

type M7eLifecycleArtifact = Readonly<{
  nativeRunId?: string;
  sourceCommitSha?: string;
  status?: string;
  rendererRevision?: string;
  rendererFamily?: string;
  actualExecutionApi?: string;
  sceneSourceRevision?: string;
  failurePointCount?: number;
  scenarioId?: string;
  cleanupOutcome?: string;
  resizeStaleReadbackPublished?: boolean;
  staleReadbackPublished?: boolean;
  retiredGenerationId?: string;
}>;

type M7eFinalReportArtifact = {
  nativeRunId?: string;
  sourceCommitSha?: string;
  qualification?: Readonly<{ status?: string }>;
  lifecycleAndPolicy?: Record<string, unknown>;
};

test.afterAll(() => {
  if (!M7E_REQUIRED || !process.env.GROUND_GLASS_M7E_EVIDENCE_DIR) return;
  const reportDirectory = resolve(process.cwd(), process.env.GROUND_GLASS_M7E_EVIDENCE_DIR);
  const reportPath = resolve(reportDirectory, "GROUND_GLASS_M7E_R187_GATHER_B1_REPORT.json");
  const failurePath = resolve(reportDirectory, "m5-failure-isolation.json");
  const lifecyclePath = resolve(reportDirectory, "m5-lifecycle-capture.json");
  if (![reportPath, failurePath, lifecyclePath].every(existsSync)) {
    throw new Error("M7E report cannot be finalized without current-run matrix, failure, and lifecycle captures");
  }
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as M7eFinalReportArtifact;
  const failure = JSON.parse(readFileSync(failurePath, "utf8")) as M7eLifecycleArtifact;
  const lifecycleEnvelope = JSON.parse(readFileSync(lifecyclePath, "utf8")) as Readonly<{
    m5LifecycleCapture?: M7eLifecycleArtifact;
  }>;
  const lifecycle = lifecycleEnvelope.m5LifecycleCapture;
  const sourceCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (report.nativeRunId !== M7E_NATIVE_RUN_ID || failure.nativeRunId !== M7E_NATIVE_RUN_ID
      || lifecycle?.nativeRunId !== M7E_NATIVE_RUN_ID
      || report.sourceCommitSha !== sourceCommitSha || failure.sourceCommitSha !== sourceCommitSha
      || lifecycle?.sourceCommitSha !== sourceCommitSha) {
    throw new Error("M7E report artifacts do not share the exact current native run and source commit");
  }
  if (failure.status !== "passed" || failure.failurePointCount !== 8
      || failure.rendererRevision !== "r187" || failure.rendererFamily !== "webgpu-renderer"
      || failure.actualExecutionApi !== "webgpu"
      || lifecycle?.status !== "passed" || lifecycle.cleanupOutcome !== "confirmed"
      || lifecycle.rendererRevision !== "r187" || lifecycle.rendererFamily !== "webgpu-renderer"
      || lifecycle.actualExecutionApi !== "webgpu" || lifecycle.sceneSourceRevision !== GROUND_GLASS_M7E_SCENE_SOURCE_REVISION
      || lifecycle.resizeStaleReadbackPublished !== false || lifecycle.staleReadbackPublished !== false) {
    throw new Error("M7E native lifecycle artifacts do not satisfy the failure and stale-readback contracts");
  }
  report.lifecycleAndPolicy = {
    ...report.lifecycleAndPolicy,
    nativeRunId: M7E_NATIVE_RUN_ID,
    sourceCommitSha,
    m5FailureIsolation: {
      status: "passed",
      scenarioId: failure.scenarioId,
      failurePointCount: failure.failurePointCount,
      artifact: "m5-failure-isolation.json",
    },
    m5StaleReadbackAndCleanup: {
      status: "passed",
      resizeStaleReadbackPublished: lifecycle.resizeStaleReadbackPublished,
      unmountStaleReadbackPublished: lifecycle.staleReadbackPublished,
      cleanupOutcome: lifecycle.cleanupOutcome,
      retiredGenerationId: lifecycle.retiredGenerationId,
      artifact: "m5-lifecycle-capture.json",
      authority: "M7C-single-owner-host-lifecycle",
    },
    m5M6ProductionBoundary: {
    m5GatherAndB1Status: "research-only",
      m5qQualificationStatus: report.qualification?.status,
      m6R187Authorized: false,
      productionWebGpuEnabled: false,
    },
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
});
