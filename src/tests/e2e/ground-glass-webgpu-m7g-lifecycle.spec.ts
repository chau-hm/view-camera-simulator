import { expect, test, type Page } from "@playwright/test";
import { release } from "node:os";
import { isGroundGlassM7gRequired, groundGlassM7gSourceProvenance, writeGroundGlassM7gCapture } from "./helpers/groundGlassM7gEvidence";
import type { GroundGlassWebGpuTestEvent } from "../../render/webgpu/groundGlassWebGpuTestSeam";

const nativeRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const m6Required = process.env.GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED === "1" &&
  process.env.GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED === "1";

const paneFor = (page: Page) => page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
const pilotFor = (page: Page) => page.getByTestId("ground-glass-webgpu-pilot");

const waitForCurrentFrame = async (page: Page): Promise<void> => {
  const pane = paneFor(page);
  await expect.poll(async () => {
    const requestId = await pane.getAttribute("data-frame-request-id");
    return Boolean(requestId && requestId === await pane.getAttribute("data-last-completed-request-id") &&
      await pane.getAttribute("data-frame-result-status") === "completed");
  }, { timeout: 120_000 }).toBe(true);
};

const readEvents = (page: Page): Promise<GroundGlassWebGpuTestEvent[]> => page.evaluate(() =>
  window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [],
);

test("M7G holds a submitted M5 composite, rejects its stale request, and publishes the latest M4/M5/M6 result", async ({ page }, testInfo) => {
  test.skip(!nativeRequired || !m6Required || !isGroundGlassM7gRequired(),
    "Requires the native chrome project and trusted r187 M6/M7G development build flags");
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => { window.__groundGlassWebGpuM3TestControl = {}; });
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  await page.getByLabel("Render quality").selectOption("low");

  const pane = paneFor(page);
  const pilot = pilotFor(page);
  await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(pilotFor(page)).toHaveAttribute("data-internal-fallback", "none");
  await expect(pane).toHaveAttribute("data-frame-scene-id", "architecture-rise");
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed", { timeout: 120_000 });
  await waitForCurrentFrame(page);

  const generationId = await pane.getAttribute("data-renderer-generation");
  const initialRequestId = await pane.getAttribute("data-frame-request-id");
  if (!generationId || !initialRequestId) throw new Error("Native M6 initial frame identity was incomplete");
  const r1CaptureToken = `m7g-r1-${generationId}`;
  const r2CaptureToken = `m7g-r2-${generationId}`;
  await page.evaluate(({ generation, token }) => {
    const control = window.__groundGlassWebGpuM3TestControl!;
    control.holdNextM5CompositeGenerationId = generation;
    control.m5CompositeBarrierReached = false;
    control.heldM5CompositeIdentity = null;
    control.apertureGatherCaptureRequest = {
      token,
      qualityMode: "half32",
      retainReadbackBuffers: false,
    };
    control.apertureGatherCaptureReadback = null;
    control.apertureGatherCapturePublications = [];
  }, { generation: generationId, token: r1CaptureToken });

  const apertureGroup = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  const options = await apertureGroup.getByRole("radio").evaluateAll((elements) => elements.map((element) => ({
    name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
    checked: (element as HTMLInputElement).checked,
  })));
  const nextAperture = options.find((option) => !option.checked)?.name;
  expect(nextAperture).toBeTruthy();
  await apertureGroup.getByRole("radio", { name: nextAperture!, exact: true }).check();
  await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(initialRequestId);
  const r1RequestId = await pane.getAttribute("data-frame-request-id");
  if (!r1RequestId) throw new Error("R1 request was not accepted by the host");
  await expect.poll(() => page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.m5CompositeBarrierReached === true,
  ), { timeout: 60_000 }).toBe(true);
  const heldIdentity = await page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.heldM5CompositeIdentity ?? null,
  );
  expect(heldIdentity).toMatchObject({ generationId, requestId: r1RequestId, channelId: "default", sceneId: "architecture-rise" });
  const r1DiagnosticsAtHold = {
    frameRequestId: await pane.getAttribute("data-frame-request-id"),
    lastCompletedRequestId: await pane.getAttribute("data-last-completed-request-id"),
    physicalRequestId: await pilot.getAttribute("data-physical-coc-request-id"),
    physicalStatus: await pilot.getAttribute("data-physical-coc-status"),
    apertureGatherRequestId: await pilot.getAttribute("data-aperture-gather-request-id"),
    apertureGatherStatus: await pilot.getAttribute("data-aperture-gather-status"),
    presentationRequestId: await pilot.getAttribute("data-presentation-request-id"),
    presentationStatus: await pilot.getAttribute("data-presentation-status"),
    lastDisplayedRequestId: await pilot.getAttribute("data-last-displayed-request-id"),
  };
  expect(r1DiagnosticsAtHold).toMatchObject({
    frameRequestId: r1RequestId,
    physicalRequestId: r1RequestId,
    physicalStatus: "completed",
    apertureGatherRequestId: r1RequestId,
    apertureGatherStatus: "ready",
  });
  expect(r1DiagnosticsAtHold.lastDisplayedRequestId).not.toBe(r1RequestId);

  let r2RequestId: string | null = null;
  try {
    const focus = page.getByRole("slider", { name: "Focus distance" });
    await focus.focus();
    await focus.press("ArrowRight");
    await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 })
      .not.toBe(r1RequestId);
    r2RequestId = await pane.getAttribute("data-frame-request-id");
    if (!r2RequestId) throw new Error("R2 request was not accepted while the M5 composite hold was active");
    await expect.poll(async () => (await readEvents(page)).some((event) =>
      event.kind === "host-request-accepted" && event.requestId === r2RequestId &&
      event.activeGenerationId === generationId && event.channelId === "default" && event.sceneId === "architecture-rise",
    )).toBe(true);
    await page.evaluate((token) => {
      const control = window.__groundGlassWebGpuM3TestControl!;
      control.apertureGatherCaptureRequest = {
        token,
        qualityMode: "half32",
        retainReadbackBuffers: false,
      };
      control.apertureGatherCaptureReadback = null;
    }, r2CaptureToken);
  } finally {
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseM5Composite?.());
  }
  if (!r2RequestId) throw new Error("R2 identity was not captured before releasing the M5 composite");

  await expect.poll(async () => {
    const result = await pane.getAttribute("data-frame-result-status");
    const request = await pane.getAttribute("data-frame-request-id");
    return request === r2RequestId && result === "completed" &&
      await pane.getAttribute("data-last-completed-request-id") === r2RequestId;
  }, { timeout: 120_000 }).toBe(true);
  await expect(pilot).toHaveAttribute("data-physical-coc-status", "completed");
  await expect(pilot).toHaveAttribute("data-physical-coc-request-id", r2RequestId);
  await expect(pilot).toHaveAttribute("data-physical-coc-renderer-generation", generationId);
  await expect(pilot).toHaveAttribute("data-aperture-gather-request-id", r2RequestId);
  await expect(pilot).toHaveAttribute("data-aperture-gather-renderer-generation", generationId);
  await expect(pilot).toHaveAttribute("data-aperture-gather-status", "completed");
  await expect(pilot).toHaveAttribute("data-presentation-request-id", r2RequestId);
  await expect(pilot).toHaveAttribute("data-presentation-renderer-generation", generationId);
  await expect(pilot).toHaveAttribute("data-presentation-source", "m5-research-composite");
  await expect(pilot).toHaveAttribute("data-presentation-status", "completed");
  await expect(pilot).toHaveAttribute("data-last-displayed-request-id", r2RequestId);
  await waitForCurrentFrame(page);

  const events = await readEvents(page);
  const r1Phases = events.filter((event): event is Extract<GroundGlassWebGpuTestEvent, { kind: "m5-composite-lifecycle" }> =>
    event.kind === "m5-composite-lifecycle" && event.identity.requestId === r1RequestId);
  expect(r1Phases.map((event) => event.phase)).toEqual([
    "submitted", "hold-reached", "hold-released", "queue-settled", "stale-discarded",
  ]);
  expect(r1Phases.every((event) => event.kind === "m5-composite-lifecycle" &&
    event.identity.generationId === generationId && event.identity.channelId === "default" &&
    event.identity.sceneId === "architecture-rise" && event.executionApi === "webgpu" &&
    event.internalFallback === "none" && event.identity.targetUuid === heldIdentity?.targetUuid)).toBe(true);
  expect(r1Phases[0]?.completedPassesBeforeSubmission).toEqual(expect.arrayContaining([
    "farGather", "nearGather", "farReconstructionB1",
  ]));
  expect(events.some((event) => event.kind === "frame-completed" && event.requestId === r1RequestId)).toBe(false);
  expect(events.some((event) => event.kind === "host-frame-result" && event.requestId === r1RequestId &&
    event.acceptedByHost)).toBe(false);
  expect(events.some((event) => event.kind === "frame-completed" && event.requestId === r2RequestId)).toBe(true);
  expect(events.some((event) => event.kind === "host-frame-result" && event.requestId === r2RequestId &&
    event.channelId === "default" && event.generationId === generationId && event.sceneId === "architecture-rise" &&
    event.acceptedByHost && event.latestAcceptedRequestId === r2RequestId)).toBe(true);

  const capture = await page.evaluate(() => {
    const control = window.__groundGlassWebGpuM3TestControl;
    const readback = control?.apertureGatherCaptureReadback ?? null;
    return {
      publications: control?.apertureGatherCapturePublications ?? [],
      summary: readback ? { ...readback, readbackBuffers: null } : null,
    };
  });
  expect(capture.publications).toEqual([expect.objectContaining({ token: r2CaptureToken, requestId: r2RequestId })]);
  expect(capture.summary).toMatchObject({
    token: r2CaptureToken,
    requestId: r2RequestId,
    channelId: "default",
    sceneId: "architecture-rise",
    rendererGenerationId: generationId,
    rendererRevision: "r187",
    rendererFamily: "webgpu-renderer",
    actualExecutionApi: "webgpu",
    internalFallback: "none",
    sceneSourceRevision: expect.any(String),
  });
  expect(capture.summary?.inputFingerprints).toMatchObject({
    sourceColor: expect.any(String),
    depth: expect.any(String),
    physical: expect.any(String),
    validity: expect.any(String),
  });
  expect(capture.summary?.physicalDataFingerprint).toEqual(expect.any(String));
  expect(pageErrors).toEqual([]);

  const captureProvenance = groundGlassM7gSourceProvenance();
  const browser = page.context().browser();
  const evidence = {
    schemaVersion: 1,
    scenarioId: "m7g-r187-held-m5-composite-latest-request",
    route: new URL(page.url()).pathname,
    sourceHeadSha: captureProvenance.sourceCommitSha,
    invocation: captureProvenance.testInvocation,
    captureProvenance,
    environment: {
      testProject: "chrome-native-webgpu",
      browserName: browser?.browserType().name() ?? null,
      browserVersion: browser?.version() ?? null,
      threeRevision: "187",
      operatingSystem: {
        platform: process.platform,
        release: release(),
        architecture: process.arch,
      },
    },
    browserVersion: browser?.version() ?? "unknown",
    operatingSystem: `${process.platform} ${release()} ${process.arch}`,
    runtime: events.find((event) => event.kind === "runtime-observed") ?? null,
    rendererGenerationId: generationId,
    initialRequestId,
    transitions: { r1: "aperture-change", r2: "focus-distance-step" },
    r1RequestId,
    r2RequestId,
    heldIdentity,
    r1DiagnosticsAtHold,
    r1Phases,
    orderedEvents: events,
    hostFrameResults: events.filter((event) => event.kind === "host-frame-result"),
    frameCompletions: events.filter((event) => event.kind === "frame-completed"),
    capture,
    finalDiagnostics: {
      frameRequestId: await pane.getAttribute("data-frame-request-id"),
      lastCompletedRequestId: await pane.getAttribute("data-last-completed-request-id"),
      physicalRequestId: await pilot.getAttribute("data-physical-coc-request-id"),
      physicalStatus: await pilot.getAttribute("data-physical-coc-status"),
      physicalGenerationId: await pilot.getAttribute("data-physical-coc-renderer-generation"),
      apertureGatherRequestId: await pilot.getAttribute("data-aperture-gather-request-id"),
      apertureGatherGenerationId: await pilot.getAttribute("data-aperture-gather-renderer-generation"),
      apertureGatherStatus: await pilot.getAttribute("data-aperture-gather-status"),
      presentationRequestId: await pilot.getAttribute("data-presentation-request-id"),
      presentationGenerationId: await pilot.getAttribute("data-presentation-renderer-generation"),
      presentationSource: await pilot.getAttribute("data-presentation-source"),
      presentationStatus: await pilot.getAttribute("data-presentation-status"),
      lastDisplayedRequestId: await pilot.getAttribute("data-last-displayed-request-id"),
    },
  };
  const evidenceJson = JSON.stringify(evidence, null, 2);
  await testInfo.attach("m7g-r187-held-m5-composite-lifecycle.json", {
    body: evidenceJson,
    contentType: "application/json",
  });
  writeGroundGlassM7gCapture("native/m5-composite-latest-request.json", evidence);
});
