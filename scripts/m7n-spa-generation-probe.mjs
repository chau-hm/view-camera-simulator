import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, devices } from "@playwright/test";

const argumentsByName = new Map(process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  return separator < 0
    ? [argument.replace(/^--/, ""), "true"]
    : [argument.slice(2, separator), argument.slice(separator + 1)];
}));
const outputPath = resolve(argumentsByName.get("output") ?? "");
const port = Number(argumentsByName.get("port") ?? 4319);
if (!argumentsByName.has("output") || !Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("Usage: node scripts/m7n-spa-generation-probe.mjs --output=<new-file.json> [--port=4319]");
}
const sourceWorkingTree = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim();
if (sourceWorkingTree) {
  throw new Error("Commit the lifecycle instrumentation before capturing provenance; tracked source changes are present.");
}
try {
  await access(outputPath);
  throw new Error(`Refusing to overwrite existing lifecycle evidence: ${outputPath}`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    VITE_BASE_PATH: "/",
    VITE_M7N_RENDERER_LIFECYCLE_TRACE: "true",
  },
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-12_000); });
server.stderr.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-12_000); });

let browser;
const pageErrors = [];
const failedRequests = [];
const longTaskInstaller = () => {
  const entries = [];
  let dropped = 0;
  let observer = null;
  if (typeof PerformanceObserver !== "undefined") {
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entries.length === 50) {
            entries.shift();
            dropped += 1;
          }
          entries.push({ startTimeMs: entry.startTime, durationMs: entry.duration });
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer?.disconnect();
      observer = null;
    }
  }
  Object.defineProperty(window, "__m7nProbeTiming", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      snapshot: () => ({
        navigation: performance.getEntriesByType("navigation").map((entry) => ({
          durationMs: entry.duration,
          domInteractiveMs: entry.domInteractive,
          domContentLoadedMs: entry.domContentLoadedEventEnd,
          loadEventEndMs: entry.loadEventEnd,
        })),
        longTasks: [...entries],
        droppedLongTasks: dropped,
        longTaskObserverAvailable: observer !== null,
      }),
    }),
  });
};

const waitForServer = async () => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before startup. ${serverOutput}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The loopback listener is not ready yet.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Timed out waiting for Vite. ${serverOutput}`);
};

const makeStep = async (page, sceneId, route, viaScenes) => {
  const startedAtMs = performance.now();
  if (viaScenes) {
    const scenesLinks = page.locator('a[href="/scenes"]');
    await scenesLinks.last().click();
    await page.waitForURL("**/scenes");
    await page.locator(`a[href="${route}"]`).click();
    await page.waitForURL(`**${route}`);
  } else {
    await page.goto(`${baseUrl}${route}`);
  }
  const readySelector = `[data-testid="scene-canvas"][data-scene-subject-id="${sceneId}"][data-observer-renderer-status="active"] canvas`;
  await page.locator(readySelector).first().waitFor({ state: "attached", timeout: 90_000 });
  const readyAtMs = performance.now();
  const diagnostics = await page.locator('[data-testid="scene-canvas"]').evaluate((element) => ({
    sceneId: element.getAttribute("data-scene-subject-id"),
    rendererStatus: element.getAttribute("data-observer-renderer-status"),
    rendererFamily: element.getAttribute("data-observer-renderer-family"),
    rendererGeneration: element.getAttribute("data-observer-renderer-generation"),
    canvasCount: element.querySelectorAll("canvas").length,
  }));
  if (diagnostics.sceneId !== sceneId || diagnostics.rendererStatus !== "active" || diagnostics.canvasCount !== 1) {
    throw new Error(`Unexpected readiness state for ${sceneId}: ${JSON.stringify(diagnostics)}`);
  }
  return {
    sceneId,
    route,
    transition: viaScenes ? "SPA scene-card navigation" : "initial document navigation",
    startedAtCaptureMs: startedAtMs,
    observerReadyAtCaptureMs: readyAtMs,
    durationToObserverActiveMs: readyAtMs - startedAtMs,
    diagnostics,
  };
};

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices["Desktop Chrome"] });
  const page = await context.newPage();
  await page.addInitScript(longTaskInstaller);
  page.on("pageerror", (error) => {
    if (pageErrors.length === 80) pageErrors.shift();
    pageErrors.push(error.message.slice(0, 500));
  });
  page.on("requestfailed", (request) => {
    const resourceType = request.resourceType();
    if (resourceType !== "document" && resourceType !== "script" && resourceType !== "stylesheet") return;
    if (failedRequests.length === 80) failedRequests.shift();
    failedRequests.push({ path: new URL(request.url()).pathname, resourceType, error: request.failure()?.errorText ?? null });
  });

  const traceSequence = [];
  traceSequence.push(await makeStep(page, "architecture-rise", "/simulator/free/architecture-rise", false));
  traceSequence.push(await makeStep(page, "macro-bellows-extension", "/simulator/free/macro-bellows-extension", true));
  traceSequence.push(await makeStep(page, "architecture-rise", "/simulator/free/architecture-rise", true));

  const browserEvidence = await page.evaluate(() => {
    const typedWindow = window;
    return {
      pageTimeOriginMs: performance.timeOrigin,
      pageMonotonicEndMs: performance.now(),
      applicationTrace: typedWindow.__m7nRendererLifecycleTrace?.snapshot() ?? null,
      browserTiming: typedWindow.__m7nProbeTiming?.snapshot() ?? null,
      currentUrl: `${window.location.pathname}${window.location.search}`,
    };
  });
  const trace = browserEvidence.applicationTrace;
  if (!trace || typeof trace !== "object" || !Array.isArray(trace.events)) {
    throw new Error("The opted-in application lifecycle trace was not available after the SPA probe.");
  }
  const activeObserverScenes = trace.events
    .filter((event) => event.event === "observer-capabilities-published" && event.status === "active")
    .map((event) => event.sceneId)
    .filter((sceneId, index, scenes) => index === 0 || sceneId !== scenes[index - 1]);
  if (activeObserverScenes.join(",") !== "architecture-rise,macro-bellows-extension,architecture-rise") {
    throw new Error(`Observer readiness order did not match A→B→A: ${activeObserverScenes.join(" → ")}`);
  }
  const activatedViewports = trace.events.filter((event) => event.event === "observer-generation-authority-activated");
  const architectureViewportIdentities = activatedViewports
    .filter((event) => event.sceneId === "architecture-rise")
    .map((event) => event.mountGeneration);
  if (architectureViewportIdentities.length < 2 || architectureViewportIdentities[0] === architectureViewportIdentities.at(-1)) {
    throw new Error("The two Architecture Rise mounts did not retain distinct trace identities.");
  }

  const report = {
    schemaVersion: 1,
    experimentId: "spa-a-b-a-generation-probe",
    sourceCommitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    browser: { name: "Chromium", version: browser.version(), viewport: devices["Desktop Chrome"].viewport },
    traceEnabled: true,
    navigationModel: "one initial document navigation followed by two React Router scene-card navigations",
    pageErrors,
    failedModuleOrDocumentRequests: failedRequests,
    traceSequence,
    activeObserverSceneSequence: activeObserverScenes,
    distinctArchitectureRiseMountIdentities: architectureViewportIdentities,
    staleObserverCallbacksRejected: trace.events.filter((event) => event.event === "observer-stale-capability-callback-rejected").length,
    staleGroundGlassFrameResultsRejected: trace.events.filter((event) => event.event === "ground-glass-stale-frame-result-rejected").length,
    traceDroppedEventCount: trace.droppedEventCount,
    browserEvidence,
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, { flag: "wx" });
  console.log(JSON.stringify({ outputPath, sha256: createHash("sha256").update(serialized).digest("hex"), activeObserverScenes, traceDroppedEventCount: trace.droppedEventCount }, null, 2));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
