const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const out = path.resolve(process.argv[2] || "/private/tmp/room-material-evidence");
const timeout = Number(process.env.ROOM_SURFACE_TIMEOUT_MS || 240000);
const presetKey = process.env.ROOM_SURFACE_PRESET || "desk";
if (!["wide", "desk", "depth"].includes(presetKey)) throw new Error("ROOM_SURFACE_PRESET must be wide, desk, or depth");
const focusOption = process.env.ROOM_SURFACE_FOCUS_MM;
const focusDistanceMm = focusOption === undefined ? null : Number(focusOption);
if (focusOption !== undefined && (!Number.isInteger(focusDistanceMm) || focusDistanceMm < 100 || focusDistanceMm > 8000 || focusDistanceMm % 10 !== 0)) {
  throw new Error("ROOM_SURFACE_FOCUS_MM must be an integer from 100 to 8000 on the public 10 mm slider step");
}
const roiRadiusPx = Number(process.env.ROOM_SURFACE_ROI_RADIUS_PX || 7);
if (!Number.isInteger(roiRadiusPx) || roiRadiusPx < 2 || roiRadiusPx > 20) throw new Error("ROOM_SURFACE_ROI_RADIUS_PX must be an integer from 2 to 20");
const requestedUrl = process.env.ROOM_OPTICS_URL ||
  "http://127.0.0.1:5214/view-camera-simulator/experiments/room-at-dawn/optics.html?rttDiagnostics=1";
const url = new URL(requestedUrl);
url.searchParams.set("focusStage", "1");
const sourcePointOption = process.env.ROOM_SURFACE_SOURCE_M;
const sourcePointM = sourcePointOption === undefined ? null : sourcePointOption.split(",").map(Number);
if (sourcePointOption !== undefined && (!sourcePointM || sourcePointM.length !== 3 || !sourcePointM.every(Number.isFinite))) {
  throw new Error("ROOM_SURFACE_SOURCE_M must be three comma-separated finite upstream metre coordinates");
}
const sourcePointId = process.env.ROOM_SURFACE_SOURCE_ID || "known-source-surface-point";
const sampleUs = [0.16, 0.34, 0.52, 0.70, 0.88];
const sampleVs = [0.18, 0.40, 0.62, 0.82];
const gridProbes = sampleVs.flatMap((v, row) => sampleUs.map((u, column) => ({
  id: "screen-r" + row + "-c" + column,
  displayUv: { u, v },
})));
const probes = sourcePointM
  ? [...gridProbes, { id: sourcePointId, sourceM: sourcePointM }]
  : gridProbes;
const hardwareRequested = process.env.ROOM_OPTICS_HARDWARE === "1";
const browserArgs = hardwareRequested
  ? process.platform === "darwin" ? ["--enable-gpu", "--use-angle=metal"] : ["--enable-gpu"]
  : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
if (fs.existsSync(out)) throw new Error("Evidence directory already exists; choose a fresh path to preserve earlier captures: " + out);
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: browserArgs });
  const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
  page.setDefaultTimeout(timeout);
  const errors = [];
  page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push("console: " + message.text());
  });
  await page.addInitScript({ path: path.join(__dirname, "capture-sync.cjs") });
  await page.addInitScript(() => {
    window.__focusStageControl = {
      enabled: true,
      captureCanvas: true,
      points: [{ id: "material-capture-transport", uv: [0.5, 0.5] }],
    };
  });

  try {
    await page.goto(url.href);
    await page.waitForFunction(
      () => window.__roomOptics?.ready || window.__roomOptics?.error,
      null,
      { timeout },
    );
    const bootError = await page.evaluate(() => window.__roomOptics?.error);
    if (bootError) throw new Error("Room scene initialization failed: " + bootError);

    await page.getByLabel("Subject").selectOption("room");
    await page.getByLabel("Composition").selectOption(presetKey);
    await page.getByLabel("Render quality").selectOption("high");
    await page.getByLabel("Color path").selectOption("hdr");
    await page.getByLabel("Reflections").check();
    if (await page.evaluate(() => window.__roomOptics?.previewMode === "raw")) {
      await page.getByRole("button", { name: "Toggle Raw/Upright" }).click();
    }
    if (await page.evaluate(() => window.__roomOptics?.rawDebug)) {
      await page.getByRole("button", { name: "Processed" }).click();
    }
    await page.getByLabel("Aperture").selectOption("5.6");
    if (focusDistanceMm !== null) await page.getByLabel("Focus (mm)").fill(String(focusDistanceMm));

    await page.waitForFunction(({ expectedPreset, expectedFocus }) => {
      const state = window.__roomOptics;
      return state?.ready && state.subjectMode === "room" && state.presetKey === expectedPreset &&
        state.renderQuality === "high" && state.hdr === true && state.reflectionsEnabled === true &&
        state.rawDebug === false && state.previewMode === "upright" && state.camera.aperture === 5.6 &&
        (expectedFocus === null || state.camera.focusDistanceMm === expectedFocus);
    }, { expectedPreset: presetKey, expectedFocus: focusDistanceMm }, { timeout });

    const expected = await page.evaluate((focusExpected) => ({
      subjectMode: "room",
      presetKey: window.__roomOptics.presetKey,
      renderQuality: "high",
      hdr: true,
      rawDebug: false,
      reflectionsEnabled: true,
      "camera.aperture": 5.6,
      ...(focusExpected === null ? {} : { "camera.focusDistanceMm": focusExpected }),
    }), focusDistanceMm);
    await page.waitForFunction((required) => {
      const state = window.__roomOptics;
      const checked = window.__roomInspectCapture?.(state, required);
      if (checked?.status !== "ready") return false;
      return window.__focusStageSamples?.some((sample) =>
        sample.status === "sampled" && sample.completion?.status === "completed" &&
        sample.completion.frameId === sample.frameId &&
        sample.request?.requestId === checked.requestId &&
        sample.generation?.generationId === checked.generationId &&
        sample.canvasDataUrl?.startsWith("data:image/png;base64,"));
    }, expected, { timeout });

    const capture = await page.evaluate(({ required, probesToInspect }) => {
      const state = window.__roomOptics;
      const readiness = window.__roomInspectCapture(state, required);
      if (readiness.status !== "ready") throw new Error("RTT is not ready: " + readiness.reason);
      const currentFrameIdentity = {
        requestId: state.frame.request.requestId,
        generationId: state.frame.generation.generationId,
        frameId: state.frame.frameId,
      };
      const stage = [...window.__focusStageSamples].reverse().find((sample) =>
        sample.request?.requestId === readiness.requestId &&
        sample.generation?.generationId === readiness.generationId &&
        sample.completion?.status === "completed" &&
        sample.completion.frameId === sample.frameId &&
        sample.canvasDataUrl?.startsWith("data:image/png;base64,"));
      if (!stage?.canvasDataUrl) throw new Error("Matching High canvas capture is unavailable");
      const captureIdentity = {
        requestId: stage.request.requestId,
        generationId: stage.generation.generationId,
        frameId: stage.frameId,
      };
      if (typeof window.__roomSurfaceInspect !== "function")
        throw new Error("Room surface inspection callback is not installed by the mounted room owner");
      const inspected = window.__roomSurfaceInspect(probesToInspect, captureIdentity, state.previewMode);
      return {
        readiness,
        currentFrameIdentity,
        captureIdentity,
        state: {
          presetKey: state.presetKey,
          preset: state.preset,
          camera: state.camera,
          optics: {
            lensCenterWorld: state.optics.lensCenterWorld,
            lensPlane: state.optics.lensPlane,
            filmPlane: state.optics.filmPlane,
            filmPlaneCornersWorld: state.optics.filmPlaneCornersWorld,
            focusPlane: state.optics.focusPlane,
          },
          rendererInfo: state.info,
          colorPath: state.hdr ? "HDR HalfFloat" : "byte diagnostic",
          renderQuality: state.renderQuality,
          previewMode: state.previewMode,
          rawDebug: state.rawDebug,
          displayExposure: state.displayExposure,
          reflectionsEnabled: state.reflectionsEnabled,
          gi: window.__giReport || null,
        },
        canvasDataUrl: stage.canvasDataUrl,
        canvasCaptureError: stage.canvasCaptureError || null,
        focusStageStatus: stage.status,
        surfaceProbes: inspected,
      };
    }, { required: expected, probesToInspect: probes });

    const pngBytes = Buffer.from(capture.canvasDataUrl.split(",")[1], "base64");
    const imagePath = path.join(out, "ground-glass-high-native-canvas.png");
    fs.writeFileSync(imagePath, pngBytes);
    const patchMeasurements = await page.evaluate(async ({ base64, samples, identity, roiRadiusPx }) => {
      if (typeof window.__roomSurfaceMeasureRgba !== "function" || typeof window.__roomSurfaceInspect !== "function")
        throw new Error("Room surface inspection and patch-measurement callbacks are not installed");
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("2D image decoder context unavailable");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const state = window.__roomOptics;
      if (state.request.requestId !== identity.requestId || state.generation.generationId !== identity.generationId)
        throw new Error("Room camera request changed before patch surface verification");
      if (!samples.length) return { width: canvas.width, height: canvas.height, roiRadiusPx, measurements: [] };
      const roleOf = (sample) => {
        const stable = (sample.mesh.giMeshKey + " " + sample.mesh.path + " " + sample.material.name).toLowerCase();
        const roles = [];
        if (/bed\/(duvet|throw|sheet|pillow)|cardigan|tote|fabric/.test(stable)) roles.push("upstream-named-fabric-geometry");
        if (/bed\/(frame|slats)|desk\/deskt(op)?|wood|oak/.test(stable)) roles.push("upstream-wood-or-desk-geometry");
        if ((sample.material.metalness ?? 0) > 0.1 ||
            (sample.material.roughness !== null && sample.material.roughness <= 0.45) ||
            (sample.material.transmission ?? 0) > 0) roles.push("PBR-specular-response-candidate");
        return roles;
      };
      const unique = new Map();
      for (const sample of samples) {
        if (!sample.valid || !sample.mesh?.giMeshKey || !sample.material?.stableId) continue;
        const key = sample.mesh.giMeshKey + "|" + sample.material.stableId;
        if (!unique.has(key)) unique.set(key, sample);
      }
      const representatives = [...unique.values()]
        .map((sample) => ({ sample, roles: roleOf(sample), isKnownPoint: Boolean(sample.knownSourcePoint) }))
        .sort((a, b) => Number(b.isKnownPoint) - Number(a.isKnownPoint) || b.roles.length - a.roles.length)
        .slice(0, 8);
      const radiusPx = roiRadiusPx;
      const offsets = [
        [-1, -1], [0, -1], [1, -1], [1, 0],
        [1, 1], [0, 1], [-1, 1], [-1, 0],
      ];
      const cornerProbes = [];
      for (const { sample } of representatives) {
        const uStep = radiusPx / Math.max(1, image.width - 1);
        const vStep = radiusPx / Math.max(1, image.height - 1);
        for (let i = 0; i < offsets.length; i++) {
          const [du, dv] = offsets[i];
          cornerProbes.push({
            id: sample.id + ":roi:" + i,
            displayUv: {
              u: sample.projectedDisplayUv.u + du * uStep,
              v: sample.projectedDisplayUv.v + dv * vStep,
            },
          });
        }
      }
      const cornerHits = window.__roomSurfaceInspect(cornerProbes, identity, state.previewMode);
      const byCornerId = new Map(cornerHits.map((sample) => [sample.id, sample]));
      const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
      return {
        width: canvas.width,
        height: canvas.height,
        roiRadiusPx: radiusPx,
        ambiguousRoiPolicy: "all 8 ROI perimeter rays must hit the same GI mesh/material; local surface normals must stay within 18 degrees",
        measurements: representatives.map(({ sample, roles, isKnownPoint }) => {
          const corners = offsets.map((_, index) => byCornerId.get(sample.id + ":roi:" + index));
          const centerNormal = sample.surfaceNormalWorld;
          const mismatch = corners.find((corner) => !corner?.valid ||
            corner.mesh?.giMeshKey !== sample.mesh.giMeshKey ||
            corner.material?.stableId !== sample.material.stableId ||
            !centerNormal || !corner.surfaceNormalWorld || dot(centerNormal, corner.surfaceNormalWorld) < Math.cos(18 * Math.PI / 180));
          if (mismatch) return {
            id: sample.id,
            giMeshKey: sample.mesh.giMeshKey,
            materialId: sample.material.stableId,
            roles,
            isKnownPoint,
            valid: false,
            rejection: "ROI ambiguous: perimeter ray misses or changes GI mesh/material/normal",
            rejectedPerimeterRay: mismatch.id,
            perimeter: corners,
          };
          const patch = window.__roomSurfaceMeasureRgba(
            image.data,
            image.width,
            image.height,
            sample.projectedDisplayUv,
            { radiusPx, frameIdentity: identity },
          );
          return {
            id: sample.id,
            giMeshKey: sample.mesh.giMeshKey,
            materialId: sample.material.stableId,
            roles,
            isKnownPoint,
            sourceM: sample.sourceM,
            valid: patch.valid,
            rejection: patch.rejection || null,
            patch,
            perimeterSurface: "same GI mesh/material across all 8 perimeter rays; local normal spread under 18 degrees",
          };
        }),
      };
    }, {
      base64: capture.canvasDataUrl.split(",")[1],
      samples: capture.surfaceProbes,
      identity: capture.captureIdentity,
      roiRadiusPx,
    });

    const finalReadiness = await page.evaluate((required) =>
      window.__roomInspectCapture(window.__roomOptics, required), expected);
    if (finalReadiness.status !== "ready" ||
        finalReadiness.requestId !== capture.captureIdentity.requestId ||
        finalReadiness.generationId !== capture.captureIdentity.generationId) {
      throw new Error("Camera request or renderer generation changed while material evidence was being measured");
    }
    const gpu = await page.locator('[data-rtt-resource-channel="default"] canvas').evaluate((canvas) => {
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return { available: false };
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        available: true,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        webglVersion: gl.getParameter(gl.VERSION),
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      };
    });
    if (hardwareRequested && (!gpu.renderer || /swiftshader|llvmpipe|software/i.test(gpu.renderer) ||
        (process.platform === "darwin" && !/metal/i.test(gpu.renderer)))) {
      throw new Error("Hardware rendering was requested but the Ground Glass canvas does not report the expected hardware renderer: " + JSON.stringify(gpu));
    }
    const source = {
      commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      dirtyWorktree: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()),
    };
    const summary = {
      source,
      url: url.href,
      browser: browser.version(),
      requestedBackend: hardwareRequested ? (process.platform === "darwin" ? "Metal" : "hardware") : "SwiftShader",
      gpu,
      image: { path: path.basename(imagePath), bytes: pngBytes.byteLength, dimensions: [patchMeasurements.width, patchMeasurements.height] },
      captureFrameIdentity: capture.captureIdentity,
      currentFrameIdentityAtInspection: capture.currentFrameIdentity,
      finalCurrentFrameIdentity: {
        requestId: finalReadiness.requestId,
        generationId: finalReadiness.generationId,
        frameId: finalReadiness.frameId,
      },
      state: capture.state,
      requestedFocusDistanceMm: focusDistanceMm,
      requestedKnownSourcePointM: sourcePointM,
      focusSelectionValidation: focusDistanceMm === null ? "preset value retained" : "public focus slider step: 10 mm; range 100..8000 mm",
      probes: capture.surfaceProbes,
      patchMeasurements: patchMeasurements.measurements,
      errors,
      evidenceLimits: [
        "same completed RTT frame and native output canvas data URL; not compositor presentation proof",
        "patch metrics are display-referred RGB8 statistics and do not measure linear radiance or sharpness",
        "raycast confirms the first base-geometry surface only; alpha/displacement/custom shader surfaces are rejected",
        "screen-probe patch may include adjacent surfaces, defocus, reflections, or highlight clipping",
      ],
    };
    fs.writeFileSync(path.join(out, "room-surface-capture.json"), JSON.stringify(summary, null, 2) + "\n");
    if (errors.length) throw new Error("Browser reported errors: " + JSON.stringify(errors));
    if (!capture.surfaceProbes.some((probe) => probe.valid))
      throw new Error("No visible count-matched baked-GI PBR surface was found in the scan");
    console.log(JSON.stringify({
      output: out,
      image: summary.image,
      frameIdentity: summary.frameIdentity,
      validSurfaceCount: capture.surfaceProbes.filter((probe) => probe.valid).length,
      surfaces: [...new Set(capture.surfaceProbes.filter((probe) => probe.valid).map((probe) => probe.mesh.giMeshKey + " | " + probe.material.name))],
      gpu,
      errors,
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
