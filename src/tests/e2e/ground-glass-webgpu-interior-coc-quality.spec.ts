import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { PHASE_L_CANDIDATES } from "./fixtures/ground-glass-webgpu-interior-coc-cases";

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
    number(counts.highContrastFarDepthEdgePairs) ?? 0,
    number(counts.uncappedReferenceClearCapPixels) ?? 0,
  ];
};

const compareScore = (left: readonly number[], right: readonly number[]) => {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (right[index] ?? 0) - (left[index] ?? 0);
    if (delta) return delta;
  }
  return 0;
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

  const sortedCandidates = [...candidateResults].sort((a, b) => compareScore(a.score, b.score));
  const qualifiedCandidates = sortedCandidates.filter((entry) => record(entry.geometry).candidateQualified === true);
  const selected = qualifiedCandidates[0] ?? sortedCandidates[0]!;
  await testInfo.attach("candidate-search.json", {
    body: Buffer.from(JSON.stringify({
      predeclaredCriteria: record(candidateResults[0]!.geometry.thresholds),
      candidates: sortedCandidates.map((entry) => ({
        id: entry.id,
        magnification: entry.magnification,
        pan: entry.pan,
        score: entry.score,
        qualified: record(entry.geometry).candidateQualified,
        inspectionWindow: record(record(entry.phaseL.selectedCandidateConfiguration).inspectionWindow),
        sampledFilmMm: record(record(entry.phaseL.selectedCandidateConfiguration).sampledFilmMm),
        counts: record(entry.geometry.counts),
        borderClearance: record(entry.geometry.borderClearance),
        largestInteriorCapComponent: entry.geometry.largestInteriorCapComponent,
        surfaceSamples: entry.phaseL.firstVisibleMacroSurfaceSamples,
      })),
      selectedForConfirmation: selected.id,
      selectionPolicy: "Lexicographic geometry score: interior cap pixels, largest interior 4-connected component, interior cap/far edge pixels, high-contrast cap/far edge pairs, then local uncapped-reference-clear cap pixels. B0/B1 quality is not evaluated or consulted.",
    }, null, 2)),
    contentType: "application/json",
  });
  await mkdir(ARTIFACT_DIRECTORY, { recursive: true });
  await writeFile(join(ARTIFACT_DIRECTORY, "candidate-search.json"), JSON.stringify({ candidates: candidateResults, selected: selected.id }, null, 2));
  await attachImages(page, testInfo, "macro-focus-middle-f5.6-");

  const matrix: Array<{ label: string; operation: Operation; handle: Handle }> = [];
  let decision: "L-A" | "L-B" | "L-C" | "L-D" | "L-E" = "L-D";
  if (qualifiedCandidates.length > 0) {
    await page.getByTestId("phase-l-selected-candidate").selectOption(selected.id);
    const sequence = [
      ["cap60-full32", "phase-l-cap60-full32"],
      ["cap60-full64", "phase-l-cap60-full64"],
      ["cap60-half32-b0", "phase-l-cap60-half32-b0"],
      ["cap60-half32-b1", "phase-l-cap60-half32-b1"],
      ["cap12-full32", "phase-l-cap12-full32"],
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
    const reference = matrix[0]!.operation;
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
      expect(phaseL.qualityMetrics, `${entry.label} independent Phase L metrics`).not.toBeNull();
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
    const convergence = record(phaseKOf(matrix[1]!.operation).full32VsFull64Agreement);
    expect(number(convergence.pixelCount)).toBe(512 * 384);
    for (const entry of [matrix[3]!, matrix[6]!]) {
      const quality = record(phaseKOf(entry.operation).largeCocFarQuality);
      expect(number(record(quality.validFarRgbError).pixelCount) ?? 0).toBeGreaterThan(0);
    }
    const capDelta = record(phaseKOf(matrix[6]!.operation).capOutputDeltaFrom60);
    expect(capDelta).toMatchObject({ fromCapPx: 60, toCapPx: 12, path: "half32-b1" });
    const near = record(phaseKOf(matrix[6]!.operation).nearRgbaComparisonFromB0);
    expect(number(near.rootMeanSquareRgbError) ?? Infinity).toBeLessThanOrEqual(0.0001);
    expect(number(near.rootMeanSquareAlphaError) ?? Infinity).toBeLessThanOrEqual(0.0001);
    expect(number(near.maxRgbError) ?? Infinity).toBeLessThanOrEqual(0.0001);
    expect(number(near.maxAlphaError) ?? Infinity).toBeLessThanOrEqual(0.0001);

    const full64PhaseL = record(phaseLOf(matrix[1]!.operation).qualityMetrics);
    const full64Convergence = record(full64PhaseL.farQuality);
    expect(number(record(record(full64Convergence.interiorCap12Far).rgb).pixelCount) ?? 0).toBeGreaterThan(0);
    expect(number(record(record(full64Convergence.interiorCap12FarDepthEdge).rgb).pixelCount) ?? 0).toBeGreaterThan(0);
    for (const entry of [matrix[3]!, matrix[6]!]) {
      const phaseLQuality = record(phaseLOf(entry.operation).qualityMetrics);
      const interiorFarEdge = record(record(record(phaseLQuality.farQuality).interiorCap12FarDepthEdge).rgb);
      expect(number(interiorFarEdge.pixelCount) ?? 0, `${entry.label} interior cap/far edge population`).toBeGreaterThanOrEqual(32);
      expect(number(interiorFarEdge.rgbRootMeanSquareError), `${entry.label} interior cap/far edge RMSE`).not.toBeNull();
      expect(record(phaseLQuality.fallback).depthBoundaryDistanceBands).toBeTruthy();
    }
    const interiorFallback = record(record(record(phaseLOf(matrix[6]!.operation).qualityMetrics).fallback).interiorCap12Far);
    expect(number(interiorFallback.fallbackPixelCount) ?? -1).toBeGreaterThanOrEqual(0);
    const selectedFallbackMetrics = record(record(phaseLOf(matrix[6]!.operation).qualityMetrics).fallback);
    expect(number(selectedFallbackMetrics.allFallbackSourceRgbMismatchCount) ?? Infinity).toBe(0);
    expect(Array.isArray(interiorFallback.sharpFallbackSamples)).toBe(true);
    const phaseLCapDelta = record(phaseLOf(matrix[6]!.operation).capOutputDeltaFrom60);
    expect(phaseLCapDelta).toMatchObject({ fromCapPx: 60, toCapPx: 12, path: "half32-b1" });
    const phaseLCapInteriorEdge = record(record(phaseLCapDelta.farGather).interiorCap12FarDepthEdge);
    const phaseLCapInteriorEdgeRgb = record(phaseLCapInteriorEdge.rgb);
    expect(number(phaseLCapInteriorEdgeRgb.pixelCount) ?? 0).toBeGreaterThanOrEqual(32);
    expect(number(phaseLCapInteriorEdgeRgb.changedPixelCount) ?? -1).toBeGreaterThanOrEqual(0);
    expect(record(record(phaseLCapDelta.finalComposite).interiorCap12FarDepthEdge)).toBeTruthy();
    const b0ToB1 = record(phaseLOf(matrix[6]!.operation).b0ToB1Comparison);
    expect(b0ToB1).toMatchObject({ referenceVariant: "Half ×32 B0", candidateVariant: "Half ×32 B1" });
    const b0ToB1Edge = record(record(record(b0ToB1.farGather).interiorCap12FarDepthEdge).rgb);
    expect(number(b0ToB1Edge.pixelCount) ?? 0).toBeGreaterThanOrEqual(32);
    expect(number(b0ToB1Edge.changedPixelCount)).toBe(0);
    expect(number(b0ToB1Edge.rgbRootMeanSquareError)).toBe(0);
    expect(number(interiorFallback.fallbackPixelCount)).toBe(0);
    expect(number(interiorFallback.sharpFallbackPixelCount)).toBe(0);

    const qualityValues = matrix.map((entry) => ({
      label: entry.label,
      operationId: entry.operation.operationId,
      operationWallTimeMs: record(entry.operation.timing).operationWallTimeMs,
      readbackWallTimeMs: record(entry.operation.timing).readbackWallTimeMs,
      stageTiming: record(entry.operation.timing).stages,
      phaseK: phaseKOf(entry.operation),
      phaseL: phaseLOf(entry.operation),
    }));
    await testInfo.attach("selected-state-quality-and-resource-evidence.json", {
      body: Buffer.from(JSON.stringify({ selected, matrix: qualityValues }, null, 2)),
      contentType: "application/json",
    });
    await writeFile(join(ARTIFACT_DIRECTORY, "selected-state-quality-and-resource-evidence.json"), JSON.stringify({ selected, matrix: qualityValues }, null, 2));
    await attachImages(page, testInfo, "macro-focus-middle-f5.6-");
    // Bounded L-A outcome: the qualified interior cap/far-edge ROI is reference-close,
    // B1 is identical to B0 there, and this ROI contains no source-color or sharp fallback.
    // This does not assert a general B1 advantage or extend beyond the selected state.
    decision = "L-A";
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
    selectedCandidate: {
      id: selected.id,
      magnification: selected.magnification,
      pan: selected.pan,
      inspectionWindow: record(record(selected.phaseL.selectedCandidateConfiguration).inspectionWindow),
      sampledFilmMm: record(record(selected.phaseL.selectedCandidateConfiguration).sampledFilmMm),
      geometry: selected.geometry,
      surfaceSamples: selected.phaseL.firstVisibleMacroSurfaceSamples,
    },
    matrixOperationIds: matrix.map(({ label, operation }) => ({ label, operationId: operation.operationId })),
    decision,
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
});

test("ordinary Chromium Phase L route remains an isolated research fixture", async ({ page }) => {
  test.skip(nativeRequired, "Ordinary compatibility control runs separately from native-required validation");
  await page.goto(FIXTURE_PATH);
  const handle = await waitForActiveHandle(page);
  expect(handle.runtime?.threeRevision).toBe("186");
  await expect(page.getByTestId("phase-l-controls")).toBeVisible();
  const publicRoutes = await page.locator("a").allTextContents();
  expect(publicRoutes).toContain("Navigate away (SPA)");
});
