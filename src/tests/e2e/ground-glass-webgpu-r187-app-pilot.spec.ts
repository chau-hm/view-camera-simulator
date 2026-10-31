import { REVISION } from "three";
import { expect, test } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const nativeRequired = process.env.GROUND_GLASS_NATIVE_WEBGPU_REQUIRED === "1";
const rawPilotEnabled = process.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true";

test.skip(
  !nativeRequired || !rawPilotEnabled,
  "Requires headed native WebGPU Chrome and the explicit development Raw RTT pilot flag",
);

test("r187 native M3 Raw RTT runs in the application and disposes on scene transition", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  expect(REVISION).toBe("187");

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
  await expect(glass).toHaveAttribute("data-three-revision", "187");
  await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(glass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  const logicalWidth = Number(await glass.getAttribute("data-rtt-logical-width"));
  const highDprWidth = Number(await glass.getAttribute("data-rtt-internal-width"));
  expect(logicalWidth).toBeGreaterThan(0);
  expect(await glass.getAttribute("data-rtt-effective-device-pixel-ratio")).toBe("2");
  expect(highDprWidth).toBe(Math.round(
    logicalWidth * Number(await glass.getAttribute("data-rtt-resolution-scale")) * 2,
  ));
  expect(Number(await glass.getAttribute("data-rtt-color-target-width"))).toBe(highDprWidth);
  expect(Number(await glass.getAttribute("data-rtt-final-target-width"))).toBe(highDprWidth);
  const renderQuality = page.getByRole("combobox", { name: "Render quality", exact: true });
  await renderQuality.selectOption("low");
  await expect(glass).toHaveAttribute("data-rtt-resolution-scale", "0.65");
  const lowResolutionScale = Number(await glass.getAttribute("data-rtt-resolution-scale"));
  await expect.poll(async () => Number(await glass.getAttribute("data-rtt-internal-width")))
    .toBe(Math.round(logicalWidth * lowResolutionScale));
  await expect(glass).toHaveAttribute("data-rtt-effective-device-pixel-ratio", "1");
  expect(lowResolutionScale).toBe(0.65);
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(glass).toHaveAttribute("data-actual-execution-api", "webgl2");
  await expect(glass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await renderQuality.selectOption("high");
  await expect.poll(async () => Number(await glass.getAttribute("data-rtt-internal-width")))
    .toBe(Math.round(logicalWidth * 2));
  await expect(glass).toHaveAttribute("data-rtt-effective-device-pixel-ratio", "2");
  await expect(glass).toHaveAttribute("data-rtt-color-target-width", String(highDprWidth));

  await page.getByLabel("Raw RTT — bypass DOF").check();
  await expect(glass).toHaveAttribute("data-policy-selected-backend", "webgpu", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 90_000 });
  await expect(glass).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(glass).toHaveAttribute("data-policy-evidence-revisions", "m3-architecture-rise-raw-rtt-native-r187-v1");
  await expect(glass).toHaveAttribute("data-mounted-renderer-revision", "r187");
  const policyEvidenceRevision = await glass.getAttribute("data-policy-evidence-revisions");
  expect(policyEvidenceRevision).toBe("m3-architecture-rise-raw-rtt-native-r187-v1");
  await expect.poll(() => glass.getAttribute("data-mounted-verification-evidence-revision"))
    .toBe(policyEvidenceRevision);
  await expect(glass).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  await expect(glass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  const webGpuGeneration = await glass.getAttribute("data-renderer-generation");
  expect(webGpuGeneration).toBeTruthy();
  const webGpuAdapter = glass.getByTestId("ground-glass-webgpu-pilot");
  await expect(webGpuAdapter).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(webGpuAdapter).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(webGpuAdapter).toHaveAttribute("data-internal-fallback", "none");

  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const focusValue = Number(await focus.inputValue());
  const focusStep = Number(await focus.getAttribute("step"));
  await setStepRangeInput(page, "Focus distance", focusValue + focusStep);
  await page.getByRole("radiogroup", { name: "Aperture", exact: true })
    .getByRole("radio", { name: "f/8", exact: true }).check();
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  await expect(glass).toHaveAttribute("data-actual-execution-api", "webgpu");
  await expect(glass).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });

  const screenshot = await glass.screenshot({ animations: "disabled" });
  await testInfo.attach("r187-native-application-raw-ground-glass.png", {
    body: screenshot,
    contentType: "image/png",
  });
  const runtimeEvidence = await glass.evaluate((element) => ({
    adapterInternalFallback: element.querySelector<HTMLElement>("[data-testid='ground-glass-webgpu-pilot']")
      ?.getAttribute("data-internal-fallback"),
    threeRevision: element.getAttribute("data-three-revision"),
    selectedBackend: element.getAttribute("data-policy-selected-backend"),
    rendererFamily: element.getAttribute("data-mounted-renderer-family"),
    executionApi: element.getAttribute("data-actual-execution-api"),
    policyEvidenceRevisions: element.getAttribute("data-policy-evidence-revisions"),
    mountedRendererRevision: element.getAttribute("data-mounted-renderer-revision"),
    mountedEvidenceRevision: element.getAttribute("data-mounted-verification-evidence-revision"),
    applicationFallback: element.getAttribute("data-application-fallback"),
    generation: element.getAttribute("data-renderer-generation"),
    rawContentful: element.getAttribute("data-rtt-raw-contentful"),
    finalContentful: element.getAttribute("data-rtt-final-contentful"),
    renderTargetDimensions: {
      internal: [element.getAttribute("data-rtt-internal-width"), element.getAttribute("data-rtt-internal-height")],
      color: [element.getAttribute("data-rtt-color-target-width"), element.getAttribute("data-rtt-color-target-height")],
      final: [element.getAttribute("data-rtt-final-target-width"), element.getAttribute("data-rtt-final-target-height")],
    },
  }));
  expect(runtimeEvidence).toMatchObject({
    threeRevision: "187",
    selectedBackend: "webgpu",
    rendererFamily: "webgpu-renderer",
    executionApi: "webgpu",
    adapterInternalFallback: "none",
    policyEvidenceRevisions: "m3-architecture-rise-raw-rtt-native-r187-v1",
    mountedRendererRevision: "r187",
    mountedEvidenceRevision: "m3-architecture-rise-raw-rtt-native-r187-v1",
    applicationFallback: "not-observed",
    rawContentful: "true",
    finalContentful: "true",
  });
  await testInfo.attach("r187-native-application-raw-ground-glass-runtime.json", {
    body: JSON.stringify(runtimeEvidence, null, 2),
    contentType: "application/json",
  });

  await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await page.locator('article.scene-feature-card a.btn--primary[href="/simulator/free/interior-corner"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/interior-corner$/);
  const transitionedGlass = page.getByTestId("ground-glass-rtt").first();
  await expect(transitionedGlass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  await expect(transitionedGlass).toHaveAttribute("data-three-revision", "187");
  await expect(transitionedGlass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(transitionedGlass).toHaveAttribute("data-actual-execution-api", "webgl2");

  const lifecycle = await page.evaluate(() => {
    const testWindow = window as Window & {
      __groundGlassWebGpuM3TestControl?: { adapterEvents?: Array<Record<string, unknown>> };
    };
    return testWindow.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [];
  });
  expect(lifecycle).toContainEqual(expect.objectContaining({
    kind: "cleanup-acknowledged",
    generationId: webGpuGeneration,
    outcome: "confirmed",
  }));
  expect(pageErrors).toEqual([]);
});
