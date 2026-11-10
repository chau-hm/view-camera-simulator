import { mkdir, writeFile } from "node:fs/promises";
import { arch, release } from "node:os";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { REVISION } from "three";
import { expect, test } from "@playwright/test";
import { setStepRangeInput } from "../../src/tests/e2e/helpers/stepRangeInput";
import {
  ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
} from "../../src/render/webgpu/groundGlassRawWebGpuCompatibility";

const nativeRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const rawPilotEnabled = process.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true";

test.skip(
  !nativeRequired || !rawPilotEnabled,
  "Requires headed native WebGPU Chrome and the explicit development Raw RTT pilot flag",
);

test("RQ2.1 v2 native M3 Raw runs in the application and cleans up on scene transition", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  expect(REVISION).toBe("187");
  expect(ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION).toBe("architecture-rise-raw-rtt-v2");
  expect(ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION)
    .toBe("m3-architecture-rise-raw-rtt-native-r187-v2");

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const testWindow = window as Window & {
      __groundGlassWebGpuM3TestControl?: {
        adapterEvents?: unknown[];
        adapterAttemptGenerations?: string[];
      };
    };
    testWindow.__groundGlassWebGpuM3TestControl = {
      adapterEvents: [],
      adapterAttemptGenerations: [],
    };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");

  const glass = page.getByTestId("ground-glass-rtt").first();
  await expect(glass).toHaveAttribute("data-rtt-scene-id", "architecture-rise");
  await expect(glass).toHaveAttribute("data-three-revision", "187");
  await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(glass).toHaveAttribute("data-actual-execution-api", "webgl2");
  await expect(glass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expect(glass).toHaveAttribute("data-policy-selected-backend", "webgpu", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(glass).toHaveAttribute("data-mounted-renderer-revision", "r187");
  await expect(glass).toHaveAttribute("data-mounted-scene-source-revision", ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION);
  await expect(glass).toHaveAttribute("data-policy-evidence-revisions", ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION);
  await expect(glass).toHaveAttribute("data-mounted-verification-evidence-revision", ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION);
  await expect(glass).toHaveAttribute("data-application-fallback", "not-observed");
  await expect(glass).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  const generationId = await glass.getAttribute("data-renderer-generation");
  expect(generationId).toBeTruthy();
  const adapter = glass.getByTestId("ground-glass-webgpu-pilot");
  await expect(adapter).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(adapter).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(adapter).toHaveAttribute("data-internal-fallback", "none");

  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const focusValue = Number(await focus.inputValue());
  const focusStep = Number(await focus.getAttribute("step"));
  await setStepRangeInput(page, "Focus distance", focusValue + focusStep);
  const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  await aperture.getByRole("radio", { name: "f/8", exact: true }).check();
  const rise = page.getByRole("slider", { name: "Rise", exact: true });
  await setStepRangeInput(page, "Rise", 20);
  await expect(rise).toHaveValue("20");
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(glass).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(glass).toHaveAttribute("data-mounted-scene-source-revision", ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION);
  await expect(glass).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  const requestId = await glass.getAttribute("data-frame-request-id");
  expect(requestId).toBeTruthy();
  await expect(glass).toHaveAttribute("data-last-completed-request-id", requestId!, { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-frame-result-status", "completed");

  const cameraState = {
    focalLengthMm: Number(await glass.getAttribute("data-rtt-focal-length-mm")),
    focusDistanceMm: Number(await focus.inputValue()),
    apertureFNumber: Number(await aperture.getAttribute("data-selected-aperture")),
    frontRiseMm: Number(await rise.inputValue()),
  };
  expect(cameraState).toMatchObject({ focalLengthMm: 150, apertureFNumber: 8, frontRiseMm: 20 });
  const screenshot = await glass.screenshot({ animations: "disabled" });
  await testInfo.attach("rq2.1-native-v2-application-raw.png", { body: screenshot, contentType: "image/png" });

  const runtimeEvidence = await glass.evaluate((element) => ({
    selectedBackend: element.getAttribute("data-policy-selected-backend"),
    rendererFamily: element.getAttribute("data-mounted-renderer-family"),
    executionApi: element.getAttribute("data-actual-execution-api"),
    rendererRevision: element.getAttribute("data-mounted-renderer-revision"),
    sceneSourceRevision: element.getAttribute("data-mounted-scene-source-revision"),
    policyEvidenceRevision: element.getAttribute("data-policy-evidence-revisions"),
    mountedEvidenceRevision: element.getAttribute("data-mounted-verification-evidence-revision"),
    applicationFallback: element.getAttribute("data-application-fallback"),
    internalFallback: element.querySelector<HTMLElement>("[data-testid='ground-glass-webgpu-pilot']")
      ?.getAttribute("data-internal-fallback"),
    sceneId: element.getAttribute("data-frame-scene-id"),
    channelId: element.getAttribute("data-frame-channel-id"),
    generationId: element.getAttribute("data-renderer-generation"),
    requestId: element.getAttribute("data-frame-request-id"),
    lastCompletedRequestId: element.getAttribute("data-last-completed-request-id"),
    frameStatus: element.getAttribute("data-frame-result-status"),
    rawContentful: element.getAttribute("data-rtt-raw-contentful"),
    finalContentful: element.getAttribute("data-rtt-final-contentful"),
  }));
  expect(runtimeEvidence).toMatchObject({
    selectedBackend: "webgpu",
    rendererFamily: "webgpu-renderer",
    executionApi: "webgpu",
    rendererRevision: "r187",
    sceneSourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
    policyEvidenceRevision: ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
    mountedEvidenceRevision: ARCHITECTURE_RISE_RAW_RTT_R187_EVIDENCE_REVISION,
    applicationFallback: "not-observed",
    internalFallback: "none",
    sceneId: "architecture-rise",
    channelId: "default",
    generationId,
    requestId,
    lastCompletedRequestId: requestId,
    frameStatus: "completed",
    rawContentful: "true",
    finalContentful: "true",
  });

  await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/interior-corner"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/interior-corner$/);
  const nextGlass = page.getByTestId("ground-glass-rtt").first();
  await expect(nextGlass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(nextGlass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(nextGlass).toHaveAttribute("data-actual-execution-api", "webgl2");

  const lifecycleEvents = await page.evaluate(() => {
    const testWindow = window as Window & {
      __groundGlassWebGpuM3TestControl?: { adapterEvents?: Array<Record<string, unknown>> };
    };
    return testWindow.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [];
  });
  const acceptedFrame = lifecycleEvents.find((event) =>
    event.kind === "host-frame-result" && event.generationId === generationId &&
    event.requestId === requestId && event.acceptedByHost === true &&
    event.latestAcceptedRequestId === requestId && event.frameStatus === "completed",
  );
  const cleanup = lifecycleEvents.find((event) =>
    event.kind === "cleanup-acknowledged" && event.generationId === generationId &&
    event.outcome === "confirmed",
  );
  expect(acceptedFrame).toBeDefined();
  expect(cleanup).toBeDefined();
  expect(await page.evaluate(() => window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? []))
    .toEqual([generationId]);
  expect(pageErrors).toEqual([]);

  const runtimeRecord = {
    schemaVersion: "rq2.1-native-m3-v2-runtime-v1",
    captureSourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    test: { title: testInfo.title, status: testInfo.status, expectedStatus: testInfo.expectedStatus },
    invocation: process.env.GROUND_GLASS_RQ21_TEST_INVOCATION ?? null,
    environment: {
      testProject: testInfo.project.name,
      browserName: page.context().browser()?.browserType().name() ?? null,
      browserVersion: page.context().browser()?.version() ?? null,
      userAgent: await page.evaluate(() => navigator.userAgent),
      operatingSystem: {
        platform: process.platform,
        release: release(),
        architecture: arch(),
        nodeVersion: process.version,
      },
      threeRevision: REVISION,
    },
    runtime: runtimeEvidence,
    cameraState,
    changes: { focus: true, aperture: true, frontRise: true },
    acceptedFrame,
    cleanup,
    nextSceneRenderer: await nextGlass.getAttribute("data-mounted-renderer-family"),
    limitations: ["One headed Chrome/macOS environment; hardware acceleration and other platforms are not qualified."],
  };
  await testInfo.attach("rq2.1-native-v2-runtime.json", {
    body: JSON.stringify(runtimeRecord, null, 2),
    contentType: "application/json",
  });
  const evidenceDirectory = process.env.GROUND_GLASS_RQ21_CAPTURE_DIR;
  if (evidenceDirectory) {
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(join(evidenceDirectory, "rq2.1-native-v2-runtime.json"), JSON.stringify(runtimeRecord, null, 2) + "\n");
  }
});
