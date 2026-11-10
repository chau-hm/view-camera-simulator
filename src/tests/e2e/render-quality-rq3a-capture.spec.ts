import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { arch, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const captureRunId = randomUUID();
const sourceCommit = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();
const dirtySource = execFileSync("git", [
  "status",
  "--porcelain=v1",
  "--untracked-files=all",
  "--",
  ".",
  ":(exclude,top)node_modules",
  ":(exclude,top)node_modules/**",
], { cwd: repositoryRoot, encoding: "utf8" }).trim();

if (dirtySource) throw new Error(`RQ3A captures require a clean source tree:\n${dirtySource}`);

type CaptureState = Readonly<{
  stateId: string;
  sceneId: string;
  focusDistanceMm: number;
  apertureFNumber: number;
  filename: string;
}>;

const states: readonly CaptureState[] = [
  {
    stateId: "macro-m1-middle-shallow",
    sceneId: "macro-depth-of-field",
    focusDistanceMm: 400,
    apertureFNumber: 5.6,
    filename: "macro-m1-middle-shallow.png",
  },
  {
    stateId: "macro-m2-near-focus",
    sceneId: "macro-depth-of-field",
    focusDistanceMm: 390,
    apertureFNumber: 5.6,
    filename: "macro-m2-near-focus.png",
  },
  {
    stateId: "macro-m3-far-focus",
    sceneId: "macro-depth-of-field",
    focusDistanceMm: 410,
    apertureFNumber: 5.6,
    filename: "macro-m3-far-focus.png",
  },
  {
    stateId: "macro-m4-stopped-down",
    sceneId: "macro-depth-of-field",
    focusDistanceMm: 400,
    apertureFNumber: 32,
    filename: "macro-m4-stopped-down.png",
  },
  {
    stateId: "interior-corner-canonical-start",
    sceneId: "interior-corner",
    focusDistanceMm: 8000,
    apertureFNumber: 5.6,
    filename: "interior-corner-canonical-start.png",
  },
  {
    stateId: "architecture-rise-rq2-neutral-regression",
    sceneId: "architecture-rise",
    focusDistanceMm: 8900,
    apertureFNumber: 8,
    filename: "architecture-rise-neutral.png",
  },
];

const setPublicFocus = async (focus: Locator, target: number): Promise<void> => {
  const values = await Promise.all([
    focus.getAttribute("min"),
    focus.getAttribute("max"),
    focus.getAttribute("step"),
  ]);
  const min = Number(values[0]);
  const max = Number(values[1]);
  const step = Number(values[2]);
  if (
    !Number.isFinite(min + max + step) ||
    target < min || target > max ||
    Math.abs((target - min) / step - Math.round((target - min) / step)) > 1e-8
  ) {
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
}

const waitForAcceptedWebGlFrame = async (
  page: Page,
  rtt: Locator,
  state: CaptureState,
): Promise<Readonly<{ requestId: string; lastCompletedRequestId: string; acceptedByHost: boolean }>> => {
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
    return scene === state.sceneId && family === "webgl-renderer" && api === "webgl2" &&
      lifecycle === "ready" && status === "completed" && contentful === "true" &&
      Boolean(requestId) && requestId === completedId;
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
  if (!acceptedByHost) throw new Error(`The host did not accept completed request ${frame.requestId}`);
  return { ...frame, acceptedByHost };
};

test("capture the RQ3A WebGL Ground Glass Before/After reference states", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
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

  const captures: Array<Record<string, unknown>> = [];
  for (const state of states) {
    const route = `/simulator/free/${state.sceneId}?rttDiagnostics=1`;
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const rtt = page.getByTestId("ground-glass-rtt").first();
    await expect(rtt).toHaveAttribute("data-rtt-scene-id", state.sceneId, { timeout: 60_000 });
    await page.getByRole("combobox", { name: "Render quality", exact: true })
      .selectOption({ label: "Standard" });
    await page.getByRole("radio", { name: "Raw Ground Glass", exact: true }).check();
    const rawDebug = page.getByLabel("Raw RTT — bypass DOF", { exact: true });
    if (await rawDebug.isChecked()) await rawDebug.uncheck();
    const grid = page.getByRole("checkbox", { name: "Grid", exact: true });
    if (await grid.isChecked()) await grid.uncheck();

    const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
    const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
    if ((await focus.inputValue()) !== String(state.focusDistanceMm)) {
      await setPublicFocus(focus, state.focusDistanceMm);
    }
    await aperture.getByRole("radio", {
      name: `f/${state.apertureFNumber}`,
      exact: true,
    }).check();

    const frame = await waitForAcceptedWebGlFrame(page, rtt, state);
    const canvas = rtt.locator("canvas").first();
    const bounds = await canvas.boundingBox();
    if (!bounds || Math.abs(bounds.width - 450) > 1 || Math.abs(bounds.height - 360) > 1) {
      throw new Error(`Unexpected Ground Glass display size for ${state.stateId}`);
    }
    await page.evaluate(() => new Promise<void>((resolveFrame) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
    }));
    const image = await canvas.screenshot({
      path: testInfo.outputPath(state.filename),
      animations: "disabled",
    });
    const runtime = await rtt.evaluate((element) => {
      const attributes: Record<string, string> = {};
      for (const attribute of element.attributes) {
        if (attribute.name.startsWith("data-")) attributes[attribute.name] = attribute.value;
      }
      const output = element.querySelector("canvas");
      const gl = output?.getContext("webgl2");
      const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        attributes,
        canvas: output ? {
          backingWidth: output.width,
          backingHeight: output.height,
          cssRect: (() => {
            const rect = output.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          })(),
          webglVersion: gl?.getParameter(gl.VERSION) ?? null,
          webglVendor: debugInfo && gl ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
          webglRenderer: debugInfo && gl ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
        } : null,
      };
    });
    const cameraState = await page.evaluate(() => {
      const rttElement = document.querySelector('[data-testid="ground-glass-rtt"]');
      const focusInput = document.querySelector<HTMLInputElement>('input[aria-label="Focus distance"]');
      const apertureElement = document.querySelector('[role="radiogroup"][aria-label="Aperture"]');
      const publicRanges = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="range"]'))
        .map((input) => ({
          label: input.getAttribute("aria-label"),
          value: Number(input.value),
          min: Number(input.min),
          max: Number(input.max),
          step: Number(input.step),
          disabled: input.disabled,
        }));
      return {
        focalLengthMm: Number(rttElement?.getAttribute("data-rtt-focal-length-mm")),
        focusDistanceMm: focusInput ? Number(focusInput.value) : null,
        apertureFNumber: Number(apertureElement?.getAttribute("data-selected-aperture")),
        movements: publicRanges.filter((range) => range.label !== "Focus distance"),
        previewMode: document.querySelector<HTMLInputElement>('input[aria-label="Raw Ground Glass"]')?.checked
          ? "Raw"
          : "unexpected",
        rawDebug: document.querySelector<HTMLInputElement>('input[aria-label="Raw RTT — bypass DOF"]')?.checked ?? null,
        publicRanges,
      };
    });
    const attrs = runtime.attributes;
    const actualImage = {
      path: state.filename,
      width: image.readUInt32BE(16),
      height: image.readUInt32BE(20),
      sha256: createHash("sha256").update(image).digest("hex"),
    };
    if (
      cameraState.focusDistanceMm !== state.focusDistanceMm ||
      cameraState.apertureFNumber !== state.apertureFNumber ||
      cameraState.previewMode !== "Raw" ||
      cameraState.rawDebug !== false ||
      attrs["data-application-fallback"] !== "not-observed" ||
      attrs["data-internal-fallback"] !== "none" ||
      !actualImage.width || !actualImage.height ||
      pageErrors.length > 0 || consoleErrors.length > 0
    ) {
      throw new Error(`Capture state validation failed for ${state.stateId}`);
    }

    captures.push({
      captureId: `rq3a-${captureRunId}-${state.stateId}`,
      stateId: state.stateId,
      sceneId: state.sceneId,
      route,
      sourceCommit,
      sourceTreeStatus: "clean",
      captureRunId,
      cameraState,
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
      contentful: attrs["data-rtt-final-contentful"] === "true",
      viewport: { width: 1280, height: 900, devicePixelRatio: await page.evaluate(() => window.devicePixelRatio) },
      display: {
        backingWidth: runtime.canvas?.backingWidth,
        backingHeight: runtime.canvas?.backingHeight,
        rttWidth: attrs["data-rtt-internal-width"],
        rttHeight: attrs["data-rtt-internal-height"],
        gatherScale: attrs["data-rtt-gather-scale"],
        resolutionScale: attrs["data-rtt-resolution-scale"],
      },
      browser: { name: "Chromium (Playwright)", version: browser?.version() ?? "unknown" },
      operatingSystem: { platform: platform(), release: release(), architecture: arch() },
      runtime,
      image: actualImage,
      pageErrors: [...pageErrors],
      consoleErrors: [...consoleErrors],
    });
  }

  const run = {
    schemaVersion: "rq3a-capture-run-v1",
    captureRunId,
    sourceCommit,
    sceneRasterSourceCommit: sourceCommit,
    sourceTreeStatus: "clean",
    browser: { name: "Chromium (Playwright)", version: page.context().browser()?.version() ?? "unknown" },
    operatingSystem: { platform: platform(), release: release(), architecture: arch() },
    viewport: { width: 1280, height: 900, devicePixelRatio: await page.evaluate(() => window.devicePixelRatio) },
    renderQuality: "standard",
    previewMode: "Raw",
    rawDebug: false,
    captureMethod: "Playwright screenshot of the actual visible WebGL Ground Glass canvas",
    captures,
  };
  await writeFile(testInfo.outputPath("capture-run.json"), `${JSON.stringify(run, null, 2)}\n`);
  expect(captures).toHaveLength(states.length);
  console.info("RQ3A WebGL capture run:", JSON.stringify({
    captureRunId,
    sourceCommit,
    captures: captures.map((capture) => ({
      stateId: capture.stateId,
      image: capture.image,
      rendererIdentity: capture.rendererIdentity,
      cameraState: capture.cameraState,
    })),
  }));
});
