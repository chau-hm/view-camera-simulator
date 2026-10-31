import { mkdir, writeFile } from "node:fs/promises";
import { arch, release } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { REVISION } from "three";
import { expect, test, type Page } from "@playwright/test";
import type {
  GroundGlassWebGpuTestControl,
  GroundGlassWebGpuTestEventWithSequence,
} from "../../render/webgpu/groundGlassWebGpuTestSeam";
import { clickStageAt } from "./helpers/groundGlass";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const nativeRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const failureIntegrationEnabled = process.env.GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION === "1";
const physicalResearchEnabled = process.env.GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH === "1";
const rawPilotBuildEnabled = process.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true" ||
  process.env.GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED === "1";
const r187RawEvidenceRevision = "m3-architecture-rise-raw-rtt-native-r187-v1";

type M7cCaptureControl = GroundGlassWebGpuTestControl & {
  m7cObservations?: Array<Readonly<Record<string, unknown>>>;
};
type M7cPolicyEvidence = Readonly<{
  threeRevision: string | null;
  selectedBackend: string | null;
  policyEvidenceRevision: string | null;
  mountedRendererRevision: string | null;
  mountedVerificationEvidenceRevision: string | null;
}>;

type FailurePoint =
  | "initialization-after-target"
  | "scene-render-after-submit"
  | "queue-completion"
  | "physical-coc-after-submit"
  | "physical-validity-after-submit"
  | "texture-display-after-submit"
  | "dispose-target";

const pane = (page: Page) => page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');

const waitForStableRequestId = async (page: Page, glass: ReturnType<typeof pane>) => {
  await expect.poll(async () => {
    const first = await glass.getAttribute("data-frame-request-id");
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    const second = await glass.getAttribute("data-frame-request-id");
    return first && first === second ? second : null;
  }, { timeout: 15_000 }).not.toBeNull();
  return glass.getAttribute("data-frame-request-id");
};

const writeControl = async (page: Page, patch: Partial<GroundGlassWebGpuTestControl>) => page.evaluate((next) => {
  const control = window.__groundGlassWebGpuM3TestControl ??= {};
  if (Object.prototype.hasOwnProperty.call(next, "failurePoints")) {
    control.configuredFailurePoints = [...(next.failurePoints ?? [])];
  }
  Object.assign(control, next);
}, patch);

const recordM7cObservation = async (page: Page, observation: Readonly<Record<string, unknown>>) => page.evaluate((next) => {
  const control = window.__groundGlassWebGpuM3TestControl as M7cCaptureControl | undefined;
  if (!control) throw new Error("The M7C lifecycle test control was not installed");
  control.m7cObservations ??= [];
  control.m7cObservations.push(next);
}, observation);

const captureNativePolicyEvidence = async (glass: ReturnType<typeof pane>): Promise<M7cPolicyEvidence> => {
  await expect(glass).toHaveAttribute("data-policy-evidence-revisions", r187RawEvidenceRevision, { timeout: 60_000 });
  await expect(glass).toHaveAttribute("data-policy-selected-backend", "webgpu", { timeout: 60_000 });
  return glass.evaluate((element) => ({
    threeRevision: element.getAttribute("data-three-revision"),
    selectedBackend: element.getAttribute("data-policy-selected-backend"),
    policyEvidenceRevision: element.getAttribute("data-policy-evidence-revisions"),
    mountedRendererRevision: element.getAttribute("data-mounted-renderer-revision"),
    mountedVerificationEvidenceRevision: element.getAttribute("data-mounted-verification-evidence-revision"),
  }));
};

const recordNativePolicyObservation = async (
  page: Page,
  glass: ReturnType<typeof pane>,
  generationId: string,
  capturedPolicyEvidence?: M7cPolicyEvidence,
) => {
  const policyEvidence = capturedPolicyEvidence ?? await glass.evaluate((element) => ({
    threeRevision: element.getAttribute("data-three-revision"),
    selectedBackend: element.getAttribute("data-policy-selected-backend"),
    policyEvidenceRevision: element.getAttribute("data-policy-evidence-revisions"),
    mountedRendererRevision: element.getAttribute("data-mounted-renderer-revision"),
    mountedVerificationEvidenceRevision: element.getAttribute("data-mounted-verification-evidence-revision"),
  }));
  expect(policyEvidence).toMatchObject({
    threeRevision: "187",
    selectedBackend: "webgpu",
    policyEvidenceRevision: r187RawEvidenceRevision,
  });
  const events = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
  const attempt = events.find((event) => event.kind === "attempt" && event.generationId === generationId);
  const runtime = events.find((event) => event.kind === "runtime-observed" && event.generationId === generationId);
  expect(attempt).toMatchObject({ rendererRevision: "187" });
  expect(runtime).toMatchObject({
    rendererRevision: "187",
    rendererFamily: "webgpu-renderer",
    executionApi: "webgpu",
    internalFallback: "none",
  });
  await recordM7cObservation(page, {
    kind: "native-policy-runtime-identity",
    policyEvidence,
    attemptId: attempt?.kind === "attempt" ? attempt.attemptId : null,
    generationId,
    requestId: attempt?.kind === "attempt" ? attempt.requestId : null,
    sceneId: attempt?.kind === "attempt" ? attempt.sceneId : null,
    channelId: attempt?.kind === "attempt" ? attempt.channelId : null,
    pilotSessionId: await glass.getAttribute("data-pilot-session-id"),
    retryEpoch: Number(await glass.getAttribute("data-pilot-retry-epoch")),
    hostId: events.find((event) => event.kind === "host-attached")?.hostId ?? null,
    runtimeEventSequence: runtime?.sequence ?? null,
    runtimeIdentity: runtime ? {
      rendererRevision: runtime.kind === "runtime-observed" ? runtime.rendererRevision : null,
      rendererFamily: runtime.kind === "runtime-observed" ? runtime.rendererFamily : null,
      executionApi: runtime.kind === "runtime-observed" ? runtime.executionApi : null,
      internalFallback: runtime.kind === "runtime-observed" ? runtime.internalFallback : null,
    } : null,
  });
};

const installControl = async (page: Page) => {
  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = {
      adapterAttemptGenerations: [],
      adapterEvents: [],
      configuredFailurePoints: [],
      failurePoints: [],
    };
  });
};

const stableScenarioIdFor = (titlePath: readonly string[]): string =>
  `m7c-r187-${titlePath.at(-1)?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ?? "unknown"}`;

const attachLifecycleEvidence = async (page: Page, testInfo: import("@playwright/test").TestInfo): Promise<void> => {
  const controlEvidence = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(
      '[data-testid="ground-glass-rtt"][data-rtt-channel="default"]',
    );
    const attribute = (name: string) => element?.getAttribute(name) ?? null;
    const events: GroundGlassWebGpuTestEventWithSequence[] =
      window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [];
    const attemptEvents = events.filter((event) => event.kind === "attempt");
    const runtimeEvents = events.filter((event) => event.kind === "runtime-observed");
    const mountEvents = events.filter((event) => event.kind === "renderer-mounted");
    const failureEvents = events.filter((event) => event.kind === "failure");
    const cleanupEvents = events.filter((event) => event.kind === "cleanup" || event.kind === "cleanup-acknowledged");
    const hostEvents = events.filter((event) => event.kind === "host-attached");
    const qualificationEvents = events.filter((event) => event.kind !== "host-frame-result" ||
      event.acceptedByHost === true ||
      (event.acceptedByHost === false && event.requestId !== event.latestAcceptedRequestId));
    const lifecycleGenerationId = attribute("data-last-failure-generation-id") ?? attemptEvents.at(-1)?.generationId ?? null;
    const lifecycleCleanupAck = cleanupEvents.find((event) =>
      event.kind === "cleanup-acknowledged" && event.generationId === lifecycleGenerationId,
    );
    const lifecycleMount = mountEvents.find((event) => event.generationId === lifecycleGenerationId);
    const lifecycleAttempt = attemptEvents.find((event) => event.generationId === lifecycleGenerationId);
    return {
      controlPresent: window.__groundGlassWebGpuM3TestControl !== undefined,
      configuredFailurePoints: window.__groundGlassWebGpuM3TestControl?.configuredFailurePoints ?? [],
      adapterAttemptGenerations: window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? [],
      m7cObservations: (window.__groundGlassWebGpuM3TestControl as M7cCaptureControl | undefined)?.m7cObservations ?? [],
      identities: {
        channelId: attribute("data-frame-channel-id") ?? attribute("data-rtt-channel"),
        pilotSessionId: attribute("data-pilot-session-id"),
        retryEpoch: attribute("data-pilot-retry-epoch"),
        hostId: lifecycleCleanupAck?.kind === "cleanup-acknowledged"
          ? lifecycleCleanupAck.hostId
          : lifecycleMount?.hostId ?? hostEvents.at(-1)?.hostId ?? attribute("data-last-failure-host-id"),
        generationId: lifecycleGenerationId,
        attemptId: lifecycleAttempt?.attemptId ?? null,
        requestId: attribute("data-last-failure-request-id") ?? lifecycleAttempt?.requestId ?? attribute("data-frame-request-id"),
        sceneId: attribute("data-last-failure-scene-id") ?? lifecycleAttempt?.sceneId ??
          attribute("data-frame-scene-id") ?? attribute("data-rtt-scene-id"),
        attemptIds: attemptEvents.map((event) => event.attemptId),
        attempts: attemptEvents,
      },
      policy: {
        requestedBackend: attribute("data-policy-requested-backend"),
        selectedBackend: attribute("data-policy-selected-backend"),
        evidenceRevision: attribute("data-policy-evidence-revisions"),
        mountedRendererRevision: attribute("data-mounted-renderer-revision"),
        mountedVerificationEvidenceRevision: attribute("data-mounted-verification-evidence-revision"),
        attemptedBackend: attribute("data-attempted-backend"),
        attemptStatus: attribute("data-backend-attempt-status"),
      },
      runtime: {
        finalMountedRendererFamily: attribute("data-mounted-renderer-family"),
        finalActualExecutionApi: attribute("data-actual-execution-api"),
        finalInternalFallback: attribute("data-internal-fallback"),
        adapterObservations: runtimeEvents,
        hostMountObservations: mountEvents,
      },
      failure: {
        hostId: attribute("data-last-failure-host-id"),
        channelId: attribute("data-last-failure-channel-id"),
        pilotSessionId: attribute("data-last-failure-session-id"),
        retryEpoch: attribute("data-last-failure-retry-epoch"),
        generationId: attribute("data-last-failure-generation-id"),
        requestId: attribute("data-last-failure-request-id"),
        sceneId: attribute("data-last-failure-scene-id"),
        stage: attribute("data-pilot-failure-stage"),
        operation: attribute("data-last-failure-operation"),
        adapterEvents: failureEvents,
      },
      cleanup: {
        finalStatus: attribute("data-render-cleanup-status"),
        lastObserved: cleanupEvents.at(-1) ?? null,
        events: cleanupEvents,
      },
      fallback: {
        applicationFallback: attribute("data-application-fallback"),
      },
      publication: {
        currentRequestId: attribute("data-frame-request-id"),
        lastCompletedRequestId: attribute("data-last-completed-request-id"),
        completedCurrentRequest: Boolean(
          attribute("data-frame-request-id") &&
          attribute("data-frame-request-id") === attribute("data-last-completed-request-id"),
        ),
        frameResultStatus: attribute("data-frame-result-status"),
      },
      finalLifecycle: attribute("data-render-host-lifecycle"),
      totalEventCount: events.length,
      qualificationEvents,
    };
  }).catch((error: unknown) => ({ snapshotError: error instanceof Error ? error.message : String(error) }));
  const browser = page.context().browser();
  const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => null);
  const evidence = {
    schemaVersion: "ground-glass-m7c-r187-native-observation-v1",
    sourceHeadSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    scenarioId: stableScenarioIdFor(testInfo.titlePath),
    title: testInfo.titlePath.join(" › "),
    result: { status: testInfo.status, expectedStatus: testInfo.expectedStatus },
    environment: {
      testProject: testInfo.project.name,
      browserName: browser?.browserType().name() ?? null,
      browserVersion: browser?.version() ?? null,
      userAgent,
      threeRevision: REVISION,
      operatingSystem: {
        platform: process.platform,
        release: release(),
        architecture: arch(),
        nodeVersion: process.version,
      },
      flags: {
        nativeRequired: process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1",
        failureIntegrationEnabled: process.env.GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION === "1",
        rawPilotBuildEnabled,
      },
    },
    invocation: process.env.GROUND_GLASS_M7C_TEST_INVOCATION ??
      "npm run test:e2e -- --project=chrome-native-webgpu src/tests/e2e/ground-glass-webgpu-failure-host.spec.ts",
    processArguments: process.argv,
    observation: controlEvidence,
  };
  const body = JSON.stringify(evidence, null, 2);
  const outputPath = testInfo.outputPath("ground-glass-m7c-r187-lifecycle-evidence.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, body);
  const captureDirectory = process.env.GROUND_GLASS_M7C_CAPTURE_DIR;
  if (captureDirectory) {
    await mkdir(captureDirectory, { recursive: true });
    await writeFile(join(captureDirectory, `${evidence.scenarioId}.json`), body);
  }
  await testInfo.attach("ground-glass-m7c-r187-lifecycle-evidence", {
    path: outputPath,
    contentType: "application/json",
  });
};

const startNativePilot = async (
  page: Page,
  failurePoints: FailurePoint[],
  controlPatch: Partial<GroundGlassWebGpuTestControl> = {},
) => {
  await installControl(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  const glass = pane(page);
  await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await writeControl(page, { ...controlPatch, failurePoints });
  await page.getByLabel("Raw RTT — bypass DOF").check();
  const authorizedPolicyEvidence = await captureNativePolicyEvidence(glass);
  await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
    .toContainEqual(expect.objectContaining({
      kind: "runtime-observed",
      rendererFamily: "webgpu-renderer",
      executionApi: "webgpu",
    }));
  const nativeEvents = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
  const nativeGeneration = await page.evaluate(() =>
    window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations?.[0] ?? null,
  );
  const nativeAttempt = nativeEvents.find((event) => event.kind === "attempt" && event.generationId === nativeGeneration);
  const nativeRuntime = nativeEvents.find((event) => event.kind === "runtime-observed" && event.generationId === nativeGeneration);
  expect(nativeAttempt).toMatchObject({ rendererRevision: "187" });
  expect(nativeRuntime).toMatchObject({
    rendererRevision: "187",
    rendererFamily: "webgpu-renderer",
    executionApi: "webgpu",
    internalFallback: "none",
  });
  if (!nativeGeneration) throw new Error("Native WebGPU generation identity was not captured");
  await recordNativePolicyObservation(page, glass, nativeGeneration, authorizedPolicyEvidence);
  const failedRequestId = await glass.getAttribute("data-frame-request-id");
  const failedGeneration = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations?.[0] ?? null);
  if (!failedRequestId || !failedGeneration) throw new Error("Native WebGPU request/generation identity was not captured");
  return { glass, failedRequestId, failedGeneration };
};

const assertConfirmedWebGlFallback = async (
  glass: ReturnType<typeof pane>,
  page: Page,
  failedRequestId: string,
  failedGeneration: string,
  failureStage: "initialization" | "runtime",
  failureOperation: string,
) => {
  await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
    .toContainEqual(expect.objectContaining({
      kind: "cleanup",
      generationId: failedGeneration,
      outcome: "confirmed",
    }));
  const events = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
  const attemptEvent = events.find((event) => event.kind === "attempt" && event.generationId === failedGeneration);
  const runtimeEvent = events.find((event) => event.kind === "runtime-observed" && event.generationId === failedGeneration);
  const mountedEvent = events.find((event) => event.kind === "renderer-mounted" && event.generationId === failedGeneration);
  const failureEvent = events.find((event) => event.kind === "failure" && event.generationId === failedGeneration);
  const cleanupEvent = events.find((event) => event.kind === "cleanup" && event.generationId === failedGeneration);
  expect(attemptEvent).toBeTruthy();
  expect(runtimeEvent).toBeTruthy();
  expect(failureEvent).toBeTruthy();
  expect(cleanupEvent).toBeTruthy();
  expect(runtimeEvent!.sequence).toBeGreaterThan(attemptEvent!.sequence!);
  expect(failureEvent!.sequence).toBeGreaterThan(runtimeEvent!.sequence!);
  expect(cleanupEvent!.sequence).toBeGreaterThan(failureEvent!.sequence!);
  const backendObservation = runtimeEvent?.kind === "runtime-observed" ? runtimeEvent : undefined;
  expect(backendObservation?.internalFallback).toBe(
    backendObservation?.executionApi === "webgpu" ? "none" : "webgl2-compatibility",
  );
  const hostMountExpected = failureStage === "runtime" || backendObservation?.executionApi === "webgl2";
  if (!hostMountExpected) {
    // The after-target initialization injection runs after backend observation but before host mount.
    expect(mountedEvent).toBeUndefined();
  } else {
    expect(mountedEvent).toBeTruthy();
    expect(failureEvent!.sequence).toBeGreaterThan(mountedEvent!.sequence!);
    if (backendObservation?.executionApi === "webgl2") {
      expect(mountedEvent).toMatchObject({
        rendererFamily: "webgpu-renderer",
        executionApi: "webgl2",
        internalFallback: "webgl2-compatibility",
      });
    }
  }
  expect(events).toContainEqual(expect.objectContaining({
    kind: "failure",
    generationId: failedGeneration,
    stage: failureStage,
    operation: failureOperation,
  }));
  expect(events).not.toContainEqual(expect.objectContaining({
    kind: "frame-completed",
    generationId: failedGeneration,
    requestId: failedRequestId,
  }));
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-actual-execution-api", /^webgl2?$/);
  await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-last-completed-request-id", failedRequestId, { timeout: 90_000 });
  const currentGeneration = await glass.getAttribute("data-renderer-generation");
  expect(currentGeneration).toBeTruthy();
  expect(currentGeneration).not.toBe(failedGeneration);
  const hostEvents = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
  const hostCleanup = hostEvents.find((event) =>
    event.kind === "cleanup-acknowledged" && event.generationId === failedGeneration,
  );
  const replacementMount = hostEvents.find((event) =>
    event.kind === "renderer-mounted" && event.generationId === currentGeneration &&
    event.rendererFamily === "webgl-renderer",
  );
  const currentPublication = hostEvents.find((event) =>
    event.kind === "host-frame-result" && event.generationId === currentGeneration &&
    event.requestId === failedRequestId && event.acceptedByHost,
  );
  expect(hostCleanup).toBeTruthy();
  expect(replacementMount).toBeTruthy();
  expect(currentPublication).toBeTruthy();
  expect(replacementMount!.sequence).toBeGreaterThan(hostCleanup!.sequence!);
  expect(currentPublication!.sequence).toBeGreaterThan(replacementMount!.sequence!);
  if (currentPublication?.kind === "host-frame-result") {
    const currentSceneId = await glass.getAttribute("data-frame-scene-id");
    expect(currentPublication).toMatchObject({
      activeGenerationId: currentGeneration,
      latestAcceptedRequestId: failedRequestId,
      activeRendererFamily: "webgl-renderer",
    });
    expect(currentPublication.sceneId).toBe(currentSceneId);
    expect(currentPublication.latestAcceptedSceneId).toBe(currentSceneId);
  }
};

test.describe("native M3 WebGPU adapter-to-host controlled failure recovery", () => {
  test.skip(
    !nativeRequired || !failureIntegrationEnabled,
    "Requires headed native Chrome, VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true, and GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1",
  );

  test.beforeAll(() => {
    if (!rawPilotBuildEnabled) {
      throw new Error(
        "Native failure-host tests require VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true; without trusted build authorization the app correctly selects WebGL and cannot emit a native runtime-observed event.",
      );
    }
  });

  test.afterEach(async ({ page }, testInfo) => attachLifecycleEvidence(page, testInfo));

  test("D1 initialization failure cleans acquired resources before WebGL fallback and remains sticky", async ({ page }) => {
    test.setTimeout(300_000);
    const { glass, failedRequestId, failedGeneration } = await startNativePilot(page, ["initialization-after-target"]);
    const initialSessionId = await glass.getAttribute("data-pilot-session-id");
    const initialRetryEpoch = Number(await glass.getAttribute("data-pilot-retry-epoch"));
    const initialAttemptGenerations = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    await assertConfirmedWebGlFallback(glass, page, failedRequestId, failedGeneration, "initialization", "unknown");

    const slider = page.getByRole("slider", { name: "Focus distance" });
    const currentFocus = Number(await slider.inputValue());
    const focusStep = Number(await slider.getAttribute("step"));
    await setStepRangeInput(page, "Focus distance", currentFocus + focusStep);
    await page.getByRole("radio", { name: "f/16" }).check();
    await page.getByRole("radio", { name: "Upright Assist", exact: true }).check();
    const stage = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
    await clickStageAt(page, stage, 0.68, 0.36);
    await page.setViewportSize({ width: 1160, height: 900 });
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");

    await page.getByRole("link", { name: "All Scenes", exact: true }).click();
    await expect(page).toHaveURL(/\/scenes$/);
    await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/interior-corner"]').click();
    await expect(page).toHaveURL(/\/simulator\/free\/interior-corner$/);
    await page.getByRole("link", { name: "All Scenes", exact: true }).click();
    await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/architecture-rise"]').click();
    await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
    const remountedGlass = pane(page);
    await expect(remountedGlass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await expect(remountedGlass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    const adapterAttempts = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    expect(adapterAttempts).toEqual([failedGeneration]);
    expect(await remountedGlass.getAttribute("data-pilot-session-id")).toBe(initialSessionId);
    expect(Number(await remountedGlass.getAttribute("data-pilot-retry-epoch"))).toBe(initialRetryEpoch);
    await recordM7cObservation(page, {
      kind: "sticky-session-remount",
      sessionIdBeforeChanges: initialSessionId,
      sessionIdAfterRemount: await remountedGlass.getAttribute("data-pilot-session-id"),
      retryEpochBeforeChanges: initialRetryEpoch,
      retryEpochAfterRemount: Number(await remountedGlass.getAttribute("data-pilot-retry-epoch")),
      attemptGenerationsBeforeChanges: initialAttemptGenerations,
      attemptGenerationsAfterRemount: adapterAttempts,
    });
  });

  for (const scenario of [
    { name: "D2 controlled scene render submission rejection", point: "scene-render-after-submit" as const, operation: "sceneRender" },
    { name: "D3 controlled queue completion rejection", point: "queue-completion" as const, operation: "sceneRender" },
    { name: "D4 texture display submission", point: "texture-display-after-submit" as const, operation: "textureDisplay" },
  ]) {
    test(`${scenario.name} fails the whole frame and falls back only after confirmed cleanup`, async ({ page }) => {
      test.setTimeout(240_000);
      const { glass, failedRequestId, failedGeneration } = await startNativePilot(page, [scenario.point]);
      await assertConfirmedWebGlFallback(glass, page, failedRequestId, failedGeneration, "runtime", scenario.operation);
      if (scenario.point === "scene-render-after-submit") {
        const events = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
        expect(events).toContainEqual(expect.objectContaining({
          kind: "failure",
          generationId: failedGeneration,
          reason: expect.stringContaining("Injected test-only Ground Glass WebGPU failure"),
        }));
      }
      const adapterAttempts = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
      expect(adapterAttempts).toEqual([failedGeneration]);
    });
  }

  test("D4 failed disposal keeps the host unavailable and prevents a replacement generation", async ({ page }) => {
    test.setTimeout(240_000);
    const { glass, failedRequestId, failedGeneration } = await startNativePilot(page, ["initialization-after-target", "dispose-target"]);
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({ kind: "failure", generationId: failedGeneration, stage: "initialization" }));
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({
        kind: "cleanup",
        generationId: failedGeneration,
        outcome: "failed",
      }));
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "unavailable");
    await expect(glass).toHaveAttribute("data-render-cleanup-status", "failed");
    await expect(glass).not.toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    expect(await glass.getAttribute("data-renderer-generation")).toBe(failedGeneration);
    expect(await glass.getAttribute("data-last-completed-request-id")).not.toBe(failedRequestId);
    const adapterAttempts = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    expect(adapterAttempts).toEqual([failedGeneration]);
  });

  test("D5 pending queue work blocks replacement until the actual adapter operation settles", async ({ page }) => {
    test.setTimeout(180_000);
    await installControl(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
    const glass = pane(page);
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await writeControl(page, { holdQueueCompletion: true });
    await page.getByLabel("Raw RTT — bypass DOF").check();
    const authorizedPolicyEvidence = await captureNativePolicyEvidence(glass);
    const adapter = page.getByTestId("ground-glass-webgpu-pilot");
    await expect(adapter).toHaveAttribute("data-actual-execution-api", "webgpu", { timeout: 120_000 });
    await expect.poll(async () => page.evaluate(() => Boolean(window.__groundGlassWebGpuM3TestControl?.queueCompletionBarrierReached))).toBe(true);
    const queueCompletionBarrierReachedBeforeRetirement = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.queueCompletionBarrierReached === true,
    );
    expect(queueCompletionBarrierReachedBeforeRetirement).toBe(true);
    const retiredGeneration = await glass.getAttribute("data-renderer-generation");
    if (!retiredGeneration) throw new Error("Native generation identity was not captured");
    await recordNativePolicyObservation(page, glass, retiredGeneration, authorizedPolicyEvidence);
    await page.getByLabel("Raw RTT — bypass DOF").uncheck();
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "retiring");
    await expect(glass).toHaveAttribute("data-render-cleanup-status", "pending");
    expect(await glass.getAttribute("data-renderer-generation")).toBe(retiredGeneration);
    await expect(glass).not.toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    const retirementWhileHeld = await glass.evaluate((element) => ({
      lifecycle: element.getAttribute("data-render-host-lifecycle"),
      cleanupStatus: element.getAttribute("data-render-cleanup-status"),
      rendererGeneration: element.getAttribute("data-renderer-generation"),
      mountedRendererFamily: element.getAttribute("data-mounted-renderer-family"),
    }));
    expect(retirementWhileHeld).toMatchObject({
      lifecycle: "retiring",
      cleanupStatus: "pending",
      rendererGeneration: retiredGeneration,
    });
    const releaseRequested = await page.evaluate(() => {
      const control = window.__groundGlassWebGpuM3TestControl;
      if (control?.queueCompletionBarrierReached !== true || !control.releaseQueueCompletion) return false;
      control.releaseQueueCompletion();
      return true;
    });
    expect(releaseRequested).toBe(true);
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({
        kind: "queue-completion-settled",
        generationId: retiredGeneration,
        operation: "sceneRender",
      }));
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({
        kind: "cleanup",
        generationId: retiredGeneration,
        outcome: "confirmed",
      }));
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 90_000 });
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    const events = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
    const attempt = events.find((event) => event.kind === "attempt" && event.generationId === retiredGeneration);
    const queueSettled = events.find((event) => event.kind === "queue-completion-settled" &&
      event.generationId === retiredGeneration);
    const adapterCleanup = events.find((event) => event.kind === "cleanup" && event.generationId === retiredGeneration);
    const hostAcknowledgement = events.find((event) => event.kind === "cleanup-acknowledged" &&
      event.generationId === retiredGeneration);
    const replacement = events.find((event) => event.kind === "renderer-mounted" &&
      event.rendererFamily === "webgl-renderer" && event.generationId !== retiredGeneration &&
      typeof event.sequence === "number" && hostAcknowledgement?.kind === "cleanup-acknowledged" &&
      typeof hostAcknowledgement.sequence === "number" &&
      event.sequence > hostAcknowledgement.sequence && event.channelId === hostAcknowledgement.channelId &&
      event.hostId === hostAcknowledgement.hostId);
    if (attempt?.kind !== "attempt" || queueSettled?.kind !== "queue-completion-settled" ||
        adapterCleanup?.kind !== "cleanup" || hostAcknowledgement?.kind !== "cleanup-acknowledged" ||
        replacement?.kind !== "renderer-mounted" || typeof queueSettled.sequence !== "number" ||
        typeof adapterCleanup.sequence !== "number" || typeof hostAcknowledgement.sequence !== "number" ||
        typeof replacement.sequence !== "number") {
      throw new Error("Pending queue retirement did not produce its full settlement and cleanup chain");
    }
    expect(queueSettled.sequence).toBeLessThan(adapterCleanup.sequence);
    expect(adapterCleanup.sequence).toBeLessThan(hostAcknowledgement.sequence);
    expect(hostAcknowledgement.sequence).toBeLessThan(replacement.sequence);
    expect(events).not.toContainEqual(expect.objectContaining({
      kind: "device-lost-observed",
      generationId: retiredGeneration,
    }));
    await recordM7cObservation(page, {
      kind: "pending-queue-retirement",
      generationId: retiredGeneration,
      attemptId: attempt.attemptId,
      requestId: attempt.requestId,
      channelId: attempt.channelId,
      sceneId: attempt.sceneId,
      hostId: hostAcknowledgement.hostId,
      queueCompletionBarrierReachedBeforeRelease: queueCompletionBarrierReachedBeforeRetirement,
      retirementWhileHeld,
      releaseRequested,
      queueCompletionSettledSequence: queueSettled?.sequence ?? null,
      adapterCleanupSequence: adapterCleanup?.sequence ?? null,
      hostAcknowledgementSequence: hostAcknowledgement?.sequence ?? null,
      replacementGenerationId: replacement.generationId,
      replacementMountSequence: replacement.sequence,
    });
  });

  test("M7C scene navigation during pending cleanup does not publish retired output or retry on remount", async ({ page }) => {
    test.setTimeout(300_000);
    await installControl(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
    const glass = pane(page);
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await writeControl(page, { holdQueueCompletion: true });
    await page.getByLabel("Raw RTT — bypass DOF").check();
    const authorizedPolicyEvidence = await captureNativePolicyEvidence(glass);
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
      .toContainEqual(expect.objectContaining({
        kind: "runtime-observed",
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
      }));
    await expect.poll(async () => page.evaluate(() => Boolean(window.__groundGlassWebGpuM3TestControl?.queueCompletionBarrierReached)))
      .toBe(true);
    const heldRequestId = await waitForStableRequestId(page, glass);
    const retiredGeneration = await glass.getAttribute("data-renderer-generation");
    expect(retiredGeneration).toBeTruthy();
    if (!retiredGeneration) throw new Error("Native generation identity was not captured");
    await recordNativePolicyObservation(page, glass, retiredGeneration, authorizedPolicyEvidence);
    const heldSessionId = await glass.getAttribute("data-pilot-session-id");

    await page.getByRole("link", { name: "All Scenes", exact: true }).click();
    await expect(page).toHaveURL(/\/scenes$/);
    const unmountSequence = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.adapterEvents?.at(-1)?.sequence ?? -1,
    );
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseQueueCompletion?.());
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({
        kind: "cleanup-acknowledged",
        generationId: retiredGeneration,
        outcome: "confirmed",
      }));
    const retiredEvents = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
    const retirementAck = retiredEvents.find((event) =>
      event.kind === "cleanup-acknowledged" && event.generationId === retiredGeneration && event.outcome === "confirmed",
    );
    const publishedAfterRetirement = retiredEvents.filter((event) =>
      event.kind === "host-frame-result" && event.generationId === retiredGeneration && event.acceptedByHost === true &&
      typeof event.sequence === "number" && event.sequence > unmountSequence,
    );
    expect(publishedAfterRetirement).toEqual([]);
    await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/architecture-rise"]').click();
    await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
    const remountedGlass = pane(page);
    await expect(remountedGlass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await expect(remountedGlass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    const attemptsAfterRemount = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    expect(attemptsAfterRemount).toEqual([retiredGeneration]);
    await recordM7cObservation(page, {
      kind: "pending-cleanup-scene-remount",
      heldRequestId,
      heldSessionId,
      retiredGeneration,
      unmountSequence,
      cleanupAcknowledgement: retirementAck ?? null,
      postRetirementAcceptedPublications: publishedAfterRetirement,
      remountedRendererFamily: await remountedGlass.getAttribute("data-mounted-renderer-family"),
      adapterAttemptGenerationsAfterRemount: attemptsAfterRemount,
    });
  });

  test("D8 WebGPURenderer on its WebGL2 compatibility backend is not reported as native and falls back safely", async ({ page }) => {
    test.setTimeout(240_000);
    await installControl(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
    const glass = pane(page);
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await writeControl(page, { forceWebGlCompatibilityBackend: true });
    await page.getByLabel("Raw RTT — bypass DOF").check();
    const authorizedPolicyEvidence = await captureNativePolicyEvidence(glass);
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
      .toContainEqual(expect.objectContaining({
        kind: "runtime-observed",
        rendererFamily: "webgpu-renderer",
        executionApi: "webgl2",
      }));

    const failedRequestId = await glass.getAttribute("data-frame-request-id");
    const failedGeneration = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations?.[0] ?? null);
    if (!failedRequestId || !failedGeneration) throw new Error("Compatibility-backend attempt identity was not captured");
    expect(authorizedPolicyEvidence.policyEvidenceRevision).toBe(r187RawEvidenceRevision);
    const compatibilityEvents = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
    const compatibilityRuntime = compatibilityEvents.find((event) =>
      event.kind === "runtime-observed" && event.generationId === failedGeneration,
    );
    await recordM7cObservation(page, {
      kind: "webgl2-compatibility-control",
      generationId: failedGeneration,
      policyEvidenceRevision: authorizedPolicyEvidence.policyEvidenceRevision,
      runtimeIdentity: compatibilityRuntime?.kind === "runtime-observed" ? {
        rendererRevision: compatibilityRuntime.rendererRevision,
        rendererFamily: compatibilityRuntime.rendererFamily,
        executionApi: compatibilityRuntime.executionApi,
        internalFallback: compatibilityRuntime.internalFallback,
      } : null,
      nativeWebGpuQualified: false,
    });
    await assertConfirmedWebGlFallback(glass, page, failedRequestId, failedGeneration, "initialization", "unknown");

    const events = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
    expect(events).toContainEqual(expect.objectContaining({
      kind: "failure",
      generationId: failedGeneration,
      stage: "initialization",
      reason: expect.stringContaining("internal WebGL2 backend; native WebGPU is required"),
    }));
    expect(events).not.toContainEqual(expect.objectContaining({
      kind: "frame-completed",
      generationId: failedGeneration,
      requestId: failedRequestId,
    }));
    expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []))
      .toEqual([failedGeneration]);
  });

  test("M7A explicit retry and new session are developer actions, preserve history, and never loop", async ({ page }) => {
    test.setTimeout(360_000);
    const { glass, failedRequestId, failedGeneration } = await startNativePilot(page, ["initialization-after-target"]);
    await assertConfirmedWebGlFallback(glass, page, failedRequestId, failedGeneration, "initialization", "unknown");
    const firstSessionId = await glass.getAttribute("data-pilot-session-id");
    const firstAttemptGenerations = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    await expect(glass).toHaveAttribute("data-pilot-retry-status", "consumed");
    await expect(glass).toHaveAttribute("data-pilot-retry-failure-count", "1");

    await writeControl(page, { failurePoints: ["initialization-after-target"] });
    const explicitRetry = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.requestGroundGlassPilotRecoveryAction?.("default", "explicit-retry") ?? null,
    );
    const attemptsAfterExplicitRetry = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    expect(explicitRetry).toMatchObject({
      action: "explicit-retry",
      status: "authorized",
      pilotSessionId: firstSessionId,
      retryEpoch: 1,
      reason: null,
    });
    await expect(glass).toHaveAttribute("data-pilot-recovery-result", "authorized");
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []), { timeout: 120_000 })
      .toHaveLength(2);
    const retryGeneration = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations?.[1] ?? null);
    if (!retryGeneration) throw new Error("Explicit retry did not create its one authorized attempt");
    await assertConfirmedWebGlFallback(glass, page, failedRequestId, retryGeneration, "initialization", "unknown");
    await expect(glass).toHaveAttribute("data-pilot-retry-status", "consumed");
    await expect(glass).toHaveAttribute("data-pilot-retry-epoch", "1");
    await expect(glass).toHaveAttribute("data-pilot-retry-failure-count", "2");
    expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []))
      .toHaveLength(2);

    const generationBeforeInvalidAction = await glass.getAttribute("data-renderer-generation");
    const invalidAction = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.requestGroundGlassPilotRecoveryAction?.("default", "force-retry") ?? null,
    );
    const attemptsAfterInvalidAction = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    expect(invalidAction).toMatchObject({
      action: "invalid",
      invalidAction: "force-retry",
      status: "rejected",
      pilotSessionId: firstSessionId,
      retryEpoch: 1,
      reason: "invalid-recovery-action",
    });
    await expect(glass).toHaveAttribute("data-pilot-recovery-action", "invalid");
    await expect(glass).toHaveAttribute("data-pilot-recovery-result", "rejected");
    await expect(glass).toHaveAttribute("data-pilot-retry-status", "consumed");
    await expect(glass).toHaveAttribute("data-pilot-retry-epoch", "1");
    await expect(glass).toHaveAttribute("data-pilot-retry-failure-count", "2");
    expect(await glass.getAttribute("data-renderer-generation")).toBe(generationBeforeInvalidAction);
    expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []))
      .toHaveLength(2);

    const newSession = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.requestGroundGlassPilotRecoveryAction?.("default", "new-pilot-session") ?? null,
    );
    expect(newSession).toMatchObject({
      action: "new-pilot-session",
      status: "authorized",
      retryEpoch: 2,
      reason: null,
    });
    expect(newSession?.pilotSessionId).toBeTruthy();
    expect(newSession?.pilotSessionId).not.toBe(firstSessionId);
    await expect(glass).toHaveAttribute("data-pilot-session-id", newSession!.pilotSessionId!);
    await expect(glass).toHaveAttribute("data-pilot-retry-status", "explicit-retry-requested");
    await expect(glass).toHaveAttribute("data-pilot-retry-failure-count", "2");
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
    await expect(glass).toHaveAttribute("data-actual-execution-api", "webgpu");
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []), { timeout: 120_000 })
      .toHaveLength(3);
    const attemptsAfterNewSession = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    await recordM7cObservation(page, {
      kind: "authorized-recovery-actions",
      initialSessionId: firstSessionId,
      initialAttemptGenerations: firstAttemptGenerations,
      explicitRetry,
      attemptsAfterExplicitRetry,
      invalidAction,
      attemptsAfterInvalidAction,
      newSession,
      attemptsAfterNewSession,
    });
  });

  test("M7A injected device loss uses the native runtime failure and cleanup path", async ({ page }) => {
    test.setTimeout(300_000);
    const { glass, failedRequestId, failedGeneration } = await startNativePilot(page, []);
    await expect(glass).toHaveAttribute("data-actual-execution-api", "webgpu");
    await expect(glass).toHaveAttribute("data-last-completed-request-id", failedRequestId!, { timeout: 90_000 });
    const accepted = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.requestGroundGlassDeviceLoss?.("default") ?? false,
    );
    expect(accepted).toBe(true);
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
      .toContainEqual(expect.objectContaining({
        kind: "failure",
        generationId: failedGeneration,
        stage: "runtime",
        operation: "unknown",
        reason: expect.stringContaining("device-loss equivalent"),
      }));
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
      .toContainEqual(expect.objectContaining({ kind: "cleanup", generationId: failedGeneration, outcome: "confirmed" }));
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 120_000 });
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
    await expect(glass).toHaveAttribute("data-pilot-retry-status", "consumed");
    await expect(glass).toHaveAttribute("data-pilot-failure-backend", "webgpu");
    await expect(glass).toHaveAttribute("data-pilot-failure-stage", "runtime");
    expect(await glass.getAttribute("data-last-completed-request-id")).toBe(failedRequestId);
    expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []))
      .toEqual([failedGeneration]);
  });

  test("M7B test-destroyed GPUDevice resolves its actual lost promise through the owned failure path", async ({ page }) => {
    test.setTimeout(300_000);
    const { glass, failedGeneration } = await startNativePilot(page, [], { holdQueueCompletion: true });
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
    await expect(glass).toHaveAttribute("data-actual-execution-api", "webgpu");
    await expect(glass).toHaveAttribute("data-internal-fallback", "none");
    const activeRequestId = await waitForStableRequestId(page, glass);
    await expect.poll(async () => page.evaluate(() => Boolean(window.__groundGlassWebGpuM3TestControl?.queueCompletionBarrierReached)))
      .toBe(true);
    const destroyRequested = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.requestGroundGlassDeviceDestroy?.("default") ?? false,
    );
    expect(destroyRequested).toBe(true);
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({
        kind: "device-lost-observed",
        generationId: failedGeneration,
        cause: "test-destroy",
      }));
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseQueueCompletion?.());
    await assertConfirmedWebGlFallback(glass, page, activeRequestId!, failedGeneration, "runtime", "unknown");
    const events = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
    const destroyEvent = events.find((event) => event.kind === "device-destroy-requested" && event.generationId === failedGeneration);
    const lostEvent = events.find((event) => event.kind === "device-lost-observed" && event.generationId === failedGeneration);
    const failureEvents = events.filter((event) => event.kind === "failure" && event.generationId === failedGeneration);
    const cleanupEvents = events.filter((event) => event.kind === "cleanup" && event.generationId === failedGeneration);
    expect(destroyEvent).toBeTruthy();
    expect(lostEvent).toBeTruthy();
    expect(lostEvent!.sequence).toBeGreaterThan(destroyEvent!.sequence!);
    expect(failureEvents).toHaveLength(1);
    expect(cleanupEvents).toHaveLength(1);
    expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []))
      .toEqual([failedGeneration]);
    expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.requestGroundGlassDeviceDestroy?.("default") ?? false))
      .toBe(false);
  });

  test("M7B current WebGL context loss is terminal across client-side remount", async ({ page }) => {
    test.setTimeout(240_000);
    await installControl(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
    const glass = pane(page);
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await expect(glass).toHaveAttribute("data-policy-requested-backend", "default");
    await expect(glass).toHaveAttribute("data-policy-selected-backend", "webgl");
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    await expect(glass).toHaveAttribute("data-actual-execution-api", /^webgl2?$/);
    const terminalRendererFamily = await glass.getAttribute("data-mounted-renderer-family");
    const terminalExecutionApi = await glass.getAttribute("data-actual-execution-api");
    const requestId = await waitForStableRequestId(page, glass);
    const generationId = await glass.getAttribute("data-renderer-generation");
    expect(generationId).toBeTruthy();
    const lossControlAvailable = await glass.locator("canvas").first().evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      return Boolean(context?.getExtension("WEBGL_lose_context"));
    });
    expect(lossControlAvailable).toBe(true);
    await glass.locator("canvas").first().evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error("The owned renderer canvas was unavailable");
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      const extension = context?.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("The owned WebGL context did not expose WEBGL_lose_context");
      extension.loseContext();
    });
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "unavailable", { timeout: 90_000 });
    await expect(glass).toHaveAttribute("data-render-cleanup-status", "confirmed");
    await expect(glass).toHaveAttribute("data-last-failure-generation-id", generationId!);
    await expect(glass).toHaveAttribute("data-last-failure-request-id", requestId!);
    await expect(glass).toHaveAttribute("data-last-failure-channel-id", "default");
    await expect(glass).toHaveAttribute("data-pilot-failure-stage", "runtime");
    await expect(glass).not.toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    const failedFrame = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.adapterEvents?.find((event) => event.kind === "failed-frame-result") ?? null,
    );
    expect(failedFrame).toMatchObject({
      channelId: "default",
      generationId,
      requestId,
      acceptedByHost: true,
    });
    expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []))
      .toEqual([]);
    const mountedCount = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.adapterEvents?.filter((event) => event.kind === "renderer-mounted").length ?? 0,
    );

    await page.getByRole("link", { name: "All Scenes", exact: true }).click();
    await expect(page).toHaveURL(/\/scenes$/);
    await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/interior-corner"]').click();
    await expect(page).toHaveURL(/\/simulator\/free\/interior-corner$/);
    await page.getByRole("link", { name: "All Scenes", exact: true }).click();
    await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/architecture-rise"]').click();
    await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
    const remountedGlass = pane(page);
    await expect(remountedGlass).toHaveAttribute("data-render-host-lifecycle", "unavailable", { timeout: 90_000 });
    await expect(remountedGlass).not.toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []))
      .toEqual([]);
    expect(await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.adapterEvents?.filter((event) => event.kind === "renderer-mounted").length ?? 0,
    )).toBe(mountedCount);
    const eventsAfterRemount = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
    const acceptedSuccessesAfterTerminalFailure = eventsAfterRemount.filter((event) =>
      event.kind === "host-frame-result" && event.acceptedByHost &&
      (event.sequence ?? Number.POSITIVE_INFINITY) > (failedFrame?.sequence ?? Number.POSITIVE_INFINITY),
    );
    expect(acceptedSuccessesAfterTerminalFailure).toEqual([]);
    expect(eventsAfterRemount.filter((event) =>
      event.kind === "host-frame-result" && event.generationId === generationId &&
      (event.sequence ?? Number.POSITIVE_INFINITY) > (failedFrame?.sequence ?? Number.POSITIVE_INFINITY),
    )).toEqual([]);
    await recordM7cObservation(page, {
      kind: "terminal-webgl-context-loss",
      generationId,
      requestId,
      rendererFamily: terminalRendererFamily,
      executionApi: terminalExecutionApi,
      cleanupStatus: await remountedGlass.getAttribute("data-render-cleanup-status"),
      failureSequence: failedFrame?.sequence ?? null,
      lifecycleAfterRemount: await remountedGlass.getAttribute("data-render-host-lifecycle"),
      remountRendererFamily: await remountedGlass.getAttribute("data-mounted-renderer-family"),
      adapterAttemptGenerationsAfterRemount: await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []),
    });
  });

  for (const scenario of [
    {
      name: "physical writer",
      point: "physical-coc-after-submit" as const,
      completedPasses: "sceneDepth",
    },
    {
      name: "physical validity writer",
      point: "physical-validity-after-submit" as const,
      completedPasses: "sceneDepth,physicalCoc",
    },
  ]) {
    test(`M4 ${scenario.name} failure stays local while Raw completes and the next request recovers`, async ({ page }, testInfo) => {
      test.skip(!physicalResearchEnabled, "Requires the separate M4 physical research build gate");
      test.setTimeout(300_000);
      const { glass, failedRequestId, failedGeneration } = await startNativePilot(page, [scenario.point]);
      const pilot = page.getByTestId("ground-glass-webgpu-pilot");
      await expect(pilot).toHaveAttribute("data-physical-coc-status", "failed", { timeout: 120_000 });
      await expect(pilot).toHaveAttribute("data-physical-coc-request-id", failedRequestId);
      await expect(pilot).toHaveAttribute("data-physical-coc-passes", scenario.completedPasses);
      await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
      await expect(glass).toHaveAttribute("data-actual-execution-api", "webgpu");
      await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready");
      await expect(glass).toHaveAttribute("data-last-completed-request-id", failedRequestId, { timeout: 90_000 });
      const initialGeneration = await glass.getAttribute("data-renderer-generation");
      expect(initialGeneration).toBe(failedGeneration);

      const events = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
      expect(events).toContainEqual(expect.objectContaining({
        kind: "frame-completed",
        generationId: failedGeneration,
        requestId: failedRequestId,
      }));
      expect(events).not.toContainEqual(expect.objectContaining({
        kind: "failure",
        generationId: failedGeneration,
      }));
      expect(events).not.toContainEqual(expect.objectContaining({
        kind: "cleanup",
        generationId: failedGeneration,
      }));
      const acceptedFailureFrame = events.find((event) =>
        event.kind === "host-frame-result" && event.requestId === failedRequestId,
      );
      expect(acceptedFailureFrame).toMatchObject({
        kind: "host-frame-result",
        requestId: failedRequestId,
        generationId: failedGeneration,
        sceneId: "architecture-rise",
        channelId: "default",
        frameStatus: "completed",
        acceptedByHost: true,
        latestAcceptedRequestId: failedRequestId,
        activeGenerationId: failedGeneration,
        activeRendererFamily: "webgpu-renderer",
      });
      const failureEvidence = {
        scenario: scenario.name,
        failurePoint: scenario.point,
        browserVersion: page.context().browser()?.version() ?? "unknown",
        operatingSystem: `${process.platform} ${process.arch}`,
        threeRevision: REVISION,
        sourceSha: process.env.GROUND_GLASS_EVIDENCE_SOURCE_SHA ?? "missing",
        testProject: testInfo.project.name,
        testInvocation: process.env.GROUND_GLASS_EVIDENCE_TEST_INVOCATION ?? "missing",
        rendererFamily: await glass.getAttribute("data-mounted-renderer-family"),
        actualExecutionApi: await glass.getAttribute("data-actual-execution-api"),
        internalFallback: await glass.getAttribute("data-internal-fallback"),
        requestId: failedRequestId,
        channelId: await glass.getAttribute("data-frame-channel-id"),
        sceneId: await glass.getAttribute("data-frame-scene-id"),
        generationId: failedGeneration,
        physicalStatusAtInjectedFailure: await pilot.getAttribute("data-physical-coc-status"),
        completedPhysicalPassesAtInjectedFailure: await pilot.getAttribute("data-physical-coc-passes"),
        rawFrameCompleted: events.some((event) =>
          event.kind === "frame-completed" && event.requestId === failedRequestId && event.generationId === failedGeneration,
        ),
        acceptedHostFrameResult: acceptedFailureFrame,
        adapterEventsAtFailure: events.filter((event) =>
          "generationId" in event && event.generationId === failedGeneration &&
          (!("requestId" in event) || event.requestId === failedRequestId),
        ),
      };

      const focus = page.getByRole("slider", { name: "Focus distance" });
      const currentFocus = Number(await focus.inputValue());
      const focusStep = Number(await focus.getAttribute("step"));
      await setStepRangeInput(page, "Focus distance", currentFocus + focusStep);
      const recoveredRequestId = await waitForStableRequestId(page, glass);
      expect(recoveredRequestId).not.toBe(failedRequestId);
      await expect(pilot).toHaveAttribute("data-physical-coc-status", "completed", { timeout: 120_000 });
      await expect(pilot).toHaveAttribute("data-physical-coc-request-id", recoveredRequestId!);
      await expect(pilot).toHaveAttribute("data-physical-coc-passes", "sceneDepth,physicalCoc,validity");
      await expect(glass).toHaveAttribute("data-last-completed-request-id", recoveredRequestId!, { timeout: 90_000 });
      expect(await glass.getAttribute("data-renderer-generation")).toBe(initialGeneration);
      await testInfo.attach(`ground-glass-m4-${scenario.point}-failure-evidence.json`, {
        body: JSON.stringify({ ...failureEvidence, recoveredRequestId }, null, 2),
        contentType: "application/json",
      });
    });
  }

  test("M4 unsupported physical storage reports unsupported while native Raw remains available", async ({ page }, testInfo) => {
    test.skip(!physicalResearchEnabled, "Requires the separate M4 physical research build gate");
    test.setTimeout(240_000);
    const { glass, failedRequestId, failedGeneration } = await startNativePilot(
      page,
      [],
      { forcePhysicalCocUnsupported: true },
    );
    const pilot = page.getByTestId("ground-glass-webgpu-pilot");
    await expect(pilot).toHaveAttribute("data-physical-coc-status", "unsupported", { timeout: 120_000 });
    await expect(pilot).toHaveAttribute("data-physical-coc-passes", "");
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
    await expect(glass).toHaveAttribute("data-actual-execution-api", "webgpu");
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready");
    await expect(glass).toHaveAttribute("data-last-completed-request-id", failedRequestId, { timeout: 90_000 });
    expect(await glass.getAttribute("data-renderer-generation")).toBe(failedGeneration);
    const events = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
    expect(events).toContainEqual(expect.objectContaining({
      kind: "frame-completed",
      generationId: failedGeneration,
      requestId: failedRequestId,
    }));
    expect(events).not.toContainEqual(expect.objectContaining({ kind: "failure", generationId: failedGeneration }));
    expect(events).not.toContainEqual(expect.objectContaining({ kind: "cleanup", generationId: failedGeneration }));
    const acceptedUnsupportedFrame = events.find((event) =>
      event.kind === "host-frame-result" && event.requestId === failedRequestId,
    );
    expect(acceptedUnsupportedFrame).toMatchObject({
      kind: "host-frame-result",
      requestId: failedRequestId,
      generationId: failedGeneration,
      frameStatus: "completed",
      acceptedByHost: true,
      activeGenerationId: failedGeneration,
      activeRendererFamily: "webgpu-renderer",
    });
    await testInfo.attach("ground-glass-m4-unsupported-storage-evidence.json", {
      body: JSON.stringify({
        test: "M4 unsupported physical storage reports unsupported while native Raw remains available",
        browserVersion: page.context().browser()?.version() ?? "unknown",
        operatingSystem: `${process.platform} ${process.arch}`,
        threeRevision: REVISION,
        sourceSha: process.env.GROUND_GLASS_EVIDENCE_SOURCE_SHA ?? "missing",
        testProject: testInfo.project.name,
        testInvocation: process.env.GROUND_GLASS_EVIDENCE_TEST_INVOCATION ?? "missing",
        rendererFamily: await glass.getAttribute("data-mounted-renderer-family"),
        actualExecutionApi: await glass.getAttribute("data-actual-execution-api"),
        requestId: failedRequestId,
        channelId: await glass.getAttribute("data-frame-channel-id"),
        sceneId: await glass.getAttribute("data-frame-scene-id"),
        generationId: failedGeneration,
        physicalStatus: await pilot.getAttribute("data-physical-coc-status"),
        physicalCompletedPasses: await pilot.getAttribute("data-physical-coc-passes"),
        rawLastCompletedRequestId: await glass.getAttribute("data-last-completed-request-id"),
        acceptedHostFrameResult: acceptedUnsupportedFrame,
        adapterEvents: events,
      }, null, 2),
      contentType: "application/json",
    });
  });

  test("D6 latest request wins after a held adapter failure and an out-of-order fallback completion", async ({ page }) => {
    test.setTimeout(300_000);
    await installControl(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
    const glass = pane(page);
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    await writeControl(page, {
      failurePoints: ["scene-render-after-submit"],
      holdAdapterOperationAfterFailure: true,
    });
    await page.getByLabel("Raw RTT — bypass DOF").check();
    const authorizedPolicyEvidence = await captureNativePolicyEvidence(glass);
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
      .toContainEqual(expect.objectContaining({
        kind: "runtime-observed",
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
      }));
    await expect.poll(async () => page.evaluate(() => Boolean(window.__groundGlassWebGpuM3TestControl?.adapterOperationBarrierReached))).toBe(true);
    const r1 = await waitForStableRequestId(page, glass);
    const oldGeneration = await glass.getAttribute("data-renderer-generation");
    if (!oldGeneration) throw new Error("Native generation identity was not captured");
    await recordNativePolicyObservation(page, glass, oldGeneration, authorizedPolicyEvidence);
    await setStepRangeInput(page, "Focus distance", 8000);
    await page.getByRole("combobox", { name: "Render quality", exact: true }).selectOption("low");
    const stage = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
    await clickStageAt(page, stage, 0.68, 0.36);
    const r2 = await waitForStableRequestId(page, glass);
    expect(r1).toBeTruthy();
    expect(r2).toBeTruthy();
    expect(r2).not.toBe(r1);
    await writeControl(page, { holdNextCompletedFrame: true });
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseAdapterOperation?.());
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({
        kind: "cleanup",
        generationId: oldGeneration,
        outcome: "confirmed",
      }));
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 90_000 });
    await expect(glass).toHaveAttribute("data-frame-request-id", r2!);
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.heldFrameRequestId ?? null), { timeout: 90_000 }).toBe(r2);
    const fallbackGeneration = await glass.getAttribute("data-renderer-generation");
    expect(fallbackGeneration).toBeTruthy();
    expect(fallbackGeneration).not.toBe(oldGeneration);
    await page.getByRole("radio", { name: "f/16" }).check();
    const r3 = await glass.getAttribute("data-frame-request-id");
    expect(r3).toBeTruthy();
    expect(r3).not.toBe(r2);
    await expect(glass).toHaveAttribute("data-frame-channel-id", "default");
    await expect(glass).toHaveAttribute("data-frame-scene-id", "architecture-rise");
    await expect(glass).toHaveAttribute("data-last-completed-request-id", r3!, { timeout: 90_000 });
    const currentRequestEvents = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
    const currentPublicationBeforeStaleRelease = currentRequestEvents.find((event) =>
      event.kind === "host-frame-result" && event.requestId === r3 && event.acceptedByHost === true &&
      event.generationId === fallbackGeneration,
    );
    expect(currentPublicationBeforeStaleRelease).toBeTruthy();
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseHeldFrame?.());
    await expect.poll(async () => page.evaluate((request) =>
      window.__groundGlassWebGpuM3TestControl?.adapterEvents?.find((event) =>
        event.kind === "host-frame-result" && event.requestId === request.staleRequestId &&
        event.generationId === request.replacementGeneration && event.acceptedByHost === false &&
        event.latestAcceptedRequestId === request.latestRequestId,
      ) ?? null,
    { staleRequestId: r2, latestRequestId: r3, replacementGeneration: fallbackGeneration }), { timeout: 90_000 }).toMatchObject({
      kind: "host-frame-result",
      requestId: r2,
      generationId: fallbackGeneration,
      frameStatus: "completed",
      acceptedByHost: false,
      latestAcceptedRequestId: r3,
      activeGenerationId: fallbackGeneration,
      activeRendererFamily: "webgl-renderer",
    });
    await expect(glass).toHaveAttribute("data-last-completed-request-id", r3!);
    await expect(glass).toHaveAttribute("data-renderer-generation", fallbackGeneration!);
    const adapterAttempts = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    expect(adapterAttempts).toEqual([oldGeneration]);
    const finalEvents = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
    const stalePublication = finalEvents.find((event) =>
      event.kind === "host-frame-result" && event.requestId === r2 && event.generationId === fallbackGeneration &&
      event.acceptedByHost === false && event.latestAcceptedRequestId === r3,
    );
    const acceptedLatestPublication = finalEvents.find((event) =>
      event.kind === "host-frame-result" && event.requestId === r3 && event.generationId === fallbackGeneration &&
      event.acceptedByHost === true,
    );
    const staleHostPublication = stalePublication?.kind === "host-frame-result" ? stalePublication : undefined;
    const acceptedHostPublication = acceptedLatestPublication?.kind === "host-frame-result" ? acceptedLatestPublication : undefined;
    expect(staleHostPublication?.acceptedByHost).toBe(false);
    expect(staleHostPublication?.latestAcceptedRequestId).toBe(r3);
    expect(staleHostPublication!.sequence).toBeGreaterThan(acceptedHostPublication!.sequence!);
    const viewport = page.getByLabel("GroundGlassViewport").locator("[data-zoomed]");
    await recordM7cObservation(page, {
      kind: "latest-request-interleaving",
      requests: { firstFailedRequestId: r1, staleRequestId: r2, latestAcceptedRequestId: r3 },
      generations: { failedNativeGeneration: oldGeneration, replacementWebGlGeneration: fallbackGeneration },
      currentPublicationSequence: acceptedHostPublication?.sequence ?? null,
      staleRejectedPublicationSequence: staleHostPublication?.sequence ?? null,
      latestRequestIdentity: {
        channelId: await glass.getAttribute("data-frame-channel-id"),
        sceneId: await glass.getAttribute("data-frame-scene-id"),
        rendererFamily: await glass.getAttribute("data-mounted-renderer-family"),
        renderQuality: await page.getByRole("combobox", { name: "Render quality", exact: true }).inputValue(),
        dimensions: {
          width: await glass.getAttribute("data-rtt-internal-width"),
          height: await glass.getAttribute("data-rtt-internal-height"),
        },
        stagePan: {
          x: await viewport.getAttribute("data-pan-x"),
          y: await viewport.getAttribute("data-pan-y"),
        },
      },
      changedInputs: ["focus", "render-quality", "stage-pan", "aperture"],
      hostAcceptedLatestBeforeRejectingStale: true,
    });
  });
});
