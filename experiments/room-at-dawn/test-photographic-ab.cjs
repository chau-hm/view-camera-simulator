/*
 * Real-browser regression for completed-frame A/B capture.
 * Run with a running experiment Vite server, for example:
 *   ROOM_OPTICS_URL=http://127.0.0.1:5215/view-camera-simulator/experiments/room-at-dawn/optics.html \
 *   node experiments/room-at-dawn/test-photographic-ab.cjs
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const configuredUrl = process.env.ROOM_OPTICS_URL ||
  "http://127.0.0.1:5215/view-camera-simulator/experiments/room-at-dawn/optics.html";
const testUrl = new URL(configuredUrl);
testUrl.searchParams.set("roomCaptureTest", "1");
const url = testUrl.toString();
const timeoutMs = Number(process.env.ROOM_AB_TIMEOUT_MS || 120_000);

function stage(message) {
  process.stdout.write(`[room-ab] ${message}\n`);
}

async function waitFor(label, promise) {
  try {
    return await promise;
  } catch (error) {
    error.message = `${label} did not complete within the configured timeout (${timeoutMs} ms): ${error.message}`;
    throw error;
  }
}

function comparisonPanel(page) {
  return page.getByRole("region", { name: "Ground Glass A/B comparison" });
}

async function waitForCurrentFrame(page, focusDistanceMm) {
  await page.waitForFunction((wantedFocus) => {
    const state = window.__roomOptics;
    const frame = state?.frame;
    return state?.ready === true && state?.subjectMode === "room" &&
      state?.renderQuality === "high" && state?.camera?.focusDistanceMm === wantedFocus &&
      frame?.status === "completed" && frame?.requiredOperations === "all-completed" &&
      frame?.request?.requestId === state?.request?.requestId &&
      frame?.generation?.generationId === state?.generation?.generationId;
  }, focusDistanceMm, { timeout: timeoutMs });
}

async function savedCapture(panel, slot) {
  const article = panel.getByRole("article", { name: `Capture ${slot}` });
  const image = article.getByRole("img");
  await image.waitFor({ state: "visible", timeout: timeoutMs });
  if (!await article.locator("details").evaluate((element) => element.open)) {
    await article.getByText("Frame and camera details").click();
  }
  const pre = article.locator("pre");
  const provenance = JSON.parse(await pre.textContent());
  const dimensions = await image.evaluate((element) => ({
    naturalWidth: element.naturalWidth,
    naturalHeight: element.naturalHeight,
    complete: element.complete,
  }));
  return { article, image, provenance, dimensions };
}

async function waitForDeferredFrameCount(page, expectedCount) {
  await page.waitForFunction((count) =>
    window.__roomComparisonCaptureTest?.deferredFrameCount() === count,
  expectedCount, { timeout: timeoutMs });
}

async function assertFailureCleanup(page, panel, statusPattern, acceptedASource, acceptedA) {
  const status = panel.getByRole("status");
  await status.filter({ hasText: statusPattern }).waitFor({ timeout: timeoutMs });
  assert.match(await status.textContent(), statusPattern);
  await panel.getByRole("article", { name: "Capture B" }).getByText("No capture").waitFor();
  assert.equal(await panel.getByRole("button", { name: "Capture B" }).isDisabled(), false);
  assert.equal(await panel.getByRole("button", { name: "Replace A" }).isDisabled(), false);
  assert.equal(await page.getByRole("slider", { name: "Focus (mm)" }).isEnabled(), true);
  const timeoutStillArmed = await page.evaluate(() => {
    try {
      window.__roomComparisonCaptureTest.firePendingTimeout();
      return true;
    } catch (error) {
      if (String(error?.message || error).includes("No pending A/B capture timeout")) return false;
      throw error;
    }
  });
  assert.equal(timeoutStillArmed, false, "cancelled capture must release its timeout handler");

  await assertAcceptedAUnchanged(panel, acceptedASource, acceptedA);
}

async function assertAcceptedAUnchanged(panel, acceptedASource, acceptedA) {
  const captureA = await savedCapture(panel, "A");
  assert.equal(await captureA.image.getAttribute("src"), acceptedASource);
  assert.equal(captureA.provenance.requestId, acceptedA.requestId);
  assert.equal(captureA.provenance.generationId, acceptedA.generationId);
  assert.equal(captureA.provenance.frameId, acceptedA.frameId);
}

async function captureAfterLateFrame(page, panel, staleFrame, previousDeferredCount) {
  await page.evaluate(() => window.__roomComparisonCaptureTest.deferNextCompletedFrame());
  await panel.getByRole("button", { name: "Capture B" }).click();
  await panel.getByRole("status").filter({ hasText: /Waiting for completed B frame/ }).waitFor({ timeout: timeoutMs });
  await waitForDeferredFrameCount(page, previousDeferredCount + 1);

  const deferredFrames = await page.evaluate(() => window.__roomComparisonCaptureTest.deferredFrameIdentities());
  const freshFrame = deferredFrames[previousDeferredCount];
  const currentRequestId = await page.evaluate(() => window.__roomOptics.request.requestId);
  assert.equal(freshFrame.requestId, currentRequestId);
  assert.notEqual(staleFrame.requestId, currentRequestId);

  stage(`replay late ${staleFrame.requestId} / ${staleFrame.frameId} while the fresh B request is pending`);
  await page.evaluate(() => window.__roomComparisonCaptureTest.replayDeferredFrame(0));
  await panel.getByRole("article", { name: "Capture B" }).getByText("No capture").waitFor();
  assert.match(await panel.getByRole("status").textContent(), /Waiting for completed B frame/);

  await page.evaluate((index) => window.__roomComparisonCaptureTest.replayDeferredFrame(index), previousDeferredCount);
  await panel.getByRole("status").filter({ hasText: /^Saved B from / }).waitFor({ timeout: timeoutMs });
  const captureB = await savedCapture(panel, "B");
  assert.equal(captureB.provenance.requestId, currentRequestId);
  assert.equal(captureB.provenance.requestId, freshFrame.requestId);
  assert.equal(captureB.provenance.generationId, freshFrame.generationId);
  assert.equal(captureB.provenance.frameId, freshFrame.frameId);
  assert.notEqual(captureB.provenance.requestId, staleFrame.requestId);
  assert.notEqual(captureB.provenance.frameId, staleFrame.frameId);
  return captureB;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--enable-gpu", "--use-angle=metal"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1150 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    stage(`open ${url}`);
    await waitFor("experiment document", page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs }));
    stage("wait for scene readiness and verify High quality");
    await waitFor("GI 302/302 scene readiness", page.getByText(/Ready: GI 302\/302/).waitFor({ timeout: timeoutMs }));
    assert.equal(await page.getByLabel("Render quality").inputValue(), "high");
    await page.getByLabel("Composition").selectOption("wide");
    await page.getByLabel("Optical reference state").selectOption("near");
    stage("wait for the committed 1550 mm frame");
    await waitFor("current 1550 mm frame", waitForCurrentFrame(page, 1550));

    const panel = comparisonPanel(page);
    assert.equal(await page.evaluate(() => typeof window.__roomComparisonCaptureTest), "object");
    stage("capture A and verify frame provenance / native dimensions");
    await panel.getByRole("button", { name: "Capture A" }).click();
    await waitFor("A capture completion", page.getByRole("status").filter({ hasText: /^Saved A from / }).waitFor({ timeout: timeoutMs }));
    const captureA = await savedCapture(panel, "A");
    assert.equal(captureA.provenance.focusDistanceMm, 1550);
    assert.equal(captureA.provenance.focalLengthMm, 150);
    assert.equal(captureA.provenance.renderQuality, "high");
    assert.equal(captureA.provenance.previewMode, "upright");
    assert.deepEqual([captureA.provenance.width, captureA.provenance.height], [960, 720]);
    assert.deepEqual([captureA.dimensions.naturalWidth, captureA.dimensions.naturalHeight], [960, 720]);
    assert.equal(captureA.dimensions.complete, true);
    const runtimeA = await page.evaluate(() => window.__roomOptics);
    const backend = await page.evaluate(() => {
      const canvas = document.querySelector('[data-rtt-resource-channel="default"] canvas');
      const gl = canvas?.getContext('webgl2');
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      return gl ? { version: gl.getParameter(gl.VERSION), renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null } : null;
    });
    assert.equal(captureA.provenance.requestId, runtimeA.request.requestId);
    assert.equal(captureA.provenance.generationId, runtimeA.generation.generationId);
    assert.match(captureA.provenance.frameId, new RegExp(`^${captureA.provenance.generationId}:frame:`));
    await page.getByRole("status").filter({
      hasText: `Saved A from ${captureA.provenance.requestId} / ${captureA.provenance.frameId}`,
    }).waitFor();
    assert.equal(runtimeA.frame.request.requestId, captureA.provenance.requestId);
    assert.equal(runtimeA.frame.generation.generationId, captureA.provenance.generationId);

    const focus = page.getByRole("slider", { name: "Focus (mm)" });
    stage("change Focus by one reachable step and wait for the new frame");
    await focus.focus();
    await focus.press("ArrowRight");
    await waitFor("current 1560 mm frame", waitForCurrentFrame(page, 1560));
    stage("capture B and verify changed-setting disclosure");
    await panel.getByRole("button", { name: "Capture B" }).click();
    await waitFor("B capture completion", page.getByRole("status").filter({ hasText: /^Saved B from / }).waitFor({ timeout: timeoutMs }));
    const captureB = await savedCapture(panel, "B");
    assert.equal(captureB.provenance.focusDistanceMm, 1560);
    assert.equal(captureB.provenance.focalLengthMm, 150);
    assert.equal(captureB.provenance.width, captureA.provenance.width);
    assert.equal(captureB.provenance.height, captureA.provenance.height);
    assert.notEqual(captureB.provenance.frameId, captureA.provenance.frameId);
    assert.notEqual(captureB.provenance.requestId, captureA.provenance.requestId);
    assert.equal(captureB.provenance.generationId, captureA.provenance.generationId);
    const runtimeB = await page.evaluate(() => window.__roomOptics);
    assert.equal(captureB.provenance.requestId, runtimeB.request.requestId);
    assert.equal(captureB.provenance.generationId, runtimeB.generation.generationId);
    assert.match(captureB.provenance.frameId, new RegExp(`^${captureB.provenance.generationId}:frame:`));
    await page.getByRole("status").filter({
      hasText: `Saved B from ${captureB.provenance.requestId} / ${captureB.provenance.frameId}`,
    }).waitFor();
    assert.equal(runtimeB.frame.request.requestId, captureB.provenance.requestId);
    assert.equal(runtimeB.frame.generation.generationId, captureB.provenance.generationId);
    await expectChangedFocusDisclosure(panel);

    stage("clear B and confirm A is retained");
    await panel.getByRole("button", { name: "Clear B" }).click();
    await panel.getByRole("article", { name: "Capture B" }).getByText("No capture").waitFor();
    await panel.getByRole("article", { name: "Capture A" }).getByRole("img").waitFor({ state: "visible" });
    const acceptedASource = await captureA.image.getAttribute("src");

    stage("verify no-frame timeout cancels B and preserves accepted A");
    await page.evaluate(() => window.__roomComparisonCaptureTest.armTimeout());
    await panel.getByRole("button", { name: "Capture B" }).click();
    await panel.getByRole("status").filter({ hasText: /Waiting for completed B frame/ }).waitFor({ timeout: timeoutMs });
    await waitForDeferredFrameCount(page, 1);
    const timeoutEvidence = await page.evaluate(() => ({
      deferred: window.__roomComparisonCaptureTest.deferredFrameIdentities()[0],
      requestId: window.__roomOptics.request.requestId,
      publishedFrameRequestId: window.__roomOptics.frame?.request?.requestId,
    }));
    assert.equal(timeoutEvidence.deferred.status, "completed");
    assert.equal(timeoutEvidence.deferred.requestId, timeoutEvidence.requestId);
    assert.notEqual(timeoutEvidence.publishedFrameRequestId, timeoutEvidence.requestId);
    await page.evaluate(() => window.__roomComparisonCaptureTest.firePendingTimeout());
    await assertFailureCleanup(
      page,
      panel,
      /Capture timed out waiting for its completed Ground Glass frame/,
      acceptedASource,
      captureA.provenance,
    );
    const timeoutLateFrame = await page.evaluate(() => window.__roomComparisonCaptureTest.deferredFrameIdentities()[0]);
    await captureAfterLateFrame(page, panel, timeoutLateFrame, 1);
    await panel.getByRole("button", { name: "Clear B" }).click();
    await panel.getByRole("article", { name: "Capture B" }).getByText("No capture").waitFor();

    stage("verify renderer boundary failure cancels B and preserves accepted A");
    await page.evaluate(() => window.__roomComparisonCaptureTest.armRendererFailure());
    await panel.getByRole("button", { name: "Capture B" }).click();
    await panel.getByRole("status").filter({ hasText: /Waiting for completed B frame/ }).waitFor({ timeout: timeoutMs });
    await waitForDeferredFrameCount(page, 3);
    const rendererFailureEvidence = await page.evaluate(() => ({
      deferred: window.__roomComparisonCaptureTest.deferredFrameIdentities()[2],
      requestId: window.__roomOptics.request.requestId,
      publishedFrameRequestId: window.__roomOptics.frame?.request?.requestId,
    }));
    assert.equal(rendererFailureEvidence.deferred.status, "completed");
    assert.equal(rendererFailureEvidence.deferred.requestId, rendererFailureEvidence.requestId);
    assert.notEqual(rendererFailureEvidence.publishedFrameRequestId, rendererFailureEvidence.requestId);
    await page.getByRole("alert").filter({
      hasText: /Ground Glass renderer failed: Deterministic A\/B Ground Glass renderer failure/,
    }).waitFor({ timeout: timeoutMs });
    await assertFailureCleanup(
      page,
      panel,
      /Capture cancelled after Ground Glass renderer error: Deterministic A\/B Ground Glass renderer failure/,
      acceptedASource,
      captureA.provenance,
    );
    const rendererLateFrame = await page.evaluate(() => window.__roomComparisonCaptureTest.deferredFrameIdentities()[2]);

    await page.evaluate(() => window.__roomComparisonCaptureTest.releaseRendererFailureProbe());
    await page.getByRole("button", { name: "Unmount Ground Glass" }).click();
    await page.getByRole("button", { name: "Remount Ground Glass" }).click();
    const focusAfterRendererRemount = await page.evaluate(() => window.__roomOptics.camera.focusDistanceMm);
    await waitForCurrentFrame(page, focusAfterRendererRemount);
    await captureAfterLateFrame(page, panel, rendererLateFrame, 3);
    await assertAcceptedAUnchanged(panel, acceptedASource, captureA.provenance);
    await panel.getByRole("button", { name: "Clear B" }).click();
    await panel.getByRole("article", { name: "Capture B" }).getByText("No capture").waitFor();

    // The two DOM events share one browser task. This exercises cancellation before a render frame
    // can interleave; direct input assignment is used only for this race test, not reachability.
    stage("verify immediate cancellation when Focus changes during a pending capture");
    await page.evaluate(() => {
      const capture = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Capture B");
      const slider = [...document.querySelectorAll('input[type="range"]')].find((input) => input.getAttribute("aria-label") === "Focus (mm)");
      if (!capture || !slider) throw new Error("A/B or Focus control is missing");
      capture.click();
      const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setNativeValue.call(slider, String(Number(slider.value) + Number(slider.step)));
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await panel.getByRole("status").filter({ hasText: /Capture cancelled because the camera or presentation changed/ }).waitFor({ timeout: 15_000 });
    await panel.getByRole("article", { name: "Capture B" }).getByText("No capture").waitFor();

    // Cancel synchronously when the parent view is removed, before another frame can arrive.
    stage("verify cancellation when views unmount");
    await page.evaluate(() => {
      const capture = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Capture B");
      const unmount = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Unmount views");
      if (!capture || !unmount) throw new Error("Capture or view-unmount control is missing");
      capture.click();
      unmount.click();
    });
    await panel.getByRole("status").filter({ hasText: /Capture cancelled because the views were unmounted/ }).waitFor({ timeout: 15_000 });
    await panel.getByRole("article", { name: "Capture B" }).getByText("No capture").waitFor();
    assert.equal(await panel.getByRole("button", { name: "Capture B" }).isDisabled(), true);

    await page.getByRole("button", { name: "Remount views" }).click();
    const focusAfterViewRemount = await page.evaluate(() => window.__roomOptics.camera.focusDistanceMm);
    await waitForCurrentFrame(page, focusAfterViewRemount);
    stage("verify cancellation when Ground Glass unmounts");
    await page.evaluate(() => {
      const capture = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Capture B");
      const unmount = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Unmount Ground Glass");
      if (!capture || !unmount) throw new Error("Capture or Ground Glass unmount control is missing");
      capture.click();
      unmount.click();
    });
    await panel.getByRole("status").filter({ hasText: /Capture cancelled because Ground Glass was unmounted/ }).waitFor({ timeout: 15_000 });
    await panel.getByRole("article", { name: "Capture B" }).getByText("No capture").waitFor();
    assert.equal(await panel.getByRole("button", { name: "Capture B" }).isDisabled(), true);

    await panel.getByRole("button", { name: "Clear A" }).click();
    await panel.getByRole("article", { name: "Capture A" }).getByText("No capture").waitFor();
    assert.deepEqual(errors, [], `Browser errors: ${errors.join("; ")}`);
    stage("collect browser/backend and capture provenance report");
    const report = await page.evaluate(({ captures, backend }) => ({
      gpu: backend,
      gi: window.__giReport,
      captures,
      focus: window.__roomOptics?.camera?.focusDistanceMm,
      dimensions: [captures[0].width, captures[0].height],
    }), {backend, captures: [captureA, captureB].map(({ provenance }, index) => ({
      slot: index === 0 ? "A" : "B",
      requestId: provenance.requestId,
      generationId: provenance.generationId,
      frameId: provenance.frameId,
      width: provenance.width,
      height: provenance.height,
    }))});
    process.stdout.write(JSON.stringify({ status: "passed", url, report }, null, 2) + "\n");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});

async function expectChangedFocusDisclosure(panel) {
  await panel.getByText("1 recorded setting changed:").waitFor({ timeout: timeoutMs });
  await panel.getByText("Focus: A 1550 → B 1560").waitFor({ timeout: timeoutMs });
}
