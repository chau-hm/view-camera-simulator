import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { arch, platform, release } from "node:os";
import { writeFile } from "node:fs/promises";
import { relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const sceneId = "macro-depth-of-field";
const captureRunId = randomUUID();

const readFrame = async (
  page: Page,
  rtt: Locator,
): Promise<Readonly<{ requestId: string; lastCompletedRequestId: string; acceptedByHost: boolean }>> => {
  await expect.poll(async () => {
    const attrs = await rtt.evaluate((element) => ({
      sceneId: element.getAttribute("data-rtt-scene-id"),
      rendererFamily: element.getAttribute("data-mounted-renderer-family"),
      executionApi: element.getAttribute("data-actual-execution-api"),
      lifecycle: element.getAttribute("data-render-host-lifecycle"),
      frameStatus: element.getAttribute("data-frame-result-status"),
      contentful: element.getAttribute("data-rtt-final-contentful"),
      requestId: element.getAttribute("data-frame-request-id"),
      completedRequestId: element.getAttribute("data-last-completed-request-id"),
    }));
    return attrs.sceneId === sceneId &&
      attrs.rendererFamily === "webgl-renderer" &&
      attrs.executionApi === "webgl2" &&
      attrs.lifecycle === "ready" &&
      attrs.frameStatus === "completed" &&
      attrs.contentful === "true" &&
      Boolean(attrs.requestId) && attrs.requestId === attrs.completedRequestId;
  }, { timeout: 120_000 }).toBe(true);

  const frame = await rtt.evaluate((element) => ({
    requestId: element.getAttribute("data-frame-request-id") ?? "",
    lastCompletedRequestId: element.getAttribute("data-last-completed-request-id") ?? "",
  }));
  const acceptedByHost = await page.evaluate((requestId) => {
    const events = window.__groundGlassWebGpuM3TestControl?.adapterEvents ?? [];
    return events.some((event) => event.kind === "host-frame-result" &&
      event.requestId === requestId && event.acceptedByHost === true &&
      event.latestAcceptedRequestId === requestId);
  }, frame.requestId);
  expect(acceptedByHost, `Host accepted current completed frame ${frame.requestId}`).toBe(true);
  return { ...frame, acceptedByHost };
};

const captureCanvas = async (
  canvas: Locator,
  outputPath: string,
): Promise<Readonly<{ imagePath: string; imageWidth: number; imageHeight: number; sha256: string }>> => {
  const image = await canvas.screenshot({ path: outputPath, animations: "disabled" });
  return {
    imagePath: relative(repositoryRoot, outputPath),
    imageWidth: image.readUInt32BE(16),
    imageHeight: image.readUInt32BE(20),
    sha256: createHash("sha256").update(image).digest("hex"),
  };
};

test("capture Macro Depth of Field Observer and 4× Ground Glass inspection references", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const sourceCommit = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const sourceStatus = execFileSync("git", [
    "status", "--porcelain=v1", "--untracked-files=all", "--", ".",
    ":(exclude,top)node_modules", ":(exclude,top)node_modules/**",
  ], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  expect(sourceStatus, "capture source tree is clean; ignored outputs do not dirty the source").toBe("");

  await page.addInitScript(() => {
    window.__groundGlassWebGpuM3TestControl = { adapterEvents: [] };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  const browser = page.context().browser();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(`/simulator/free/${sceneId}?rttDiagnostics=1&sceneCapacityProfiling=1`, {
    waitUntil: "domcontentloaded",
  });
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt").first();
  await expect(scene).toHaveAttribute("data-scene-subject-id", sceneId);
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(scene).toHaveAttribute("data-observer-three-revision", "187");
  await expect(scene).toHaveAttribute("data-observer-application-fallback", "none");
  await page.getByRole("combobox", { name: "Render quality", exact: true })
    .selectOption({ label: "Standard" });
  await page.getByRole("button", { name: "Reset 3D view", exact: true }).click();
  await expect(scene).toHaveAttribute("data-view-focus", "scene");

  const capacityText = await page.getByTestId("scene-capacity-snapshot").textContent();
  const subjectSnapshot = capacityText ? JSON.parse(capacityText) as Record<string, unknown> : null;
  expect(subjectSnapshot).not.toBeNull();
  expect(JSON.stringify(subjectSnapshot)).toContain('"sceneId":"macro-depth-of-field"');
  const observerCameraPose = await scene.evaluate((element) => ({
    cameraPosition: element.getAttribute("data-observer-camera-position"),
    orbitTarget: element.getAttribute("data-orbit-target"),
    rendererFamily: element.getAttribute("data-observer-renderer-family"),
    executionApi: element.getAttribute("data-observer-execution-backend"),
    rendererRevision: element.getAttribute("data-observer-three-revision"),
  }));
  expect(observerCameraPose.cameraPosition).toBeTruthy();
  expect(observerCameraPose.orbitTarget).toBeTruthy();
  const observer = await captureCanvas(
    scene.locator("canvas").first(),
    testInfo.outputPath("macro-depth-of-field-observer.png"),
  );
  expect(observer.imageWidth).toBeGreaterThan(0);
  expect(observer.imageHeight).toBeGreaterThan(0);

  await expect(rtt).toHaveAttribute("data-rtt-scene-id", sceneId);
  const quality = page.getByRole("combobox", { name: "Render quality", exact: true });
  await quality.selectOption({ label: "Standard" });
  const rawPreview = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  await rawPreview.check();
  const rawDebug = page.getByLabel("Raw RTT — bypass DOF", { exact: true });
  if (await rawDebug.isChecked()) await rawDebug.uncheck();
  const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  await expect(focus).toHaveValue("400");
  await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  const frame = await readFrame(page, rtt);

  const loupeButton = page.getByRole("button", {
    name: "Focus loupe · 4× Ground Glass view",
    exact: true,
  });
  await loupeButton.click();
  const stage = page.locator('[data-focus-loupe-active="true"]').first();
  await expect(stage).toHaveAttribute("data-focus-loupe-scale", "4");
  await expect(stage).toHaveAttribute("data-focus-loupe-window-width", "0.25");
  await expect(stage).toHaveAttribute("data-focus-loupe-window-height", "0.25");
  await expect.poll(async () => rtt.getAttribute("data-frame-request-id"))
    .not.toBe(frame.requestId);
  const loupeFrame = await readFrame(page, rtt);
  await page.evaluate(() => new Promise<void>((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
  }));
  const loupeBounds = await rtt.locator("canvas").first().boundingBox();
  expect(loupeBounds?.width).toBe(450);
  expect(loupeBounds?.height).toBe(360);
  const loupe = await captureCanvas(
    rtt.locator("canvas").first(),
    testInfo.outputPath("macro-depth-of-field-middle-focus-loupe-4x.png"),
  );
  expect(loupe.imageWidth).toBe(450);
  expect(loupe.imageHeight).toBe(360);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  const run = {
    schemaVersion: "rq3d-macro-support-capture-v1",
    captureRunId,
    sourceCommit,
    sourceTreeStatus: "clean",
    sceneId,
    sceneSourceRevision: null,
    browser: { name: "Chromium (Playwright)", version: browser?.version() ?? "unknown" },
    operatingSystem: { platform: platform(), release: release(), architecture: arch() },
    viewport: { width: 1280, height: 900, devicePixelRatio: await page.evaluate(() => window.devicePixelRatio) },
    renderQuality: "standard",
    captures: [
      {
        captureId: "macro-depth-of-field-observer-default-pose",
        captureRole: "observer-regression-reference",
        target: "observer-canvas",
        cameraPose: observerCameraPose,
        rendererIdentity: {
          rendererFamily: "webgl-renderer",
          executionApi: "webgl2",
          rendererRevision: "r187",
          applicationFallback: "none",
        },
        subjectEvidence: subjectSnapshot,
        image: observer,
      },
      {
        captureId: "macro-depth-of-field-middle-focus-loupe-4x",
        captureRole: "ground-glass-inspection-reference",
        target: "ground-glass-webgl-canvas",
        cameraState: {
          sceneId,
          focalLengthMm: Number(await rtt.getAttribute("data-rtt-focal-length-mm")),
          focusDistanceMm: Number(await focus.inputValue()),
          apertureFNumber: Number(await aperture.getAttribute("data-selected-aperture")),
          frontRiseMm: 0,
          frontShiftMm: 0,
          frontTiltDeg: 0,
          frontSwingDeg: 0,
          rearRiseMm: 0,
          rearShiftMm: 0,
          rearTiltDeg: 0,
          rearSwingDeg: 0,
        },
        previewMode: "Raw",
        rawDebug: false,
        focusLoupe: {
          active: true,
          scale: 4,
          centerU: Number(await stage.getAttribute("data-focus-loupe-center-u")),
          centerV: Number(await stage.getAttribute("data-focus-loupe-center-v")),
          windowWidth: 0.25,
          windowHeight: 0.25,
        },
        rendererIdentity: {
          rendererFamily: await rtt.getAttribute("data-mounted-renderer-family"),
          executionApi: await rtt.getAttribute("data-actual-execution-api"),
          rendererRevision: await rtt.getAttribute("data-three-revision"),
          applicationFallback: await rtt.getAttribute("data-application-fallback"),
          internalFallback: await rtt.getAttribute("data-internal-fallback"),
        },
        frame: loupeFrame,
        contentful: (await rtt.getAttribute("data-rtt-final-contentful")) === "true",
        image: loupe,
      },
    ],
    pageErrors,
    consoleErrors,
  };
  await writeFile(testInfo.outputPath("rq3d-support-capture-run.json"), `${JSON.stringify(run, null, 2)}\n`);
});
