import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { arch, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { setStepRangeInput } from "../../e2e/helpers/stepRangeInput";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const captureRunId = randomUUID();
const sourceCommit = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();

type CaptureState = Readonly<{
  stateId: string;
  sceneId: string;
  focusDistanceMm: number;
  apertureFNumber: number;
  movement: Readonly<{ riseMm?: number; swingDeg?: number; tiltDeg?: number }>;
}>;

const states: readonly CaptureState[] = [
  { stateId: "oblique-architecture-a1-parallel", sceneId: "oblique-architecture", focusDistanceMm: 13200, apertureFNumber: 11, movement: { riseMm: 0, swingDeg: 0 } },
  { stateId: "oblique-architecture-a2-rise40", sceneId: "oblique-architecture", focusDistanceMm: 13200, apertureFNumber: 11, movement: { riseMm: 40, swingDeg: 0 } },
  { stateId: "oblique-architecture-a3-rise40-swing-plus5", sceneId: "oblique-architecture", focusDistanceMm: 13200, apertureFNumber: 11, movement: { riseMm: 40, swingDeg: 5 } },
  { stateId: "oblique-architecture-a4-rise40-swing-minus5", sceneId: "oblique-architecture", focusDistanceMm: 13200, apertureFNumber: 11, movement: { riseMm: 40, swingDeg: -5 } },
  { stateId: "macro-oblique-plane-b1-neutral", sceneId: "macro-oblique-plane", focusDistanceMm: 400, apertureFNumber: 5.6, movement: { tiltDeg: 0 } },
  { stateId: "macro-oblique-plane-b2-tilt-plus5", sceneId: "macro-oblique-plane", focusDistanceMm: 400, apertureFNumber: 5.6, movement: { tiltDeg: 5 } },
  { stateId: "macro-bellows-extension-c1-focus900", sceneId: "macro-bellows-extension", focusDistanceMm: 900, apertureFNumber: 5.6, movement: {} },
  { stateId: "macro-bellows-extension-c2-focus300", sceneId: "macro-bellows-extension", focusDistanceMm: 300, apertureFNumber: 5.6, movement: {} },
  { stateId: "architecture-rise-d-rq2-neutral", sceneId: "architecture-rise", focusDistanceMm: 8900, apertureFNumber: 8, movement: {} },
];

const setPublicFocus = async (focus: Locator, target: number): Promise<void> => {
  const [minText, maxText, stepText] = await Promise.all([
    focus.getAttribute("min"), focus.getAttribute("max"), focus.getAttribute("step"),
  ]);
  const min = Number(minText);
  const max = Number(maxText);
  const step = Number(stepText);
  if (!Number.isFinite(min + max + step) || target < min || target > max ||
    Math.abs((target - min) / step - Math.round((target - min) / step)) > 1e-8) {
    throw new Error(`Focus ${target} mm is not reachable through the public control`);
  }
  await focus.focus();
  await focus.evaluate((input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("The public focus range setter is unavailable");
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, target);
  await expect(focus).toHaveValue(String(target));
};

const waitForAcceptedFrame = async (page: Page, rtt: Locator, sceneId: string) => {
  await expect.poll(async () => {
    const [scene, family, api, lifecycle, status, contentful, requestId, completedId] = await Promise.all([
      rtt.getAttribute("data-rtt-scene-id"),
      rtt.getAttribute("data-mounted-renderer-family"),
      rtt.getAttribute("data-actual-execution-api"),
      rtt.getAttribute("data-render-host-lifecycle"),
      rtt.getAttribute("data-frame-result-status"),
      rtt.getAttribute("data-rtt-final-contentful"),
      rtt.getAttribute("data-frame-request-id"),
      rtt.getAttribute("data-last-completed-request-id"),
    ]);
    return scene === sceneId && family === "webgl-renderer" && api === "webgl2" &&
      lifecycle === "ready" && status === "completed" && contentful === "true" &&
      Boolean(requestId) && requestId === completedId;
  }, { timeout: 120_000 }).toBe(true);

  const requestId = await rtt.getAttribute("data-frame-request-id");
  if (!requestId) throw new Error("The accepted frame has no request identity");
  const accepted = await page.evaluate((id) =>
    window.__groundGlassWebGpuM3TestControl?.adapterEvents?.some((event) =>
      event.kind === "host-frame-result" && event.requestId === id &&
      event.acceptedByHost === true && event.latestAcceptedRequestId === id) ?? false,
  requestId);
  if (!accepted) throw new Error(`The host did not accept completed request ${requestId}`);
  return {
    requestId,
    lastCompletedRequestId: await rtt.getAttribute("data-last-completed-request-id"),
    acceptedByHost: accepted,
  };
};

test("capture RQ3B matched WebGL Ground Glass states", async ({ page }, testInfo) => {
  const dirtySource = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  if (dirtySource) throw new Error(`RQ3B captures require a clean source tree:\n${dirtySource}`);

  test.setTimeout(900_000);
  await page.addInitScript(() => { window.__groundGlassWebGpuM3TestControl = { adapterEvents: [] }; });
  await page.setViewportSize({ width: 1280, height: 900 });
  const browser = page.context().browser();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const captures: Array<Record<string, unknown>> = [];

  for (const state of states) {
    const route = `/simulator/free/${state.sceneId}?rttDiagnostics=1`;
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const rtt = page.getByTestId("ground-glass-rtt").first();
    await expect(rtt).toHaveAttribute("data-rtt-scene-id", state.sceneId, { timeout: 60_000 });
    await page.getByRole("combobox", { name: "Render quality", exact: true }).selectOption({ label: "Standard" });
    const rawPreview = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
    await rawPreview.check();
    const rawDebug = page.getByLabel("Raw RTT — bypass DOF", { exact: true });
    if (await rawDebug.isChecked()) await rawDebug.uncheck();
    const grid = page.getByRole("checkbox", { name: "Grid", exact: true });
    if (await grid.isChecked()) await grid.uncheck();

    const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
    if (Number(await focus.inputValue()) !== state.focusDistanceMm) {
      await setPublicFocus(focus, state.focusDistanceMm);
    }
    if (state.movement.riseMm !== undefined) await setStepRangeInput(page, "Rise", state.movement.riseMm);
    if (state.movement.swingDeg !== undefined) await setStepRangeInput(page, "Swing", state.movement.swingDeg);
    if (state.movement.tiltDeg !== undefined) await setStepRangeInput(page, "Tilt", state.movement.tiltDeg);

    const apertureGroup = page.getByRole("radiogroup", { name: "Aperture", exact: true });
    const aperture = Number(await apertureGroup.getAttribute("data-selected-aperture"));
    if (aperture !== state.apertureFNumber) {
      await apertureGroup.getByRole("radio", { name: `f/${state.apertureFNumber}`, exact: true }).check();
    }
    const appliedAperture = Number(await apertureGroup.getAttribute("data-selected-aperture"));
    if (appliedAperture !== state.apertureFNumber) {
      throw new Error(`${state.stateId}: aperture ${appliedAperture} does not match ${state.apertureFNumber}`);
    }
    const frame = await waitForAcceptedFrame(page, rtt, state.sceneId);
    const canvas = rtt.locator("canvas").first();
    const bounds = await canvas.boundingBox();
    if (!bounds || Math.abs(bounds.width - 450) > 1 || Math.abs(bounds.height - 360) > 1) {
      throw new Error(`Unexpected Ground Glass display size for ${state.stateId}`);
    }

    const fileName = `${state.stateId}.png`;
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
        const overlaps = bounds.width > 0 && bounds.height > 0 && bounds.left < canvasBounds.right &&
          bounds.right > canvasBounds.left && bounds.top < canvasBounds.bottom && bounds.bottom > canvasBounds.top;
        if (!forcedOverlay && !overlaps) continue;
        candidate.dataset.rq3bCaptureHidden = "true";
        hidden.push(candidate.getAttribute("aria-label") ?? candidate.getAttribute("data-testid") ??
          (candidate.textContent?.trim() || String(candidate.className) || candidate.tagName));
      }
      const style = document.createElement("style");
      style.dataset.rq3bCaptureStyles = "true";
      style.textContent = "[data-rq3b-capture-hidden='true'] { visibility: hidden !important; pointer-events: none !important; }";
      document.head.append(style);
      return hidden;
    });
    let image: Buffer;
    try {
      image = await page.screenshot({
        path: testInfo.outputPath(fileName),
        clip: { x: Math.round(bounds.x), y: Math.round(bounds.y), width: 450, height: 360 },
        scale: "css",
        animations: "disabled",
      });
    } finally {
      await page.evaluate(() => {
        document.querySelector("[data-rq3b-capture-styles='true']")?.remove();
        document.querySelectorAll<HTMLElement>("[data-rq3b-capture-hidden='true']")
          .forEach((element) => delete element.dataset.rq3bCaptureHidden);
      });
    }
    const runtime = await rtt.evaluate((element) => {
      const attributes: Record<string, string> = {};
      for (const attribute of element.attributes) if (attribute.name.startsWith("data-")) attributes[attribute.name] = attribute.value;
      const output = element.querySelector("canvas");
      const gl = output?.getContext("webgl2");
      return {
        attributes,
        canvas: output ? {
          backingWidth: output.width,
          backingHeight: output.height,
          webglVersion: gl?.getParameter(gl.VERSION) ?? null,
        } : null,
      };
    });
    const actualState = await page.evaluate(() => {
      const focusInput = document.querySelector<HTMLInputElement>('input[aria-label="Focus distance"]');
      const apertureInput = document.querySelector('[role="radiogroup"][aria-label="Aperture"]');
      const ranges = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="range"]'));
      return {
        focusDistanceMm: focusInput ? Number(focusInput.value) : null,
        apertureFNumber: Number(apertureInput?.getAttribute("data-selected-aperture")),
        movements: ranges.map((input) => ({
          label: input.getAttribute("aria-label"), value: Number(input.value),
          min: Number(input.min), max: Number(input.max), step: Number(input.step),
        })),
      };
    });
    const attrs = runtime.attributes;
    if (attrs["data-actual-execution-api"] !== "webgl2" ||
      attrs["data-mounted-renderer-family"] !== "webgl-renderer" ||
      attrs["data-application-fallback"] !== "not-observed" ||
      attrs["data-internal-fallback"] !== "none" ||
      attrs["data-rtt-final-contentful"] !== "true" ||
      !(await rawPreview.isChecked()) || await rawDebug.isChecked() || pageErrors.length > 0 ||
      actualState.focusDistanceMm !== state.focusDistanceMm || actualState.apertureFNumber !== state.apertureFNumber) {
      throw new Error(`${state.stateId} failed runtime/state validation: ${JSON.stringify({ attrs, actualState, pageErrors })}`);
    }

    captures.push({
      captureId: `rq3b-${captureRunId}-${state.stateId}`,
      stateId: state.stateId,
      sceneId: state.sceneId,
      route,
      sourceCommit,
      sourceTreeStatus: "clean",
      captureRunId,
      requestedState: state,
      observedPublicCameraState: actualState,
      renderQuality: "standard",
      previewMode: "Raw",
      rawDebug: false,
      pipeline: ["scene-color-and-depth", "physical-coc", "far-gather", "near-gather", "composite-display"],
      rendererIdentity: {
        rendererFamily: attrs["data-mounted-renderer-family"],
        executionApi: attrs["data-actual-execution-api"],
        threeRevision: attrs["data-three-revision"],
        applicationFallback: attrs["data-application-fallback"],
        internalFallback: attrs["data-internal-fallback"],
      },
      frame,
      naturalIllumination: {
        enabled: attrs["data-rtt-natural-illumination-enabled"],
        kind: attrs["data-rtt-natural-illumination-kind"],
      },
      coverage: {
        enabled: attrs["data-rtt-coverage-enabled"],
        kind: attrs["data-rtt-coverage-kind"],
      },
      contentful: attrs["data-rtt-final-contentful"] === "true",
      viewport: { width: 1280, height: 900, devicePixelRatio: await page.evaluate(() => window.devicePixelRatio) },
      display: {
        cssWidth: bounds.width, cssHeight: bounds.height,
        backingWidth: runtime.canvas?.backingWidth, backingHeight: runtime.canvas?.backingHeight,
        rttWidth: attrs["data-rtt-internal-width"], rttHeight: attrs["data-rtt-internal-height"],
      },
      browser: { name: "Chromium (Playwright)", version: browser?.version() ?? "unknown" },
      operatingSystem: { platform: platform(), release: release(), architecture: arch() },
      runtime,
      image: {
        path: fileName,
        width: image.readUInt32BE(16), height: image.readUInt32BE(20),
        sha256: createHash("sha256").update(image).digest("hex"),
      },
      hiddenDomControls,
      pageErrors: [...pageErrors],
    });
  }

  const run = {
    schemaVersion: "rq3b-capture-run-v1",
    captureRunId,
    sourceCommit,
    sourceTreeStatus: "clean",
    browser: { name: "Chromium (Playwright)", version: browser?.version() ?? "unknown" },
    operatingSystem: { platform: platform(), release: release(), architecture: arch() },
    viewport: { width: 1280, height: 900, devicePixelRatio: await page.evaluate(() => window.devicePixelRatio) },
    captures,
  };
  await writeFile(testInfo.outputPath("capture-run.json"), `${JSON.stringify(run, null, 2)}\n`);
});
