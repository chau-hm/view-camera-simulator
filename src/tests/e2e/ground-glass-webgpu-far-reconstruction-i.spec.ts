import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/ground-glass-webgpu-aperture-gather.html?phaseI=1";
const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";

type JsonRecord = Record<string, unknown>;
type Operation = {
  operationId: string;
  state: string;
  stage: string;
  resultPublished: boolean;
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
  dimensions: JsonRecord | null;
  operations: Operation[];
  pointProbes: Array<{
    id: string;
    gpuDepth: number;
    worldPositionMm: [number, number, number];
    physicalRgba16Float: [number, number, number, number];
    validityCode: number;
  }>;
  unresolvedSample: null | {
    validityCode: number;
    storedFootprint: [number, number, number, number];
  };
  phaseH: unknown;
  phaseI: unknown;
  resources: Array<{ id: string; role: string; allocation: string; state: string; error: string | null }>;
  error: string | null;
  cleanupError: string | null;
  cleanupCompletedAt: number | null;
};
type Diagnostics = { activeHandleId: string | null; handles: Handle[] };

const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const at = (value: unknown, ...keys: string[]) => keys.reduce<unknown>((current, key) => record(current)[key], value);

const diagnostics = async (page: Page): Promise<Diagnostics> => {
  const text = await page.getByTestId("fixture-diagnostics").textContent();
  if (!text) throw new Error("Phase I fixture diagnostics were not published");
  return JSON.parse(text) as Diagnostics;
};

const activeHandle = async (page: Page) => {
  const state = await diagnostics(page);
  const handle = state.handles.find((candidate) => candidate.instanceId === state.activeHandleId);
  if (!handle) throw new Error("Phase I fixture has no active renderer handle");
  return handle;
};

const waitForInitial = async (page: Page) => {
  await expect.poll(async () => {
    const handle = await activeHandle(page).catch(() => null);
    const operation = handle?.operations.at(-1);
    return Boolean(
      handle?.state === "active"
      && operation?.state === "completed"
      && operation.resultPublished
      && handle.phaseH
      && handle.phaseI,
    );
  }, { timeout: 180_000, intervals: [100, 250, 500] }).toBe(true);
  return activeHandle(page);
};

const run = async (page: Page, buttonName: string) => {
  const before = await activeHandle(page);
  const previousCount = before.operations.length;
  const previousOperationId = before.operations.at(-1)?.operationId;
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  await expect.poll(async () => {
    const handle = (await diagnostics(page)).handles.find((candidate) => candidate.instanceId === before.instanceId);
    const operation = handle?.operations.at(-1);
    return Boolean(
      handle?.state === "active"
      && handle.operations.length === previousCount + 1
      && operation?.operationId !== previousOperationId
      && operation?.state === "completed"
      && operation.resultPublished
      && handle.phaseI,
    );
  }, { timeout: 120_000, intervals: [100, 250, 500, 1000] }).toBe(true);
  const handle = (await diagnostics(page)).handles.find((candidate) => candidate.instanceId === before.instanceId);
  if (!handle) throw new Error(`Renderer handle ${before.instanceId} disappeared after ${buttonName}`);
  return { handle, operation: handle.operations.at(-1)! };
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

const assertFiniteSignal = (phaseI: JsonRecord, path: string[]) => {
  const target = at(phaseI, ...path);
  for (const key of ["signalEnergy", "thresholdedSignalEnergy", "normalizedSignalEnergy", "peakSignal", "thresholdClassifiedPixelCount"]) {
    const value = number(record(target)[key]);
    expect(value, `${path.join(".")}.${key} is a measured finite value`).not.toBeNull();
    expect(value!).toBeGreaterThanOrEqual(0);
  }
  expect(record(target).radialProfile).toEqual(expect.any(Array));
  expect(record(target).signalWeightedCovariancePx2).not.toBeUndefined();
};

const attachJson = async (testInfo: TestInfo, name: string, value: unknown) => {
  await mkdir(testInfo.outputDir, { recursive: true });
  const path = testInfo.outputPath(name);
  await writeFile(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: "application/json" });
};

const attachFixtureImages = async (page: Page, testInfo: TestInfo) => {
  const images = await page.evaluate(() => {
    const store = (window as Window & { __groundGlassWebGpuFarReconstructionImages?: Record<string, string> })
      .__groundGlassWebGpuFarReconstructionImages;
    return store ?? {};
  });
  const attached: string[] = [];
  for (const [name, dataUrl] of Object.entries(images)) {
    const encoded = dataUrl.match(/^data:image\/png;base64,(.+)$/)?.[1];
    if (!encoded) continue;
    const path = testInfo.outputPath(`images/${name}.png`);
    await mkdir(testInfo.outputPath("images"), { recursive: true });
    await writeFile(path, Buffer.from(encoded, "base64"));
    await testInfo.attach(`phase-i-${name}`, { path, contentType: "image/png" });
    attached.push(name);
  }
  return attached;
};

test("ordinary Chromium Phase I fixture remains a fallback-only control", async ({ page }) => {
  test.skip(nativeRequired, "Native execution is measured only in headed Chrome");
  await page.goto(FIXTURE_PATH);
  await expect(page.getByTestId("phase-i-controls")).toBeVisible();
  const handle = await waitForInitial(page);
  expect(handle.runtime?.initialized).toBe(true);
  expect(handle.runtime?.threeRevision).toBe("186");
  expect(handle.runtime?.executionBackend).not.toBe("webgpu");
});

test("native Phase I measures matched references, B0/B1/C1 quality, coverage, performance and lifecycle", async ({ page }, testInfo) => {
  test.skip(!nativeRequired, "Native WebGPU evidence requires headed Chrome");
  test.setTimeout(1_200_000);
  await page.goto(FIXTURE_PATH);
  await expect(page.getByTestId("phase-i-controls")).toBeVisible();
  const initial = await waitForInitial(page);
  assertNative(initial);

  const results: Array<{ label: string; operationId: string; phaseI: JsonRecord; phaseH: JsonRecord; dimensions: JsonRecord | null }> = [];
  const physicalFingerprint = (handle: Handle) => handle.pointProbes.map((probe) => ({
    id: probe.id,
    gpuDepth: probe.gpuDepth,
    worldPositionMm: probe.worldPositionMm,
    physicalRgba16Float: probe.physicalRgba16Float,
    validityCode: probe.validityCode,
  }));
  const capture = async (label: string, button: string) => {
    const { handle, operation } = await run(page, button);
    assertNative(handle);
    const phaseI = record(handle.phaseI);
    const phaseH = record(handle.phaseH);
    results.push({ label, operationId: operation.operationId, phaseI, phaseH, dimensions: handle.dimensions });
    return { handle, operation, phaseI, phaseH, physicalFingerprint: physicalFingerprint(handle) };
  };

  // Capture a 16-proposal CPU/GPU reference sensitivity case, then the two matched full-resolution references.
  const full16 = await capture("full-16-CPU-reference-sensitivity", "Phase I full ×16 CPU reference sensitivity");
  expect(at(full16.phaseI, "phaseIC1", "available")).toBe(true);
  expect(number(at(full16.phaseI, "phaseIC1", "nativeGpuVsCpu", "maxRgbError"))).toBeLessThan(0.04);
  expect(number(at(full16.phaseI, "phaseIC1", "nativePathVsCpu", "fallbackMismatch"))).toBe(0);
  expect(number(at(full16.phaseI, "phaseIC1", "nativePathVsCpu", "fallbackReasonMismatch"))).toBe(0);
  const full32 = await capture("full-32-B0", "Phase I full ×32 B0 reference");
  const full64 = await capture("full-64-B0", "Phase I full ×64 B0 reference");
  expect(at(full32.phaseI, "setup", "scene")).toBe("phase-f-controlled");
  expect(at(full32.phaseI, "references", "available", "full32")).toBe(false);
  expect(at(full64.phaseI, "references", "available", "full32")).toBe(true);
  expect(at(full64.phaseI, "references", "available", "full64")).toBe(false);

  // Full-resolution B1/C1 are controls for arbitrary image changes; C1 must passthrough here.
  const full32B1 = await capture("full-32-B1", "Phase I full ×32 B1");
  const full32C1 = await capture("full-32-C1-passthrough", "Phase I full ×32 C1 passthrough");
  const full64B1 = await capture("full-64-B1", "Phase I full ×64 B1");
  const full64C1 = await capture("full-64-C1-passthrough", "Phase I full ×64 C1 passthrough");
  for (const entry of [full32B1, full32C1, full64B1, full64C1]) {
    expect(at(entry.phaseI, "references", "agreement", "full32VsFull64")).not.toBeNull();
  }
  for (const entry of [full32B1, full64B1]) {
    expect(at(entry.phaseI, "phaseHB1", "available")).toBe(true);
    expect(number(at(entry.phaseI, "phaseHB1", "nativeGpuVsCpu", "maxRgbError"))).toBeLessThan(0.04);
  }
  for (const entry of [full32C1, full64C1]) {
    expect(at(entry.phaseI, "phaseIC1", "available")).toBe(true);
    expect(number(at(entry.phaseI, "phaseIC1", "nativeGpuVsCpu", "maxRgbError"))).toBeLessThan(0.04);
    expect(number(at(entry.phaseI, "phaseIC1", "compositeGpuVsCpu", "maxRgbError"))).toBeLessThan(0.04);
    expect(number(at(entry.phaseI, "phaseIC1", "nativePathVsCpu", "fallbackMismatch"))).toBe(0);
    expect(number(at(entry.phaseI, "phaseIC1", "nativePathVsCpu", "fallbackReasonMismatch"))).toBe(0);
  }

  const matrix: Array<{ scale: "half"; count: 16 | 32 | 64; label: string }> = [
    { scale: "half", count: 16, label: "half-16" },
    { scale: "half", count: 32, label: "half-32" },
    { scale: "half", count: 64, label: "half-64" },
  ];
  const b0b1c1 = new Map<string, { b0: JsonRecord; b1: JsonRecord; c1: JsonRecord; phaseH: JsonRecord }>();
  for (const row of matrix) {
    const name = `Phase I half ×${row.count}`;
    const b0Result = await capture(`${row.label}-B0`, `${name} B0`);
    const b1Result = await capture(`${row.label}-B1`, `${name} B1`);
    const c1Result = await capture(`${row.label}-C1`, `${name} C1`);
    const b0 = record(b0Result.phaseI.baselineB0);
    const b1 = record(b1Result.phaseI.phaseHB1);
    const c1 = record(c1Result.phaseI.phaseIC1);
    expect(b1.available).toBe(true);
    expect(c1.available).toBe(true);
    for (const output of [b0, b1, c1]) {
      for (const reference of ["Full32", "Full64"]) {
        const profile = record(output[`radialEnergyProfileAgainst${reference}`]);
        expect(number(profile.binCount)).toBe(24);
        expect(number(profile.meanAbsoluteEnergyShareError)).not.toBeNull();
        expect(number(profile.rootMeanSquareEnergyShareError)).not.toBeNull();
      }
    }
    expect(number(at(b1, "nativeGpuVsCpu", "maxRgbError"))).toBeLessThan(0.04);
    expect(number(at(c1, "nativeGpuVsCpu", "maxRgbError"))).toBeLessThan(0.04);
    expect(number(at(c1, "nativePathVsCpu", "countMismatch"))).toBe(0);
    expect(number(at(c1, "nativePathVsCpu", "fallbackMismatch"))).toBe(0);
    expect(number(at(c1, "nativePathVsCpu", "fallbackReasonMismatch"))).toBe(0);
    expect(number(at(c1, "nativePathVsCpu", "maximumWeightSumError"))).toBeLessThan(0.06);
    expect(number(at(c1, "nearLayerSignature", "rgbaHalfReadbackHash")))
      .toBe(number(at(b0Result.phaseI, "phaseIC1", "nearLayerSignature", "rgbaHalfReadbackHash")));
    expect(number(at(b1Result.phaseI, "phaseIC1", "nearLayerSignature", "rgbaHalfReadbackHash")))
      .toBe(number(at(b0Result.phaseI, "phaseIC1", "nearLayerSignature", "rgbaHalfReadbackHash")));
    expect(b1Result.physicalFingerprint).toEqual(b0Result.physicalFingerprint);
    expect(c1Result.physicalFingerprint).toEqual(b0Result.physicalFingerprint);
    expect(number(at(b0, "leakage", "farRedLeakPixels"))).toBeGreaterThan(0);
    expect(number(at(b1, "leakage", "farRedLeakPixels"))).toBe(0);
    expect(number(at(c1, "leakage", "farRedLeakPixels"))).toBe(0);
    assertFiniteSignal(b0Result.phaseI, ["baselineB0", "farSignal"]);
    assertFiniteSignal(b1Result.phaseI, ["phaseHB1", "farSignal"]);
    assertFiniteSignal(c1Result.phaseI, ["phaseIC1", "farSignal"]);
    const referenceAgreement = record(c1Result.phaseI.references);
    expect(at(referenceAgreement, "available", "full32")).toBe(true);
    expect(at(referenceAgreement, "available", "full64")).toBe(true);
    b0b1c1.set(row.label, { b0, b1, c1, phaseH: b1Result.phaseH });
  }

  const half32B0 = b0b1c1.get("half-32")!.b0;
  const half32B1 = b0b1c1.get("half-32")!.b1;
  const half32C1 = b0b1c1.get("half-32")!.c1;
  const half32Coverage = record(record(results.find((entry) => entry.label === "half-32-B0")!.phaseI).coverageAudit);
  const problematicPixelCount = number(half32Coverage.problematicPixelCount);
  const compatibleNeighborAtLeastOneCount = number(half32Coverage.compatibleNeighborAtLeastOneCount);
  const noCompatibleNeighborCount = number(half32Coverage.noCompatibleNeighborCount);
  expect(problematicPixelCount).not.toBeNull();
  expect(problematicPixelCount!).toBeGreaterThan(0);
  expect(compatibleNeighborAtLeastOneCount).not.toBeNull();
  expect(noCompatibleNeighborCount).not.toBeNull();
  expect(compatibleNeighborAtLeastOneCount! + noCompatibleNeighborCount!).toBe(problematicPixelCount);
  expect(Array.isArray(half32Coverage.records)).toBe(true);

  // Spatial comparison and leakage remain separate; this records, rather than assumes, a winner.
  const qualityAudit = {
    references: {
      full32: full32.phaseI,
      full64: full64.phaseI,
      full32B1: full32B1.phaseI,
      full32C1: full32C1.phaseI,
      full64B1: full64B1.phaseI,
      full64C1: full64C1.phaseI,
    },
    halfMatrix: Object.fromEntries(b0b1c1),
    half32: { b0: half32B0, b1: half32B1, c1: half32C1, coverage: half32Coverage },
  };

  const edgeResults: Array<{ label: string; operationId: string; phaseI: JsonRecord }> = [];
  for (const [label, button] of [
    ["vertical", "Phase I vertical edge C1"],
    ["diagonal", "Phase I diagonal edge C1"],
    ["thin", "Phase I thin foreground C1"],
    ["multiple-far-depths", "Phase I multiple far depths C1"],
    ["tilted-4x-crop", "Phase I tilted 4× crop C1"],
    ["unresolved-exclusion", "Phase I unresolved exclusion C1"],
  ] as const) {
    const { handle, operation, phaseI } = await capture(label, button);
    expect(at(phaseI, "phaseIC1", "available")).toBe(true);
    expect(number(at(phaseI, "phaseIC1", "nativeGpuVsCpu", "maxRgbError"))).toBeLessThan(0.04);
    expect(number(at(phaseI, "phaseIC1", "nativePathVsCpu", "countMismatch"))).toBe(0);
    expect(number(at(phaseI, "phaseIC1", "nativePathVsCpu", "fallbackMismatch"))).toBe(0);
    expect(number(at(phaseI, "phaseIC1", "nativePathVsCpu", "fallbackReasonMismatch"))).toBe(0);
    expect(handle.runtime?.executionBackend).toBe("webgpu");
    if (label === "tilted-4x-crop") {
      expect(number(handle.dimensions?.sampledFilmWidthMm)).toBeCloseTo(9, 5);
      expect(number(handle.dimensions?.sampledFilmHeightMm)).toBeCloseTo(6, 5);
    }
    if (label === "unresolved-exclusion") {
      expect(handle.unresolvedSample?.validityCode).toBe(4);
      expect(handle.unresolvedSample?.storedFootprint).toEqual([0, 0, 0, 0]);
    }
    if (label === "multiple-far-depths") {
      await testInfo.attach("phase-i-multiple-depth-rendered-composite.png", {
        body: await page.locator('canvas[aria-label="Native WebGPU aperture gather composite"]').screenshot(),
        contentType: "image/png",
      });
      await attachJson(testInfo, "phase-i-multiple-depth-audit.json", at(phaseI, "surfaceDepthAudit"));
      expect(number(at(phaseI, "surfaceDepthAudit", "secondFarSurfacePixelCount"))).toBeGreaterThan(0);
      expect(number(at(phaseI, "surfaceDepthAudit", "validSecondFarSurfacePixelCount"))).toBeGreaterThan(0);
      expect(number(at(phaseI, "surfaceDepthAudit", "distinctRoundedFarDepthCount"))).toBeGreaterThanOrEqual(2);
      expect(number(at(phaseI, "surfaceDepthAudit", "incompatibleFarNeighborObservationCount"))).toBeGreaterThan(0);
    }
    edgeResults.push({ label, operationId: operation.operationId, phaseI });
  }

  // Balanced serial operation order: two warmups, then five samples per variant.
  const variants = [
    { key: "B0", button: "Phase I half ×32 B0" },
    { key: "B1", button: "Phase I half ×32 B1" },
    { key: "C1", button: "Phase I half ×32 C1" },
  ] as const;
  const order = [
    ["B0", "B1", "C1"], ["B1", "C1", "B0"], ["C1", "B0", "B1"],
    ["C1", "B1", "B0"], ["B0", "C1", "B1"], ["B1", "B0", "C1"], ["B0", "B1", "C1"],
  ].flat();
  const timings: Array<{ variant: string; warmup: boolean; operationId: string; timing: JsonRecord }> = [];
  const counts: Record<string, number> = { B0: 0, B1: 0, C1: 0 };
  for (const variantKey of order) {
    const variant = variants.find((entry) => entry.key === variantKey)!;
    const { operation } = await run(page, variant.button);
    const timing = record(operation.timing);
    expect(number(timing.operationWallTimeMs)).not.toBeNull();
    timings.push({ variant: variantKey, warmup: counts[variantKey]! < 2, operationId: operation.operationId, timing });
    counts[variantKey] = counts[variantKey]! + 1;
  }
  expect(counts).toEqual({ B0: 7, B1: 7, C1: 7 });

  const imageNames = await attachFixtureImages(page, testInfo);
  await attachJson(testInfo, "phase-i-reference-audit.json", qualityAudit);
  await attachJson(testInfo, "phase-i-edge-and-depth-cases.json", edgeResults);
  await attachJson(testInfo, "phase-i-timing.json", timings);

  // The same fixture route unmounts the exact renderer host; return creates an independent native handle.
  const oldId = (await activeHandle(page)).instanceId;
  await page.getByRole("link", { name: "Navigate away (SPA)" }).click();
  await expect(page.getByTestId("away-route")).toBeVisible();
  await expect.poll(async () => (await diagnostics(page)).handles.find((entry) => entry.instanceId === oldId)?.state)
    .toBe("disposed");
  const oldHandle = (await diagnostics(page)).handles.find((entry) => entry.instanceId === oldId)!;
  expect(oldHandle.resources.length).toBeGreaterThan(0);
  expect(oldHandle.resources.every((resource) => resource.state === "disposed")).toBe(true);
  expect(oldHandle.cleanupError).toBeNull();
  await page.getByRole("link", { name: "Return to experiment (SPA)" }).click();
  await expect(page.getByTestId("phase-i-controls")).toBeVisible();
  const remounted = await waitForInitial(page);
  expect(remounted.instanceId).not.toBe(oldId);
  assertNative(remounted);
  const remountC1 = await capture("remount-half32-C1", "Phase I half ×32 C1");
  expect(number(at(remountC1.phaseI, "phaseIC1", "nativeGpuVsCpu", "maxRgbError"))).toBeLessThan(0.04);
  await page.getByRole("link", { name: "Navigate away (SPA)" }).click();
  await expect.poll(async () => (await diagnostics(page)).handles.find((entry) => entry.instanceId === remounted.instanceId)?.state)
    .toBe("disposed");

  await attachJson(testInfo, "phase-i-lifecycle.json", {
    oldHandleId: oldId,
    firstCleanup: oldHandle.resources,
    remountedHandleId: remounted.instanceId,
    remountOperationId: remountC1.operation.operationId,
    remountRuntime: remounted.runtime,
    remountCleanup: (await diagnostics(page)).handles.find((entry) => entry.instanceId === remounted.instanceId),
  });
  await attachJson(testInfo, "phase-i-run-summary.json", {
    nativeRuntime: initial.runtime,
    referenceOperationIds: {
      full32: full32.operation.operationId,
      full64: full64.operation.operationId,
    },
    matrix: results.map(({ label, operationId, phaseI, dimensions }) => ({ label, operationId, dimensions, phaseI })),
    qualityAudit,
    timingSummary: timings,
    edgeResults,
    imageNames,
  });
});
