import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, release } from "node:os";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { REVISION } from "three";
import { expect, test, type Page } from "@playwright/test";
import { setStepRangeInput } from "../../src/tests/e2e/helpers/stepRangeInput";

type CameraState = {
  focalLengthMm: number;
  focusDistanceMm: number;
  apertureFNumber: number;
  frontRiseMm: number;
  frontShiftMm: number;
  frontTiltDeg: number;
  frontSwingDeg: number;
  rearRiseMm: number;
  rearShiftMm: number;
  rearTiltDeg: number;
  rearSwingDeg: number;
};

type CaptureSpec = {
  captureId: string;
  path: string;
  rendererFamily: string;
  executionApi: string;
  featureEvidenceRevision?: string;
  previewMode: "raw" | "upright";
  rawDebug: boolean;
  pipelineStage: string;
  referenceRole: string;
};

type CaptureState = { stateId: string; cameraState: CameraState; captures: CaptureSpec[] };
type StateManifest = {
  sceneId: string;
  route: string;
  sceneSourceRevision: string;
  rendererRevision: string;
  renderQuality: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  groundGlassOutputSizeCss: { width: number; height: number };
  states: CaptureState[];
  additionalReferences: CaptureSpec[];
  nativeRevalidation?: { featureEvidenceRevision: string; status: string };
};

const backend = process.env.RQ1_CAPTURE_BACKEND;
const outputDirectory = process.env.RQ1_CAPTURE_OUTPUT_DIR;
const repositoryRoot = process.cwd();
const captureProfile = process.env.RQ_CAPTURE_PROFILE ?? "rq1";
const comparisonLimit =
  "WebGL Raw Debug and native M3 Raw use different display implementations; this is a bounded Raw display comparison, not strict pixel parity.";

test.skip(!backend || !outputDirectory, "Run through render-quality:rq1:capture.");

test("RQ1 captures public Architecture Rise Ground Glass reference states", async ({ page }, testInfo) => {
  test.setTimeout(480_000);
  expect(["webgl", "webgpu"]).toContain(backend);
  expect(REVISION).toBe("187");

  const manifest = JSON.parse(
    await readFile(resolve(
      repositoryRoot,
      captureProfile === "rq2"
        ? "docs/render-quality/rq2-architecture-rise/states.json"
        : "docs/render-quality/rq1-baseline/states.json",
    ), "utf8"),
  ) as StateManifest;
  const nativeEvidenceRevision = manifest.nativeRevalidation?.featureEvidenceRevision ??
    manifest.states.flatMap((state) => state.captures)
      .find((capture) => capture.rendererFamily === "webgpu-renderer")?.featureEvidenceRevision;
  if (!nativeEvidenceRevision) throw new Error("Capture state manifest has no native M3 evidence revision.");
  expect(manifest.sceneId).toBe("architecture-rise");
  expect(manifest.states.map((state) => state.stateId)).toEqual([
    "architecture-rise-neutral",
    "architecture-rise-front-rise",
  ]);
  expect(manifest.viewport).toEqual({ width: 1280, height: 900, devicePixelRatio: 1 });

  const pageErrors: string[] = [];
  const captureRunId = process.env.RQ1_CAPTURE_RUN_ID;
  const captureRunSourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  expect(captureRunId).toMatch(/^[0-9a-f-]{36}$/);
  if (backend === "webgpu") {
    const preflight = await runNativeEnvironmentPreflight(page, captureRunId, captureRunSourceCommit);
    if (preflight.status === "environment-unavailable") {
      test.skip(true, `Native WebGPU prerequisite unavailable: ${preflight.probeStatus}`);
    }
    if (preflight.status !== "available") {
      throw new Error(`Native WebGPU preflight is invalid: ${preflight.probeStatus}`);
    }
  }
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const testWindow = window as Window & {
      __groundGlassWebGpuM3TestControl?: { adapterEvents?: unknown[]; adapterAttemptGenerations?: string[] };
    };
    testWindow.__groundGlassWebGpuM3TestControl = { adapterEvents: [], adapterAttemptGenerations: [] };
  });

  await page.setViewportSize({ width: manifest.viewport.width, height: manifest.viewport.height });
  await page.goto(manifest.route);
  const glass = page.getByTestId("ground-glass-rtt").first();
  await expect(glass).toHaveAttribute("data-rtt-scene-id", manifest.sceneId);
  await expect(glass).toHaveAttribute("data-three-revision", "187");
  await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
  await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 120_000 });
  await expect(glass).toHaveAttribute("data-actual-execution-api", "webgl2", { timeout: 120_000 });

  const viewport = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    devicePixelRatio,
  }));
  expect(viewport).toEqual(manifest.viewport);
  await page.getByRole("combobox", { name: "Render quality", exact: true }).selectOption(manifest.renderQuality);

  const rawToggle = page.getByLabel("Raw RTT — bypass DOF", { exact: true });
  const previewRadio = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  const gridToggle = page.getByRole("checkbox", { name: "Grid", exact: true });
  const apertureGroup = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  const focusSlider = page.getByRole("slider", { name: "Focus distance", exact: true });
  const riseSlider = page.getByRole("slider", { name: "Rise", exact: true });
  const tiltSlider = page.getByRole("slider", { name: "Tilt", exact: true });
  const swingSlider = page.getByRole("slider", { name: "Swing", exact: true });
  const canvas = glass.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  // A fresh free route starts from the canonical Architecture Rise preset. Do
  // not invoke Reset movements: its generic fallback focus value is not this
  // scene's preset focus distance.
  await expect(focusSlider).toHaveValue("8890");
  await expect(apertureGroup).toHaveAttribute("data-selected-aperture", "11");
  await expect(riseSlider).toHaveValue("0");
  await expect(tiltSlider).toHaveValue("0");
  await expect(swingSlider).toHaveValue("0");
  if (await gridToggle.isChecked()) await gridToggle.uncheck();
  await expect(gridToggle).not.toBeChecked();

  const capture = async (spec: CaptureSpec, state: CaptureState) => {
    if (backend === "webgpu") {
      await expect(glass).toHaveAttribute("data-policy-selected-backend", "webgpu", { timeout: 120_000 });
      await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
      await expect(glass).toHaveAttribute("data-actual-execution-api", "webgpu", { timeout: 120_000 });
      await expect(glass).toHaveAttribute("data-policy-evidence-revisions", nativeEvidenceRevision);
      await expect(glass).toHaveAttribute("data-mounted-renderer-revision", "r187");
      await expect(glass).toHaveAttribute("data-mounted-verification-evidence-revision", nativeEvidenceRevision);
      await expect(glass).toHaveAttribute("data-application-fallback", "not-observed");
      const pilot = glass.getByTestId("ground-glass-webgpu-pilot");
      await expect(pilot).toHaveAttribute("data-internal-fallback", "none");
      await expect(pilot).toHaveAttribute("data-frame-raw-debug", String(spec.rawDebug));
    } else {
      await expect(glass).toHaveAttribute("data-policy-selected-backend", "webgl");
      await expect(glass).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
      await expect(glass).toHaveAttribute("data-actual-execution-api", "webgl2");
      await expect(glass).toHaveAttribute("data-application-fallback", "not-observed");
    }

    await expect(glass).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 120_000 });
    await expect.poll(async () => {
      const requestId = await glass.getAttribute("data-frame-request-id");
      return Boolean(
        requestId &&
        requestId === await glass.getAttribute("data-last-completed-request-id") &&
        await glass.getAttribute("data-frame-result-status") === "completed",
      );
    }, { timeout: 120_000 }).toBe(true);

    const frame = await glass.evaluate((element) => ({
      requestId: element.getAttribute("data-frame-request-id"),
      lastCompletedRequestId: element.getAttribute("data-last-completed-request-id"),
      frameStatus: element.getAttribute("data-frame-result-status"),
    }));
    expect(frame.requestId).toBeTruthy();
    expect(frame.requestId).toBe(frame.lastCompletedRequestId);
    expect(frame.frameStatus).toBe("completed");

    const acceptedByHost = await page.evaluate((requestId) => {
      const testWindow = window as Window & {
        __groundGlassWebGpuM3TestControl?: { adapterEvents?: Array<Record<string, unknown>> };
      };
      return (testWindow.__groundGlassWebGpuM3TestControl?.adapterEvents ?? []).some((event) =>
        event.kind === "host-frame-result" &&
        event.requestId === requestId &&
        event.acceptedByHost === true &&
        event.latestAcceptedRequestId === requestId,
      );
    }, frame.requestId);
    expect(acceptedByHost, "the host must accept and complete the current request").toBe(true);

    if (backend === "webgl") {
      const expectedContentful = await glass.getAttribute(
        spec.rawDebug ? "data-rtt-raw-contentful" : "data-rtt-final-contentful",
      );
      expect(expectedContentful).toBe("true");
    }
    await expect(glass).toHaveAttribute("data-rtt-logical-width", String(manifest.groundGlassOutputSizeCss.width));
    await expect(glass).toHaveAttribute("data-rtt-logical-height", String(manifest.groundGlassOutputSizeCss.height));

    const { image, hiddenDomControls, captureRegionCss } = await captureGroundGlassCanvas(
      page,
      canvas,
      manifest.groundGlassOutputSizeCss,
    );
    const contentfulness = await readScreenshotStats(page, image);
    expect(contentfulness.contentful, "decoded Ground Glass pixels must contain meaningful image content").toBe(true);

    const cameraState: CameraState = {
      focalLengthMm: Number(await glass.getAttribute("data-rtt-focal-length-mm")),
      focusDistanceMm: Number(await focusSlider.inputValue()),
      apertureFNumber: Number(await apertureGroup.getAttribute("data-selected-aperture")),
      frontRiseMm: Number(await riseSlider.inputValue()),
      frontShiftMm: 0,
      frontTiltDeg: Number(await tiltSlider.inputValue()),
      frontSwingDeg: Number(await swingSlider.inputValue()),
      rearRiseMm: 0,
      rearShiftMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
    };
    expect(cameraState).toEqual(state.cameraState);
    await expect(rawToggle).toHaveJSProperty("checked", spec.rawDebug);
    await expect(previewRadio).toHaveJSProperty("checked", spec.previewMode === "raw");
    await expect(gridToggle).not.toBeChecked();
    expect(pageErrors).toEqual([]);

    if (backend === "webgpu") {
      const pilot = glass.getByTestId("ground-glass-webgpu-pilot");
      await expect(pilot).toHaveAttribute("data-frame-ready", "true");
      await expect(pilot).toHaveAttribute("data-last-displayed-request-id", frame.requestId as string);
      await expect(pilot).toHaveAttribute("data-frame-scene-id", manifest.sceneId);
      await expect(pilot).toHaveAttribute("data-preview-mode", spec.previewMode);
    }

    const runtime = await glass.evaluate((element, expected) => {
      const adapter = element.querySelector<HTMLElement>("[data-testid='ground-glass-webgpu-pilot']");
      const attr = (name: string) => element.getAttribute(name);
      return {
        sceneId: attr("data-rtt-scene-id"),
        selectedBackend: attr("data-policy-selected-backend"),
        rendererFamily: attr("data-mounted-renderer-family"),
        actualExecutionApi: attr("data-actual-execution-api"),
        threeRevision: attr("data-three-revision"),
        mountedRendererRevision: attr("data-mounted-renderer-revision"),
        featureEvidenceRevision: attr("data-policy-evidence-revisions"),
        mountedFeatureEvidenceRevision: attr("data-mounted-verification-evidence-revision"),
        applicationFallback: attr("data-application-fallback"),
        internalFallback: adapter?.getAttribute("data-internal-fallback") ?? null,
        hostLifecycle: attr("data-render-host-lifecycle"),
        frameRequestId: attr("data-frame-request-id"),
        lastCompletedRequestId: attr("data-last-completed-request-id"),
        frameStatus: attr("data-frame-result-status"),
        finalVariance: expected.isWebgl ? attr("data-rtt-final-variance") : null,
        finalNonBackgroundPixels: expected.isWebgl ? attr("data-rtt-final-non-background") : null,
        logicalOutputDimensions: [attr("data-rtt-logical-width"), attr("data-rtt-logical-height")],
        internalTargetDimensions: [attr("data-rtt-internal-width"), attr("data-rtt-internal-height")],
        adapterTargetDimensions: adapter
          ? [adapter.getAttribute("data-target-width"), adapter.getAttribute("data-target-height")]
          : null,
        rawDebug: adapter?.getAttribute("data-frame-raw-debug") ?? String(expected.rawDebug),
        previewMode: adapter?.getAttribute("data-preview-mode") ?? expected.previewMode,
        focalLengthMm: attr("data-rtt-focal-length-mm"),
        rawContentful: expected.isWebgl ? attr("data-rtt-raw-contentful") : null,
        finalContentful: expected.isWebgl ? attr("data-rtt-final-contentful") : null,
        rawVariance: expected.isWebgl ? attr("data-rtt-raw-variance") : null,
        rawNonBackgroundPixels: expected.isWebgl ? attr("data-rtt-raw-non-background") : null,
        naturalIlluminationEnabled: expected.isWebgl ? attr("data-rtt-natural-illumination-enabled") : null,
        naturalIlluminationKind: expected.isWebgl ? attr("data-rtt-natural-illumination-kind") : null,
        illuminanceGain: expected.isWebgl ? attr("data-rtt-ground-glass-illuminance-gain") : null,
        coverageEnabled: expected.isWebgl ? attr("data-rtt-coverage-enabled") : null,
        coverageKind: expected.isWebgl ? attr("data-rtt-coverage-kind") : null,
      };
    }, { rawDebug: spec.rawDebug, previewMode: spec.previewMode, isWebgl: backend === "webgl" });

    const imagePath = resolve(outputDirectory as string, spec.path);
    await mkdir(dirname(imagePath), { recursive: true });
    await writeFile(imagePath, image);
    const metadata = {
      schemaVersion: "rq1-capture-metadata-v1",
      captureProfile,
      captureId: spec.captureId,
      stateId: state.stateId,
      captureRunId,
      captureRunSourceCommit,
      sourceCommit: captureRunSourceCommit,
      sceneId: manifest.sceneId,
      sceneSourceRevision: manifest.sceneSourceRevision,
      rendererFamily: runtime.rendererFamily,
      actualExecutionApi: runtime.actualExecutionApi,
      selectedBackend: runtime.selectedBackend,
      rendererRevision: runtime.mountedRendererRevision ?? `r${runtime.threeRevision}`,
      threeRevision: runtime.threeRevision,
      featureEvidenceRevision: runtime.featureEvidenceRevision,
      mountedFeatureEvidenceRevision: runtime.mountedFeatureEvidenceRevision,
      applicationFallback: runtime.applicationFallback,
      internalFallback: runtime.internalFallback,
      browser: {
        name: page.context().browser()?.browserType().name() ?? null,
        version: page.context().browser()?.version() ?? null,
        userAgent: await page.evaluate(() => navigator.userAgent),
      },
      operatingSystem: {
        platform: process.platform,
        release: release(),
        architecture: arch(),
        nodeVersion: process.version,
      },
      viewport,
      devicePixelRatio: viewport.devicePixelRatio,
      cameraPresetIdentity: "architecture-rise-canonical-public-preset",
      cameraState,
      opticalState: {
        focusDistanceMm: cameraState.focusDistanceMm,
        apertureFNumber: cameraState.apertureFNumber,
        focalLengthMm: cameraState.focalLengthMm,
        previewMode: spec.previewMode,
        movementProvenance:
          "Front rise/tilt/swing were read from public range controls. Front shift and rear movements have no public controls on this scene; a fresh free route starts from the canonical scene preset, which declares those fields as zero.",
      },
      renderQuality: manifest.renderQuality,
      previewMode: spec.previewMode,
      viewOptions: { grid: false },
      rawDebug: spec.rawDebug,
      pipelineStage: spec.pipelineStage,
      displayPipelineNotes: spec.pipelineStage === "webgl-raw-debug-display"
        ? "Raw Debug bypasses CoC and gathers, sets photographic throughput gain to 1, and disables natural illumination and coverage, then uses the WebGL composite/display implementation."
        : spec.pipelineStage === "m3-raw-rtt-display"
          ? "Authorized M3 Raw renders and displays its native scene-color target through the WebGPU pilot display implementation; it does not run the WebGL photographic composite."
          : "WebGL photographic Ground Glass reference with the standard CoC/gather/composite path enabled; this is separate from both Raw outputs.",
      frameStatus: runtime.frameStatus,
      requestId: runtime.frameRequestId,
      lastCompletedRequestId: runtime.lastCompletedRequestId,
      acceptedByHost,
      contentful: contentfulness.contentful,
      contentfulness,
      contentfulnessEvidence: backend === "webgpu"
        ? "decoded displayed-canvas pixels; the native adapter exposes frame readiness and request identity but no raw-contentful counter"
        : "decoded displayed-canvas pixels plus the mounted WebGL Raw/final contentfulness diagnostic",
      runtimeDiagnostics: runtime,
      imagePath: relative(repositoryRoot, imagePath),
      imageWidth: contentfulness.width,
      imageHeight: contentfulness.height,
      captureRegionCss,
      imageSha256: createHash("sha256").update(image).digest("hex"),
      hiddenDomControls,
      captureBoundary: "Ground Glass canvas screenshot with only overlapping DOM controls, focus label, fixed preview overlays, and native pilot status temporarily hidden; canvas output remains rendered.",
      referenceRole: spec.referenceRole,
      comparisonLimit,
    };
    const metadataPath = resolve(outputDirectory as string, "captures", `${spec.captureId}.json`);
    await mkdir(dirname(metadataPath), { recursive: true });
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
    await testInfo.attach(`${spec.captureId}.png`, { body: image, contentType: "image/png" });
    await testInfo.attach(`${spec.captureId}.json`, {
      body: JSON.stringify(metadata, null, 2),
      contentType: "application/json",
    });
  };

  for (const state of manifest.states) {
    const camera = state.cameraState;
    await setStepRangeInput(page, "Focus distance", camera.focusDistanceMm);
    await apertureGroup.getByRole("radio", { name: `f/${camera.apertureFNumber}`, exact: true }).check();
    await setStepRangeInput(page, "Rise", camera.frontRiseMm);
    await setStepRangeInput(page, "Tilt", camera.frontTiltDeg);
    await setStepRangeInput(page, "Swing", camera.frontSwingDeg);
    await previewRadio.check();

    const targetFamily = backend === "webgpu" ? "webgpu-renderer" : "webgl-renderer";
    const rawSpec = state.captures.find((item) => item.rendererFamily === targetFamily);
    expect(rawSpec, `${backend} raw capture is declared for ${state.stateId}`).toBeDefined();
    if (!rawSpec) throw new Error(`Missing ${backend} capture in ${state.stateId}`);
    if (!(await rawToggle.isChecked())) await rawToggle.check();
    await capture(rawSpec, state);

    if (backend === "webgl" && state.stateId === "architecture-rise-neutral") {
      const processed = manifest.additionalReferences[0];
      expect(processed).toBeDefined();
      await rawToggle.uncheck();
      await capture(processed!, state);
      await rawToggle.check();
    }
  }
});

async function runNativeEnvironmentPreflight(page: Page, captureRunId: string, sourceCommit: string) {
  const browserLaunched = page.context().browser() !== null;
  let localPageLoaded = false;
  let secureContext = false;
  let navigatorGpuPresent: boolean | null = null;
  let adapterAvailable: boolean | null = null;
  let probeStatus = "local-page-load-failed";
  let diagnostic: string | null = null;

  try {
    await page.goto("/");
    localPageLoaded = true;
    const probe = await page.evaluate(async () => {
      const gpu = (navigator as Navigator & {
        gpu?: { requestAdapter: () => PromiseLike<unknown | null> };
      }).gpu;
      if (!window.isSecureContext) return { secureContext: false, navigatorGpuPresent: Boolean(gpu), adapter: "insecure-context" };
      if (!gpu || typeof gpu.requestAdapter !== "function") {
        return { secureContext: true, navigatorGpuPresent: false, adapter: "webgpu-api-absent" };
      }

      let timeoutHandle: number | undefined;
      try {
        const adapter = await Promise.race([
          Promise.resolve(gpu.requestAdapter()).then(
            (value) => value === null ? "adapter-unavailable" as const
              : typeof value === "object" ? "adapter-available" as const
                : "adapter-result-invalid" as const,
            () => "adapter-request-rejected" as const,
          ),
          new Promise<"adapter-request-timeout">((resolve) => {
            timeoutHandle = window.setTimeout(() => resolve("adapter-request-timeout"), 5_000);
          }),
        ]);
        return { secureContext: true, navigatorGpuPresent: true, adapter };
      } finally {
        if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
      }
    });
    secureContext = probe.secureContext;
    navigatorGpuPresent = probe.navigatorGpuPresent;
    adapterAvailable = probe.adapter === "adapter-available" ? true
      : probe.adapter === "adapter-unavailable" ? false
        : null;
    probeStatus = probe.adapter;
  } catch (error) {
    diagnostic = error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000);
    probeStatus = localPageLoaded ? "probe-failed" : "local-page-load-failed";
  }

  const isEnvironmentUnavailable = secureContext &&
    (probeStatus === "webgpu-api-absent" || probeStatus === "adapter-unavailable");
  const status = isEnvironmentUnavailable ? "environment-unavailable"
    : probeStatus === "adapter-available" && navigatorGpuPresent && adapterAvailable ? "available"
      : "invalid";
  const preflight = {
    schemaVersion: "rq1-native-preflight-v1",
    captureRunId,
    sourceCommit,
    browserProject: "chrome-native-webgpu",
    browserLaunched,
    localPageLoaded,
    secureContext,
    navigatorGpuPresent,
    adapterAvailable,
    probeStatus,
    status,
    browserVersion: page.context().browser()?.version() ?? null,
    diagnostic,
  };
  const outputDirectory = process.env.RQ1_CAPTURE_OUTPUT_DIR;
  if (!outputDirectory) throw new Error("RQ1 output directory is missing while recording native preflight.");
  const preflightPath = resolve(outputDirectory, "captures/native-preflight.json");
  await mkdir(dirname(preflightPath), { recursive: true });
  await writeFile(preflightPath, JSON.stringify(preflight, null, 2) + "\n");
  return preflight;
}

async function readScreenshotStats(page: Page, png: Buffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not inspect captured Ground Glass pixels");
    context.drawImage(image, 0, 0);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonBlackPixels = 0;
    let luminanceSum = 0;
    const colorBuckets = new Set<string>();
    for (let index = 0; index < rgba.length; index += 4) {
      const red = rgba[index] ?? 0;
      const green = rgba[index + 1] ?? 0;
      const blue = rgba[index + 2] ?? 0;
      luminanceSum += red * 0.2126 + green * 0.7152 + blue * 0.0722;
      if (Math.max(red, green, blue) > 8) nonBlackPixels += 1;
      colorBuckets.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);
    }
    const pixelCount = Math.max(1, rgba.length / 4);
    return {
      width: canvas.width,
      height: canvas.height,
      nonBlackPixels,
      distinctSrgbBuckets: colorBuckets.size,
      meanSrgbLuminance: luminanceSum / pixelCount,
      contentful: nonBlackPixels > 100 && colorBuckets.size > 16,
    };
  }, png.toString("base64"));
}

async function captureGroundGlassCanvas(
  page: Page,
  canvas: import("@playwright/test").Locator,
  outputSize: { width: number; height: number },
) {
  const hiddenDomControls = await canvas.evaluate((canvasElement) => {
    const canvasBounds = canvasElement.getBoundingClientRect();
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      "button, a[href], [role='button'], [data-testid='ground-glass-focus-label'], " +
      "[data-testid='ground-glass-webgpu-pilot-status'], [data-testid='ground-glass-image-layer'] + div",
    ));
    const hidden: string[] = [];
    for (const candidate of candidates) {
      if (candidate === canvasElement || candidate.contains(canvasElement) || canvasElement.contains(candidate)) continue;
      const forcedOverlay = candidate.matches(
        "[data-testid='ground-glass-focus-label'], [data-testid='ground-glass-webgpu-pilot-status'], " +
        "[data-testid='ground-glass-image-layer'] + div",
      );
      const bounds = candidate.getBoundingClientRect();
      const overlapsCanvas = bounds.width > 0 && bounds.height > 0 &&
        bounds.left < canvasBounds.right && bounds.right > canvasBounds.left &&
        bounds.top < canvasBounds.bottom && bounds.bottom > canvasBounds.top;
      if (!forcedOverlay && !overlapsCanvas) continue;
      candidate.dataset.rq1CaptureHidden = "true";
      hidden.push(
        candidate.getAttribute("aria-label") ??
        candidate.getAttribute("data-testid") ??
        candidate.textContent?.trim() ??
        candidate.className.toString() ??
        candidate.tagName,
      );
    }
    const style = document.createElement("style");
    style.dataset.rq1CaptureStyles = "true";
    style.textContent =
      '[data-rq1-capture-hidden="true"] { visibility: hidden !important; pointer-events: none !important; }';
    document.head.append(style);
    return hidden;
  });

  try {
    const bounds = await canvas.boundingBox();
    if (!bounds || bounds.width + 1 < outputSize.width || bounds.height + 1 < outputSize.height) {
      throw new Error(
        `Ground Glass canvas bounds ${bounds?.width ?? 0}x${bounds?.height ?? 0} do not contain ` +
        `the declared ${outputSize.width}x${outputSize.height} output.`,
      );
    }
    const captureRegionCss = {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: outputSize.width,
      height: outputSize.height,
    };
    await page.evaluate(() => new Promise<void>((resolveFrame) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
    }));
    return {
      image: await page.screenshot({ clip: captureRegionCss, scale: "css", animations: "disabled" }),
      hiddenDomControls,
      captureRegionCss,
    };
  } finally {
    await page.evaluate(() => {
      document.querySelector('[data-rq1-capture-styles="true"]')?.remove();
      document.querySelectorAll<HTMLElement>("[data-rq1-capture-hidden='true']")
        .forEach((element) => delete element.dataset.rq1CaptureHidden);
    });
  }
}
