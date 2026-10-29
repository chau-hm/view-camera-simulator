import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import {
  GROUND_GLASS_M6C_ALPHA_MATRIX,
  createGroundGlassM6bCalibrationSource,
} from "../../render/groundGlassPhysicalOverlayConformance";
import {
  GROUND_GLASS_M6C_ALPHA_GATE_REVISION,
  evaluateGroundGlassM6cAlphaConformance,
  type GroundGlassM6cAlphaConformanceResult,
} from "../../render/groundGlassM6cAlphaConformance";
import type {
  GroundGlassM6bPresentationFixtureEvidence,
  GroundGlassM6bPresentationEffectOverrides,
  GroundGlassM6cAlphaCaptureReadback,
} from "../../render/webgpu/groundGlassWebGpuTestSeam";
import { mapGroundGlassInspectionWindowToRttSourceCrop } from "../../render/groundGlassInspectionWindow";
import { readFreshElementBounds } from "./helpers/groundGlass";

const nativeWebGpuRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const m6PresentationRequired = process.env.GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED === "1";

const paneFor = (page: Page) => page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
const pilotFor = (page: Page) => page.getByTestId("ground-glass-webgpu-pilot");
const stageFor = (page: Page) => page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");

const waitForCurrentFrame = async (page: Page): Promise<void> => {
  const pane = paneFor(page);
  await expect.poll(async () => {
    const requestId = await pane.getAttribute("data-frame-request-id");
    return Boolean(requestId && requestId === await pane.getAttribute("data-last-completed-request-id") &&
      await pane.getAttribute("data-frame-result-status") === "completed");
  }, { timeout: 150_000 }).toBe(true);
};

const attachJson = async (testInfo: TestInfo, name: string, value: unknown): Promise<void> => {
  const path = testInfo.outputPath(name);
  await writeFile(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: "application/json" });
};

const captureAlpha = async (page: Page, token: string): Promise<GroundGlassM6cAlphaCaptureReadback> => {
  await page.evaluate((captureToken) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.m6cAlphaFixture?.enabled || !control.requestM6cAlphaCapture) {
      throw new Error("M6C alpha capture control was not installed by the authorized test seam");
    }
    control.m6cAlphaCaptureReadback = null;
    control.m6cAlphaCaptureRequest = { token: captureToken };
    control.requestM6cAlphaCapture();
  }, token);
  await expect.poll(async () => page.evaluate((captureToken) => {
    const readback = window.__groundGlassWebGpuM3TestControl?.m6cAlphaCaptureReadback;
    return readback?.token === captureToken ? readback.status : null;
  }, token), { timeout: 60_000 }).not.toBeNull();
  const readback = await page.evaluate((captureToken) => {
    const result = window.__groundGlassWebGpuM3TestControl?.m6cAlphaCaptureReadback;
    if (!result || result.token !== captureToken) throw new Error("M6C alpha capture result was replaced before collection");
    return result;
  }, token);
  return readback;
};

const evaluateReadback = (readback: GroundGlassM6cAlphaCaptureReadback): GroundGlassM6cAlphaConformanceResult =>
  evaluateGroundGlassM6cAlphaConformance({
    status: readback.status,
    identityCurrent: readback.status === "measured",
    expectedSampleIds: GROUND_GLASS_M6C_ALPHA_MATRIX.map(({ id }) => id),
    samples: readback.samples,
    expectedStoredAlpha: () => readback.material?.transparent === false && readback.material.opacity === 1 &&
      readback.material.blending === "normal" && readback.material.alphaTest === 0 &&
      readback.material.premultipliedAlpha === false ? 1 : Number.NaN,
  });

const setEffectOverrides = async (
  page: Page,
  effectOverrides: GroundGlassM6bPresentationEffectOverrides | undefined,
): Promise<void> => page.evaluate((overrides) => {
  const fixture = window.__groundGlassWebGpuM3TestControl?.m6bCalibrationFixture;
  if (!fixture?.enabled) throw new Error("M6B/M6C calibration fixture control disappeared");
  fixture.presentationState = "neutral";
  fixture.effectOverrides = overrides;
  fixture.presentationEvidence = null;
}, effectOverrides);

test("native M6C captures actual presentation alpha across effects, orientation, crop and resize", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired || !m6PresentationRequired,
    "Requires chrome-native-webgpu and trusted M6 development build flags");
  test.setTimeout(600_000);
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {
      m6bCalibrationFixture: { enabled: true, presentationState: "neutral" },
      m6cAlphaFixture: { enabled: true, targetAllocationCount: 0, targetDisposalCount: 0 },
    };
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise");
  await page.getByLabel("Render quality").selectOption("low");

  const pane = paneFor(page);
  const pilot = pilotFor(page);
  const stage = stageFor(page);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 150_000 });
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilot).toHaveAttribute("data-internal-fallback", "none");
  await expect(pilot).toHaveAttribute("data-presentation-source", "m6b-calibration-fixture");
  await waitForCurrentFrame(page);

  const captures: Array<Readonly<{
    id: string;
    readback: GroundGlassM6cAlphaCaptureReadback;
    decision: GroundGlassM6cAlphaConformanceResult;
    presentationEvidence: GroundGlassM6bPresentationFixtureEvidence;
  }>> = [];
  const allocationBeforeCapture = await page.evaluate(() => {
    const fixture = window.__groundGlassWebGpuM3TestControl?.m6cAlphaFixture;
    return {
      allocations: fixture?.targetAllocationCount ?? 0,
      disposals: fixture?.targetDisposalCount ?? 0,
    };
  });
  expect(allocationBeforeCapture).toEqual({ allocations: 0, disposals: 0 });
  const runCase = async (id: string) => {
    const readback = await captureAlpha(page, id);
    const decision = evaluateReadback(readback);
    const presentationEvidence = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.m6bCalibrationFixture?.presentationEvidence ?? null) as
      GroundGlassM6bPresentationFixtureEvidence | null;
    expect(presentationEvidence).not.toBeNull();
    const expectedSource = createGroundGlassM6bCalibrationSource({
      inspectionWindow: mapGroundGlassInspectionWindowToRttSourceCrop(
        presentationEvidence!.sourceCrop,
        readback.identity?.previewMode ?? "upright",
      ),
      previewMode: readback.identity?.previewMode ?? "upright",
      includeAlphaMatrix: true,
    });
    const expectedAlphaById = new Map(expectedSource.alphaSamples.map((sample) => [sample.id, sample.linearRgba[3]]));
    expect(presentationEvidence!.requestId).toBe(readback.identity?.requestId);
    expect(presentationEvidence!.channelId).toBe(readback.identity?.channelId);
    expect(presentationEvidence!.sceneId).toBe(readback.identity?.sceneId);
    expect(presentationEvidence!.rendererGenerationId).toBe(readback.identity?.rendererGenerationId);
    expect(presentationEvidence!.sourceDataFingerprint).toBe(readback.identity?.sourceDataFingerprint);
    expect(presentationEvidence!.presentationStateFingerprint).toBe(readback.identity?.presentationStateFingerprint);
    expect(readback.material?.uuid).toBe(presentationEvidence!.presentationMaterialUuid);
    const item = { id, readback, decision, presentationEvidence: presentationEvidence! };
    captures.push(item);
    await attachJson(testInfo, `${id}-alpha-readback.json`, item);
    expect(readback.status, readback.failureReason ?? id).toBe("measured");
    expect(readback.rendererRevision).toBe("186");
    expect(readback.rendererFamily).toBe("webgpu-renderer");
    expect(readback.actualExecutionApi).toBe("webgpu");
    expect(readback.internalFallback).toBe("none");
    expect(readback.applicationFallback).toBe(false);
    expect(readback.source?.format).toBe("rgba32float");
    expect(readback.source?.colorSpace).toBe("no-color-space");
    expect(readback.source?.sampling).toBe("nearest");
    expect(readback.source?.sourceDataFingerprint).toBe(expectedSource.sourceFingerprint);
    expect(readback.target?.format).toBe("rgba8unorm");
    expect(readback.target?.colorSpace).toBe("no-color-space");
    expect(readback.target?.channelOrder).toBe("rgba");
    expect(readback.target?.clearRgba).toEqual([0, 0, 0, 0]);
    const target = readback.target;
    expect(target).not.toBeNull();
    if (!target) throw new Error("M6C target storage evidence was not recorded");
    expect(target.estimatedBytes).toBe(target.widthPx * target.heightPx * 4);
    const expectedReadbackRows = new Set(readback.samples.map((sample) =>
      Math.floor(sample.displayUvTopOrigin.v * target.heightPx),
    )).size;
    expect(target.readbackBytes).toBe(expectedReadbackRows * target.widthPx * 4);
    expect(target.readbackBytes).toBeLessThan(target.estimatedBytes);
    expect(readback.rendererOutputColorSpace).toBe("srgb");
    expect(readback.rendererToneMapping).toBe(0);
    expect(readback.material).toMatchObject({
      transparent: false,
      opacity: 1,
      blending: "normal",
      depthWrite: true,
      depthTest: true,
      colorWrite: true,
      alphaTest: 0,
      premultipliedAlpha: false,
      samePresentationMaterialInstance: true,
    });
    expect(readback.samples).toHaveLength(GROUND_GLASS_M6C_ALPHA_MATRIX.length);
    expect(readback.samples.every((sample) => sample.sourceSampleIdentityMatches && sample.materialEquivalent)).toBe(true);
    for (const sample of readback.samples) {
      expect(sample.sourceLinearRgba[3]).toBe(expectedAlphaById.get(sample.id));
    }
    expect(decision.status).toBe("failed");
    expect(decision.alphaDecision).toBe("alpha-observable-contract-different");
    expect(decision.rgbDecision).toBe("rgb-regression-passed");
    expect(decision.maximumAlphaError).toBeLessThanOrEqual(2 / 255);
    expect(decision.alphaRmse).toBeLessThanOrEqual(2 / 255);
    expect(decision.maximumSourceAlphaPreservationError).toBeGreaterThan(2 / 255);
    expect(decision.sourceAlphaPreservationRmse).toBeGreaterThan(2 / 255);
    expect(decision.failedConditions).toContain("material-alpha-output-contract-differs-from-source");
    expect(decision.maximumRgbError).toBeLessThanOrEqual(4 / 255);
    expect(decision.supportedSampleCount).toBe(GROUND_GLASS_M6C_ALPHA_MATRIX.length);
    expect(decision.unavailableSampleCount).toBe(0);
    expect(readback.resourceAccounting.targetAllocated).toBe(true);
    expect(readback.resourceAccounting.targetDisposed).toBe(true);
    expect(readback.resourceAccounting.allocationCount).toBe(captures.length);
    expect(readback.resourceAccounting.disposalCount).toBe(captures.length);
    expect(readback.resourceAccounting.previousRenderTargetRestored).toBe(true);
    expect(readback.resourceAccounting.disposalOutcome).toBe("confirmed");
    if (presentationEvidence && readback.identity) {
      expect(presentationEvidence.presentationStateFingerprint).toBe(readback.identity.presentationStateFingerprint);
    }
    return item;
  };

  const neutral = await runCase("m6c-neutral-raw");
  const sourceAlphaById = new Map(neutral.decision.samples.map((sample) => [sample.id, sample.expectedFragmentAlpha]));
  expect(neutral.readback.samples.map((sample) => sample.id)).toEqual(GROUND_GLASS_M6C_ALPHA_MATRIX.map(({ id }) => id));
  for (const sample of neutral.decision.samples) {
    expect(sample.expectedFragmentAlpha).toBe(sample.sourceLinearRgba[3]);
    expect(sample.expectedStoredTargetAlpha).toBe(1);
    expect(sample.actualGpuTargetAlpha).toBe(1);
    expect(sample.sourceAlphaPreservationError).toBe(Math.abs(1 - sample.sourceLinearRgba[3]));
  }
  const canvasAlphaMode = await pilot.locator("canvas").evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement & { getContext(type: "webgpu"): { getConfiguration?: () => { alphaMode?: string } } | null })
      .getContext("webgpu");
    return context?.getConfiguration?.().alphaMode ?? null;
  });
  expect(canvasAlphaMode).toBe("opaque");
  const browserUserAgent = await page.evaluate(() => navigator.userAgent);
  expect(browserUserAgent).toContain("Chrome/");

  const effectCases: readonly Readonly<{
    id: string;
    overrides?: GroundGlassM6bPresentationEffectOverrides;
    expectedRgbChange: boolean;
  }>[] = [
    { id: "m6c-throughput-half", overrides: { throughputGain: 0.5 }, expectedRgbChange: true },
    { id: "m6c-throughput-above-one", overrides: { throughputGain: 1.25 }, expectedRgbChange: true },
    { id: "m6c-natural-cos4", overrides: { naturalIllumination: {
      enabled: true, geometry: { kind: "parallel-cos4", imageDistanceMm: 150, opticalAxisOffsetXMm: 0, opticalAxisOffsetYMm: 0 },
    } }, expectedRgbChange: true },
    { id: "m6c-circle-centered", overrides: { coverage: {
      active: true, edgeFeatherMm: 8, geometry: { kind: "parallel-circle", radiusMm: 40, opticalAxisOffsetXMm: 0, opticalAxisOffsetYMm: 0 },
    } }, expectedRgbChange: true },
    { id: "m6c-circle-shifted", overrides: { coverage: {
      active: true, edgeFeatherMm: 8, geometry: { kind: "parallel-circle", radiusMm: 43, opticalAxisOffsetXMm: 20, opticalAxisOffsetYMm: -12 },
    } }, expectedRgbChange: true },
    { id: "m6c-conic-coverage", overrides: { coverage: {
      active: true, edgeFeatherMm: 8,
      geometry: { kind: "nonparallel-conic", quadratic: { a: 1 / (45 * 45), b: 0, c: 1 / (35 * 35), d: 0, e: 0, f: -1 }, axial: { x: 0, y: 0, constant: 1 } },
    } }, expectedRgbChange: true },
    { id: "m6c-combined-effects", overrides: {
      throughputGain: 0.55,
      naturalIllumination: { enabled: true, geometry: { kind: "parallel-cos4", imageDistanceMm: 150, opticalAxisOffsetXMm: 12, opticalAxisOffsetYMm: -8 } },
      coverage: { active: true, edgeFeatherMm: 8, geometry: { kind: "parallel-circle", radiusMm: 48, opticalAxisOffsetXMm: 15, opticalAxisOffsetYMm: -8 } },
    }, expectedRgbChange: true },
  ];
  for (const effectCase of effectCases) {
    await setEffectOverrides(page, effectCase.overrides);
    const result = await runCase(effectCase.id);
    const state = result.presentationEvidence.presentationState;
    expect(state.throughputGain).toBe(effectCase.overrides?.throughputGain ?? 1);
    if (effectCase.overrides?.naturalIllumination) {
      expect(state.naturalIllumination.enabled).toBe(effectCase.overrides.naturalIllumination.enabled);
      expect(state.naturalIllumination.geometry?.kind).toBe(effectCase.overrides.naturalIllumination.geometry?.kind);
    }
    if (effectCase.overrides?.coverage) {
      expect(state.coverage.active).toBe(effectCase.overrides.coverage.active);
      expect(state.coverage.geometry?.kind).toBe(effectCase.overrides.coverage.geometry?.kind);
    }
    expect(result.decision.samples.every((sample) =>
      sample.expectedFragmentAlpha === (sourceAlphaById.get(sample.id) ?? Number.NaN) &&
      sample.expectedStoredTargetAlpha === 1 && sample.actualGpuTargetAlpha === 1,
    )).toBe(true);
    if (effectCase.expectedRgbChange) {
      const neutralRgbById = new Map(neutral.decision.samples.map((sample) => [sample.id, sample.actualGpuRgb]));
      expect(result.decision.samples.some((sample) => {
        const neutralRgb = neutralRgbById.get(sample.id);
        return neutralRgb?.some((channel, index) => channel !== sample.actualGpuRgb[index]);
      }), `${effectCase.id} must change measured GPU RGB`).toBe(true);
    }
  }

  await setEffectOverrides(page, undefined);
  await page.getByRole("radio", { name: "Upright Assist", exact: true }).check();
  await waitForCurrentFrame(page);
  const upright = await runCase("m6c-upright");
  expect(upright.readback.identity?.previewMode).toBe("upright");
  await page.getByRole("radio", { name: "Raw Ground Glass", exact: true }).check();
  await waitForCurrentFrame(page);
  const raw = await runCase("m6c-raw-round-trip");
  expect(raw.readback.identity?.previewMode).toBe("raw");

  await page.getByRole("button", { name: "Focus loupe · 4× Ground Glass view", exact: true }).click();
  await expect(stage).toHaveAttribute("data-focus-loupe-active", "true");
  await waitForCurrentFrame(page);
  const centeredLoupe = await runCase("m6c-loupe-centered");
  expect(centeredLoupe.readback.identity?.inspectionWindow.active).toBe(true);
  const bounds = await readFreshElementBounds(stage);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.62, bounds.y + bounds.height * 0.58, { steps: 6 });
  await page.mouse.up();
  await waitForCurrentFrame(page);
  const pannedLoupe = await runCase("m6c-loupe-panned");
  expect(pannedLoupe.readback.identity?.inspectionWindow.centerU).not.toBe(centeredLoupe.readback.identity?.inspectionWindow.centerU);

  const sizeBefore = centeredLoupe.readback.identity && {
    widthPx: centeredLoupe.readback.identity.targetWidthPx,
    heightPx: centeredLoupe.readback.identity.targetHeightPx,
  };
  await page.getByLabel("Render quality").selectOption("standard");
  await waitForCurrentFrame(page);
  const resized = await runCase("m6c-resized-target");
  expect(resized.readback.identity && sizeBefore && (
    resized.readback.identity.targetWidthPx !== sizeBefore.widthPx ||
    resized.readback.identity.targetHeightPx !== sizeBefore.heightPx
  )).toBe(true);
  expect(captures).toHaveLength(13);
  const finalResourceAccounting = await page.evaluate(() => {
    const fixture = window.__groundGlassWebGpuM3TestControl?.m6cAlphaFixture;
    return {
      allocations: fixture?.targetAllocationCount ?? 0,
      disposals: fixture?.targetDisposalCount ?? 0,
    };
  });
  expect(finalResourceAccounting).toEqual({ allocations: captures.length, disposals: captures.length });

  await attachJson(testInfo, "m6c-alpha-conformance-report-fragment.json", {
    evaluatorRevision: GROUND_GLASS_M6C_ALPHA_GATE_REVISION,
    sourceAlphaMatrix: GROUND_GLASS_M6C_ALPHA_MATRIX,
    browserUserAgent,
    captureIds: captures.map(({ id }) => id),
    captures,
    resourceAccounting: {
      ...finalResourceAccounting,
      normalFrameAllocationsBeforeCapture: allocationBeforeCapture.allocations,
    },
    visibleCanvas: { alphaMode: canvasAlphaMode, remainsOpaque: true },
    m6bPhysicalOverlayEvidence: "retained separately by the M6B native regression",
    qualityDecision: "quality-unqualified",
  });
  await expect(pilot).toHaveAttribute("data-actual-execution-api", "webgpu");
});

test("native M6C rejects a held alpha result after the accepted request changes", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired || !m6PresentationRequired,
    "Requires chrome-native-webgpu and trusted M6 development build flags");
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {
      m6bCalibrationFixture: { enabled: true, presentationState: "neutral" },
      m6cAlphaFixture: { enabled: true, holdReadback: true },
    };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/simulator/free/architecture-rise");
  const pane = paneFor(page);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 150_000 });
  await waitForCurrentFrame(page);
  const initialRequestId = await pane.getAttribute("data-frame-request-id");
  const token = "m6c-stale-after-preview-change";
  await page.evaluate((captureToken) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.m6cAlphaFixture || !control.requestM6cAlphaCapture) throw new Error("M6C stale-capture seam unavailable");
    control.m6cAlphaCaptureReadback = null;
    control.m6cAlphaCaptureRequest = { token: captureToken };
    control.requestM6cAlphaCapture();
  }, token);
  await expect.poll(() => page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.m6cAlphaFixture?.readbackBarrierReached === true),
  { timeout: 60_000 }).toBe(true);
  await page.getByRole("radio", { name: "Upright Assist", exact: true }).check();
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
    .not.toBe(initialRequestId);
  await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.m6cAlphaFixture?.releaseReadback?.());
  await expect.poll(() => page.evaluate((captureToken) => {
    const readback = window.__groundGlassWebGpuM3TestControl?.m6cAlphaCaptureReadback;
    return readback?.token === captureToken ? readback.status : null;
  }, token), { timeout: 60_000 }).toBe("stale");
  const stale = await page.evaluate((captureToken) => {
    const readback = window.__groundGlassWebGpuM3TestControl?.m6cAlphaCaptureReadback;
    if (!readback || readback.token !== captureToken) throw new Error("M6C stale diagnostic disappeared");
    return readback;
  }, token);
  await attachJson(testInfo, "m6c-stale-readback-control.json", stale);
  expect(stale.samples).toHaveLength(0);
  expect(stale.resourceAccounting.targetDisposed).toBe(true);
  expect(stale.resourceAccounting.allocationCount).toBe(1);
  expect(stale.resourceAccounting.disposalCount).toBe(1);
  expect(stale.resourceAccounting.previousRenderTargetRestored).toBe(true);
  await waitForCurrentFrame(page);
});

test("native M6C discards held alpha readback when SPA navigation retires its renderer generation", async ({ page }, testInfo) => {
  test.skip(!nativeWebGpuRequired || !m6PresentationRequired,
    "Requires chrome-native-webgpu and trusted M6 development build flags");
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {
      m6bCalibrationFixture: { enabled: true, presentationState: "neutral" },
      m6cAlphaFixture: { enabled: true, holdReadback: true },
    };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/simulator/free/architecture-rise");
  const pane = paneFor(page);
  const pilot = pilotFor(page);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 150_000 });
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await waitForCurrentFrame(page);

  const token = "m6c-stale-after-adapter-retirement";
  await page.evaluate((captureToken) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.m6cAlphaFixture || !control.requestM6cAlphaCapture) throw new Error("M6C retirement seam unavailable");
    control.m6cAlphaCaptureReadback = null;
    control.m6cAlphaCaptureRequest = { token: captureToken };
    control.requestM6cAlphaCapture();
  }, token);
  await expect.poll(() => page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.m6cAlphaFixture?.readbackBarrierReached === true),
  { timeout: 60_000 }).toBe(true);
  const retiredPilot = await pilot.elementHandle();
  if (!retiredPilot) throw new Error("M6C renderer host disappeared before retirement could be observed");

  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect(pilot).toHaveCount(0);
  await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.m6cAlphaFixture?.releaseReadback?.());
  await expect.poll(() => page.evaluate((captureToken) => {
    const readback = window.__groundGlassWebGpuM3TestControl?.m6cAlphaCaptureReadback;
    return readback?.token === captureToken ? readback.status : null;
  }, token), { timeout: 60_000 }).toBe("stale");
  await expect.poll(() => retiredPilot.getAttribute("data-cleanup-outcome"), { timeout: 90_000 }).toBe("confirmed");
  const stale = await page.evaluate((captureToken) => {
    const readback = window.__groundGlassWebGpuM3TestControl?.m6cAlphaCaptureReadback;
    if (!readback || readback.token !== captureToken) throw new Error("M6C retirement result disappeared");
    return readback;
  }, token);
  await attachJson(testInfo, "m6c-retired-generation-readback-control.json", stale);
  expect(stale.samples).toHaveLength(0);
  expect(stale.resourceAccounting.targetDisposed).toBe(true);
  expect(stale.resourceAccounting.allocationCount).toBe(1);
  expect(stale.resourceAccounting.disposalCount).toBe(1);
  expect(stale.resourceAccounting.previousRenderTargetRestored).toBe(true);
});
