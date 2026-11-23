const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const out = path.resolve(process.argv[2] || "/private/tmp/room-optics-evidence");
const url =
  process.env.ROOM_OPTICS_URL ||
  "http://127.0.0.1:5199/view-camera-simulator/experiments/room-at-dawn/optics.html?rttDiagnostics=1";
const timeout = 240000;
const allCases = [
  "neutral",
  "rise-positive",
  "shift-positive",
  "shift-negative",
  "tilt-positive",
  "tilt-negative",
  "swing-positive",
  "swing-negative",
  "focus-near",
  "focus-far",
  "aperture-mid",
  "stopped",
  "lateral",
  "combined",
  "raw",
  "remount",
];
const requested = process.env.ROOM_OPTICS_CASES
  ? new Set(
      process.env.ROOM_OPTICS_CASES.split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    )
  : null;
if (requested && (!requested.size || [...requested].some((name) => !allCases.includes(name))))
  throw new Error(`Invalid ROOM_OPTICS_CASES; valid names: ${allCases.join(", ")}`);
const completed = new Set();
const subsetComplete = Symbol("requested capture subset complete");
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args:
      process.env.ROOM_OPTICS_HARDWARE === "1"
        ? []
        : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
  // A software reflection capture can keep controls busy past the Playwright
  // action default; completed-frame checks remain independently bounded.
  page.setDefaultTimeout(timeout);
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  await page.addInitScript({ path: path.join(__dirname, "capture-sync.cjs") });
  await page.addInitScript({ path: path.join(__dirname, "observer-sync.cjs") });
  try {
    await page.goto(url);
    await page.waitForFunction(
      () => window.__roomOptics?.ready || window.__roomOptics?.error,
      null,
      { timeout },
    );
    const bootError = await page.evaluate(() => window.__roomOptics?.error);
    if (bootError) throw new Error(`Scene initialization failed: ${bootError}`);
    if (process.env.ROOM_OPTICS_PRESET)
      await page.getByLabel("Composition").selectOption(process.env.ROOM_OPTICS_PRESET);
    if (process.env.ROOM_OPTICS_QUALITY)
      await page.getByLabel("Render quality").selectOption(process.env.ROOM_OPTICS_QUALITY);
    if (process.env.ROOM_OPTICS_COLOR)
      await page.getByLabel("Color path").selectOption(process.env.ROOM_OPTICS_COLOR);
    if (process.env.ROOM_OPTICS_REFLECTIONS === "off")
      await page.getByLabel("Reflections").uncheck();
    if (process.env.ROOM_OPTICS_REFLECTIONS === "on") await page.getByLabel("Reflections").check();
    if (process.env.ROOM_OPTICS_EXPOSURE)
      await page.getByLabel("Display exposure").fill(process.env.ROOM_OPTICS_EXPOSURE);
    const requestedSettings = {
      presetKey: process.env.ROOM_OPTICS_PRESET || null,
      renderQuality: process.env.ROOM_OPTICS_QUALITY || null,
      hdr: process.env.ROOM_OPTICS_COLOR ? process.env.ROOM_OPTICS_COLOR === "hdr" : null,
      reflectionsEnabled: process.env.ROOM_OPTICS_REFLECTIONS
        ? process.env.ROOM_OPTICS_REFLECTIONS === "on"
        : null,
      displayExposure: process.env.ROOM_OPTICS_EXPOSURE
        ? Number(process.env.ROOM_OPTICS_EXPOSURE)
        : null,
    };
    await page.waitForFunction(
      (expected) => {
        const state = window.__roomOptics;
        return (
          state &&
          Object.entries(expected).every(([key, value]) => value === null || state[key] === value)
        );
      },
      requestedSettings,
      { timeout },
    );
    const configured = await page.evaluate(() => ({
      camera: window.__roomOptics.camera,
      presetKey: window.__roomOptics.presetKey,
      renderQuality: window.__roomOptics.renderQuality,
      hdr: window.__roomOptics.hdr,
      displayExposure: window.__roomOptics.displayExposure,
      reflectionsEnabled: window.__roomOptics.reflectionsEnabled,
    }));
    if (process.env.ROOM_OPTICS_PRESET && configured.presetKey !== process.env.ROOM_OPTICS_PRESET)
      throw new Error("Preset change did not commit");
    if (process.env.ROOM_OPTICS_QUALITY && configured.renderQuality !== process.env.ROOM_OPTICS_QUALITY)
      throw new Error("Render quality change did not commit");
    if (
      process.env.ROOM_OPTICS_COLOR &&
      configured.hdr !== (process.env.ROOM_OPTICS_COLOR === "hdr")
    )
      throw new Error("Color path change did not commit");
    if (
      process.env.ROOM_OPTICS_REFLECTIONS &&
      configured.reflectionsEnabled !== (process.env.ROOM_OPTICS_REFLECTIONS === "on")
    )
      throw new Error("Reflection setting did not commit");
    if (
      process.env.ROOM_OPTICS_EXPOSURE &&
      configured.displayExposure !== Number(process.env.ROOM_OPTICS_EXPOSURE)
    )
      throw new Error("Display exposure change did not commit");
    // Source readiness precedes shader compilation and reflection capture. Do not
    // operate controls until an actual current RTT frame has completed.
    await page.waitForFunction(
      () => {
        const result = window.__roomInspectCapture(window.__roomOptics, {});
        return result.status === "ready" || result.status === "failed";
      },
      null,
      { timeout },
    );
    const initialFrame = await page.evaluate(() =>
      window.__roomInspectCapture(window.__roomOptics, {}),
    );
    if (initialFrame.status !== "ready")
      throw new Error(`Initial RTT frame failed: ${initialFrame.reason}`);
    async function capture(name, expected) {
      if (requested && !requested.has(name)) return;
      try {
        await page.waitForFunction(
          (required) => {
            const result = window.__roomInspectCapture(window.__roomOptics, required);
            return result.status === "ready" || result.status === "failed";
          },
          expected,
          { timeout },
        );
      } catch (error) {
        const status = await page
          .evaluate(
            (required) => ({
              result: window.__roomInspectCapture?.(window.__roomOptics, required),
              state: window.__roomOptics,
            }),
            expected,
          )
          .catch(() => null);
        throw new Error(
          `${name}: timed out waiting for a matching completed RTT frame and diagnostic: ${JSON.stringify(status)}; ${error.message}`,
        );
      }
      const snapshot = await page.evaluate(
        (required) => ({
          result: window.__roomInspectCapture(window.__roomOptics, required),
          state: window.__roomOptics,
          gi: window.__giReport,
          features: window.__roomOptics?.features,
          colorSettings: {
            hdr: window.__roomOptics?.hdr,
            displayExposure: window.__roomOptics?.displayExposure,
            reflectionsEnabled: window.__roomOptics?.reflectionsEnabled,
          },
        }),
        expected,
      );
      if (snapshot.result.status !== "ready") throw new Error(`${name}: ${snapshot.result.reason}`);
      await page.waitForFunction(
        () => {
          const result = window.__roomInspectObserver(window.__roomOptics, window.__roomObserver);
          return (
            result.status === "ready" ||
            result.status === "failed" ||
            window.__roomObserver?.status === "failed"
          );
        },
        null,
        { timeout },
      );
      const observerSnapshot = await page.evaluate(() => ({
        result: window.__roomInspectObserver(window.__roomOptics, window.__roomObserver),
        frame: window.__roomObserver,
        request: window.__roomOptics?.observerRequest,
      }));
      if (observerSnapshot.result.status !== "ready")
        throw new Error(`${name}: Observer not ready: ${JSON.stringify(observerSnapshot)}`);
      const observerCanvas = page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: "Room observer" }) })
        .locator("canvas");
      if ((await observerCanvas.count()) !== 1)
        throw new Error(`${name}: expected one Observer canvas`);
      const observerPath = path.join(out, `${name}-observer.png`);
      await observerCanvas.screenshot({ path: observerPath, timeout });
      const observerAfter = await page.evaluate(() =>
        window.__roomInspectObserver(window.__roomOptics, window.__roomObserver),
      );
      if (
        observerAfter.status !== "ready" ||
        observerAfter.requestId !== observerSnapshot.result.requestId ||
        observerAfter.generationId !== observerSnapshot.result.generationId
      )
        throw new Error(`${name}: Observer request or generation changed during capture`);
      const observerPng = fs.readFileSync(observerPath).toString("base64");
      const observerMetrics = await page.evaluate(async (png) => {
        const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const c = document.createElement("canvas");
        c.width = image.width;
        c.height = image.height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        image.close();
        const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
        function measure(x0, y0, x1, y1) {
          let total = 0,
            dark = 0,
            white = 0,
            n = 0;
          for (let y = y0; y < y1; y++)
            for (let x = x0; x < x1; x++) {
              const i = (y * width + x) * 4;
              const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
              total += l;
              n++;
              if (l <= 5) dark++;
              if (l >= 250) white++;
            }
          return {
            meanLuma8: total / n,
            nearBlackFraction: dark / n,
            nearWhiteFraction: white / n,
            pixels: n,
          };
        }
        return {
          space: "display-referred RGB8; not linear radiance",
          wholeImage: measure(0, 0, width, height),
          centerRegion: {
            bounds: [
              Math.floor(width * 0.35),
              Math.floor(height * 0.35),
              Math.floor(width * 0.65),
              Math.floor(height * 0.65),
            ],
            materialUnverified: true,
            ...measure(
              Math.floor(width * 0.35),
              Math.floor(height * 0.35),
              Math.floor(width * 0.65),
              Math.floor(height * 0.65),
            ),
          },
        };
      }, observerPng);
      const canvas = page.locator('[data-rtt-resource-channel="default"] canvas');
      if ((await canvas.count()) !== 1)
        throw new Error(`${name}: expected exactly one Ground Glass canvas`);
      const output = path.join(out, `${name}.png`);
      await canvas.screenshot({ path: output, timeout });
      const after = await page.evaluate(
        (required) => ({
          result: window.__roomInspectCapture(window.__roomOptics, required),
          request: window.__roomOptics?.request,
          generation: window.__roomOptics?.generation,
        }),
        expected,
      );
      if (
        after.result.status !== "ready" ||
        after.result.requestId !== snapshot.result.requestId ||
        after.result.generationId !== snapshot.result.generationId
      )
        throw new Error(
          `${name}: state or renderer generation changed during capture: ${JSON.stringify(after)}`,
        );
      // Display-referred screenshot statistics. Candidate ROIs have not been
      // raycast for visibility and must not be treated as optical proof.
      const screenshotBase64 = fs.readFileSync(output).toString("base64");
      const imageMetrics = await page.evaluate(
        async ({ png, features, previewMode }) => {
          const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const luminance = (x, y) => {
            const i = (y * width + x) * 4;
            return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          };
          function measure(x0, y0, x1, y1) {
            let sum = 0,
              grad = 0,
              n = 0,
              clipped = 0,
              dark = 0;
            for (let y = y0; y < y1; y++)
              for (let x = x0; x < x1; x++) {
                const value = luminance(x, y);
                sum += value;
                n++;
                if (value >= 250) clipped++;
                if (value <= 5) dark++;
                if (x + 1 < x1) grad += Math.abs(value - luminance(x + 1, y));
                if (y + 1 < y1) grad += Math.abs(value - luminance(x, y + 1));
              }
            return {
              meanLuma8: sum / n,
              gradientEnergy8: grad / n,
              nearBlackFraction: dark / n,
              nearWhiteFraction: clipped / n,
              pixels: n,
            };
          }
          const candidateRegions = features.map((feature) => {
            const projected = feature.projected;
            if (!projected?.visible) return { id: feature.id, inFrame: false };
            // Projection uses a bottom-origin film V; screenshots use top-origin Y.
            // Raw applies the existing physical inversion to both display axes.
            const u = previewMode === "raw" ? 1 - projected.uRaw : projected.uRaw;
            const v = previewMode === "raw" ? projected.vRaw : 1 - projected.vRaw;
            const cx = Math.round(u * (width - 1)),
              cy = Math.round(v * (height - 1)),
              radius = 10;
            const x0 = Math.max(0, cx - radius),
              y0 = Math.max(0, cy - radius),
              x1 = Math.min(width, cx + radius),
              y1 = Math.min(height, cy + radius);
            return {
              id: feature.id,
              inFrame: true,
              center: [cx, cy],
              region: [x0, y0, x1, y1],
              occlusionChecked: false,
              validForSharpness: false,
              invalidReason:
                "Candidate visibility, occlusion and texture suitability are unverified",
              ...measure(x0, y0, x1, y1),
            };
          });
          return {
            space: "display-referred screenshot, 8-bit luma; not linear radiance",
            wholeImage: measure(0, 0, width, height),
            candidateRegions,
          };
        },
        {
          png: screenshotBase64,
          features: snapshot.features || [],
          previewMode: snapshot.state.previewMode,
        },
      );
      fs.writeFileSync(
        path.join(out, `${name}.json`),
        JSON.stringify(
          {
            expected,
            snapshot,
            observer: observerSnapshot,
            observerMetrics,
            imageMetrics,
            canvas: await canvas.evaluate((el) => {
              const gl = el.getContext("webgl2") || el.getContext("webgl");
              const ext = gl?.getExtension("WEBGL_debug_renderer_info");
              return {
                width: el.width,
                height: el.height,
                cssWidth: el.clientWidth,
                cssHeight: el.clientHeight,
                colorTypes: el.getAttribute("data-rtt-color-types"),
                framebufferStatus: el.getAttribute("data-rtt-hdr-framebuffers"),
                webglVersion: gl?.getParameter(gl.VERSION) ?? null,
                unmaskedRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
                unmaskedVendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
              };
            }),
            url,
            browser: browser.version(),
            capturedAt: new Date().toISOString(),
            problems,
          },
          null,
          2,
        ),
      );
      console.log(`${name}: ${snapshot.result.frameId}`);
      completed.add(name);
      if (requested && completed.size === requested.size) throw subsetComplete;
    }
    try {
      const camera = {
        "camera.focusDistanceMm": configured.camera.focusDistanceMm,
        "camera.focalLengthMm": configured.camera.focalLengthMm,
        presetKey: configured.presetKey,
        renderQuality: configured.renderQuality,
        hdr: configured.hdr,
        displayExposure: configured.displayExposure,
        reflectionsEnabled: configured.reflectionsEnabled,
        "camera.aperture": configured.camera.aperture,
        "camera.mirrorShiftLessonState.rigLateralMm": 0,
        "camera.frontRiseMm": 0,
        "camera.frontShiftMm": 0,
        "camera.frontTiltDeg": 0,
        "camera.frontSwingDeg": 0,
        previewMode: "upright",
        rawDebug: false,
      };
      await capture("neutral", camera);
      // Each movement starts from neutral; the supported front rise range is nonnegative.
      for (const [name, label, key, value] of [
        ["rise-positive", "Rise (mm)", "camera.frontRiseMm", 30],
        ["shift-positive", "Shift (mm)", "camera.frontShiftMm", 40],
        ["shift-negative", "Shift (mm)", "camera.frontShiftMm", -40],
        ["tilt-positive", "Tilt (degrees)", "camera.frontTiltDeg", 5],
        ["tilt-negative", "Tilt (degrees)", "camera.frontTiltDeg", -5],
        ["swing-positive", "Swing (degrees)", "camera.frontSwingDeg", 5],
        ["swing-negative", "Swing (degrees)", "camera.frontSwingDeg", -5],
      ]) {
        await page.getByLabel(label).fill(String(value));
        camera[key] = value;
        await capture(name, camera);
        await page.getByLabel(label).fill("0");
        camera[key] = 0;
      }
      for (const [name, value] of [
        ["focus-near", "800"],
        ["focus-far", "3500"],
      ]) {
        await page.getByLabel("Focus (mm)").fill(value);
        camera["camera.focusDistanceMm"] = Number(value);
        await capture(name, camera);
      }
      await page.getByLabel("Aperture").selectOption("11");
      camera["camera.aperture"] = 11;
      await capture("aperture-mid", camera);
      await page.getByLabel("Aperture").selectOption("22");
      camera["camera.aperture"] = 22;
      await capture("stopped", camera);
      await page.getByLabel("Focus (mm)").fill(String(configured.camera.focusDistanceMm));
      camera["camera.focusDistanceMm"] = configured.camera.focusDistanceMm;
      await page.getByLabel("Aperture").selectOption(String(configured.camera.aperture));
      camera["camera.aperture"] = configured.camera.aperture;
      await page.getByLabel("Camera lateral position (mm)").fill("500");
      camera["camera.mirrorShiftLessonState.rigLateralMm"] = 500;
      await capture("lateral", camera);
      for (const [label, key, value] of [
        ["Rise (mm)", "camera.frontRiseMm", 30],
        ["Shift (mm)", "camera.frontShiftMm", 40],
        ["Tilt (degrees)", "camera.frontTiltDeg", 5],
        ["Swing (degrees)", "camera.frontSwingDeg", 5],
      ]) {
        await page.getByLabel(label).fill(String(value));
        camera[key] = value;
      }
      await capture("combined", camera);
      await page.getByRole("button", { name: "Toggle Raw/Upright" }).click();
      camera.previewMode = "raw";
      await capture("raw", camera);
      const retiredGeneration = await page.evaluate(
        () => window.__roomOptics.generation.generationId,
      );
      await page.getByRole("button", { name: "Unmount views" }).click();
      if ((await page.locator("canvas").count()) !== 0)
        throw new Error("Unmount left a canvas mounted");
      try {
        await page.waitForFunction(
          (id) => window.__roomRetirements?.some((x) => x.generation?.generationId === id),
          retiredGeneration,
          { timeout },
        );
      } catch (error) {
        throw new Error(
          `Renderer cleanup did not settle for ${retiredGeneration}: ${error.message}`,
        );
      }
      const retirement = await page.evaluate(
        (id) => window.__roomRetirements.find((x) => x.generation?.generationId === id),
        retiredGeneration,
      );
      fs.writeFileSync(
        path.join(out, "retirement.json"),
        JSON.stringify(retirement, null, 2) + "\n",
      );
      if (retirement.outcome !== "confirmed")
        throw new Error(`Renderer cleanup was ${retirement.outcome}: ${retirement.reason}`);
      await page.getByRole("button", { name: "Remount views" }).click();
      await capture("remount", camera);
    } catch (error) {
      if (error !== subsetComplete) throw error;
    }
    fs.writeFileSync(
      path.join(out, "manifest.json"),
      JSON.stringify(
        {
          requested: requested ? [...requested] : allCases,
          completed: [...completed],
          fullMatrix: !requested,
          url,
          browser: browser.version(),
          problems,
        },
        null,
        2,
      ),
    );
    if (problems.length) throw new Error(`Browser errors occurred: ${JSON.stringify(problems)}`);
  } catch (error) {
    if (problems.length) console.error("Browser errors:", JSON.stringify(problems));
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
