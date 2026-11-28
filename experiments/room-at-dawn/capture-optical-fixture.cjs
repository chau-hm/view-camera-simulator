const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const out = path.resolve(process.argv[2] || "/private/tmp/room-optical-fixture");
const url = process.env.ROOM_OPTICS_URL || "http://127.0.0.1:5199/view-camera-simulator/experiments/room-at-dawn/optics.html?rttDiagnostics=1";
const timeout = 240000;
const cases = [
  { id: "focus-near", focus: 1100, aperture: 5.6, tilt: 0, swing: 0 },
  { id: "focus-middle", focus: 2000, aperture: 5.6, tilt: 0, swing: 0 },
  { id: "focus-far", focus: 4000, aperture: 5.6, tilt: 0, swing: 0 },
  { id: "aperture-f11", focus: 1100, aperture: 11, tilt: 0, swing: 0 },
  { id: "aperture-f22", focus: 1100, aperture: 22, tilt: 0, swing: 0 },
  { id: "tilt-positive", focus: 2000, aperture: 5.6, tilt: 5, swing: 0 },
  { id: "tilt-negative", focus: 2000, aperture: 5.6, tilt: -5, swing: 0 },
  { id: "swing-positive", focus: 2000, aperture: 5.6, tilt: 0, swing: 5 },
  { id: "swing-negative", focus: 2000, aperture: 5.6, tilt: 0, swing: -5 },
  { id: "combined", focus: 2000, aperture: 5.6, tilt: 5, swing: 5 },
];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
  page.setDefaultTimeout(timeout);
  await page.addInitScript({ path: path.join(__dirname, "capture-sync.cjs") });
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });
  const canvas = page.locator('[data-rtt-resource-channel="default"] canvas');
  const wait = async (expected) => {
    await page.waitForFunction((wanted) => {
      const result = window.__roomInspectCapture(window.__roomOptics, wanted);
      return result.status === "failed" || (result.status === "ready" && typeof window.__roomFixtureInspect === "function");
    }, expected, { timeout });
    const data = await page.evaluate((wanted) => {
      const state = window.__roomOptics;
      const result = window.__roomInspectCapture(state, wanted);
      const info = state.observation?.info || {};
      const canvas = document.querySelector('[data-rtt-resource-channel="default"] canvas');
      return { result, state, features: window.__roomFixtureInspect?.({ internalWidthPx: info.colorTargetWidthPx, displayWidthPx: Math.round(canvas.getBoundingClientRect().width), sampledFilmWidthMm: info.sampledFilmWidthMm }) };
    }, expected);
    if (data.result.status !== "ready") throw new Error(`Frame failure: ${JSON.stringify(data.result)}`);
    if (!Array.isArray(data.features) || data.features.length !== 3) throw new Error("Fixture features unavailable");
    return data;
  };
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__roomOptics?.ready || window.__roomOptics?.error, null, { timeout });
    if (await page.evaluate(() => window.__roomOptics?.error)) throw new Error("Room resource initialization failed");
    await page.getByLabel("Subject").selectOption("fixture");
    await page.getByLabel("Render quality").selectOption("high");
    await page.getByRole("button", { name: "Unmount Observer" }).click();
    const records = [];
    for (const test of cases) {
      // Display-only normalization keeps the two edge plateaus measurable at
      // stopped-down apertures; it does not alter canonical illumination.
      const exposure = Number(((test.aperture / 5.6) ** 2).toFixed(3));
      await page.getByLabel("Display exposure").fill(String(exposure));
      await page.getByLabel("Focus (mm)").fill(String(test.focus));
      await page.getByLabel("Aperture").selectOption(String(test.aperture));
      await page.getByLabel("Tilt (degrees)").fill(String(test.tilt));
      await page.getByLabel("Swing (degrees)").fill(String(test.swing));
      const expected = { subjectMode: "fixture", renderQuality: "high", displayExposure: exposure, "camera.focusDistanceMm": test.focus, "camera.aperture": test.aperture, "camera.frontTiltDeg": test.tilt, "camera.frontSwingDeg": test.swing, previewMode: "upright" };
      const before = await wait(expected);
      const pngPath = path.join(out, `${test.id}.png`);
      await canvas.screenshot({ path: pngPath, timeout });
      const after = await wait(expected);
      if (before.result.requestId !== after.result.requestId || before.result.generationId !== after.result.generationId) throw new Error(`${test.id}: frame identity changed during capture`);
      const png = fs.readFileSync(pngPath).toString("base64");
      const measurements = await page.evaluate(async ({ png, features }) => {
        const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const c = document.createElement("canvas"); c.width = image.width; c.height = image.height;
        const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(image, 0, 0); image.close();
        const imageData = ctx.getImageData(0, 0, c.width, c.height);
        return features.map((feature) => {
          const x = Math.round(feature.projected.uRaw * c.width), y = Math.round((1 - feature.projected.vRaw) * c.height);
          const roi = { x: x - 14, y: y - 6, width: 28, height: 12 };
          let measurement = feature.valid ? window.__roomMeasureVerticalEdge(imageData.data, c.width, c.height, roi) : { valid: false, rejection: feature.rejection };
          if (measurement.valid && Math.abs(measurement.edgeX - x) > 4) measurement = { valid: false, rejection: "edge is not registered to the projected target center", measuredEdgeX: measurement.edgeX };
          return { id: feature.id, projectedCenter: { x, y }, roi, geometryValid: feature.valid, measurement };
        });
      }, { png, features: after.features });
      const record = { test, expected, frame: after.result, state: after.state, features: after.features, measurements, screenshot: path.basename(pngPath), browser: browser.version(), problems };
      fs.writeFileSync(path.join(out, `${test.id}.json`), JSON.stringify(record, null, 2) + "\n");
      records.push({ id: test.id, frame: after.result, measurements });
      console.log(test.id, JSON.stringify(measurements));
    }
    const manifest = { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), dirtySource: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() !== "", browser: browser.version(), backend: "Chromium ANGLE SwiftShader WebGL", url, problems, records, limitations: ["fixture is not the room", "RGB8 edge spread is display-referred and must be interpreted with exposure and sampling", "valid geometry does not imply valid image ROI"] };
    fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    if (problems.length) throw new Error(`Browser errors: ${JSON.stringify(problems)}`);
    if (!records.some((record) => record.measurements.some((m) => m.measurement.valid))) throw new Error("No valid image measurement; see manifest for rejections");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
