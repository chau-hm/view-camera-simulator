import { expect, test, type Page } from "@playwright/test";
import { REVISION } from "three";
import type {
  GroundGlassApertureGatherCaptureReadback,
} from "../../render/webgpu/groundGlassWebGpuTestSeam";
import type { GroundGlassApertureGatherQualityMode } from "../../render/webgpu/groundGlassApertureGatherPolicy";
import { clickStageAt } from "./helpers/groundGlass";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const nativeRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const rawPilotEnabled = process.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true";
const physicalResearchEnabled = process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "1";
const gatherResearchEnabled = process.env.GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH === "1";
const M5_REQUIRED = nativeRequired && rawPilotEnabled && physicalResearchEnabled && gatherResearchEnabled;
const M4_RAW_BASELINE_REQUIRED = nativeRequired && rawPilotEnabled && physicalResearchEnabled && !gatherResearchEnabled;

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
): Promise<GroundGlassApertureGatherCaptureReadback> => {
  const triggered = await page.evaluate(({ captureToken, mode }) => {
    const control = window.__groundGlassWebGpuM3TestControl;
    if (!control?.requestApertureGatherCapture) return false;
    control.apertureGatherCaptureReadback = null;
    control.apertureGatherCaptureRequest = { token: captureToken, qualityMode: mode };
    control.requestApertureGatherCapture();
    return true;
  }, { captureToken: token, mode: qualityMode });
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
  const readback = await page.evaluate((captureToken) => {
    const result = window.__groundGlassWebGpuM3TestControl?.apertureGatherCaptureReadback;
    return result?.token === captureToken ? result : null;
  }, token);
  if (!readback) throw new Error(`M5 did not return capture ${token}`);
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

test("native M5 app adapter captures B1 provenance, source fallback, and near coverage for matched quality modes", async ({ page }, testInfo) => {
  test.skip(!M5_REQUIRED,
    "Requires headed native WebGPU, the M3 Raw pilot, the M4 physical research gate, and the separate M5 gather research gate");
  test.setTimeout(900_000);
  expect(REVISION).toBe("186");

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

  // f/8 produces a non-empty foreground coverage region in this registered subject.
  await page.getByRole("radiogroup", { name: "Aperture", exact: true })
    .getByRole("radio", { name: "f/8", exact: true }).check();
  await waitForCurrentFrame(page);
  await expectNativeM5Identity(page);

  const captures: GroundGlassApertureGatherCaptureReadback[] = [];
  for (const qualityMode of ["half32", "full32", "full64"] as const) {
    const result = await captureGather(page, qualityMode, `m5-${qualityMode}-${Date.now()}`);
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
    captures.push(result);
  }
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
