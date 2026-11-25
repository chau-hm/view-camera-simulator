import { createHash } from "node:crypto";
import { mkdir, realpath, stat, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import type { Page, TestInfo } from "@playwright/test";

type TraceEvent = Record<string, unknown>;
type TraceCompletion = { dataLossOccurred: boolean };

const traceCategories = ["blink.user_timing", "devtools.timeline", "toplevel"];
const traceBufferSizeInKb = 32 * 1024;
const maxTraceEvents = 300_000;

export type M7pAssertionSchedulingCapture = {
  recordBrowserEvaluation(label: string): Promise<Record<string, unknown>>;
  recordNodeInterval(label: string, startedAtMs: number, settledAtMs: number): void;
  beginAssertion(timeoutMs: number): void;
  settleAssertion(outcome: "passed" | "failed", error?: string): void;
  beginSyntheticMainThreadStall(durationMs: number): Promise<void>;
  finish(): Promise<void>;
};

const isInsideRepositoryDirectory = (directory: string, repositoryRoot: string) => {
  const pathFromRepository = relative(repositoryRoot, directory);
  return pathFromRepository === "" || (!pathFromRepository.startsWith(`..${sep}`) && pathFromRepository !== "..");
};

export const installM7pAssertionSchedulingCapture = async (
  page: Page,
  testInfo: TestInfo,
  captureId: string,
): Promise<M7pAssertionSchedulingCapture> => {
  if (!/^[a-zA-Z0-9._-]+$/.test(captureId)) throw new Error("M7P capture ID contains unsupported characters.");

  const nodeCaptureStartedAtMs = performance.now();
  let rawDirectory = resolve(process.env.M7P_CAPTURE_OUTPUT_DIR ?? resolve(tmpdir(), "m7p-assertion-scheduling"));
  if (isInsideRepositoryDirectory(rawDirectory, process.cwd())) {
    throw new Error("M7P raw trace output must be outside the repository worktree.");
  }
  await mkdir(rawDirectory, { recursive: true });
  rawDirectory = await realpath(rawDirectory);
  if (isInsideRepositoryDirectory(rawDirectory, await realpath(process.cwd()))) {
    throw new Error("M7P raw trace output resolved inside the repository worktree.");
  }

  const cdp = await page.context().newCDPSession(page);
  const traceEnabled = process.env.M7P_TRACE_ENABLED !== "0";
  const traceEvents: TraceEvent[] = [];
  const bufferUsage: Array<{ percentFull: number; eventCount: number }> = [];
  let categoriesResponse = { categories: [] as string[] };
  let traceCompletion: Promise<TraceCompletion> | null = null;
  let traceOverflowed = false;
  let traceStopError: string | null = null;
  let traceComplete: TraceCompletion | null = null;
  let traceStarted = false;
  let finished = false;
  const nodeClockSyncBrackets: Array<{ syncId: string; startedAtMs: number; settledAtMs: number }> = [];
  const publicEvaluationIntervals: Array<Record<string, unknown>> = [];
  const nodeHeartbeat: Array<Record<string, number>> = [];
  let nodeHeartbeatDropped = 0;
  let previousNodeHeartbeatMs = performance.now();
  const nodeHeartbeatTimer = setInterval(() => {
    const now = performance.now();
    if (nodeHeartbeat.length >= 512) {
      nodeHeartbeat.shift();
      nodeHeartbeatDropped += 1;
    }
    nodeHeartbeat.push({
      previousAtMs: previousNodeHeartbeatMs,
      observedAtMs: now,
      intervalMs: now - previousNodeHeartbeatMs,
      excessOver50Ms: Math.max(0, now - previousNodeHeartbeatMs - 50),
    });
    previousNodeHeartbeatMs = now;
  }, 50);
  let assertion: Record<string, unknown> | null = null;
  let syntheticStall: Record<string, unknown> | null = null;
  let syntheticStallPromise: Promise<void> | null = null;
  let targetFrameId: string | null = null;
  let browserSnapshot: Record<string, unknown> | null = null;
  let browserSnapshotError: string | null = null;

  if (traceEnabled) {
    categoriesResponse = await cdp.send("Tracing.getCategories") as { categories: string[] };
    traceCompletion = new Promise<TraceCompletion>((resolveCompletion) => {
      cdp.once("Tracing.tracingComplete", (payload: TraceCompletion) => resolveCompletion(payload));
    });
    cdp.on("Tracing.dataCollected", (payload: { value: TraceEvent[] }) => {
      if (traceEvents.length + payload.value.length > maxTraceEvents) {
        traceOverflowed = true;
        return;
      }
      traceEvents.push(...payload.value);
    });
    cdp.on("Tracing.bufferUsage", (payload) => {
      bufferUsage.push({ percentFull: payload.percentFull ?? 0, eventCount: payload.eventCount ?? 0 });
    });
    await cdp.send("Tracing.start", {
      transferMode: "ReportEvents",
      bufferUsageReportingInterval: 1000,
      traceConfig: {
        recordMode: "recordUntilFull",
        traceBufferSizeInKb,
        includedCategories: traceCategories,
      },
    });
    traceStarted = true;
  }

  const markTraceClock = async (syncId: string) => {
    if (!traceEnabled) return;
    const startedAtMs = performance.now();
    await cdp.send("Tracing.recordClockSyncMarker", { syncId });
    const settledAtMs = performance.now();
    nodeClockSyncBrackets.push({ syncId, startedAtMs, settledAtMs });
  };
  await markTraceClock(`${captureId}-start`);

  await page.addInitScript(() => {
    const capacity = 256;
    const lifecycle: Array<Record<string, unknown>> = [];
    const longTasks: Array<Record<string, unknown>> = [];
    const heartbeat: Array<Record<string, number>> = [];
    let lifecycleDropped = 0;
    let longTaskDropped = 0;
    let heartbeatDropped = 0;
    let scanScheduled = false;
    let nextIdentity = 1;
    const identities = new WeakMap<Element, string>();
    let lastSignature = "";
    const identityOf = (element: Element) => {
      let identity = identities.get(element);
      if (!identity) {
        identity = `element-${nextIdentity++}`;
        identities.set(element, identity);
      }
      return identity;
    };
    const append = (target: Array<Record<string, unknown>>, entry: Record<string, unknown>, drop: () => void) => {
      if (target.length >= capacity) {
        target.shift();
        drop();
      }
      target.push(entry);
    };
    const readLifecycle = () => {
      const scene = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
      const canvases = scene ? Array.from(scene.querySelectorAll("canvas")) : [];
      const state = {
        browserMonotonicMs: performance.now(),
        route: `${location.pathname}${location.search}`,
        documentTimeOriginMs: performance.timeOrigin,
        sceneIdentity: scene ? identityOf(scene) : null,
        sceneConnected: scene?.isConnected ?? false,
        canvasCount: canvases.length,
        canvasIdentities: canvases.map(identityOf),
        canvasConnected: canvases.map((canvas) => canvas.isConnected),
        rendererStatus: scene?.getAttribute("data-observer-renderer-status") ?? null,
        rendererGeneration: scene?.getAttribute("data-observer-renderer-generation") ?? null,
      };
      const signature = JSON.stringify({ ...state, browserMonotonicMs: 0 });
      if (signature !== lastSignature) {
        lastSignature = signature;
        append(lifecycle, state, () => { lifecycleDropped += 1; });
      }
      return state;
    };
    const scan = () => {
      scanScheduled = false;
      readLifecycle();
    };
    const mutationObserver = new MutationObserver(() => {
      if (scanScheduled) return;
      scanScheduled = true;
      queueMicrotask(scan);
    });
    const observeDocument = () => {
      if (!document.documentElement) return;
      mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-observer-renderer-status", "data-observer-renderer-generation", "data-scene-subject-id"],
      });
      scan();
    };
    if (document.documentElement) observeDocument();
    else document.addEventListener("DOMContentLoaded", observeDocument, { once: true });

    let longTaskObserverAvailable = false;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const detail = entry as PerformanceEntry & { attribution?: Array<{ containerType?: string; containerName?: string; containerId?: number; name?: string }> };
          append(longTasks, {
            startMs: entry.startTime,
            endMs: entry.startTime + entry.duration,
            durationMs: entry.duration,
            name: entry.name,
            attribution: detail.attribution?.map((item) => ({
              containerType: item.containerType ?? null,
              containerName: item.containerName ?? null,
              containerId: item.containerId ?? null,
              name: item.name ?? null,
            })) ?? null,
            callbackDeliveredAtMs: performance.now(),
          }, () => { longTaskDropped += 1; });
        }
      });
      observer.observe({ type: "longtask", buffered: true });
      longTaskObserverAvailable = true;
    } catch {
      longTaskObserverAvailable = false;
    }

    let previousHeartbeatMs = performance.now();
    const heartbeatTimer = window.setInterval(() => {
      const now = performance.now();
      append(heartbeat, {
        previousAtMs: previousHeartbeatMs,
        observedAtMs: now,
        intervalMs: now - previousHeartbeatMs,
        excessOver50Ms: Math.max(0, now - previousHeartbeatMs - 50),
      }, () => { heartbeatDropped += 1; });
      previousHeartbeatMs = now;
    }, 50);

    Object.defineProperty(window, "__m7pAssertionSchedulingCapture", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        snapshot: () => ({
          browserMonotonicMs: performance.now(),
          documentTimeOriginMs: performance.timeOrigin,
          route: `${location.pathname}${location.search}`,
          longTaskObserverAvailable,
          lifecycleMutationObserverAvailable: true,
          lifecycle: [...lifecycle],
          lifecycleDropped,
          longTasks: [...longTasks],
          longTaskDropped,
          heartbeat: [...heartbeat],
          heartbeatDropped,
          heartbeatIntervalMs: 50,
          currentState: readLifecycle(),
        }),
        stop: () => window.clearInterval(heartbeatTimer),
      }),
    });
  });

  const recordBrowserEvaluation = async (label: string) => {
    const requestStartedAtMs = performance.now();
    const browserResult = await page.evaluate((markName) => {
      performance.mark(markName);
      const diagnostics = (window as Window & {
        __m7pAssertionSchedulingCapture?: { snapshot: () => Record<string, unknown> };
      }).__m7pAssertionSchedulingCapture;
      return {
        browserMonotonicMs: performance.now(),
        documentTimeOriginMs: performance.timeOrigin,
        userAgent: navigator.userAgent,
        snapshot: diagnostics?.snapshot() ?? null,
        scene: (() => {
          const scene = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
          const canvases = scene ? Array.from(scene.querySelectorAll("canvas")) : [];
          return {
            sceneConnected: scene?.isConnected ?? false,
            canvasCount: canvases.length,
            canvasConnected: canvases.map((canvas) => canvas.isConnected),
            rendererStatus: scene?.getAttribute("data-observer-renderer-status") ?? null,
            rendererGeneration: scene?.getAttribute("data-observer-renderer-generation") ?? null,
          };
        })(),
      };
    }, `m7p-${label}`);
    const responseSettledAtMs = performance.now();
    const evaluation = { label, requestStartedAtMs, responseSettledAtMs, browserResult };
    publicEvaluationIntervals.push(evaluation);
    return evaluation;
  };

  const beginSyntheticMainThreadStall = (durationMs: number) => {
    if (!Number.isInteger(durationMs) || durationMs < 100 || durationMs > 5_600) {
      throw new Error("M7P synthetic stall must be an integer from 100 through 5600 milliseconds.");
    }
    if (!cdp) throw new Error("M7P CDP session is unavailable.");
    const requestStartedAtMs = performance.now();
    const expression = `(() => { const startedAtMs = performance.now(); performance.mark("m7p-synthetic-stall-start"); const deadlineMs = startedAtMs + ${durationMs}; while (performance.now() < deadlineMs) { Math.sqrt(performance.now()); } const settledAtMs = performance.now(); performance.mark("m7p-synthetic-stall-end"); return { startedAtMs, settledAtMs, requestedDurationMs: ${durationMs}, canvasCount: document.querySelectorAll('[data-testid="scene-canvas"] canvas').length }; })()`;
    const pending = cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
      .then((result: { result?: { value?: unknown }; exceptionDetails?: unknown }) => {
        syntheticStall = {
          requestStartedAtMs,
          responseSettledAtMs: performance.now(),
          browserResult: result.result?.value ?? null,
          exceptionDetails: result.exceptionDetails ?? null,
        };
      })
      .catch((error: unknown) => {
        syntheticStall = {
          requestStartedAtMs,
          responseSettledAtMs: performance.now(),
          error: error instanceof Error ? error.message : String(error),
        };
        throw error;
      });
    syntheticStallPromise = pending;
    return pending;
  };

  const beginAssertion = (timeoutMs: number) => {
    const nodeAssertionEntryMs = performance.now();
    assertion = {
      nodeAssertionEntryMs,
      timeoutBudgetMs: timeoutMs,
      inferredNodeDeadlineMs: nodeAssertionEntryMs + timeoutMs,
      outcome: "pending",
    };
  };
  const settleAssertion = (outcome: "passed" | "failed", error?: string) => {
    if (!assertion) throw new Error("M7P assertion settlement recorded without assertion entry.");
    assertion = {
      ...assertion,
      nodeAssertionSettledMs: performance.now(),
      outcome,
      ...(error ? { errorSummary: error.split("\n")[0] } : {}),
    };
  };

  return {
    recordBrowserEvaluation,
    recordNodeInterval: (label, startedAtMs, settledAtMs) => {
      publicEvaluationIntervals.push({ label, requestStartedAtMs: startedAtMs, responseSettledAtMs: settledAtMs });
    },
    beginAssertion,
    settleAssertion,
    beginSyntheticMainThreadStall,
    finish: async () => {
      if (finished) return;
      finished = true;
      clearInterval(nodeHeartbeatTimer);
      if (syntheticStallPromise) await syntheticStallPromise.catch(() => undefined);
      const snapshotRequestStartedAtMs = performance.now();
      try {
        const result = await page.evaluate(() => {
          const diagnostics = (window as Window & {
            __m7pAssertionSchedulingCapture?: { snapshot: () => Record<string, unknown>; stop: () => void };
          }).__m7pAssertionSchedulingCapture;
          performance.mark("m7p-catch-time-snapshot");
          const snapshot = diagnostics?.snapshot() ?? null;
          diagnostics?.stop();
          return { browserMonotonicMs: performance.now(), documentTimeOriginMs: performance.timeOrigin, snapshot };
        });
        browserSnapshot = result;
      } catch (error) {
        browserSnapshotError = error instanceof Error ? error.message : String(error);
      }
      publicEvaluationIntervals.push({
        label: "catch-time-snapshot",
        requestStartedAtMs: snapshotRequestStartedAtMs,
        responseSettledAtMs: performance.now(),
        ...(browserSnapshot ? { browserResult: browserSnapshot } : { error: browserSnapshotError }),
      });

      if (traceEnabled) {
        try {
          const frameTree = await cdp.send("Page.getFrameTree") as { frameTree?: { frame?: { id?: string } } };
          targetFrameId = frameTree.frameTree?.frame?.id ?? null;
        } catch {
          targetFrameId = null;
        }
      }
      await markTraceClock(`${captureId}-end`).catch((error: unknown) => {
        traceStopError = error instanceof Error ? error.message : String(error);
      });
      if (traceStarted) {
        try {
          await cdp.send("Tracing.end");
          if (!traceCompletion) throw new Error("M7P trace completion listener was not installed.");
          traceComplete = await Promise.race([
            traceCompletion,
            new Promise<null>((resolveCompletion) => setTimeout(() => resolveCompletion(null), 15_000)),
          ]);
          if (!traceComplete) traceStopError = "Tracing.tracingComplete was not received within 15 seconds";
        } catch (error) {
          traceStopError = error instanceof Error ? error.message : String(error);
        }
      }
      await cdp.detach().catch(() => undefined);

      let tracePath: string | null = null;
      let traceSha256: string | null = null;
      let traceSizeBytes = 0;
      if (traceEnabled) {
        tracePath = resolve(rawDirectory, `${captureId}.trace.json`);
        const traceBytes = Buffer.from(JSON.stringify({ traceEvents }));
        traceSha256 = createHash("sha256").update(traceBytes).digest("hex");
        await writeFile(tracePath, traceBytes);
        traceSizeBytes = (await stat(tracePath)).size;
      }
      const maximumBufferPercent = bufferUsage.reduce((maximum, event) => Math.max(maximum, event.percentFull), 0);
      const normalizedCapture = {
        schemaVersion: 1,
        captureId,
        testIdentity: testInfo.titlePath.join(" › "),
        testStatus: testInfo.status,
        expectedStatus: testInfo.expectedStatus,
        nodeCaptureStartedAtMs,
        assertion,
        publicEvaluationIntervals,
        nodeHeartbeat,
        nodeHeartbeatDropped,
        targetFrameId,
        browserSnapshot,
        browserSnapshotError,
        syntheticStall,
        nodeClockSyncBrackets,
        trace: {
          enabled: traceEnabled,
          started: traceStarted,
          completed: traceComplete !== null,
          dataLossOccurred: traceComplete?.dataLossOccurred ?? null,
          stopError: traceStopError,
          overflowedByCollector: traceOverflowed,
          maxTraceEvents,
          traceEventCount: traceEvents.length,
          traceBufferSizeInKb,
          bufferUsageSamples: bufferUsage.length,
          maximumBufferPercent,
          categories: traceCategories,
          availableCategoryCount: categoriesResponse.categories.length,
          rawTracePath: tracePath,
          rawTraceSha256: traceSha256,
          rawTraceSizeBytes: traceSizeBytes,
          clockDomain: traceEnabled
            ? "Chromium trace clock in microseconds; page performance marks provide trace/page anchors; Node clock sync markers provide bracketed Node/trace alignment."
            : "No Chromium trace requested; page and Node clocks remain separate.",
        },
      };
      await writeFile(resolve(rawDirectory, `${captureId}.capture.json`), `${JSON.stringify(normalizedCapture, null, 2)}\n`);
    },
  };
};
