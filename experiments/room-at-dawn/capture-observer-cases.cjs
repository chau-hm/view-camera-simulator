const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const out = path.resolve(process.argv[2] || "/private/tmp/room-observer-evidence");
const url =
  process.env.ROOM_OPTICS_URL ||
  "http://127.0.0.1:5199/view-camera-simulator/experiments/room-at-dawn/optics.html?rttDiagnostics=1";
const timeout = 240000;
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 950 } });
  // Software reflection capture can block an otherwise visible control for
  // longer than Playwright's default action timeout. Frame readiness is still
  // verified separately against request and generation identities.
  page.setDefaultTimeout(timeout);
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.addInitScript({ path: path.join(__dirname, "capture-sync.cjs") });
  await page.addInitScript({ path: path.join(__dirname, "observer-sync.cjs") });
  const observer = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Room observer" }) })
    .locator("canvas");
  const ground = page.locator('[data-rtt-resource-channel="default"] canvas');
  async function waitBoth(expected) {
    try {
      await page.waitForFunction(
        (expected) => {
          const s = window.__roomOptics,
            o = window.__roomObserver;
          if (s?.error || s?.renderError || o?.status === "failed") return true;
          if (!s || !Object.entries(expected).every(([k, v]) => s[k] === v)) return false;
          return (
            window.__roomInspectCapture(s, {}).status === "ready" &&
            window.__roomInspectObserver(s, o).status === "ready"
          );
        },
        expected,
        { timeout },
      );
    } catch (error) {
      const diagnostic = await page
        .evaluate(() => ({
          state: window.__roomOptics,
          observer: window.__roomObserver,
          errors: window.__roomRetirements,
        }))
        .catch(() => null);
      throw new Error(
        `Timed out waiting for matched view frames: ${JSON.stringify(diagnostic)}; ${error.message}`,
      );
    }
    const state = await page.evaluate(() => ({
      optics: window.__roomOptics,
      observer: window.__roomObserver,
      gi: window.__giReport,
    }));
    const a = await page.evaluate(() =>
      window.__roomInspectObserver(window.__roomOptics, window.__roomObserver),
    );
    const g = await page.evaluate(() => window.__roomInspectCapture(window.__roomOptics, {}));
    if (a.status !== "ready" || g.status !== "ready")
      throw new Error(`View failure: ${JSON.stringify({ a, g })}`);
    return { state, observerIdentity: a, groundIdentity: g };
  }
  async function imageStats(png) {
    return page.evaluate(async (encoded) => {
      const b = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      const im = await createImageBitmap(new Blob([b], { type: "image/png" }));
      const c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(im, 0, 0);
      im.close();
      const { width, height, data } = ctx.getImageData(0, 0, c.width, c.height);
      let sum = 0,
        dark = 0,
        white = 0;
      for (let i = 0; i < data.length; i += 4) {
        const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        sum += l;
        if (l <= 5) dark++;
        if (l >= 250) white++;
      }
      const n = width * height;
      return {
        space: "display-referred 8-bit luma",
        width,
        height,
        meanLuma8: sum / n,
        nearBlackFraction: dark / n,
        nearWhiteFraction: white / n,
      };
    }, png);
  }
  async function capture(name, expected) {
    const before = await waitBoth(expected);
    if ((await observer.count()) !== 1 || (await ground.count()) !== 1)
      throw new Error(`${name}: missing view canvas`);
    const observerPath = path.join(out, `${name}-observer.png`),
      groundPath = path.join(out, `${name}-ground.png`);
    await observer.screenshot({ path: observerPath, timeout });
    await ground.screenshot({ path: groundPath, timeout });
    const after = await waitBoth(expected);
    if (
      before.observerIdentity.requestId !== after.observerIdentity.requestId ||
      before.observerIdentity.generationId !== after.observerIdentity.generationId ||
      before.groundIdentity.requestId !== after.groundIdentity.requestId ||
      before.groundIdentity.generationId !== after.groundIdentity.generationId
    )
      throw new Error(`${name}: a view changed identity during capture`);
    const data = {
      expected,
      ...after,
      observerMetrics: await imageStats(fs.readFileSync(observerPath).toString("base64")),
      groundMetrics: await imageStats(fs.readFileSync(groundPath).toString("base64")),
      browser: browser.version(),
      errors,
    };
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(data, null, 2) + "\n");
    console.log(
      name,
      JSON.stringify({
        observer: after.observerIdentity,
        ground: after.groundIdentity,
        observerMetrics: data.observerMetrics,
        groundMetrics: data.groundMetrics,
      }),
    );
  }
  try {
    await page.goto(url);
    await page.waitForFunction(
      () => window.__roomOptics?.ready || window.__roomOptics?.error,
      null,
      { timeout },
    );
    if (process.env.ROOM_OBSERVER_LIFECYCLE_ONLY !== "1") {
      await capture("wide-on", {
        presetKey: "wide",
        hdr: true,
        reflectionsEnabled: true,
        displayExposure: 19,
      });
      const giBefore = await page.evaluate(() => ({
        frame: window.__roomObserver.frameId,
        groundGeneration: window.__roomOptics.generation.generationId,
      }));
      await page.evaluate(() => window.__roomObserverDebug.setGiScale(0));
      await page.waitForFunction(
        (old) => window.__roomObserver?.giScale === 0 && window.__roomObserver.frameId !== old,
        giBefore.frame,
        { timeout },
      );
      const zeroGi = await page.evaluate(() => window.__roomObserver);
      const zeroPath = path.join(out, "wide-observer-gi-zero.png");
      await observer.screenshot({ path: zeroPath, timeout });
      if (
        (await page.evaluate(() => window.__roomOptics.generation.generationId)) !==
        giBefore.groundGeneration
      )
        throw new Error("Ground Glass generation changed during Observer-only GI diagnostic");
      await page.evaluate(() => window.__roomObserverDebug.setGiScale(1));
      await page.waitForFunction(
        (old) => window.__roomObserver?.giScale === 1 && window.__roomObserver.frameId !== old,
        zeroGi.frameId,
        { timeout },
      );
      fs.writeFileSync(
        path.join(out, "wide-gi-diagnostic.json"),
        JSON.stringify(
          {
            initial: giBefore,
            zeroGi,
            zeroGiMetrics: await imageStats(fs.readFileSync(zeroPath).toString("base64")),
            restored: await page.evaluate(() => window.__roomObserver),
          },
          null,
          2,
        ) + "\n",
      );

      await page.getByLabel("Display exposure").fill("9");
      await capture("wide-exposure-9", {
        presetKey: "wide",
        hdr: true,
        reflectionsEnabled: true,
        displayExposure: 9,
      });
      await page.getByLabel("Display exposure").fill("19");
      await page.getByLabel("Color path").selectOption("byte");
      await capture("wide-byte", {
        presetKey: "wide",
        hdr: false,
        reflectionsEnabled: true,
        displayExposure: 19,
      });
      await page.getByLabel("Color path").selectOption("hdr");
      await capture("wide-hdr-return", {
        presetKey: "wide",
        hdr: true,
        reflectionsEnabled: true,
        displayExposure: 19,
      });
      await page.getByLabel("Composition").selectOption("desk");
      await capture("desk-on", {
        presetKey: "desk",
        hdr: true,
        reflectionsEnabled: true,
        displayExposure: 19,
      });
      await page.getByLabel("Reflections").uncheck();
      await capture("desk-off", {
        presetKey: "desk",
        hdr: true,
        reflectionsEnabled: false,
        displayExposure: 19,
      });
      await page.getByLabel("Reflections").check();
    }
    await page.getByLabel("Composition").selectOption("depth");
    await capture("depth-on", {
      presetKey: "depth",
      hdr: true,
      reflectionsEnabled: true,
      displayExposure: 19,
    });
    const obsBefore = await page.evaluate(() => window.__roomObserver);
    const ggBefore = await page.evaluate(() => window.__roomOptics.generation.generationId);
    const retirementsBefore = await page.evaluate(() => window.__roomObserverRetirements?.length || 0);
    await page.getByRole("button", { name: "Unmount Observer" }).click();
    await page.waitForFunction(
      ({ id, count }) => window.__roomObserverRetirements?.slice(count).some((x) => x.generationId === id),
      { id: obsBefore.generationId, count: retirementsBefore },
      { timeout },
    );
    const observerRetirement = await page.evaluate(
      ({ id, count }) => window.__roomObserverRetirements.slice(count).find((x) => x.generationId === id),
      { id: obsBefore.generationId, count: retirementsBefore },
    );
    if (!observerRetirement?.reflectionDisposed || !observerRetirement?.materialVariantsDisposed)
      throw new Error(`Observer cleanup failed: ${JSON.stringify(observerRetirement)}`);
    if ((await page.evaluate(() => window.__roomOptics.generation.generationId)) !== ggBefore)
      throw new Error("Ground Glass generation changed when Observer unmounted");
    await page.getByLabel("Focus (mm)").fill("2200");
    await page.waitForFunction(
      () =>
        window.__roomOptics?.camera.focusDistanceMm === 2200 &&
        window.__roomInspectCapture(window.__roomOptics, {}).status === "ready",
      null,
      { timeout },
    );
    await page.getByRole("button", { name: "Remount Observer" }).click();
    await capture("depth-observer-remount", {
      presetKey: "depth",
      hdr: true,
      reflectionsEnabled: true,
      displayExposure: 19,
    });
    const obsAfter = await page.evaluate(() => window.__roomObserver);
    if (obsAfter.generationId === obsBefore.generationId)
      throw new Error("Observer renderer generation did not change on remount");
    const observerBeforeGroundRemount = await page.evaluate(() => window.__roomObserver);
    const oldGroundGeneration = await page.evaluate(
      () => window.__roomOptics.generation.generationId,
    );
    await page.getByRole("button", { name: "Unmount Ground Glass" }).click();
    await page.waitForFunction(
      (id) => window.__roomRetirements?.some((x) => x.generation?.generationId === id),
      oldGroundGeneration,
      { timeout },
    );
    const groundRetirement = await page.evaluate(
      (id) => window.__roomRetirements.find((x) => x.generation?.generationId === id),
      oldGroundGeneration,
    );
    if (groundRetirement.outcome !== "confirmed")
      throw new Error(`Ground Glass cleanup was ${JSON.stringify(groundRetirement)}`);
    await page.getByLabel("Display exposure").fill("18.1");
    await page.waitForFunction(
      () =>
        window.__roomOptics?.displayExposure === 18.1 &&
        window.__roomInspectObserver(window.__roomOptics, window.__roomObserver).status === "ready",
      null,
      { timeout },
    );
    if (
      (await page.evaluate(() => window.__roomObserver.generationId)) !==
      observerBeforeGroundRemount.generationId
    )
      throw new Error("Observer renderer remounted when Ground Glass was unmounted");
    await page.getByRole("button", { name: "Remount Ground Glass" }).click();
    await capture("depth-ground-remount-18_1", {
      presetKey: "depth",
      hdr: true,
      reflectionsEnabled: true,
      displayExposure: 18.1,
    });
    fs.writeFileSync(
      path.join(out, "ground-retirement.json"),
      JSON.stringify(groundRetirement, null, 2) + "\n",
    );
    fs.writeFileSync(
      path.join(out, "lifecycle.json"),
      JSON.stringify(
        {
          observerRetirement,
          oldObserverGeneration: obsBefore.generationId,
          newObserverGeneration: obsAfter.generationId,
          groundGeneration: ggBefore,
          groundFocusAfter: 2200,
        },
        null,
        2,
      ) + "\n",
    );
    if (errors.length) throw new Error(`Browser errors: ${JSON.stringify(errors)}`);
    fs.writeFileSync(
      path.join(out, "manifest.json"),
      JSON.stringify(
        {
          url,
          browser: browser.version(),
          errors,
          notes:
            "display-referred comparisons; Observer and Ground Glass have different FOV/optics",
        },
        null,
        2,
      ) + "\n",
    );
  } catch (error) {
    console.error("Browser errors:", JSON.stringify(errors));
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
