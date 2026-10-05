import { expect, test, type Page } from "@playwright/test";
import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";

const GLB_NAME = "preferred-runtime-candidate.glb";

type RendererMetrics = {
  geometries: number;
  textures: number;
  calls: number;
  triangles: number;
  fringeMeshes: number;
  instanceAMeshes: number;
  instanceBMeshes: number;
  instanceARootId: string;
  instanceBRootId: string;
  sourceAssets: number;
  ownerLeases: number;
  instanceLeases: number;
  sourceGeometries: number;
  sourceMaterials: number;
  sourceTextures: number;
  imageBackings: number;
  instanceMaterials: number;
  maxAnisotropy: number;
  appliedAnisotropy: number;
  loadMs: number;
  webglVersion: string;
  threeVersion: string;
  rendererVendor: string;
  rendererDevice: string;
};

const readMetrics = async (page: Page): Promise<RendererMetrics> =>
  page.getByTestId("fringe-renderer-metrics").evaluate((element) => {
    const value = (key: string): number => Number(element.getAttribute(key) ?? NaN);
    return {
      geometries: value("data-geometries"),
      textures: value("data-textures"),
      calls: value("data-calls"),
      triangles: value("data-triangles"),
      fringeMeshes: value("data-fringe-meshes"),
      instanceAMeshes: value("data-instance-a-meshes"),
      instanceBMeshes: value("data-instance-b-meshes"),
      instanceARootId: element.getAttribute("data-instance-a-root-id") ?? "",
      instanceBRootId: element.getAttribute("data-instance-b-root-id") ?? "",
      sourceAssets: value("data-source-assets"),
      ownerLeases: value("data-owner-leases"),
      instanceLeases: value("data-instance-leases"),
      sourceGeometries: value("data-source-geometries"),
      sourceMaterials: value("data-source-materials"),
      sourceTextures: value("data-source-textures"),
      imageBackings: value("data-image-backings"),
      instanceMaterials: value("data-instance-materials"),
      maxAnisotropy: value("data-anisotropy-max"),
      appliedAnisotropy: value("data-applied-anisotropy"),
      loadMs: value("data-load-ms"),
      webglVersion: element.getAttribute("data-webgl-version") ?? "",
      threeVersion: element.getAttribute("data-three-version") ?? "",
      rendererVendor: element.getAttribute("data-renderer-vendor") ?? "",
      rendererDevice: element.getAttribute("data-renderer-device") ?? "",
    };
  });

const installBrowserErrorCapture = (page: Page) => {
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (isKnownFiberClockDeprecation(message)) return;
    if (/GL Driver Message .*GPU stall due to ReadPixels/.test(message.text())) return;
    if (message.type() === "error" || message.type() === "warning") {
      consoleProblems.push(message.text());
    }
  });
  return { pageErrors, consoleProblems };
};

test("development Fringe fixture renders, isolates leases, and recovers app resources through SPA navigation", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = installBrowserErrorCapture(page);
  const glbRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(GLB_NAME)) glbRequests.push(request.url());
  });
  await page.addInitScript(() => {
    (window as Window & { __fringeStage2iDocument?: string }).__fringeStage2iDocument =
      `${Date.now()}-${Math.random()}`;
  });

  await page.goto("/simulator/free/architecture-rise");
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
    "data-scene-subject-id",
    "architecture-rise",
  );
  await expect(page.getByTestId("ground-glass-rtt")).toHaveCount(1);
  expect(glbRequests).toEqual([]);

  await page.goto("/__dev/fringe-club");
  await expect(page.getByText("NOT A PUBLIC SCENE.")).toBeVisible();
  const documentToken = await page.evaluate(
    () => (window as Window & { __fringeStage2iDocument?: string }).__fringeStage2iDocument,
  );
  const metrics = page.getByTestId("fringe-renderer-metrics");
  await expect(metrics).toHaveAttribute("data-baseline-geometries", /^\d+$/);
  await expect(metrics).toHaveAttribute("data-baseline-textures", /^\d+$/);
  const baseline = await metrics.evaluate((element) => ({
    geometries: Number(element.getAttribute("data-baseline-geometries")),
    textures: Number(element.getAttribute("data-baseline-textures")),
  }));
  const baselineRenderer = await readMetrics(page);
  const measurements: Record<string, unknown> = {
    environment: await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    })),
    browserVersion: page.context().browser()?.version() ?? "unknown",
    baseline,
    baselineRenderer,
  };

  await page.getByRole("button", { name: "Load source asset" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 60_000 },
  );
  await expect(metrics).toHaveAttribute("data-instance-leases", "1");
  await expect(metrics).toHaveAttribute("data-instance-a-meshes", /^[1-9]\d*$/);
  await expect(metrics).toHaveAttribute("data-fringe-meshes", /^[1-9]\d*$/);
  await expect(metrics).toHaveAttribute("data-triangles", /^[1-9]\d*$/);
  const one = await readMetrics(page);
  measurements.oneInstance = one;
  expect(one.sourceAssets).toBe(1);
  expect(one.ownerLeases).toBe(1);
  expect(one.sourceGeometries).toBeGreaterThan(0);
  expect(one.sourceMaterials).toBeGreaterThan(0);
  expect(one.instanceMaterials).toBe(one.sourceMaterials);
  expect(one.sourceTextures).toBe(7);
  expect(one.imageBackings).toBe(7);
  expect(one.geometries).toBeGreaterThan(baseline.geometries);
  expect(one.textures).toBeGreaterThan(baseline.textures);

  await page.getByRole("checkbox", { name: "Mount instance B" }).check();
  await expect(metrics).toHaveAttribute("data-instance-leases", "2");
  await expect(metrics).toHaveAttribute("data-instance-b-meshes", /^[1-9]\d*$/);
  await expect
    .poll(async () => (await readMetrics(page)).triangles)
    .toBeGreaterThan(one.triangles);
  const two = await readMetrics(page);
  measurements.twoInstances = two;
  expect(two.instanceARootId).not.toBe("");
  expect(two.instanceBRootId).not.toBe("");
  expect(two.instanceARootId).not.toBe(two.instanceBRootId);
  expect(two.sourceGeometries).toBe(one.sourceGeometries);
  expect(two.sourceTextures).toBe(one.sourceTextures);
  expect(two.instanceMaterials).toBe(one.instanceMaterials * 2);
  expect(two.geometries).toBe(one.geometries);
  expect(two.textures).toBe(one.textures);

  await page.getByRole("checkbox", { name: "Mount instance A" }).uncheck();
  await expect(metrics).toHaveAttribute("data-instance-leases", "1");
  await expect(metrics).toHaveAttribute("data-instance-a-meshes", "0");
  await expect(metrics).toHaveAttribute("data-instance-b-meshes", /^[1-9]\d*$/);
  const onlyB = await readMetrics(page);
  measurements.onlyInstanceB = onlyB;
  expect(onlyB.geometries).toBe(one.geometries);
  expect(onlyB.textures).toBe(one.textures);
  expect(onlyB.instanceMaterials).toBe(one.instanceMaterials);
  expect(onlyB.instanceARootId).toBe("");
  expect(onlyB.instanceBRootId).toBe(two.instanceBRootId);

  await page.getByRole("button", { name: "Release source asset" }).click();
  await expect(metrics).toHaveAttribute("data-source-assets", "0");
  await expect(metrics).toHaveAttribute("data-owner-leases", "0");
  await expect(metrics).toHaveAttribute("data-instance-leases", "0");
  await expect(metrics).toHaveAttribute("data-source-geometries", "0");
  await expect(metrics).toHaveAttribute("data-source-materials", "0");
  await expect(metrics).toHaveAttribute("data-source-textures", "0");
  await expect(metrics).toHaveAttribute("data-image-backings", "0");
  await expect(metrics).toHaveAttribute("data-instance-materials", "0");
  await expect
    .poll(async () => (await readMetrics(page)).geometries)
    .toBe(baseline.geometries);
  await expect
    .poll(async () => {
      const { calls, triangles } = await readMetrics(page);
      return { calls, triangles };
    })
    .toEqual({ calls: baselineRenderer.calls, triangles: baselineRenderer.triangles });
  const afterFirstRelease = await readMetrics(page);
  measurements.afterFirstRelease = afterFirstRelease;
  expect(afterFirstRelease.textures).toBeGreaterThanOrEqual(baseline.textures);
  const finalReleases = Number(await metrics.getAttribute("data-final-source-releases"));
  expect(finalReleases).toBe(1);
  const firstLoadMs = Number(await metrics.getAttribute("data-load-ms"));

  await page.getByRole("button", { name: "Load source asset" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 60_000 },
  );
  const repeatedLoadMs = Number(await metrics.getAttribute("data-load-ms"));
  expect(Number.isFinite(firstLoadMs)).toBe(true);
  expect(Number.isFinite(repeatedLoadMs)).toBe(true);
  await page.getByRole("button", { name: "Release source asset" }).click();
  await expect(metrics).toHaveAttribute("data-source-assets", "0");
  await expect(metrics).toHaveAttribute("data-instance-leases", "0");
  await expect
    .poll(async () => (await readMetrics(page)).geometries)
    .toBe(baseline.geometries);
  await expect
    .poll(async () => {
      const { calls, triangles } = await readMetrics(page);
      return { calls, triangles };
    })
    .toEqual({ calls: baselineRenderer.calls, triangles: baselineRenderer.triangles });
  const afterRepeatedRelease = await readMetrics(page);
  measurements.afterRepeatedRelease = afterRepeatedRelease;
  expect(afterRepeatedRelease.textures).toBe(afterFirstRelease.textures);
  expect(afterRepeatedRelease.geometries).toBe(afterFirstRelease.geometries);
  measurements.loadTimesMs = { first: firstLoadMs, repeated: repeatedLoadMs };

  await page.getByRole("link", { name: "Exit development fixture" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __fringeStage2iDocument?: string }).__fringeStage2iDocument))
    .toBe(documentToken);
  expect(glbRequests.length).toBeGreaterThanOrEqual(2);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleProblems).toEqual([]);

  await test.info().attach("fringe-club-stage-2i-browser-measurements.json", {
    body: Buffer.from(JSON.stringify(measurements, null, 2)),
    contentType: "application/json",
  });

  await page.goBack();
  await expect(page).toHaveURL(/\/__dev\/fringe-club$/);
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
    "data-state",
    "idle",
  );
  await page.getByRole("button", { name: "Load source asset" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: "Release source asset" }).click();
  await expect(page.getByTestId("fringe-renderer-metrics")).toHaveAttribute(
    "data-source-assets",
    "0",
  );
  await page.getByRole("link", { name: "Exit development fixture" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleProblems).toEqual([]);
});

test("navigation away aborts a delayed development load without a stale mount", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = installBrowserErrorCapture(page);
  let intercepted = 0;
  const routeWaiters: Array<() => void> = [];
  const releaseWaiters: Array<() => void> = [];
  await page.route(`**/${GLB_NAME}`, async (route) => {
    intercepted += 1;
    routeWaiters.shift()?.();
    await new Promise<void>((resolve) => releaseWaiters.push(resolve));
    try {
      await route.continue();
    } catch {
      // Navigation may already have aborted the request, which is the case under test.
    }
  });

  await page.goto("/__dev/fringe-club");
  await expect(page.getByTestId("fringe-renderer-metrics")).toHaveAttribute(
    "data-baseline-geometries",
    /^\d+$/,
  );
  const requestStarted = new Promise<void>((resolve) => routeWaiters.push(resolve));
  await page.getByRole("button", { name: "Load source asset" }).click();
  await requestStarted;
  await page.getByRole("link", { name: "Exit development fixture" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  releaseWaiters.splice(0).forEach((release) => release());
  await expect.poll(() => intercepted).toBeGreaterThan(0);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleProblems).toEqual([]);
  await expect(page.getByTestId("fringe-app-canvas")).toHaveCount(0);
});

test("Ground Glass RTT renders an independent instance from the Observer's SourceAsset lease", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = installBrowserErrorCapture(page);
  const glbRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(GLB_NAME)) glbRequests.push(request.url());
  });

  await page.goto("/simulator/free/architecture-rise");
  await expect(page.getByTestId("ground-glass-rtt")).toHaveCount(1);
  expect(glbRequests).toEqual([]);

  await page.goto("/__dev/fringe-club-rtt?sceneCapacityProfiling=1&rttDiagnostics=1");
  await expect(page.getByText("NOT A PUBLIC SCENE.")).toBeVisible();
  await expect(page.getByTestId("fringe-renderer-metrics")).toHaveAttribute(
    "data-baseline-geometries",
    /^\d+$/,
  );

  const observerMetrics = page.getByTestId("fringe-renderer-metrics");
  const rttMetrics = page.getByTestId("fringe-rtt-metrics");
  await page.getByRole("button", { name: "Load source asset" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 60_000 },
  );

  await expect(observerMetrics).toHaveAttribute("data-source-assets", "1");
  await expect(observerMetrics).toHaveAttribute("data-instance-leases", "2");
  await expect(rttMetrics).toHaveAttribute("data-subject-source-id", /^[^\s]+$/);
  const sourceId = await rttMetrics.getAttribute("data-source-id");
  expect(sourceId).toMatch(/^fringe-club-source-/);
  await expect(rttMetrics).toHaveAttribute("data-subject-source-id", sourceId!);
  await expect(rttMetrics).toHaveAttribute("data-subject-instance-id", "ground-glass-rtt");
  await expect(rttMetrics).toHaveAttribute("data-rtt-camera-ok", "true");
  await expect(rttMetrics).toHaveAttribute("data-rtt-raw-contentful", "true");
  await expect(rttMetrics).toHaveAttribute("data-rtt-final-contentful", "true");
  await expect(rttMetrics).toHaveAttribute("data-rtt-subject-meshes", /^[1-9]\d*$/);
  await expect(rttMetrics).toHaveAttribute("data-rtt-renderer-geometries", /^\d+$/);
  await expect(rttMetrics).toHaveAttribute("data-rtt-renderer-textures", /^\d+$/);
  const initialRttRoot = await rttMetrics.getAttribute("data-subject-root-id");
  const initialRttCapacity = await rttMetrics.evaluate((element) => ({
    meshes: Number(element.getAttribute("data-rtt-subject-meshes")),
    triangles: Number(element.getAttribute("data-rtt-subject-triangles")),
    geometries: Number(element.getAttribute("data-rtt-renderer-geometries")),
    textures: Number(element.getAttribute("data-rtt-renderer-textures")),
  }));
  expect(initialRttRoot).not.toBe("");
  expect(initialRttCapacity.meshes).toBeGreaterThan(0);
  expect(initialRttCapacity.triangles).toBeGreaterThan(0);

  await page.getByRole("checkbox", { name: "Mount instance A" }).uncheck();
  await expect(observerMetrics).toHaveAttribute("data-instance-leases", "1");
  await expect(rttMetrics).toHaveAttribute("data-subject-root-id", initialRttRoot!);
  await expect(rttMetrics).toHaveAttribute("data-subject-source-id", sourceId!);
  await expect(rttMetrics).toHaveAttribute("data-rtt-final-contentful", "true");

  await page.getByRole("checkbox", { name: "Mount Ground Glass RTT instance" }).uncheck();
  await expect(observerMetrics).toHaveAttribute("data-instance-leases", "0");
  await expect(rttMetrics).toHaveAttribute("data-subject-root-id", "");
  await expect(rttMetrics).toHaveAttribute("data-subject-source-id", "");
  await expect(rttMetrics).toHaveAttribute("data-active-sources", "1");
  await expect(observerMetrics).toHaveAttribute("data-owner-leases", "1");

  await page.getByRole("checkbox", { name: "Mount Ground Glass RTT instance" }).check();
  await expect(observerMetrics).toHaveAttribute("data-instance-leases", "1");
  await expect(rttMetrics).toHaveAttribute("data-subject-source-id", sourceId!);
  await expect(rttMetrics).toHaveAttribute("data-rtt-final-contentful", "true");
  const remountedRoot = await rttMetrics.getAttribute("data-subject-root-id");
  expect(remountedRoot).not.toBe("");
  expect(remountedRoot).not.toBe(initialRttRoot);

  await page.getByRole("button", { name: "Release source asset" }).click();
  await expect(observerMetrics).toHaveAttribute("data-source-assets", "0");
  await expect(observerMetrics).toHaveAttribute("data-owner-leases", "0");
  await expect(observerMetrics).toHaveAttribute("data-instance-leases", "0");
  await expect(observerMetrics).toHaveAttribute("data-source-geometries", "0");
  await expect(observerMetrics).toHaveAttribute("data-source-materials", "0");
  await expect(observerMetrics).toHaveAttribute("data-source-textures", "0");
  await expect(observerMetrics).toHaveAttribute("data-image-backings", "0");
  await expect(observerMetrics).toHaveAttribute("data-instance-materials", "0");
  await expect(rttMetrics).toHaveAttribute("data-source-id", "");
  await expect(rttMetrics).toHaveAttribute("data-subject-root-id", "");

  // React's development effect replay may request once for the cancelled first
  // generation and once for the active generation; loading stays activation-gated.
  expect(glbRequests.length).toBeGreaterThan(0);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleProblems).toEqual([]);
  await test.info().attach("fringe-club-stage-2j-rtt-browser-measurements.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          browserVersion: page.context().browser()?.version() ?? "unknown",
          userAgent: await page.evaluate(() => navigator.userAgent),
          devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
          viewport: await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
          })),
          sourceId,
          initialRttRoot,
          remountedRoot,
          initialRttCapacity,
          observerRenderer: await readMetrics(page),
          glbRequests,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
});
