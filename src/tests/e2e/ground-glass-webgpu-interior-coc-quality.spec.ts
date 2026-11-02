import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { REVISION } from "three";
import {
  buildPhaseLCandidateSearchArtifact,
  buildPhaseLNoCandidateReport,
  evaluatePhaseLQualityDecision,
  PHASE_L_CANDIDATES,
  PHASE_L_QUALITY_ACCEPTANCE,
  PHASE_L_INTERIOR_TARGETS,
  passesPhaseLConfirmatoryAcceptance,
  selectPhaseLCandidates,
} from "./fixtures/ground-glass-webgpu-interior-coc-cases";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/ground-glass-webgpu-aperture-gather.html?phaseL=1";
const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const ARTIFACT_DIRECTORY = resolve(process.cwd(), "test-results/ground-glass-webgpu-phase-l");

type JsonRecord = Record<string, unknown>;
type Operation = {
  operationId: string;
  state: string;
  stage: string;
  resultPublished: boolean;
  error: string | null;
  appliedState: JsonRecord | null;
  phaseJ: JsonRecord | null;
  timing: JsonRecord | null;
};
type Handle = {
  instanceId: string;
  generation: number;
  state: string;
  runtime: null | {
    rendererFamily: string;
    executionBackend: string;
    applicationFallback: boolean;
    initialized: boolean;
    threeRevision: string;
  };
  operations: Operation[];
  resources: Array<{ id: string; role: string; state: string; error: string | null }>;
};
type Diagnostics = { activeHandleId: string | null; handles: Handle[] };
type CandidateEvidence = {
  id: string;
  magnification: number;
  pan: { x: number; y: number };
  operation: Operation;
  phaseL: JsonRecord;
  geometry: JsonRecord;
  score: readonly number[];
  qualified: boolean;
  rejectionReasons: string[];
};

const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

const readDiagnostics = async (page: Page): Promise<Diagnostics> => {
  const text = await page.getByTestId("fixture-diagnostics").textContent();
  if (!text) throw new Error("Phase L fixture diagnostics are not published");
  return JSON.parse(text) as Diagnostics;
};

const readActiveHandle = async (page: Page) => {
  const state = await readDiagnostics(page);
  const handle = state.handles.find((entry) => entry.instanceId === state.activeHandleId);
  if (!handle) throw new Error("Phase L fixture has no active renderer handle");
  return handle;
};

const waitForActiveHandle = async (page: Page) => {
  await expect.poll(async () => {
    const handle = await readActiveHandle(page).catch(() => null);
    const operation = handle?.operations.at(-1);
    return Boolean(handle?.state === "active" && operation?.state === "completed" && operation.resultPublished);
  }, { timeout: 180_000, intervals: [100, 250, 500, 1000] }).toBe(true);
  return readActiveHandle(page);
};

const assertNative = (handle: Handle) => {
  expect(handle.runtime).toMatchObject({
    rendererFamily: "webgpu-renderer",
    executionBackend: "webgpu",
    applicationFallback: false,
    initialized: true,
    threeRevision: "186",
  });
};

const runOperation = async (page: Page, testId: string) => {
  const before = await readActiveHandle(page);
  const previousCount = before.operations.length;
  await page.getByTestId(testId).click();
  await expect.poll(async () => {
    const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === before.instanceId);
    const operation = handle?.operations.at(-1);
    return operation?.state === "completed" || operation?.state === "failed" || operation?.state === "retired";
  }, { timeout: 240_000, intervals: [100, 250, 500, 1000] }).toBe(true);
  const handle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === before.instanceId);
  if (!handle) throw new Error(`Renderer ${before.instanceId} disappeared after ${testId}`);
  const operation = handle.operations.at(-1);
  if (!operation || handle.operations.length !== previousCount + 1) {
    throw new Error(`Expected one new operation after ${testId}; observed ${handle.operations.length - previousCount}`);
  }
  expect(operation.state, `${operation.operationId} stage=${operation.stage} error=${operation.error}`).toBe("completed");
  expect(operation.resultPublished, operation.operationId).toBe(true);
  expect(operation.phaseJ, `${operation.operationId} Phase J/K diagnostics`).not.toBeNull();
  return { handle, operation };
};

const phaseLOf = (operation: Operation) => record(record(operation.phaseJ).phaseL);
const phaseKOf = (operation: Operation) => record(record(operation.phaseJ).phaseK);

const candidateScore = (geometry: JsonRecord): readonly number[] => {
  const counts = record(geometry.counts);
  return [
    number(counts.interiorCapPixels) ?? 0,
    number(counts.largestInteriorCapComponentPixels) ?? 0,
    number(counts.interiorCapFarDepthEdgePixels) ?? 0,
    number(counts.interiorHighContrastFarDepthEdgePairs) ?? 0,
    number(counts.uncappedReferenceClearCapPixels) ?? 0,
  ];
};

const candidateRejectionReasons = (geometry: JsonRecord) => {
  const counts = record(geometry.counts);
  const border = record(geometry.borderClearance);
  const minimums = PHASE_L_INTERIOR_TARGETS;
  const checks: Array<[string, number | null, number]> = [
    ["interior cap pixels", number(counts.interiorCapPixels), minimums.minimumInteriorCapPixels],
    ["largest interior cap component", number(counts.largestInteriorCapComponentPixels), minimums.minimumLargestInteriorCapComponent],
    ["interior capped far-edge pixels", number(counts.interiorCapFarDepthEdgePixels), minimums.minimumInteriorCapFarDepthEdgePixels],
    ["interior high-contrast capped far-edge pairs", number(counts.interiorHighContrastFarDepthEdgePairs), minimums.minimumHighContrastFarDepthEdgePairs],
    ["minimum interior support border clearance", number(border.minimumInteriorCapBorderDistancePx), minimums.cappedSupportMarginPx],
  ];
  return checks.filter(([, value, minimum]) => value === null || value < minimum)
    .map(([label, value, minimum]) => `${label}: ${value ?? "missing"} < ${minimum}`);
};

const assertAppliedCandidateState = (operation: Operation, candidate: CandidateEvidence) => {
  const applied = record(operation.appliedState);
  expect(applied).toMatchObject({
    scene: "macro-depth-of-field",
    crop: true,
    filmTiltDeg: 0,
    focusOffsetMm: 0,
    apertureFNumber: 5.6,
    sourceWidthPx: 512,
    sourceHeightPx: 384,
  });
  const phaseJApplied = record(applied.phaseJ);
  expect(phaseJApplied).toMatchObject({
    requestedCropMagnification: candidate.magnification,
    requestedCropPan: candidate.pan,
  });
  const optical = record(record(operation.phaseJ).opticalState);
  const cameraState = record(optical.cameraState);
  expect(cameraState).toMatchObject({ focalLengthMm: 150, focusDistanceMm: 400, aperture: 5.6 });
  const film = record(optical.film);
  expect(number(film.sampledWidthMm)).toBeCloseTo(127 / candidate.magnification, 6);
  expect(number(film.sampledHeightMm)).toBeCloseTo(101.6 / candidate.magnification, 6);
  const inspection = record(optical.inspectionWindow);
  const expectedFraction = 1 / candidate.magnification;
  const expectedCenterU = 0.5 - candidate.pan.x * (1 - expectedFraction) / 2;
  const expectedCenterV = 0.5 - candidate.pan.y * (1 - expectedFraction) / 2;
  expect(number(inspection.widthFraction)).toBeCloseTo(expectedFraction, 8);
  expect(number(inspection.heightFraction)).toBeCloseTo(expectedFraction, 8);
  expect(number(inspection.centerU)).toBeCloseTo(expectedCenterU, 8);
  expect(number(inspection.centerV)).toBeCloseTo(expectedCenterV, 8);
};

const attachImages = async (page: Page, testInfo: TestInfo, prefix: string) => {
  const images = await page.evaluate((imagePrefix) => {
    const source = (window as Window & { __groundGlassWebGpuPhaseJImages?: Record<string, string> }).__groundGlassWebGpuPhaseJImages ?? {};
    return Object.entries(source).filter(([key]) => key.startsWith(imagePrefix));
  }, prefix);
  for (const [name, dataUrl] of images) {
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    await testInfo.attach(`${name}.png`, { body: Buffer.from(base64, "base64"), contentType: "image/png" });
  }
};

test("native Phase L crop search and matched B1 large-CoC quality matrix", async ({ page }, testInfo) => {
  test.skip(!nativeRequired, "Native GPU evidence runs only in the headed native-WebGPU project");
  test.setTimeout(30 * 60 * 1000);
  await page.goto(FIXTURE_PATH);
  let handle = await waitForActiveHandle(page);
  assertNative(handle);
  const documentTimeOrigin = await page.evaluate(() => performance.timeOrigin);
  const candidateResults: CandidateEvidence[] = [];
  for (const candidate of PHASE_L_CANDIDATES) {
    const { handle: current, operation } = await runOperation(page, `phase-l-preflight-${candidate.id}`);
    assertNative(current);
    const phaseL = phaseLOf(operation);
    const geometry = record(phaseL.geometryOnlyPreflight);
    const counts = record(geometry.counts);
    const borderClearance = record(geometry.borderClearance);
    const expectedQualified = (number(counts.interiorCapPixels) ?? 0) >= PHASE_L_INTERIOR_TARGETS.minimumInteriorCapPixels
      && (number(counts.largestInteriorCapComponentPixels) ?? 0) >= PHASE_L_INTERIOR_TARGETS.minimumLargestInteriorCapComponent
      && (number(counts.interiorCapFarDepthEdgePixels) ?? 0) >= PHASE_L_INTERIOR_TARGETS.minimumInteriorCapFarDepthEdgePixels
      && (number(counts.interiorHighContrastFarDepthEdgePairs) ?? 0) >= PHASE_L_INTERIOR_TARGETS.minimumHighContrastFarDepthEdgePairs
      && (number(borderClearance.minimumInteriorCapBorderDistancePx) ?? 0) >= PHASE_L_INTERIOR_TARGETS.cappedSupportMarginPx;
    expect(number(counts.highContrastFarDepthEdgePairs), `${candidate.id} global high-contrast count`).not.toBeNull();
    expect(number(counts.interiorHighContrastFarDepthEdgePairs), `${candidate.id} interior high-contrast count`).not.toBeNull();
    expect(number(counts.highContrastFarDepthEdgePairs) ?? 0).toBeGreaterThanOrEqual(number(counts.interiorHighContrastFarDepthEdgePairs) ?? 0);
    expect(geometry.candidateQualified, `${candidate.id} corrected qualification from measured counts`).toBe(expectedQualified);
    expect(phaseL.qualityMetricsUsedForSelection).toBe(false);
    expect(phaseL.reconstructionReferenceUsedForSelection).toBe(false);
    expect(phaseKOf(operation).largeCocFarQuality).toBeNull();
    const entry: CandidateEvidence = {
      id: candidate.id,
      magnification: candidate.magnification,
      pan: candidate.pan,
      operation,
      phaseL,
      geometry,
      score: candidateScore(geometry),
      qualified: geometry.candidateQualified === true,
      rejectionReasons: candidateRejectionReasons(geometry),
    };
    assertAppliedCandidateState(operation, entry);
    expect(record(phaseL.nativeRuntime)).toMatchObject({
      rendererFamily: "webgpu-renderer",
      executionBackend: "webgpu",
      applicationFallback: false,
      threeRevision: "186",
    });
    candidateResults.push(entry);
  }

  for (let left = 0; left < candidateResults.length; left += 1) {
    for (let right = left + 1; right < candidateResults.length; right += 1) {
      const a = candidateResults[left]!;
      const b = candidateResults[right]!;
      if (a.magnification !== b.magnification) continue;
      const aFilm = record(record(record(a.operation.phaseJ).opticalState).film);
      const bFilm = record(record(record(b.operation.phaseJ).opticalState).film);
      expect(aFilm.sampledWidthMm, `${a.id}/${b.id} sampled film width under pan change`).toBe(bFilm.sampledWidthMm);
      expect(aFilm.sampledHeightMm, `${a.id}/${b.id} sampled film height under pan change`).toBe(bFilm.sampledHeightMm);
      const aOptics = record(record(a.operation.phaseJ).opticalState);
      const bOptics = record(record(b.operation.phaseJ).opticalState);
      for (const key of ["cameraState", "lens", "film", "focus", "optics"] as const) {
        expect(aOptics[key], `${a.id}/${b.id} canonical ${key} under pan change`).toEqual(bOptics[key]);
      }
      const aMatrices = record(aOptics.cameraMatrices);
      const bMatrices = record(bOptics.cameraMatrices);
      expect(aMatrices.worldMatrixElements, `${a.id}/${b.id} camera pose under pan change`).toEqual(bMatrices.worldMatrixElements);
    }
  }

  const selection = selectPhaseLCandidates(candidateResults);
  const sortedCandidates = selection.sortedCandidates;
  const qualifiedCandidates = selection.qualifiedCandidates;
  const selected = selection.selectedCandidate;
  const exploratoryCandidate = selection.bestUnqualifiedCandidate;
  const candidateSearchRecords = sortedCandidates.map((entry) => ({
    id: entry.id,
    magnification: entry.magnification,
    pan: entry.pan,
    score: entry.score,
    qualified: entry.qualified,
    rejectionReasons: entry.rejectionReasons,
    operationId: entry.operation.operationId,
    operationState: entry.operation.state,
    nativeRuntime: entry.phaseL.nativeRuntime,
    inspectionWindow: record(record(entry.phaseL.selectedCandidateConfiguration).inspectionWindow),
    sampledFilmMm: record(record(entry.phaseL.selectedCandidateConfiguration).sampledFilmMm),
    counts: record(entry.geometry.counts),
    borderClearance: record(entry.geometry.borderClearance),
    largestInteriorCapComponent: entry.geometry.largestInteriorCapComponent,
    edgePairs: Array.isArray(entry.geometry.edgePairs) ? entry.geometry.edgePairs : [],
    surfaceSamples: entry.phaseL.firstVisibleMacroSurfaceSamples,
  }));
  const candidateSearchArtifact = buildPhaseLCandidateSearchArtifact({
    candidates: candidateSearchRecords,
    selectedCandidateId: selected?.id ?? null,
    bestUnqualifiedCandidateId: selected ? null : exploratoryCandidate?.id ?? null,
    predeclaredCriteria: candidateResults[0]?.geometry.thresholds ?? PHASE_L_INTERIOR_TARGETS,
    qualityAcceptance: PHASE_L_QUALITY_ACCEPTANCE,
    nativeRuntime: handle.runtime,
    selectionPolicy: "Lexicographic geometry score: interior cap pixels, largest interior 4-connected component, interior cap/far edge pixels, interior-only high-contrast capped far-edge pairs, then local uncapped-reference-clear cap pixels. B0/B1 quality is not evaluated or consulted; no unqualified candidate is used for confirmatory quality.",
  });
  const candidateSearchJson = JSON.stringify(candidateSearchArtifact, null, 2);
  await testInfo.attach("candidate-search.json", {
    body: Buffer.from(candidateSearchJson),
    contentType: "application/json",
  });
  await mkdir(ARTIFACT_DIRECTORY, { recursive: true });
  await writeFile(join(ARTIFACT_DIRECTORY, "candidate-search.json"), candidateSearchJson);
  await attachImages(page, testInfo, "macro-focus-middle-f5.6-");

  const matrix: Array<{ label: string; operation: Operation; handle: Handle }> = [];
  let qualityValues: Array<JsonRecord> | null = null;
  let b0ToB1EdgeBaseline: { changedPixelCount: number | null; rmse: number | null } | null = null;
  let decision: "L-A" | "L-B" | "L-D" | "L-E" = "L-D";
  let qualityDecisionEvidence: ReturnType<typeof evaluatePhaseLQualityDecision> | null = null;
  const noCandidateReport = selected ? null : buildPhaseLNoCandidateReport({
    candidateSearch: candidateSearchArtifact,
    nativeRuntime: handle.runtime,
  });
  if (noCandidateReport) {
    decision = noCandidateReport.decision;
    qualityDecisionEvidence = noCandidateReport.qualityDecisionEvidence;
    const qualityDecisionJson = JSON.stringify({ acceptance: PHASE_L_QUALITY_ACCEPTANCE, decision, qualityDecisionEvidence }, null, 2);
    await testInfo.attach("phase-l-quality-decision.json", {
      body: Buffer.from(qualityDecisionJson),
      contentType: "application/json",
    });
    await writeFile(join(ARTIFACT_DIRECTORY, "phase-l-quality-decision.json"), qualityDecisionJson);
  }
  if (selected) {
    await page.getByTestId("phase-l-selected-candidate").selectOption(selected.id);
    const sequence = [
      ["cap60-full32", "phase-l-cap60-full32"],
      ["cap60-full64", "phase-l-cap60-full64"],
      ["cap60-half32-b0", "phase-l-cap60-half32-b0"],
      ["cap60-half32-b1", "phase-l-cap60-half32-b1"],
      ["cap12-full32", "phase-l-cap12-full32"],
      ["cap12-full64", "phase-l-cap12-full64"],
      ["cap12-half32-b0", "phase-l-cap12-half32-b0"],
      ["cap12-half32-b1", "phase-l-cap12-half32-b1"],
    ] as const;
    for (const [label, testId] of sequence) {
      const result = await runOperation(page, testId);
      assertNative(result.handle);
      assertAppliedCandidateState(result.operation, selected);
      expect(record(phaseKOf(result.operation).nativeRuntime)).toMatchObject({
        rendererFamily: "webgpu-renderer",
        executionBackend: "webgpu",
        applicationFallback: false,
        threeRevision: "186",
      });
      matrix.push({ label, operation: result.operation, handle: result.handle });
    }
    qualityValues = matrix.map((entry) => ({
      label: entry.label,
      operationId: entry.operation.operationId,
      operationWallTimeMs: record(entry.operation.timing).operationWallTimeMs,
      readbackWallTimeMs: record(entry.operation.timing).readbackWallTimeMs,
      stageTiming: record(entry.operation.timing).stages,
      phaseK: phaseKOf(entry.operation),
      phaseL: phaseLOf(entry.operation),
    }));
    const rawQualityEvidenceJson = JSON.stringify({ selected, matrix: qualityValues }, null, 2);
    await testInfo.attach("selected-state-quality-and-resource-evidence.json", {
      body: Buffer.from(rawQualityEvidenceJson),
      contentType: "application/json",
    });
    await writeFile(join(ARTIFACT_DIRECTORY, "selected-state-quality-and-resource-evidence.json"), rawQualityEvidenceJson);
    await attachImages(page, testInfo, "macro-focus-middle-f5.6-");

    const operationFor = (label: string) => {
      const entry = matrix.find((item) => item.label === label);
      if (!entry) throw new Error(`Missing Phase L matrix operation: ${label}`);
      return entry.operation;
    };
    const reference = operationFor("cap60-full32");
    const referenceK = phaseKOf(reference);
    const referenceFingerprints = record(referenceK.inputFingerprints);
    const referenceApplied = record(reference.appliedState);
    const referencePhaseJ = record(reference.phaseJ);
    const referenceCameraMatrices = record(record(referencePhaseJ.opticalState).cameraMatrices);
    for (const entry of matrix.slice(1)) {
      const currentK = phaseKOf(entry.operation);
      const currentFingerprints = record(currentK.inputFingerprints);
      for (const key of ["sourceColor", "worldPositionAndDepth", "validity", "physical"] as const) {
        expect(currentFingerprints[key], `${entry.label} ${key} fingerprint`).toBe(referenceFingerprints[key]);
      }
      const currentApplied = record(entry.operation.appliedState);
      for (const key of ["filmTiltDeg", "filmNormal", "filmBasisX", "filmBasisY", "crop", "sampledFilmWidthMm", "sampledFilmHeightMm", "focusOffsetMm", "apertureFNumber", "sourceWidthPx", "sourceHeightPx"] as const) {
        expect(currentApplied[key], `${entry.label} optical state ${key}`).toEqual(referenceApplied[key]);
      }
      const currentCameraMatrices = record(record(record(entry.operation.phaseJ).opticalState).cameraMatrices);
      expect(currentCameraMatrices, `${entry.label} applied capture-camera matrices`).toEqual(referenceCameraMatrices);
      const phaseL = phaseLOf(entry.operation);
      expect(phaseL.stage, `${entry.label} Phase L stage`).toBe("matched quality confirmation");
      expect(phaseL.selectedCandidateId, `${entry.label} candidate identity`).toBe(selected.id);
      expect(number(record(phaseKOf(entry.operation).physical).radiusDiagnosticMismatchCount), `${entry.label} GPU/CPU physical radius diagnostics`).toBe(0);
    }
    const referenceIdentityByCap = new Map<string, string>();
    for (const entry of matrix) {
      const capKey = entry.label.startsWith("cap60-") ? "cap60" : "cap12";
      const identity = String(phaseLOf(entry.operation).referenceIdentity ?? "");
      expect(identity, `${entry.label} Full ×32 reference identity`).toContain("macro-focus-middle-f5_6");
      const existingIdentity = referenceIdentityByCap.get(capKey);
      if (existingIdentity) expect(identity, `${entry.label} matched Full ×32 reference`).toBe(existingIdentity);
      else referenceIdentityByCap.set(capKey, identity);
    }
    expect(referenceIdentityByCap.get("cap60")).not.toBe(referenceIdentityByCap.get("cap12"));
    const cap12Full64 = operationFor("cap12-full64");
    const convergence = record(phaseKOf(cap12Full64).full32VsFull64Agreement);
    expect(number(convergence.pixelCount)).toBe(512 * 384);
    for (const entry of [matrix.find((item) => item.label === "cap60-half32-b1")!, matrix.find((item) => item.label === "cap12-half32-b1")!]) {
      const quality = record(phaseKOf(entry.operation).largeCocFarQuality);
      expect(number(record(quality.validFarRgbError).pixelCount) ?? 0).toBeGreaterThan(0);
    }
    const cap12B1 = operationFor("cap12-half32-b1");
    const cap12B0 = operationFor("cap12-half32-b0");
    const cap12Full32 = operationFor("cap12-full32");
    const capDelta = record(phaseKOf(cap12B1).capOutputDeltaFrom60);
    expect(capDelta).toMatchObject({ fromCapPx: 60, toCapPx: 12, path: "half32-b1" });
    const near = record(phaseKOf(cap12B1).nearRgbaComparisonFromB0);

    for (const entry of [matrix.find((item) => item.label === "cap60-half32-b1")!, matrix.find((item) => item.label === "cap12-half32-b1")!]) {
      const phaseLQuality = record(phaseLOf(entry.operation).qualityMetrics);
      expect(record(phaseLQuality.fallback).depthBoundaryDistanceBands).toBeTruthy();
    }
    const interiorFallback = record(record(record(phaseLOf(cap12B1).qualityMetrics).fallback).interiorCap12Far);
    const selectedFallbackMetrics = record(record(phaseLOf(cap12B1).qualityMetrics).fallback);
    expect(Array.isArray(interiorFallback.sharpFallbackSamples)).toBe(true);
    const phaseLCapDelta = record(phaseLOf(cap12B1).capOutputDeltaFrom60);
    expect(phaseLCapDelta).toMatchObject({ fromCapPx: 60, toCapPx: 12, path: "half32-b1" });
    const phaseLCapInteriorEdge = record(record(phaseLCapDelta.farGather).interiorCap12FarDepthEdge);
    const phaseLCapInteriorEdgeRgb = record(phaseLCapInteriorEdge.rgb);
    expect(number(phaseLCapInteriorEdgeRgb.pixelCount) ?? 0).toBeGreaterThanOrEqual(32);
    expect(number(phaseLCapInteriorEdgeRgb.changedPixelCount) ?? -1).toBeGreaterThanOrEqual(0);
    expect(record(record(phaseLCapDelta.finalComposite).interiorCap12FarDepthEdge)).toBeTruthy();
    const b0ToB1 = record(phaseLOf(cap12B1).b0ToB1Comparison);
    expect(b0ToB1).toMatchObject({ referenceVariant: "Half ×32 B0", candidateVariant: "Half ×32 B1" });
    const b0ToB1Edge = record(record(record(b0ToB1.farGather).interiorCap12FarDepthEdge).rgb);
    b0ToB1EdgeBaseline = {
      changedPixelCount: number(b0ToB1Edge.changedPixelCount),
      rmse: number(b0ToB1Edge.rgbRootMeanSquareError),
    };

    const selectedGeometry = record(selected.geometry);
    const eligibleInteriorPairs = Array.isArray(selectedGeometry.edgePairs)
      ? selectedGeometry.edgePairs.filter((value) => record(value).interiorHighContrastEligible === true).map(record)
      : [];
    expect(eligibleInteriorPairs.length).toBeGreaterThan(0);
    for (const pair of eligibleInteriorPairs) {
      expect(pair).toMatchObject({
        farSideCapPixel: true,
        interiorFarSideCapPixel: true,
        cappedEndpointPresent: true,
        globalHighContrastEligible: true,
        interiorHighContrastEligible: true,
      });
      expect(number(pair.depthDeltaMm) ?? 0).toBeGreaterThanOrEqual(PHASE_L_INTERIOR_TARGETS.edgeDepthDeltaMm);
      expect(number(pair.sourceContrastRgb) ?? 0).toBeGreaterThan(PHASE_L_INTERIOR_TARGETS.minimumSourceContrastRgb);
      const endpoints = [record(pair.a), record(pair.b)];
      expect(endpoints.every((endpoint) => endpoint.valid === true)).toBe(true);
      const farCappedInteriorEndpoint = endpoints.some((endpoint) => endpoint.farCapped === true
        && endpoint.insideInteriorSupport === true
        && (number(endpoint.borderClearancePx) ?? 0) >= PHASE_L_INTERIOR_TARGETS.cappedSupportMarginPx);
      expect(farCappedInteriorEndpoint).toBe(true);
    }

    const metric = (operation: Operation, roi: "interiorCap12Far" | "interiorCap12FarDepthEdge") => {
      const quality = record(record(record(phaseLOf(operation).qualityMetrics).farQuality)[roi]);
      const rgb = record(quality.rgb);
      return {
        rmse: number(rgb.rgbRootMeanSquareError),
        pixelCount: number(rgb.pixelCount),
      };
    };
    const full32Interior = metric(cap12Full32, "interiorCap12Far");
    const full64Interior = metric(cap12Full64, "interiorCap12Far");
    const b0Interior = metric(cap12B0, "interiorCap12Far");
    const b1Interior = metric(cap12B1, "interiorCap12Far");
    const full32Edge = metric(cap12Full32, "interiorCap12FarDepthEdge");
    const full64Edge = metric(cap12Full64, "interiorCap12FarDepthEdge");
    const b0Edge = metric(cap12B0, "interiorCap12FarDepthEdge");
    const b1Edge = metric(cap12B1, "interiorCap12FarDepthEdge");
    const nearRgba = {
      rgbRmse: number(near.rootMeanSquareRgbError),
      rgbMax: number(near.maxRgbError),
      alphaRmse: number(near.rootMeanSquareAlphaError),
      alphaMax: number(near.maxAlphaError),
    };
    const fallbackEvidence = {
      interiorFarFallbackPixels: number(interiorFallback.fallbackPixelCount),
      interiorFarSharpFallbackPixels: number(interiorFallback.sharpFallbackPixelCount),
      sourceRgbMismatchPixels: number(selectedFallbackMetrics.allFallbackSourceRgbMismatchCount),
    };
    const cap12MatrixEntries = matrix.filter((entry) => entry.label.startsWith("cap12-"));
    const expectedReferenceIdentity = String(phaseLOf(cap12Full32).referenceIdentity ?? "");
    const cap12ReferenceFingerprints = record(phaseKOf(cap12Full32).inputFingerprints);
    const matchedNativeProvenance = cap12MatrixEntries.every(({ operation: entryOperation, handle: entryHandle }) => {
      const runtime = entryHandle.runtime;
      const entryIdentity = String(phaseLOf(entryOperation).referenceIdentity ?? "");
      const entryFingerprints = record(phaseKOf(entryOperation).inputFingerprints);
      return runtime?.rendererFamily === "webgpu-renderer"
        && runtime.executionBackend === "webgpu"
        && runtime.applicationFallback === false
        && runtime.threeRevision === "186"
        && entryOperation.state === "completed"
        && entryOperation.resultPublished
        && entryIdentity === expectedReferenceIdentity
        && ["sourceColor", "worldPositionAndDepth", "validity", "physical"].every((key) => entryFingerprints[key] === cap12ReferenceFingerprints[key]);
    });
    qualityDecisionEvidence = evaluatePhaseLQualityDecision({
      candidateQualified: record(selected.geometry).candidateQualified === true,
      matchedNativeProvenance,
      referenceConvergence: { interiorFarRmse: full64Interior.rmse, edgeRmse: full64Edge.rmse },
      b0Quality: { interiorFarRmse: b0Interior.rmse, edgeRmse: b0Edge.rmse },
      b1Quality: { interiorFarRmse: b1Interior.rmse, edgeRmse: b1Edge.rmse },
      roiPopulations: {
        interiorFar: {
          full32: full32Interior.pixelCount,
          full64: full64Interior.pixelCount,
          b0: b0Interior.pixelCount,
          b1: b1Interior.pixelCount,
        },
        edge: {
          full32: full32Edge.pixelCount,
          full64: full64Edge.pixelCount,
          b0: b0Edge.pixelCount,
          b1: b1Edge.pixelCount,
        },
      },
      nearRgba,
      fallbackEvidence,
    });
    decision = qualityDecisionEvidence.outcome;
    const publishedOutcome = { decision, qualityDecisionEvidence };
    await testInfo.attach("phase-l-quality-decision.json", {
      body: Buffer.from(JSON.stringify({ acceptance: PHASE_L_QUALITY_ACCEPTANCE, ...publishedOutcome }, null, 2)),
      contentType: "application/json",
    });
    await writeFile(join(ARTIFACT_DIRECTORY, "phase-l-quality-decision.json"), JSON.stringify({ acceptance: PHASE_L_QUALITY_ACCEPTANCE, ...publishedOutcome }, null, 2));
  }

  handle = await readActiveHandle(page);
  const oldHandleId = handle.instanceId;
  await page.getByText("Navigate away (SPA)").click();
  await expect(page.getByTestId("away-route")).toBeVisible();
  await expect.poll(async () => (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === oldHandleId)?.state, {
    timeout: 120_000,
    intervals: [100, 250, 500, 1000],
  }).toBe("disposed");
  const retiredHandle = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === oldHandleId);
  expect(retiredHandle).toBeTruthy();
  expect(retiredHandle!.resources.length).toBeGreaterThan(0);
  expect(retiredHandle!.resources.every((resource) => resource.state === "disposed" && resource.error === null)).toBe(true);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentTimeOrigin);
  await page.getByText("Return to experiment (SPA)").click();
  await expect(page.getByTestId("phase-l-controls")).toBeVisible();
  const remounted = await waitForActiveHandle(page);
  expect(remounted.instanceId).not.toBe(oldHandleId);
  assertNative(remounted);
  expect(remounted.resources.length).toBeGreaterThan(0);
  expect(remounted.resources.every((resource) => resource.state === "active")).toBe(true);
  await page.getByText("Navigate away (SPA)").click();
  await expect(page.getByTestId("away-route")).toBeVisible();
  await expect.poll(async () => (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === remounted.instanceId)?.state, {
    timeout: 120_000,
    intervals: [100, 250, 500, 1000],
  }).toBe("disposed");
  const retiredRemount = (await readDiagnostics(page)).handles.find((entry) => entry.instanceId === remounted.instanceId);
  expect(retiredRemount).toBeTruthy();
  expect(retiredRemount!.resources.length).toBeGreaterThan(0);
  expect(retiredRemount!.resources.every((resource) => resource.state === "disposed" && resource.error === null)).toBe(true);

  const summary = {
    nativeRuntime: handle.runtime,
    discoveryCandidateCount: candidateResults.length,
    qualifiedCandidateCount: qualifiedCandidates.length,
    candidateSearch: {
      artifact: "candidate-search.json",
      selectedCandidateId: selected?.id ?? null,
      bestUnqualifiedCandidateId: candidateSearchArtifact.bestUnqualifiedCandidateForExplorationOnly,
      rejectionReasons: candidateSearchArtifact.bestUnqualifiedCandidateForExplorationOnly === null
        ? []
        : candidateSearchArtifact.candidates.find((candidate) => candidate.id === candidateSearchArtifact.bestUnqualifiedCandidateForExplorationOnly)?.rejectionReasons ?? [],
    },
    selectedCandidate: {
      id: selected?.id ?? null,
      magnification: selected?.magnification ?? null,
      pan: selected?.pan ?? null,
      inspectionWindow: selected ? record(record(selected.phaseL.selectedCandidateConfiguration).inspectionWindow) : null,
      sampledFilmMm: selected ? record(record(selected.phaseL.selectedCandidateConfiguration).sampledFilmMm) : null,
      geometry: selected?.geometry ?? null,
      surfaceSamples: selected?.phaseL.firstVisibleMacroSurfaceSamples ?? null,
    },
    exploratoryCandidate: selected ? null : exploratoryCandidate ? {
      id: exploratoryCandidate.id,
      magnification: exploratoryCandidate.magnification,
      pan: exploratoryCandidate.pan,
      geometry: exploratoryCandidate.geometry,
      label: "unqualified exploratory candidate; not used for confirmatory quality",
    } : null,
    matrixOperationIds: matrix.map(({ label, operation }) => ({ label, operationId: operation.operationId })),
    qualityMatrixStatus: selected ? "completed" : "not-run-no-qualified-candidate",
    qualityMatrix: qualityValues,
    noCandidateResearchOutcome: noCandidateReport,
    decision,
    qualityAcceptance: PHASE_L_QUALITY_ACCEPTANCE,
    qualityDecisionEvidence,
    lifecycle: {
      retiredHandleId: oldHandleId,
      retiredResourceCount: retiredHandle!.resources.length,
      retiredDisposedResourceCount: retiredHandle!.resources.filter((resource) => resource.state === "disposed").length,
      remountedHandleId: remounted.instanceId,
      remountedDisposedResourceCount: retiredRemount!.resources.filter((resource) => resource.state === "disposed").length,
    },
    limitations: [
      "The matched full-resolution aperture gather is a finite-sample renderer reference, not photographic ground truth.",
      "Single-layer scene depth cannot recover background geometry hidden behind the foreground surface.",
      "The browser evidence is fixture-only and does not establish production router integration or general WebGPU adapter parity.",
    ],
  };
  await testInfo.attach("phase-l-summary.json", { body: Buffer.from(JSON.stringify(summary, null, 2)), contentType: "application/json" });
  await writeFile(join(ARTIFACT_DIRECTORY, "phase-l-summary.json"), JSON.stringify(summary, null, 2));

  expect(qualityDecisionEvidence, "Fixed Phase L native quality evidence must be available").not.toBeNull();
  if (!qualityDecisionEvidence) throw new Error("Fixed Phase L native quality evidence was not produced");
  expect(
    qualityDecisionEvidence.outcome,
    `Fixed Phase L native quality baseline must remain L-A; failed criteria: ${qualityDecisionEvidence.failedCriteria.join(", ")}`,
  ).toBe("L-A");
  expect(qualityDecisionEvidence.failedCriteria).toEqual([]);
  expect(passesPhaseLConfirmatoryAcceptance(qualityDecisionEvidence)).toBe(true);
  expect(b0ToB1EdgeBaseline?.changedPixelCount).toBe(0);
  expect(b0ToB1EdgeBaseline?.rmse).toBe(0);
});

test("ordinary Chromium Phase L route remains an isolated research fixture", async ({ page }) => {
  test.skip(nativeRequired, "Ordinary compatibility control runs separately from native-required validation");
  await page.goto(FIXTURE_PATH);
  const handle = await waitForActiveHandle(page);
  expect(handle.runtime?.threeRevision).toBe(REVISION);
  expect(handle.runtime?.executionBackend).not.toBe("webgpu");
  await expect(page.getByTestId("phase-l-controls")).toBeVisible();
  const publicRoutes = await page.locator("a").allTextContents();
  expect(publicRoutes).toContain("Navigate away (SPA)");
});
