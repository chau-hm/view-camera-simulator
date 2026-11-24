/*
 * Browser regression for the experiment-local camera sliders.
 * The file uses trusted pointer and keyboard input against the actual Room-at-Dawn RTT.
 * Input pacing is part of the interaction; frame readiness always uses request/frame identity.
 */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");

const outputDir = path.resolve(process.env.ROOM_CONTROL_EVIDENCE_DIR || "/private/tmp/room-control-layout-after");
const url = process.env.ROOM_OPTICS_URL || "http://127.0.0.1:5215/view-camera-simulator/experiments/room-at-dawn/optics.html?rttDiagnostics=1";
const frameTimeoutMs = 240_000;
const presetKey = process.env.ROOM_CONTROL_PRESET || "depth";
if (!["wide", "depth"].includes(presetKey)) throw new Error("ROOM_CONTROL_PRESET must be wide or depth");
let keyboardSequence = 0;
const labels = [
  "Camera lateral position (mm)",
  "Rise (mm)",
  "Shift (mm)",
  "Tilt (degrees)",
  "Swing (degrees)",
  "Focus (mm)",
];
const contracts = {
  "Camera lateral position (mm)": { min: "-1000", max: "1000", step: "50" },
  "Rise (mm)": { min: "0", max: "40", step: "1" },
  "Shift (mm)": { min: "-60", max: "60", step: "1" },
  "Tilt (degrees)": { min: "-10", max: "10", step: "0.1" },
  "Swing (degrees)": { min: "-10", max: "10", step: "0.1" },
  "Focus (mm)": { min: "100", max: "8000", step: "10" },
};
fs.mkdirSync(outputDir, { recursive: true });

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function sourceSnapshot() {
  return {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    dirty: !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
    opticsSha256: sha256(path.join(__dirname, "optics.jsx")),
    harnessSha256: sha256(__filename),
  };
}

async function waitForFrame(page, expected) {
  await page.waitForFunction(
    (match) => {
      const result = window.__roomInspectCapture?.(window.__roomOptics, match);
      return result?.status === "ready" || result?.status === "failed";
    },
    expected,
    { timeout: frameTimeoutMs },
  );
  const snapshot = await page.evaluate((match) => ({
    result: window.__roomInspectCapture(window.__roomOptics, match),
    state: window.__roomOptics,
    gi: window.__giReport,
  }), expected);
  assert.equal(snapshot.result.status, "ready", JSON.stringify(snapshot.result));
  return snapshot;
}

async function setRange(page, label, value) {
  const input = page.getByLabel(label);
  await input.fill(String(value));
  await page.waitForFunction(
    ({ label: wantedLabel, value: wantedValue }) => {
      const element = [...document.querySelectorAll('input[type="range"]')].find(
        (candidate) => candidate.getAttribute("aria-label") === wantedLabel,
      );
      return (
        element?.value === String(wantedValue) &&
        element.parentElement?.querySelector("output")?.textContent.trim() === String(wantedValue)
      );
    },
    { label, value },
    { timeout: 30_000 },
  );
}

async function rangeGeometry(page, label) {
  return page.getByLabel(label).evaluate((input) => {
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right };
    };
    const output = input.parentElement.querySelector("output");
    const labelElement = input.parentElement.querySelector("label");
    return {
      value: input.value,
      min: input.min,
      max: input.max,
      step: input.step,
      input: rect(input),
      row: rect(input.parentElement),
      output: rect(output),
      label: labelElement.textContent.trim(),
      labelFor: labelElement.htmlFor,
      inputId: input.id,
      outputText: output.textContent.trim(),
      outputFontVariantNumeric: getComputedStyle(output).fontVariantNumeric,
    };
  });
}

async function assertStableRow(page, label, samples, viewportWidth) {
  const xs = samples.map((sample) => sample.input.x);
  const drift = Math.max(...xs) - Math.min(...xs);
  assert.ok(drift <= 0.5, `${label} slider moved ${drift.toFixed(3)} CSS px as its value changed`);
  for (const sample of samples) {
    assert.equal(sample.label, `${label}:`);
    assert.equal(sample.outputText, sample.value);
    assert.equal(sample.outputFontVariantNumeric, "tabular-nums");
    assert.equal(sample.min, contracts[label].min);
    assert.equal(sample.max, contracts[label].max);
    assert.equal(sample.step, contracts[label].step);
    assert.equal(sample.inputId, sample.labelFor);
    assert.ok(sample.row.x >= 0 && sample.row.right <= viewportWidth + 0.5,
      `${label} row exceeds ${viewportWidth}px viewport: ${JSON.stringify(sample.row)}`);
  }
  return { driftCssPx: drift, states: samples };
}

async function checkKeyboardSequence(page, viewportName, label, initial, nextValues, results) {
  await setRange(page, label, initial);
  const input = page.getByLabel(label);
  const samples = [await rangeGeometry(page, label)];
  const phase = `${viewportName}:keyboard:${label}:${keyboardSequence++}`;
  await page.evaluate((nextPhase) => { window.__roomControlPhase = nextPhase; }, phase);
  for (const nextValue of nextValues) {
    const previous = Number(await input.inputValue());
    await input.focus();
    await page.keyboard.press(Number(nextValue) >= previous ? "ArrowRight" : "ArrowLeft");
    assert.equal(Number(await input.inputValue()), nextValue, `${label} keyboard step did not reach ${nextValue}`);
    samples.push(await rangeGeometry(page, label));
  }
  const events = await page.evaluate((activePhase) =>
    window.__roomControlEvents.filter((event) => event.phase === activePhase && event.trusted), phase);
  assert.equal(events.length, nextValues.length, `${label} did not produce trusted keyboard input for each step`);
  results[viewportName].keyboard[label] = await assertStableRow(
    page,
    label,
    samples,
    viewportName === "desktop" ? 1200 : 390,
  );
  results[viewportName].keyboard[label].trustedInputValues = events.map((event) => event.value);
}

async function runPointerDrag(page, viewportName, pace, results) {
  const label = "Focus (mm)";
  const start = 700;
  const end = 1700;
  await setRange(page, label, start);
  await waitForFrame(page, { "camera.focusDistanceMm": start, presetKey, hdr: true });
  const input = page.getByLabel(label);
  await input.scrollIntoViewIfNeeded();
  const box = await input.boundingBox();
  assert.ok(box && box.width >= 120, `Focus slider bounds unavailable at ${viewportName}`);
  const x = (value) => box.x + 8 + ((box.width - 16) * (value - 100)) / (8000 - 100);
  const y = box.y + box.height / 2;
  const phase = `${viewportName}:pointer:${pace}`;
  await page.evaluate((nextPhase) => { window.__roomControlPhase = nextPhase; }, phase);
  await page.mouse.move(x(start), y);
  await page.mouse.down();
  const samples = [];
  for (let index = 1; index <= 60; index += 1) {
    const intended = start + ((end - start) * index) / 60;
    await page.mouse.move(x(intended), y, { steps: 1 });
    if (pace === "slow") await page.waitForTimeout(8);
    const value = Number(await input.inputValue());
    samples.push({
      intendedFocusMm: intended,
      focusMm: value,
      geometry: await rangeGeometry(page, label),
    });
  }
  await page.mouse.up();
  const values = [start, ...samples.map((sample) => sample.focusMm)];
  const monotonic = values.every((value, index) => index === 0 || value >= values[index - 1]);
  const inputEvents = await page.evaluate((activePhase) =>
    window.__roomControlEvents.filter((event) => event.phase === activePhase), phase);
  assert.ok(inputEvents.length >= 2, `${phase} produced fewer than two slider input events`);
  assert.ok(inputEvents.every((event) => event.trusted), `${phase} included untrusted input`);
  assert.ok(monotonic, `${phase} Focus values reversed during a one-direction drag: ${values.join(",")}`);
  assert.ok(values.at(-1) >= 1600 && values.at(-1) <= 1800,
    `${phase} ended at unexpected Focus ${values.at(-1)} mm for intended ${end} mm`);
  const stable = await assertStableRow(
    page,
    label,
    samples.map((sample) => sample.geometry),
    viewportName === "desktop" ? 1200 : 390,
  );
  const frame = await waitForFrame(page, {
    "camera.focusDistanceMm": values.at(-1),
    presetKey,
    hdr: true,
  });
  results[viewportName].pointer[pace] = {
    intendedRangeMm: [start, end],
    actualFocusMm: values.at(-1),
    inputEventCount: inputEvents.length,
    trusted: inputEvents.every((event) => event.trusted),
    monotonic,
    trackXDriftCssPx: stable.driftCssPx,
    inputValues: values,
    requestId: frame.state.request.requestId,
    generationId: frame.state.generation.generationId,
    frameId: frame.state.frame.frameId,
    completedAtMs: frame.state.frame.completedAtMs ?? null,
  };
}

(async () => {
  const source = sourceSnapshot();
  const args = process.platform === "darwin" ? ["--use-gl=angle", "--use-angle=metal"] : [];
  const browser = await chromium.launch({ headless: true, args });
  const page = await browser.newPage({ viewport: { width: 1200, height: 950 }, acceptDownloads: true });
  page.setDefaultTimeout(frameTimeoutMs);
  await page.addInitScript({ path: path.join(__dirname, "capture-sync.cjs") });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  const results = {
    status: "incomplete",
    source,
    url,
    browser: browser.version(),
    requestedGpu: process.platform === "darwin" ? "ANGLE Metal" : "browser default",
    viewportOrder: ["desktop", "narrow"],
    scene: { preset: presetKey, subject: "room", hdr: true, reflections: true, aperture: 5.6, exposure: 18.1, renderQuality: "low" },
    desktop: { keyboard: {}, pointer: {} },
    narrow: { keyboard: {}, pointer: {} },
    screenshots: [],
    browserErrors,
  };
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__roomOptics?.ready || window.__roomOptics?.error, null,
      { timeout: frameTimeoutMs });
    const sceneError = await page.evaluate(() => window.__roomOptics?.error);
    assert.ok(!sceneError, `Room resource initialization failed: ${sceneError}`);
    await page.getByLabel("Subject").selectOption("room");
    await page.getByLabel("Composition").selectOption(presetKey);
    await page.getByLabel("Color path").selectOption("hdr");
    await page.getByLabel("Reflections").check();
    await page.getByLabel("Display exposure").fill("18.1");
    await page.getByLabel("Aperture").selectOption("5.6");
    await page.getByLabel("Render quality").selectOption("low");
    await page.getByRole("button", { name: "Unmount Observer" }).click();
    const initialFrame = await waitForFrame(page, {
      presetKey,
      subjectMode: "room",
      hdr: true,
      reflectionsEnabled: true,
      displayExposure: 18.1,
      "camera.aperture": 5.6,
    });
    assert.equal(initialFrame.gi?.expected, 302);
    assert.equal(initialFrame.gi?.matched, 302);
    const canvas = page.locator('[data-rtt-resource-channel="default"] canvas');
    results.groundGlass = await canvas.evaluate((element) => {
      const gl = element.getContext("webgl2");
      const extension = gl?.getExtension("WEBGL_debug_renderer_info");
      return {
        width: element.width,
        height: element.height,
        renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER),
        camera: window.__roomOptics?.camera,
        presetKey: window.__roomOptics?.presetKey,
        subjectIdentity: window.__roomOptics?.subjectIdentity,
        gi: window.__giReport,
        request: window.__roomOptics?.request,
        generation: window.__roomOptics?.generation,
        frame: window.__roomOptics?.frame,
      };
    });
    assert.match(results.groundGlass.renderer || "", /metal/i, "Requested Metal renderer was not active");
    await canvas.screenshot({ path: path.join(outputDir, "ground-glass-desktop.png") });
    await page.screenshot({ path: path.join(outputDir, "page-desktop.png"), fullPage: true });
    results.screenshots.push("ground-glass-desktop.png", "page-desktop.png");

    await page.evaluate(() => {
      window.__roomControlPhase = "idle";
      window.__roomControlEvents = [];
      for (const input of document.querySelectorAll('input[type="range"]')) {
        const label = input.getAttribute("aria-label");
        input.addEventListener("input", (event) => {
          const rect = input.getBoundingClientRect();
          window.__roomControlEvents.push({
            label,
            phase: window.__roomControlPhase,
            value: Number(input.value),
            trusted: event.isTrusted,
            x: rect.x,
            width: rect.width,
            timeMs: performance.now(),
          });
        });
      }
    });
    for (const label of labels) {
      const geometry = await rangeGeometry(page, label);
      assert.equal(geometry.label, `${label}:`);
      assert.equal(geometry.min, contracts[label].min);
      assert.equal(geometry.max, contracts[label].max);
      assert.equal(geometry.step, contracts[label].step);
      results.desktop.keyboard[label] = { contract: { min: geometry.min, max: geometry.max, step: geometry.step } };
    }

    await page.getByRole("button", { name: "Record Focus trace" }).click();
    await checkKeyboardSequence(page, "desktop", "Focus (mm)", 990, [1000, 1010], results);
    await waitForFrame(page, { "camera.focusDistanceMm": 1010, presetKey, hdr: true });
    const traceDownload = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("button", { name: "Stop and download Focus trace" }).click();
    const download = await traceDownload;
    const tracePath = path.join(outputDir, "focus-trace.json");
    await download.saveAs(tracePath);
    const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
    const focusTraceInputs = trace.entries.filter((entry) => entry.kind === "focus-input" && entry.payload?.trusted);
    assert.ok(focusTraceInputs.some((entry) => entry.payload.focusDistanceMm === 1000));
    assert.ok(focusTraceInputs.some((entry) => entry.payload.focusDistanceMm === 1010));
    results.focusTrace = { trustedValues: focusTraceInputs.map((entry) => entry.payload.focusDistanceMm), path: "focus-trace.json" };
    results.screenshots.push("focus-trace.json");

    for (const viewportName of ["desktop", "narrow"]) {
      const width = viewportName === "desktop" ? 1200 : 390;
      const height = viewportName === "desktop" ? 950 : 844;
      if (viewportName === "narrow") {
        await page.setViewportSize({ width, height });
        await page.waitForFunction((expectedWidth) => window.innerWidth === expectedWidth, width);
      }
      results[viewportName].viewport = { width, height };
      results[viewportName].document = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      const layoutSnapshots = {};
      for (const [label, initial, next] of [
        ["Camera lateral position (mm)", -50, [0, 50, 0, -50]],
        ["Rise (mm)", 9, [10]],
        ["Shift (mm)", -1, [0, 1, 0, -1]],
        ["Tilt (degrees)", -0.1, [0, 0.1, 0, -0.1]],
        ["Swing (degrees)", -0.1, [0, 0.1, 0, -0.1]],
      ]) {
        await checkKeyboardSequence(page, viewportName, label, initial, next, results);
      }
      // Focus boundary check runs on each viewport, including the 990→1000 width transition.
      await checkKeyboardSequence(page, viewportName, "Focus (mm)", 990, [1000, 1010, 1000, 990], results);
      for (const label of labels) {
        layoutSnapshots[label] = results[viewportName].keyboard[label];
      }
      results[viewportName].layout = layoutSnapshots;
      await runPointerDrag(page, viewportName, "slow", results);
      await runPointerDrag(page, viewportName, "fast", results);
      const finalFrame = await waitForFrame(page, {
        "camera.focusDistanceMm": results[viewportName].pointer.fast.actualFocusMm,
        presetKey,
        hdr: true,
      });
      results[viewportName].finalFrame = {
        requestId: finalFrame.state.request.requestId,
        generationId: finalFrame.state.generation.generationId,
        frameId: finalFrame.state.frame.frameId,
        requestStatus: finalFrame.state.frame.status,
        completedOperations: finalFrame.state.frame.requiredOperations,
      };
      if (viewportName === "narrow") {
        await canvas.screenshot({ path: path.join(outputDir, "ground-glass-narrow.png") });
        await page.screenshot({ path: path.join(outputDir, "page-narrow.png"), fullPage: true });
        results.screenshots.push("ground-glass-narrow.png", "page-narrow.png");
      }
    }
    assert.equal(browserErrors.length, 0, `Browser reported errors: ${JSON.stringify(browserErrors)}`);
    const finalSource = sourceSnapshot();
    assert.equal(finalSource.commit, source.commit, "Source commit changed during capture");
    assert.equal(finalSource.opticsSha256, source.opticsSha256, "Experiment source changed during capture");
    assert.equal(finalSource.harnessSha256, source.harnessSha256, "Harness changed during capture");
    results.status = "passed";
    results.finalSource = finalSource;
    fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(results, null, 2)}\n`);
    console.log(JSON.stringify({
      status: results.status,
      gpu: results.groundGlass.renderer,
      gi: { expected: results.groundGlass.gi.expected, matched: results.groundGlass.gi.matched },
      pointer: Object.fromEntries(["desktop", "narrow"].map((viewport) => [viewport, results[viewport].pointer])),
      focusTrace: results.focusTrace,
      screenshots: results.screenshots,
      outputDir,
    }, null, 2));
  } catch (error) {
    results.status = "failed";
    results.error = String(error.stack || error);
    results.browserErrors = browserErrors;
    fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(results, null, 2)}\n`);
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
