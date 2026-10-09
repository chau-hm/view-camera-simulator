import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";

const H_GLB_NAME = "preferred-runtime-candidate.glb";
const N_GLB_NAME = "stage-2n-a-candidate.glb";
const PROBE_IDS = [
  "wyndham-rect-pair",
  "wyndham-segmental",
  "wyndham-transom",
  "wyndham-vent-louver",
  "wyndham-frieze",
  "lower-albert-timber",
  "lower-albert-louver-light",
  "lower-albert-louver-dark",
  "entrance-timber-pair",
  "entrance-paired-entry",
  "join-wy-window-frame",
] as const;

const JOIN_MOTION_PROBES = [
  { probeId: "join-wy-window-frame", label: "Wyndham window/frame" },
  { probeId: "join-la-louver-frame", label: "Lower Albert louver/frame" },
  { probeId: "join-entrance-frame-glass", label: "Entrance frame/glass" },
  { probeId: "join-wy-sill-frame", label: "Wyndham sill/frame" },
] as const;

const MOTION_IDS = ["center", "left", "right", "near", "far"] as const;

type ObserverMetrics = {
  geometries: number;
  textures: number;
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  fringeMeshes: number;
  candidateId: string;
  rootId: string;
  sampledAtMs: number;
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
  fetchMs: number;
  parseMs: number;
  webglVersion: string;
  threeVersion: string;
  rendererVendor: string;
  rendererDevice: string;
};

type GroundGlassMetrics = {
  candidateIdentity: string;
  sourceId: string;
  candidateId: string;
  probeId: string;
  motionId: string;
  rootId: string;
  cameraOk: boolean;
  rawContentful: boolean;
  finalContentful: boolean;
  generation: number;
  sanityKey: string;
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  sampledAtMs: number;
};

const readObserverMetrics = async (page: Page): Promise<ObserverMetrics> =>
  page.getByTestId("fringe-renderer-metrics").evaluate((element) => {
    const value = (key: string): number => Number(element.getAttribute(key) ?? NaN);
    return {
      geometries: value("data-geometries"),
      textures: value("data-textures"),
      calls: value("data-calls"),
      triangles: value("data-triangles"),
      points: value("data-points"),
      lines: value("data-lines"),
      fringeMeshes: value("data-fringe-meshes"),
      candidateId: element.getAttribute("data-observer-candidate-id") ?? "",
      rootId: element.getAttribute("data-observer-root-id") ?? "",
      sampledAtMs: value("data-observer-sampled-at-ms"),
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
      fetchMs: value("data-fetch-ms"),
      parseMs: value("data-parse-ms"),
      webglVersion: element.getAttribute("data-webgl-version") ?? "",
      threeVersion: element.getAttribute("data-three-version") ?? "",
      rendererVendor: element.getAttribute("data-renderer-vendor") ?? "",
      rendererDevice: element.getAttribute("data-renderer-device") ?? "",
    };
  });

const readGroundGlassMetrics = async (page: Page): Promise<GroundGlassMetrics> =>
  page.getByTestId("fringe-rtt-metrics").evaluate((element) => {
    const value = (key: string): number => Number(element.getAttribute(key) ?? NaN);
    return {
      candidateIdentity: element.getAttribute("data-rtt-render-sanity-identity") ?? "",
      sourceId: element.getAttribute("data-subject-source-id") ?? "",
      candidateId: element.getAttribute("data-subject-candidate-id") ?? "",
      probeId: element.getAttribute("data-subject-probe-id") ?? "",
      motionId: element.getAttribute("data-subject-motion-id") ?? "",
      rootId: element.getAttribute("data-subject-root-id") ?? "",
      cameraOk: element.getAttribute("data-rtt-camera-ok") === "true",
      rawContentful: element.getAttribute("data-rtt-raw-contentful") === "true",
      finalContentful: element.getAttribute("data-rtt-final-contentful") === "true",
      generation: value("data-rtt-render-sanity-generation"),
      sanityKey: element.getAttribute("data-rtt-render-sanity-state") ?? "",
      calls: value("data-rtt-calls"),
      triangles: value("data-rtt-triangles"),
      points: value("data-rtt-points"),
      lines: value("data-rtt-lines"),
      geometries: value("data-rtt-renderer-geometries"),
      textures: value("data-rtt-renderer-textures"),
      sampledAtMs: value("data-rtt-sampled-at-ms"),
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

const waitForGroundGlass = async (
  page: Page,
  candidate: "stage2h" | "stage2n-a",
  probeId: string,
  motionId: string = "center",
) => {
  const identity =
    candidate +
    "|probe:" +
    probeId +
    (motionId === "center" ? "" : "|motion:" + motionId);
  await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
    "data-rtt-render-sanity-identity",
    identity,
    { timeout: 60_000 },
  );
  await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
    "data-rtt-camera-ok",
    "true",
    { timeout: 60_000 },
  );
  await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
    "data-rtt-raw-contentful",
    "true",
    { timeout: 60_000 },
  );
  await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
    "data-rtt-final-contentful",
    "true",
    { timeout: 60_000 },
  );
  await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
    "data-rtt-calls",
    /^\d+$/,
    { timeout: 60_000 },
  );
  await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
    "data-rtt-triangles",
    /^[1-9]\d*$/,
    { timeout: 60_000 },
  );
};

const composeSideBySidePanel = async (
  page: Page,
  title: string,
  observerH: Buffer,
  groundGlassH: Buffer,
  observerN: Buffer,
  groundGlassN: Buffer,
): Promise<Buffer> => {
  const panelPage = await page.context().newPage();
  const image = (label: string, value: Buffer) =>
    "<figure><figcaption>" + label + "</figcaption><img src=\"data:image/png;base64," + value.toString("base64") + "\"></figure>";
  await panelPage.setContent(
    "<!doctype html><html><head><meta charset=\"utf-8\"><style>"
      + "body{font:14px system-ui;margin:12px;color:#111}h1{font-size:18px;margin:0 0 12px}"
      + ".grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0;border:1px solid #aaa;padding:6px}"
      + "figcaption{font-weight:600;margin-bottom:5px}img{display:block;width:100%;height:auto}"
      + "</style></head><body><h1>" + title + "</h1><div class=\"grid\">"
      + image("Stage 2H — Observer", observerH)
      + image("Stage 2H — Ground Glass RTT", groundGlassH)
      + image("Stage 2N-A — Observer", observerN)
      + image("Stage 2N-A — Ground Glass RTT", groundGlassN)
      + "</div></body></html>",
  );
  const output = await panelPage.screenshot({ fullPage: true });
  await panelPage.close();
  return output;
};

const composeMotionPanel = async (
  page: Page,
  title: string,
  captures: Array<{ motionId: string; observer: Buffer; groundGlass: Buffer }>,
): Promise<Buffer> => {
  const panelPage = await page.context().newPage();
  const imageData = await panelPage.evaluate(async ({ panelTitle, panelCaptures }) => {
    const decodeImage = (dataUrl: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not decode a captured motion frame"));
      image.src = dataUrl;
    });
    const images = await Promise.all(panelCaptures.map(async (capture) => ({
      motionId: capture.motionId,
      observer: await decodeImage(capture.observer),
      groundGlass: await decodeImage(capture.groundGlass),
    })));
    const cellWidth = 580;
    const imageHeight = Math.round(cellWidth * images[0].observer.height / images[0].observer.width);
    const rowHeight = imageHeight + 38;
    const canvas = document.createElement("canvas");
    canvas.width = cellWidth * 2 + 40;
    canvas.height = 56 + rowHeight * images.length;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create the motion contact sheet");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111";
    context.font = "bold 18px system-ui";
    context.fillText(panelTitle, 12, 28);
    const labels: Record<string, string> = {
      center: "Center",
      left: "Slight left (40 mm)",
      right: "Slight right (40 mm)",
      near: "Slight near (40 mm)",
      far: "Slight far (40 mm)",
    };
    images.forEach((capture, index) => {
      const y = 46 + index * rowHeight;
      context.font = "600 13px system-ui";
      context.fillStyle = "#111";
      context.fillText(labels[capture.motionId] + " — Stage 2N-A Observer", 12, y + 13);
      context.fillText(labels[capture.motionId] + " — Ground Glass RTT", cellWidth + 28, y + 13);
      context.drawImage(capture.observer, 12, y + 18, cellWidth, imageHeight);
      context.drawImage(capture.groundGlass, cellWidth + 28, y + 18, cellWidth, imageHeight);
    });
    return canvas.toDataURL("image/png");
  }, {
    panelTitle: title,
    panelCaptures: captures.map(({ motionId, observer, groundGlass }) => ({
      motionId,
      observer: "data:image/png;base64," + observer.toString("base64"),
      groundGlass: "data:image/png;base64," + groundGlass.toString("base64"),
    })),
  });
  const output = Buffer.from(imageData.slice(imageData.indexOf(",") + 1), "base64");
  await panelPage.close();
  return output;
};

test("development Fringe fixture keeps Stage 2H default, activation-gated, and releases its source through SPA navigation", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = installBrowserErrorCapture(page);
  const candidateRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(H_GLB_NAME) || request.url().includes(N_GLB_NAME)) {
      candidateRequests.push(request.url());
    }
  });
  await page.addInitScript(() => {
    (window as Window & { __fringeStage2nDocument?: string }).__fringeStage2nDocument =
      String(Date.now()) + "-" + String(Math.random());
  });

  await page.goto("/simulator/free/architecture-rise");
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
    "data-scene-subject-id",
    "architecture-rise",
  );
  await expect(page.getByTestId("ground-glass-rtt")).toHaveCount(1);
  expect(candidateRequests).toEqual([]);

  await page.goto("/__dev/fringe-club");
  await expect(page.getByText("NOT A PUBLIC SCENE.")).toBeVisible();
  await expect(page.getByTestId("fringe-candidate-select")).toHaveValue("stage2h");
  await expect(page.getByTestId("fringe-asset-url")).toContainText(
    "stage-2h/preferred-runtime-candidate.glb",
  );
  const documentToken = await page.evaluate(
    () => (window as Window & { __fringeStage2nDocument?: string }).__fringeStage2nDocument,
  );
  const metrics = page.getByTestId("fringe-renderer-metrics");
  await expect(metrics).toHaveAttribute("data-baseline-geometries", /^\d+$/);
  await expect(metrics).toHaveAttribute("data-baseline-textures", /^\d+$/);
  const baseline = await metrics.evaluate((element) => ({
    geometries: Number(element.getAttribute("data-baseline-geometries")),
    textures: Number(element.getAttribute("data-baseline-textures")),
  }));

  await page.getByRole("button", { name: "Load selected candidate" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 60_000 },
  );
  await expect(metrics).toHaveAttribute("data-instance-leases", "1");
  await expect(metrics).toHaveAttribute("data-observer-candidate-id", "stage2h");
  await expect(metrics).toHaveAttribute("data-fringe-meshes", /^[1-9]\d*$/);
  await expect(metrics).toHaveAttribute("data-triangles", /^[1-9]\d*$/);
  const loaded = await readObserverMetrics(page);
  expect(loaded.sourceAssets).toBe(1);
  expect(loaded.ownerLeases).toBe(1);
  expect(loaded.instanceLeases).toBe(1);
  expect(loaded.sourceGeometries).toBeGreaterThan(0);
  expect(loaded.sourceMaterials).toBeGreaterThan(0);
  expect(loaded.instanceMaterials).toBe(loaded.sourceMaterials);
  expect(loaded.geometries).toBeGreaterThan(baseline.geometries);
  expect(loaded.textures).toBeGreaterThan(baseline.textures);
  expect(Number.isFinite(loaded.fetchMs)).toBe(true);
  expect(Number.isFinite(loaded.parseMs)).toBe(true);

  await page.getByRole("button", { name: "Release source asset" }).click();
  await expect(metrics).toHaveAttribute("data-source-assets", "0");
  await expect(metrics).toHaveAttribute("data-owner-leases", "0");
  await expect(metrics).toHaveAttribute("data-instance-leases", "0");
  await expect(metrics).toHaveAttribute("data-source-geometries", "0");
  await expect(metrics).toHaveAttribute("data-source-materials", "0");
  await expect(metrics).toHaveAttribute("data-source-textures", "0");
  await expect(metrics).toHaveAttribute("data-image-backings", "0");
  await expect.poll(async () => (await readObserverMetrics(page)).geometries).toBe(baseline.geometries);
  const firstRelease = await readObserverMetrics(page);
  expect(firstRelease.instanceMaterials).toBe(0);

  await page.getByRole("button", { name: "Load selected candidate" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: "Release source asset" }).click();
  await expect(metrics).toHaveAttribute("data-source-assets", "0");
  await expect(metrics).toHaveAttribute("data-instance-leases", "0");
  await expect.poll(async () => (await readObserverMetrics(page)).geometries).toBe(baseline.geometries);

  await page.getByRole("link", { name: "Exit development fixture" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __fringeStage2nDocument?: string }).__fringeStage2nDocument))
    .toBe(documentToken);
  expect(candidateRequests.some((url) => url.includes(H_GLB_NAME))).toBe(true);
  expect(candidateRequests.some((url) => url.includes(N_GLB_NAME))).toBe(false);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleProblems).toEqual([]);
});

test("Stage 2H and Stage 2N-A render through all VCS modes and candidate/probe diagnostics remain current", async ({ page }) => {
  test.setTimeout(1_200_000);
  const errors = installBrowserErrorCapture(page);
  const candidateRequests: string[] = [];
  const evidenceDirectory = process.env.VCS_FRINGE_STAGE2NB_EVIDENCE_DIR;
  if (evidenceDirectory) mkdirSync(evidenceDirectory, { recursive: true });
  page.on("request", (request) => {
    if (request.url().includes(H_GLB_NAME) || request.url().includes(N_GLB_NAME)) {
      candidateRequests.push(request.url());
    }
  });

  await page.goto("/__dev/fringe-club-rtt?sceneCapacityProfiling=1&rttDiagnostics=1");
  const candidateSelect = page.getByTestId("fringe-candidate-select");
  const modeSelect = page.getByTestId("fringe-renderer-mode-select");
  const probeSelect = page.getByTestId("fringe-probe-select");
  const rendererMetrics = page.getByTestId("fringe-renderer-metrics");
  const rttMetrics = page.getByTestId("fringe-rtt-metrics");
  await expect(candidateSelect).toHaveValue("stage2h");
  await expect(modeSelect).toHaveValue("both");
  await expect(rendererMetrics).toHaveAttribute("data-baseline-geometries", /^\d+$/);
  const initialHLoadStartedAt = Date.now();
  await page.getByRole("button", { name: "Load selected candidate" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 90_000 },
  );
  await waitForGroundGlass(page, "stage2h", PROBE_IDS[0]);
  const firstHObserverAndRttContentMs = Date.now() - initialHLoadStartedAt;
  await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "stage2h");
  await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "2");
  const hSourceId = await rttMetrics.getAttribute("data-source-id");
  const hObserverRootId = await rendererMetrics.getAttribute("data-observer-root-id");
  const hRttRootId = await rttMetrics.getAttribute("data-subject-root-id");
  expect(hSourceId).toMatch(/^fringe-club-source-/);
  expect(hObserverRootId).not.toBe(hRttRootId);
  await expect(rttMetrics).toHaveAttribute("data-subject-source-id", hSourceId!);
  await expect(rttMetrics).toHaveAttribute("data-rtt-renderer-geometries", /^\d+$/);
  await expect(rttMetrics).toHaveAttribute("data-rtt-renderer-textures", /^\d+$/);

  const measurements: Record<string, unknown> = {
    environment: await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    })),
    browserVersion: page.context().browser()?.version() ?? "unknown",
    fixedProbeOptics: await page.locator("body").innerText().then((text) =>
      text.split("Fixed Ground Glass reference:")[1]?.split("\n")[0] ?? "not found",
    ),
    sixModes: {},
    firstAttach: { stage2hObserverAndRttContentMs: firstHObserverAndRttContentMs },
    candidateSwitches: [] as unknown[],
    probeIdentity: [] as unknown[],
    textureCountIsNotMemory: true,
  };
  const modeEvidence = async (candidate: "stage2h" | "stage2n-a", mode: string) => {
    if (mode !== "ground-glass") {
      const priorObserverSample = await rendererMetrics.getAttribute("data-observer-sampled-at-ms");
      await expect
        .poll(() => rendererMetrics.getAttribute("data-observer-sampled-at-ms"), { timeout: 15_000 })
        .not.toBe(priorObserverSample);
    }
    if (mode !== "observer") {
      const priorRttSample = await rttMetrics.getAttribute("data-rtt-sampled-at-ms");
      await expect
        .poll(() => rttMetrics.getAttribute("data-rtt-sampled-at-ms"), { timeout: 15_000 })
        .not.toBe(priorRttSample);
    }
    const observer = await readObserverMetrics(page);
    const groundGlass = await readGroundGlassMetrics(page);
    return {
      candidate,
      mode,
      warmSteadyStateSample: true,
      sampledAtMs: { observer: observer.sampledAtMs, groundGlass: groundGlass.sampledAtMs },
      observer,
      groundGlass,
    };
  };
  const setMode = async (mode: "observer" | "ground-glass" | "both") => {
    await modeSelect.selectOption(mode);
    if (mode === "observer") {
      await expect(rttMetrics).toHaveAttribute("data-rtt-render-sanity-identity", "");
      await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "1");
    } else if (mode === "ground-glass") {
      await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "");
      await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "1");
      await waitForGroundGlass(page, await candidateSelect.inputValue() as "stage2h" | "stage2n-a", await probeSelect.inputValue());
    } else {
      await waitForGroundGlass(page, await candidateSelect.inputValue() as "stage2h" | "stage2n-a", await probeSelect.inputValue());
      await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", await candidateSelect.inputValue());
      await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "2");
    }
  };
  const captureCandidateProbeSet = async (
    candidate: "stage2h" | "stage2n-a",
    panels: Record<string, Record<string, Record<string, Buffer>>>,
  ) => {
    for (const probeId of PROBE_IDS) {
      await probeSelect.selectOption(probeId);
      await waitForGroundGlass(page, candidate, probeId);
      await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", candidate);
      const observer = await readObserverMetrics(page);
      const groundGlass = await readGroundGlassMetrics(page);
      expect(observer.rootId).not.toBe("");
      expect(groundGlass.rootId).not.toBe("");
      expect(groundGlass.candidateId).toBe(candidate);
      expect(groundGlass.probeId).toBe(probeId);
      expect(groundGlass.motionId).toBe("center");
      (measurements.probeIdentity as unknown[]).push({
        candidate,
        probeId,
        motionId: groundGlass.motionId,
        observerRootId: observer.rootId,
        groundGlassRootId: groundGlass.rootId,
        renderSanityGeneration: groundGlass.generation,
        renderSanityKey: groundGlass.sanityKey,
        observer,
        groundGlass,
      });
      const observerCapture = await page.getByTestId("fringe-app-canvas").screenshot();
      const groundGlassCapture = await page.getByTestId("fringe-ground-glass-canvas").screenshot();
      if (evidenceDirectory) {
        const probeEvidenceDirectory = resolve(evidenceDirectory, candidate, probeId);
        mkdirSync(probeEvidenceDirectory, { recursive: true });
        writeFileSync(resolve(probeEvidenceDirectory, "observer.png"), observerCapture);
        writeFileSync(resolve(probeEvidenceDirectory, "ground-glass.png"), groundGlassCapture);
      }
      panels[candidate] ??= {};
      panels[candidate][probeId] = {
        observer: observerCapture,
        groundGlass: groundGlassCapture,
      };
    }
  };

  const imagePanels: Record<string, Record<string, Record<string, Buffer>>> = {};
  await captureCandidateProbeSet("stage2h", imagePanels);
  (measurements.sixModes as Record<string, unknown>)["stage2h-both"] =
    await modeEvidence("stage2h", "both");

  await setMode("observer");
  (measurements.sixModes as Record<string, unknown>)["stage2h-observer"] =
    await modeEvidence("stage2h", "observer");
  await setMode("ground-glass");
  (measurements.sixModes as Record<string, unknown>)["stage2h-ground-glass"] =
    await modeEvidence("stage2h", "ground-glass");
  await setMode("both");

  const switchCandidate = async (candidate: "stage2h" | "stage2n-a") => {
    const switchStartedAt = Date.now();
    const priorSourceId = await rttMetrics.getAttribute("data-source-id");
    const priorObserverRootId = await rendererMetrics.getAttribute("data-observer-root-id");
    await candidateSelect.selectOption(candidate);
    await expect(rttMetrics).toHaveAttribute("data-rtt-render-sanity-identity", "");
    await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
      "data-state",
      "ready",
      { timeout: 90_000 },
    );
    await waitForGroundGlass(page, candidate, await probeSelect.inputValue());
    await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", candidate);
    await expect(rendererMetrics).toHaveAttribute("data-source-assets", "1");
    await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "2");
    const nextSourceId = await rttMetrics.getAttribute("data-source-id");
    const nextObserverRootId = await rendererMetrics.getAttribute("data-observer-root-id");
    expect(nextSourceId).not.toBe(priorSourceId);
    expect(nextObserverRootId).not.toBe(priorObserverRootId);
    (measurements.candidateSwitches as unknown[]).push({
      candidate,
      selectionToContentReadyMs: Date.now() - switchStartedAt,
      previousSourceId: priorSourceId,
      sourceId: nextSourceId,
      previousObserverRootId: priorObserverRootId,
      observerRootId: nextObserverRootId,
      groundGlass: await readGroundGlassMetrics(page),
      lifecycle: await readObserverMetrics(page),
    });
  };

  await switchCandidate("stage2n-a");
  const nSourceId = await rttMetrics.getAttribute("data-source-id");
  const nObserverRootId = await rendererMetrics.getAttribute("data-observer-root-id");
  await captureCandidateProbeSet("stage2n-a", imagePanels);
  (measurements.sixModes as Record<string, unknown>)["stage2n-a-both"] =
    await modeEvidence("stage2n-a", "both");

  await setMode("observer");
  (measurements.sixModes as Record<string, unknown>)["stage2n-a-observer"] =
    await modeEvidence("stage2n-a", "observer");
  await setMode("ground-glass");
  (measurements.sixModes as Record<string, unknown>)["stage2n-a-ground-glass"] =
    await modeEvidence("stage2n-a", "ground-glass");
  await setMode("both");
  await expect(rttMetrics).toHaveAttribute("data-source-id", nSourceId!);
  await expect(rendererMetrics).toHaveAttribute("data-observer-root-id", /^[^\s]+$/);
  const remountedNObserverRootId = await rendererMetrics.getAttribute("data-observer-root-id");
  expect(remountedNObserverRootId).not.toBe(nObserverRootId);
  expect(remountedNObserverRootId).not.toBe("");

  const priorNGeneration = Number(await rttMetrics.getAttribute("data-rtt-render-sanity-generation"));
  const priorNKey = await rttMetrics.getAttribute("data-rtt-render-sanity-state");
  await setMode("observer");
  await expect(rttMetrics).toHaveAttribute("data-rtt-render-sanity-identity", "");
  await expect(rttMetrics).toHaveAttribute("data-rtt-final-contentful", "");
  await setMode("both");
  await expect
    .poll(async () => Number(await rttMetrics.getAttribute("data-rtt-render-sanity-generation")))
    .toBeGreaterThan(priorNGeneration);
  expect(await rttMetrics.getAttribute("data-rtt-render-sanity-state")).not.toBe(priorNKey);
  await expect(rttMetrics).toHaveAttribute("data-rtt-final-contentful", "true");

  await switchCandidate("stage2h");
  await switchCandidate("stage2n-a");
  await expect(rendererMetrics).toHaveAttribute("data-selected-candidate-geometries", /^[1-9]\d*$/);
  await expect(rendererMetrics).toHaveAttribute("data-final-source-releases", /^[1-9]\d*$/);
  await page.getByRole("button", { name: "Release source asset" }).click();
  await expect(rendererMetrics).toHaveAttribute("data-source-assets", "0");
  await expect(rendererMetrics).toHaveAttribute("data-owner-leases", "0");
  await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "0");
  await expect(rendererMetrics).toHaveAttribute("data-source-geometries", "0");
  await expect(rendererMetrics).toHaveAttribute("data-source-textures", "0");
  await expect(rttMetrics).toHaveAttribute("data-subject-root-id", "");

  for (const probeId of PROBE_IDS) {
    const captures = imagePanels["stage2h"][probeId];
    const candidateCaptures = imagePanels["stage2n-a"][probeId];
    const panel = await composeSideBySidePanel(
      page,
      "DEVELOPMENT_PROBE_ONLY — " + probeId,
      captures.observer,
      captures.groundGlass,
      candidateCaptures.observer,
      candidateCaptures.groundGlass,
    );
    const panelName = "fringe-club-" + probeId + "-stage-2h-vs-stage-2n-a.png";
    await test.info().attach(panelName, {
      body: panel,
      contentType: "image/png",
    });
    if (evidenceDirectory) writeFileSync(resolve(evidenceDirectory, panelName), panel);
  }
  if (evidenceDirectory) {
    rmSync(resolve(evidenceDirectory, "stage2h"), { recursive: true, force: true });
    rmSync(resolve(evidenceDirectory, "stage2n-a"), { recursive: true, force: true });
  }
  const measurementsJson = Buffer.from(JSON.stringify(measurements, null, 2));
  await test.info().attach("fringe-club-stage-2n-b-runtime-measurements.json", {
    body: measurementsJson,
    contentType: "application/json",
  });
  if (evidenceDirectory) {
    writeFileSync(
      resolve(evidenceDirectory, "fringe-club-stage-2n-b-runtime-measurements.json"),
      measurementsJson,
    );
  }
  expect(candidateRequests.some((url) => url.includes(H_GLB_NAME))).toBe(true);
  expect(candidateRequests.some((url) => url.includes(N_GLB_NAME))).toBe(true);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleProblems).toEqual([]);
});

test("Stage 2N-A Observer and RTT instances survive independent sibling removal", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = installBrowserErrorCapture(page);
  await page.goto("/__dev/fringe-club-rtt?rttDiagnostics=1");

  const candidateSelect = page.getByTestId("fringe-candidate-select");
  const modeSelect = page.getByTestId("fringe-renderer-mode-select");
  const rendererMetrics = page.getByTestId("fringe-renderer-metrics");
  const rttMetrics = page.getByTestId("fringe-rtt-metrics");
  await expect(candidateSelect).toHaveValue("stage2h");
  await expect(modeSelect).toHaveValue("both");
  await expect(rendererMetrics).toHaveAttribute("data-baseline-geometries", /^\d+$/);
  await expect(rendererMetrics).toHaveAttribute("data-baseline-textures", /^\d+$/);
  const baseline = await rendererMetrics.evaluate((element) => ({
    geometries: Number(element.getAttribute("data-baseline-geometries")),
    textures: Number(element.getAttribute("data-baseline-textures")),
  }));

  await candidateSelect.selectOption("stage2n-a");
  await page.getByRole("button", { name: "Load selected candidate" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute("data-state", "ready");
  await waitForGroundGlass(page, "stage2n-a", PROBE_IDS[0]);
  const initialObserver = await readObserverMetrics(page);
  const initialRtt = await readGroundGlassMetrics(page);
  expect(initialObserver.candidateId).toBe("stage2n-a");
  expect(initialObserver.sourceAssets).toBe(1);
  expect(initialObserver.ownerLeases).toBe(1);
  expect(initialObserver.instanceLeases).toBe(2);
  expect(initialObserver.rootId).not.toBe(initialRtt.rootId);
  expect(initialRtt.sourceId).not.toBe("");
  expect(initialRtt.finalContentful).toBe(true);

  // Removing Observer leaves the already-mounted RTT instance on the same source/root.
  await modeSelect.selectOption("ground-glass");
  await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "");
  await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "1");
  await waitForGroundGlass(page, "stage2n-a", PROBE_IDS[0]);
  const rttAfterObserverRemoval = await readGroundGlassMetrics(page);
  expect(rttAfterObserverRemoval.sourceId).toBe(initialRtt.sourceId);
  expect(rttAfterObserverRemoval.rootId).toBe(initialRtt.rootId);
  expect(rttAfterObserverRemoval.finalContentful).toBe(true);

  await modeSelect.selectOption("both");
  await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "stage2n-a");
  await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "2");
  await waitForGroundGlass(page, "stage2n-a", PROBE_IDS[0]);
  const remountedObserver = await readObserverMetrics(page);
  expect(remountedObserver.rootId).not.toBe(initialObserver.rootId);
  expect(remountedObserver.sourceAssets).toBe(1);
  expect(remountedObserver.ownerLeases).toBe(1);

  // Removing RTT leaves Observer rendering; re-enabling RTT creates a fresh root/generation.
  const observerSampleBeforeRttRemoval = remountedObserver.sampledAtMs;
  const generationBeforeRttRemoval = (await readGroundGlassMetrics(page)).generation;
  await modeSelect.selectOption("observer");
  await expect(rttMetrics).toHaveAttribute("data-rtt-render-sanity-identity", "");
  await expect(rttMetrics).toHaveAttribute("data-rtt-final-contentful", "");
  await expect(rttMetrics).toHaveAttribute("data-subject-root-id", "");
  await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "1");
  await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "stage2n-a");
  await expect
    .poll(async () => (await readObserverMetrics(page)).sampledAtMs)
    .not.toBe(observerSampleBeforeRttRemoval);

  await modeSelect.selectOption("both");
  await waitForGroundGlass(page, "stage2n-a", PROBE_IDS[0]);
  const observerAfterRttRemoval = await readObserverMetrics(page);
  const remountedRtt = await readGroundGlassMetrics(page);
  expect(observerAfterRttRemoval.rootId).toBe(remountedObserver.rootId);
  expect(observerAfterRttRemoval.candidateId).toBe("stage2n-a");
  expect(remountedRtt.sourceId).toBe(initialRtt.sourceId);
  expect(remountedRtt.rootId).not.toBe(initialRtt.rootId);
  expect(remountedRtt.generation).toBeGreaterThan(generationBeforeRttRemoval);
  expect(remountedRtt.finalContentful).toBe(true);

  const releaseCandidate = async () => {
    await page.getByRole("button", { name: "Release source asset" }).click();
    await expect(rendererMetrics).toHaveAttribute("data-source-assets", "0");
    await expect(rendererMetrics).toHaveAttribute("data-owner-leases", "0");
    await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "0");
    await expect(rendererMetrics).toHaveAttribute("data-source-geometries", "0");
    await expect(rendererMetrics).toHaveAttribute("data-source-textures", "0");
    await expect(rendererMetrics).toHaveAttribute("data-image-backings", "0");
    await expect.poll(async () => (await readObserverMetrics(page)).geometries).toBe(baseline.geometries);
  };

  await releaseCandidate();
  const settledRendererTextureCount = (await readObserverMetrics(page)).textures;
  expect(settledRendererTextureCount).toBeGreaterThanOrEqual(baseline.textures);

  // A repeated load/release cycle must reuse any stable renderer-owned transmission cache.
  await page.getByRole("button", { name: "Load selected candidate" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute("data-state", "ready");
  await waitForGroundGlass(page, "stage2n-a", PROBE_IDS[0]);
  const secondCycle = await readGroundGlassMetrics(page);
  expect(secondCycle.sourceId).not.toBe(initialRtt.sourceId);
  expect(secondCycle.rootId).not.toBe(initialRtt.rootId);
  await releaseCandidate();
  await expect
    .poll(async () => (await readObserverMetrics(page)).textures)
    .toBe(settledRendererTextureCount);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleProblems).toEqual([]);
});

test("Stage 2N-A join probes retain fresh RTT identity through bounded motion", async ({ page }) => {
  test.setTimeout(1_200_000);
  const errors = installBrowserErrorCapture(page);
  const evidenceDirectory = process.env.VCS_FRINGE_STAGE2NB_EVIDENCE_DIR;
  if (evidenceDirectory) mkdirSync(evidenceDirectory, { recursive: true });
  const candidateSelect = page.getByTestId("fringe-candidate-select");
  const probeSelect = page.getByTestId("fringe-probe-select");
  const motionSelect = page.getByTestId("fringe-probe-motion-select");
  const rendererMetrics = page.getByTestId("fringe-renderer-metrics");
  const rttMetrics = page.getByTestId("fringe-rtt-metrics");
  const measurements: Record<string, unknown> = {
    candidate: "stage2n-a",
    environment: await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    })),
    motions: [],
  };

  await page.goto("/__dev/fringe-club-rtt?sceneCapacityProfiling=1&rttDiagnostics=1");
  await expect(rendererMetrics).toHaveAttribute("data-baseline-geometries", /^\d+$/);
  await candidateSelect.selectOption("stage2n-a");
  await probeSelect.selectOption(JOIN_MOTION_PROBES[0].probeId);
  await page.getByRole("button", { name: "Load selected candidate" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 90_000 },
  );
  await waitForGroundGlass(page, "stage2n-a", JOIN_MOTION_PROBES[0].probeId, "center");

  for (const [probeIndex, joinProbe] of JOIN_MOTION_PROBES.entries()) {
    if (probeIndex > 0) {
      const priorKey = await rttMetrics.getAttribute("data-rtt-render-sanity-state");
      const priorGeneration = Number(
        await rttMetrics.getAttribute("data-rtt-render-sanity-generation"),
      );
      const priorRootId = await rttMetrics.getAttribute("data-subject-root-id");
      await probeSelect.selectOption(joinProbe.probeId);
      await waitForGroundGlass(page, "stage2n-a", joinProbe.probeId, "center");
      await expect(rttMetrics).toHaveAttribute("data-subject-motion-id", "center");
      expect(await rttMetrics.getAttribute("data-rtt-render-sanity-state")).not.toBe(priorKey);
      expect(Number(await rttMetrics.getAttribute("data-rtt-render-sanity-generation")))
        .toBeGreaterThan(priorGeneration);
      expect(await rttMetrics.getAttribute("data-subject-root-id")).not.toBe(priorRootId);
    }

    const captures: Array<{ motionId: string; observer: Buffer; groundGlass: Buffer }> = [];
    const recordMotion = async (motionId: string) => {
      await waitForGroundGlass(page, "stage2n-a", joinProbe.probeId, motionId);
      await expect(rttMetrics).toHaveAttribute("data-subject-motion-id", motionId);
      const observer = await readObserverMetrics(page);
      const groundGlass = await readGroundGlassMetrics(page);
      expect(observer.candidateId).toBe("stage2n-a");
      expect(groundGlass.candidateId).toBe("stage2n-a");
      expect(groundGlass.probeId).toBe(joinProbe.probeId);
      expect(groundGlass.motionId).toBe(motionId);
      expect(groundGlass.rootId).not.toBe("");
      const observerCapture = await page.getByTestId("fringe-app-canvas").screenshot();
      const groundGlassCapture = await page.getByTestId("fringe-ground-glass-canvas").screenshot();
      captures.push({ motionId, observer: observerCapture, groundGlass: groundGlassCapture });
      (measurements.motions as unknown[]).push({
        probeId: joinProbe.probeId,
        motionId,
        observer,
        groundGlass,
      });
    };

    await recordMotion("center");
    for (const motionId of MOTION_IDS.slice(1)) {
      const priorKey = await rttMetrics.getAttribute("data-rtt-render-sanity-state");
      const priorGeneration = Number(
        await rttMetrics.getAttribute("data-rtt-render-sanity-generation"),
      );
      const priorRootId = await rttMetrics.getAttribute("data-subject-root-id");
      await motionSelect.selectOption(motionId);
      await waitForGroundGlass(page, "stage2n-a", joinProbe.probeId, motionId);
      expect(await rttMetrics.getAttribute("data-rtt-render-sanity-state")).not.toBe(priorKey);
      expect(Number(await rttMetrics.getAttribute("data-rtt-render-sanity-generation")))
        .toBeGreaterThan(priorGeneration);
      expect(await rttMetrics.getAttribute("data-subject-root-id")).not.toBe(priorRootId);
      await recordMotion(motionId);
    }

    const panel = await composeMotionPanel(
      page,
      "DEVELOPMENT_PROBE_ONLY — join motion — " + joinProbe.label,
      captures,
    );
    const panelName = "fringe-club-" + joinProbe.probeId + "-motion-stage-2n-a.png";
    await test.info().attach(panelName, { body: panel, contentType: "image/png" });
    if (evidenceDirectory) writeFileSync(resolve(evidenceDirectory, panelName), panel);
  }

  const measurementsJson = Buffer.from(JSON.stringify(measurements, null, 2));
  await test.info().attach("fringe-club-stage-2n-b-motion-measurements.json", {
    body: measurementsJson,
    contentType: "application/json",
  });
  if (evidenceDirectory) {
    writeFileSync(
      resolve(evidenceDirectory, "fringe-club-stage-2n-b-motion-measurements.json"),
      measurementsJson,
    );
  }
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleProblems).toEqual([]);
});

test("rapid H/N-A selection aborts delayed stale fetches and only the final candidate attaches", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = installBrowserErrorCapture(page);
  const candidateSelect = page.getByTestId("fringe-candidate-select");
  const rttMetrics = page.getByTestId("fringe-rtt-metrics");
  const rendererMetrics = page.getByTestId("fringe-renderer-metrics");
  const delayed = new Set<string>();
  const releases: Record<string, Array<() => void>> = {
    stage2h: [],
    "stage2n-a": [],
  };
  const interceptWaiters: Record<string, Array<() => void>> = {
    stage2h: [],
    "stage2n-a": [],
  };
  await page.route(/(?:preferred-runtime-candidate|stage-2n-a-candidate)\.glb$/, async (route) => {
    const candidate = route.request().url().includes(N_GLB_NAME) ? "stage2n-a" : "stage2h";
    if (!delayed.has(candidate)) {
      await route.continue();
      return;
    }
    interceptWaiters[candidate].shift()?.();
    await new Promise<void>((resolve) => releases[candidate].push(resolve));
    try {
      await route.continue();
    } catch {
      // The selected candidate change should abort this stale request.
    }
  });
  const waitForIntercept = (candidate: string) =>
    new Promise<void>((resolve) => interceptWaiters[candidate].push(resolve));
  const release = (candidate: string) => {
    delayed.delete(candidate);
    releases[candidate].splice(0).forEach((resolve) => resolve());
  };

  await page.goto("/__dev/fringe-club-rtt?rttDiagnostics=1");
  await expect(rendererMetrics).toHaveAttribute("data-baseline-geometries", /^\d+$/);
  await page.getByRole("button", { name: "Load selected candidate" }).click();
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute("data-state", "ready");
  await waitForGroundGlass(page, "stage2h", PROBE_IDS[0]);

  delayed.add("stage2n-a");
  const nRequest = waitForIntercept("stage2n-a");
  await candidateSelect.selectOption("stage2n-a");
  await nRequest;
  delayed.add("stage2h");
  const hRequest = waitForIntercept("stage2h");
  await candidateSelect.selectOption("stage2h");
  await hRequest;
  release("stage2h");
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute("data-state", "ready");
  await waitForGroundGlass(page, "stage2h", PROBE_IDS[0]);
  release("stage2n-a");
  await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "stage2h");
  await expect(rttMetrics).toHaveAttribute("data-subject-candidate-id", "stage2h");

  await candidateSelect.selectOption("stage2n-a");
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute("data-state", "ready");
  await waitForGroundGlass(page, "stage2n-a", PROBE_IDS[0]);
  delayed.add("stage2h");
  const secondHRequest = waitForIntercept("stage2h");
  await candidateSelect.selectOption("stage2h");
  await secondHRequest;
  await candidateSelect.selectOption("stage2n-a");
  release("stage2h");
  await expect(page.getByTestId("fringe-load-state")).toHaveAttribute("data-state", "ready");
  await waitForGroundGlass(page, "stage2n-a", PROBE_IDS[0]);
  await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "stage2n-a");
  await expect(rendererMetrics).toHaveAttribute("data-source-assets", "1");
  await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "2");
  await expect(rttMetrics).toHaveAttribute("data-subject-candidate-id", "stage2n-a");
  await expect(rttMetrics).toHaveAttribute("data-rtt-final-contentful", "true");
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleProblems).toEqual([]);
});

test("navigation away aborts a delayed development load without a stale mount", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = installBrowserErrorCapture(page);
  let intercepted = 0;
  const routeWaiters: Array<() => void> = [];
  const releaseWaiters: Array<() => void> = [];
  await page.route("**/preferred-runtime-candidate.glb", async (route) => {
    intercepted += 1;
    routeWaiters.shift()?.();
    await new Promise<void>((resolve) => releaseWaiters.push(resolve));
    try {
      await route.continue();
    } catch {
      // SPA navigation may already have aborted the candidate request.
    }
  });

  await page.goto("/__dev/fringe-club");
  await expect(page.getByTestId("fringe-renderer-metrics")).toHaveAttribute(
    "data-baseline-geometries",
    /^\d+$/,
  );
  const requestStarted = new Promise<void>((resolve) => routeWaiters.push(resolve));
  await page.getByRole("button", { name: "Load selected candidate" }).click();
  await requestStarted;
  await page.getByRole("link", { name: "Exit development fixture" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  releaseWaiters.splice(0).forEach((release) => release());
  await expect.poll(() => intercepted).toBeGreaterThan(0);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.consoleProblems).toEqual([]);
  await expect(page.getByTestId("fringe-app-canvas")).toHaveCount(0);
});
