import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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
  `m7b-${titlePath.at(-1)?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ?? "unknown"}`;

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
    return {
      controlPresent: window.__groundGlassWebGpuM3TestControl !== undefined,
      configuredFailurePoints: window.__groundGlassWebGpuM3TestControl?.configuredFailurePoints ?? [],
      adapterAttemptGenerations: window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? [],
      identities: {
        channelId: attribute("data-frame-channel-id") ?? attribute("data-rtt-channel"),
        pilotSessionId: attribute("data-pilot-session-id"),
        retryEpoch: attribute("data-pilot-retry-epoch"),
        hostId: hostEvents.at(-1)?.hostId ?? attribute("data-last-failure-host-id"),
        generationId: attribute("data-renderer-generation"),
        requestId: attribute("data-frame-request-id"),
        sceneId: attribute("data-frame-scene-id") ?? attribute("data-rtt-scene-id"),
        attemptIds: attemptEvents.map((event) => event.attemptId),
      },
      policy: {
        requestedBackend: attribute("data-policy-requested-backend"),
        selectedBackend: attribute("data-policy-selected-backend"),
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
      events,
    };
  }).catch((error: unknown) => ({ snapshotError: error instanceof Error ? error.message : String(error) }));
  const browser = page.context().browser();
  const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => null);
  const evidence = {
    schemaVersion: "ground-glass-m7b-native-observation-v1",
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
      flags: {
        nativeRequired: process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1",
        failureIntegrationEnabled: process.env.GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION === "1",
        rawPilotBuildEnabled,
      },
    },
    invocation: "npm run test:e2e -- --project=chrome-native-webgpu src/tests/e2e/ground-glass-webgpu-failure-host.spec.ts",
    observation: controlEvidence,
  };
  const body = JSON.stringify(evidence, null, 2);
  const outputPath = testInfo.outputPath("ground-glass-m7b-lifecycle-evidence.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, body);
  await testInfo.attach("ground-glass-m7b-lifecycle-evidence", {
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
  await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
    .toContainEqual(expect.objectContaining({
      kind: "runtime-observed",
      rendererFamily: "webgpu-renderer",
      executionApi: "webgpu",
    }));
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
    const adapter = page.getByTestId("ground-glass-webgpu-pilot");
    await expect(adapter).toHaveAttribute("data-actual-execution-api", "webgpu", { timeout: 120_000 });
    await expect.poll(async () => page.evaluate(() => Boolean(window.__groundGlassWebGpuM3TestControl?.queueCompletionBarrierReached))).toBe(true);
    const retiredGeneration = await glass.getAttribute("data-renderer-generation");
    await page.getByLabel("Raw RTT — bypass DOF").uncheck();
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "retiring");
    await expect(glass).toHaveAttribute("data-render-cleanup-status", "pending");
    expect(await glass.getAttribute("data-renderer-generation")).toBe(retiredGeneration);
    await expect(glass).not.toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseQueueCompletion?.());
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 90_000 })
      .toContainEqual(expect.objectContaining({
        kind: "cleanup",
        generationId: retiredGeneration,
        outcome: "confirmed",
      }));
    await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 90_000 });
    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
    const events = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []);
    expect(events).not.toContainEqual(expect.objectContaining({
      kind: "device-lost-observed",
      generationId: retiredGeneration,
    }));
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
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
      .toContainEqual(expect.objectContaining({
        kind: "runtime-observed",
        rendererFamily: "webgpu-renderer",
        executionApi: "webgl2",
      }));

    const failedRequestId = await glass.getAttribute("data-frame-request-id");
    const failedGeneration = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations?.[0] ?? null);
    if (!failedRequestId || !failedGeneration) throw new Error("Compatibility-backend attempt identity was not captured");
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
    await expect(glass).toHaveAttribute("data-pilot-retry-status", "consumed");
    await expect(glass).toHaveAttribute("data-pilot-retry-failure-count", "1");

    await writeControl(page, { failurePoints: ["initialization-after-target"] });
    const explicitRetry = await page.evaluate(() =>
      window.__groundGlassWebGpuM3TestControl?.requestGroundGlassPilotRecoveryAction?.("default", "explicit-retry") ?? null,
    );
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
    test(`M4 ${scenario.name} failure stays local while Raw completes and the next request recovers`, async ({ page }) => {
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
    });
  }

  test("M4 unsupported physical storage reports unsupported while native Raw remains available", async ({ page }) => {
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
    await expect.poll(async () => page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []), { timeout: 120_000 })
      .toContainEqual(expect.objectContaining({
        kind: "runtime-observed",
        rendererFamily: "webgpu-renderer",
        executionApi: "webgpu",
      }));
    await expect.poll(async () => page.evaluate(() => Boolean(window.__groundGlassWebGpuM3TestControl?.adapterOperationBarrierReached))).toBe(true);
    const r1 = await waitForStableRequestId(page, glass);
    const oldGeneration = await glass.getAttribute("data-renderer-generation");
    await setStepRangeInput(page, "Focus distance", 8000);
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
    await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.releaseHeldFrame?.());
    await expect(glass).toHaveAttribute("data-last-completed-request-id", r3!);
    await expect(glass).toHaveAttribute("data-renderer-generation", fallbackGeneration!);
    const adapterAttempts = await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []);
    expect(adapterAttempts).toEqual([oldGeneration]);
  });
});
