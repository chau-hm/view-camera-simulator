import type { Page, TestInfo } from "@playwright/test";

const eventLimit = 120;
const heartbeatIntervalMs = 100;
const heartbeatDelayThresholdMs = 50;

type NodeTimelineEntry = {
  event: string;
  nodeMonotonicMs: number;
  detail?: Record<string, unknown>;
};

type BrowserBoundary = {
  label: string;
  nodeRequestStartMs: number;
  nodeResponseEndMs: number;
  roundTripMs: number;
  browser: Record<string, unknown> | null;
  error: string | null;
};

type PollObservation = {
  nodeRequestStartMs: number;
  nodeResponseEndMs: number;
  browserMonotonicMs: number | null;
  count: number | null;
  documentIdentity: string | null;
  sceneContainerIdentities: string[];
  canvasIdentities: string[];
  error?: string;
};

type Capture = {
  mark: (event: string, detail?: Record<string, unknown>) => void;
  beginAssertion: (timeoutMs: number) => void;
  settleAssertion: (outcome: "passed" | "failed", error?: string) => void;
  captureBoundary: (label: string) => Promise<BrowserBoundary>;
  recordPollObservation: (observation: PollObservation) => void;
  finish: () => Promise<void>;
};

export const installM7oCanvasAssertionTimingCapture = async (
  page: Page,
  testInfo: TestInfo,
  captureId: string,
): Promise<Capture> => {
  const captureStartedAtNodeMonotonicMs = performance.now();
  const captureStartedAtWallClock = new Date().toISOString();
  const nodeTimeline: NodeTimelineEntry[] = [];
  const browserBoundaries: BrowserBoundary[] = [];
  const diagnosticPollObservations: PollObservation[] = [];
  const dropped = { nodeTimeline: 0, browserBoundaries: 0, diagnosticPollObservations: 0, nodeHeartbeatDelays: 0 };
  const nodeHeartbeatDelays: Array<{ expectedIntervalMs: number; actualIntervalMs: number; excessDelayMs: number; nodeMonotonicMs: number }> = [];
  let maxNodeHeartbeatDelayMs = 0;
  let nodeHeartbeatCount = 0;
  let lastNodeHeartbeatAtMs = captureStartedAtNodeMonotonicMs;
  let assertion: Record<string, unknown> | null = null;
  let assertionCatchBoundary: BrowserBoundary | null = null;
  let finished = false;

  const appendBounded = <T>(items: T[], value: T, dropKey: keyof typeof dropped) => {
    if (items.length === eventLimit) {
      items.shift();
      dropped[dropKey] += 1;
    }
    items.push(value);
  };

  const mark = (event: string, detail?: Record<string, unknown>) => {
    appendBounded(nodeTimeline, { event, nodeMonotonicMs: performance.now(), ...(detail ? { detail } : {}) }, "nodeTimeline");
  };

  mark("test-attempt-start", {
    captureId,
    testIdentity: testInfo.titlePath.join(" › "),
    projectName: testInfo.project.name,
    workerIndex: testInfo.workerIndex,
    parallelIndex: testInfo.parallelIndex,
    repeatEachIndex: testInfo.repeatEachIndex,
    retry: testInfo.retry,
  });

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) mark("main-frame-navigated", { url: new URL(frame.url()).pathname });
  });
  page.on("request", (request) => {
    if (request.resourceType() === "document") {
      mark("document-request", { method: request.method(), path: new URL(request.url()).pathname });
    }
  });
  page.on("response", (response) => {
    if (response.request().resourceType() === "document") {
      mark("document-response", { status: response.status(), path: new URL(response.url()).pathname });
    }
  });
  page.on("domcontentloaded", () => mark("domcontentloaded-delivered-to-node"));
  page.on("load", () => mark("load-delivered-to-node"));
  page.on("close", () => mark("page-close-delivered-to-node"));

  await page.addInitScript(() => {
    const sceneSelector = '[data-testid="scene-canvas"]';
    const heartbeatIntervalMs = 100;
    const transitionLimit = 160;
    const longTaskLimit = 100;
    const heartbeatDelayLimit = 100;
    const delayedHeartbeatThresholdMs = 50;
    const elementIdentities = new WeakMap<Element, string>();
    let nextElementIdentity = 1;
    const transitions: Array<Record<string, unknown>> = [];
    const longTasks: Array<{ startTimeMs: number; durationMs: number }> = [];
    const heartbeatDelays: Array<{ expectedIntervalMs: number; actualIntervalMs: number; excessDelayMs: number; browserMonotonicMs: number }> = [];
    const contextEvents: Array<{ event: string; browserMonotonicMs: number; canvasIdentity: string | null }> = [];
    const dropped = { transitions: 0, longTasks: 0, heartbeatDelays: 0, contextEvents: 0 };
    let longTaskObserverAvailable = false;
    let heartbeatAvailable = false;
    let maxHeartbeatIntervalMs = 0;
    let heartbeatCount = 0;
    let previousSnapshot: Record<string, unknown> | null = null;
    let previousSignature: string | null = null;
    let mutationObserver: MutationObserver | null = null;
    const documentIdentity = `${performance.timeOrigin.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    const identify = (element: Element): string => {
      let identity = elementIdentities.get(element);
      if (!identity) {
        identity = `element-${nextElementIdentity++}`;
        elementIdentities.set(element, identity);
      }
      return identity;
    };

    const append = <T>(items: T[], value: T, dropKey: keyof typeof dropped, limit: number) => {
      if (items.length === limit) {
        items.shift();
        dropped[dropKey] += 1;
      }
      items.push(value);
    };

    const readDom = () => {
      const scenes = Array.from(document.querySelectorAll<HTMLElement>(sceneSelector));
      const sceneContainers = scenes.map((scene) => ({
        identity: identify(scene),
        isConnected: scene.isConnected,
        sceneId: scene.getAttribute("data-scene-subject-id"),
        rendererStatus: scene.getAttribute("data-observer-renderer-status"),
        rendererGeneration: scene.getAttribute("data-observer-renderer-generation"),
        canvases: Array.from(scene.querySelectorAll<HTMLCanvasElement>("canvas")).map((canvas) => ({
          identity: identify(canvas),
          isConnected: canvas.isConnected,
          width: canvas.width,
          height: canvas.height,
        })),
      }));
      const trace = (window as Window & {
        __m7nRendererLifecycleTrace?: {
          snapshot: () => { events?: readonly { surface?: string; mountGeneration?: string | number | null }[] } | null;
        };
      }).__m7nRendererLifecycleTrace?.snapshot() ?? null;
      const viewportMountIdentities = trace?.events
        ?.filter((event) => event.surface === "observer" && typeof event.mountGeneration === "string" && event.mountGeneration.startsWith("m7n-observer-viewport-"))
        .map((event) => event.mountGeneration)
        .filter((identity): identity is string | number => typeof identity === "string" || typeof identity === "number") ?? null;
      return {
        documentIdentity,
        route: `${window.location.pathname}${window.location.search}`,
        documentReadyState: document.readyState,
        browserUserAgent: navigator.userAgent,
        browserPlatform: navigator.platform,
        sceneContainers,
        totalCanvasCount: sceneContainers.reduce((total, scene) => total + scene.canvases.length, 0),
        viewportMountIdentities: viewportMountIdentities === null ? null : [...new Set(viewportMountIdentities)],
        m7nTraceAvailable: trace !== null,
      };
    };

    const currentSignature = (dom: ReturnType<typeof readDom>) => JSON.stringify(dom);
    const scan = (reason: string) => {
      const dom = readDom();
      const signature = currentSignature(dom);
      if (signature === previousSignature) return;
      const previous = previousSnapshot;
      previousSignature = signature;
      previousSnapshot = dom;
      append(transitions, {
        reason,
        observedAtPageMonotonicMs: performance.now(),
        performanceTimeOriginMs: performance.timeOrigin,
        previous,
        current: dom,
      }, "transitions", transitionLimit);
    };

    const nodeHasRelevantElement = (node: Node): boolean => {
      if (!(node instanceof Element)) return false;
      return node.matches(sceneSelector) || node.matches("canvas") || node.querySelector(sceneSelector) !== null || node.querySelector("canvas") !== null;
    };
    const mutationIsRelevant = (record: MutationRecord): boolean => {
      if (record.type === "attributes") {
        return record.attributeName === "data-testid"
          || record.attributeName === "data-scene-subject-id"
          || record.attributeName === "data-observer-renderer-status"
          || record.attributeName === "data-observer-renderer-generation";
      }
      const target = record.target;
      if (target instanceof Element && (target.matches(sceneSelector) || target.closest(sceneSelector))) return true;
      return [...record.addedNodes, ...record.removedNodes].some(nodeHasRelevantElement);
    };

    if (typeof PerformanceObserver !== "undefined") {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            append(longTasks, { startTimeMs: entry.startTime, durationMs: entry.duration }, "longTasks", longTaskLimit);
          }
        });
        observer.observe({ type: "longtask", buffered: true });
        longTaskObserverAvailable = true;
      } catch {
        longTaskObserverAvailable = false;
      }
    }

    const attachObserver = () => {
      if (typeof MutationObserver === "undefined" || !document.documentElement) return;
      mutationObserver = new MutationObserver((records) => {
        if (records.some(mutationIsRelevant)) scan("relevant-mutation-observed");
      });
      mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-testid", "data-scene-subject-id", "data-observer-renderer-status", "data-observer-renderer-generation"],
      });
      scan("mutation-observer-installed");
    };
    scan("document-start");
    if (document.documentElement) attachObserver();
    else document.addEventListener("DOMContentLoaded", attachObserver, { once: true });

    let lastHeartbeatAtMs = performance.now();
    heartbeatAvailable = true;
    window.setInterval(() => {
      const now = performance.now();
      const actualIntervalMs = now - lastHeartbeatAtMs;
      const excessDelayMs = Math.max(0, actualIntervalMs - heartbeatIntervalMs);
      heartbeatCount += 1;
      maxHeartbeatIntervalMs = Math.max(maxHeartbeatIntervalMs, actualIntervalMs);
      lastHeartbeatAtMs = now;
      if (excessDelayMs >= delayedHeartbeatThresholdMs) {
        append(heartbeatDelays, {
          expectedIntervalMs: heartbeatIntervalMs,
          actualIntervalMs,
          excessDelayMs,
          browserMonotonicMs: now,
        }, "heartbeatDelays", heartbeatDelayLimit);
      }
    }, heartbeatIntervalMs);

    const onContextEvent = (event: Event) => {
      const target = event.target;
      append(contextEvents, {
        event: event.type,
        browserMonotonicMs: performance.now(),
        canvasIdentity: target instanceof HTMLCanvasElement ? identify(target) : null,
      }, "contextEvents", 20);
    };
    document.addEventListener("webglcontextlost", onContextEvent, true);
    document.addEventListener("webglcontextrestored", onContextEvent, true);

    Object.defineProperty(window, "__m7oCanvasTimingCapture", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        observeDom: () => ({
          sampledAtPageMonotonicMs: performance.now(),
          performanceTimeOriginMs: performance.timeOrigin,
          ...readDom(),
        }),
        snapshot: () => ({
          sampledAtPageMonotonicMs: performance.now(),
          performanceTimeOriginMs: performance.timeOrigin,
          dom: readDom(),
          transitions: [...transitions],
          longTasks: [...longTasks],
          heartbeatDelays: [...heartbeatDelays],
          heartbeat: {
            available: heartbeatAvailable,
            expectedIntervalMs: heartbeatIntervalMs,
            delayedCallbackThresholdMs: delayedHeartbeatThresholdMs,
            callbackCount: heartbeatCount,
            maxActualIntervalMs: maxHeartbeatIntervalMs,
          },
          contextEvents: [...contextEvents],
          observers: { longTaskObserverAvailable, mutationObserverAvailable: mutationObserver !== null },
          droppedEventCounts: { ...dropped },
        }),
      }),
    });
  });

  const nodeHeartbeat = setInterval(() => {
    const now = performance.now();
    const actualIntervalMs = now - lastNodeHeartbeatAtMs;
    const excessDelayMs = Math.max(0, actualIntervalMs - heartbeatIntervalMs);
    nodeHeartbeatCount += 1;
    maxNodeHeartbeatDelayMs = Math.max(maxNodeHeartbeatDelayMs, excessDelayMs);
    lastNodeHeartbeatAtMs = now;
    if (excessDelayMs >= heartbeatDelayThresholdMs) {
      appendBounded(nodeHeartbeatDelays, {
        expectedIntervalMs: heartbeatIntervalMs,
        actualIntervalMs,
        excessDelayMs,
        nodeMonotonicMs: now,
      }, "nodeHeartbeatDelays");
    }
  }, heartbeatIntervalMs);
  nodeHeartbeat.unref();

  const captureBoundary = async (label: string): Promise<BrowserBoundary> => {
    const nodeRequestStartMs = performance.now();
    let browser: Record<string, unknown> | null = null;
    let error: string | null = null;
    try {
      browser = await page.evaluate(() => {
        const diagnostics = (window as Window & {
          __m7oCanvasTimingCapture?: { snapshot: () => Record<string, unknown> };
        }).__m7oCanvasTimingCapture;
        return diagnostics?.snapshot() ?? {
          sampledAtPageMonotonicMs: performance.now(),
          performanceTimeOriginMs: performance.timeOrigin,
          unavailable: true,
        };
      });
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    const nodeResponseEndMs = performance.now();
    const boundary = { label, nodeRequestStartMs, nodeResponseEndMs, roundTripMs: nodeResponseEndMs - nodeRequestStartMs, browser, error };
    appendBounded(browserBoundaries, boundary, "browserBoundaries");
    if (label === "immediate-canvas-assertion-failure-snapshot") assertionCatchBoundary = boundary;
    return boundary;
  };

  return {
    mark,
    beginAssertion: (timeoutMs) => {
      const startMs = performance.now();
      assertion = {
        matcher: "toHaveCount(1)",
        locator: '[data-testid="scene-canvas"] canvas',
        observationSemantics: "Playwright locator matcher retries internally; installed public API has no per-retry observation hook.",
        nodeCallEntryMonotonicMs: startMs,
        configuredTimeoutMs: timeoutMs,
        inferredDeadlineNodeMonotonicMs: startMs + timeoutMs,
        deadlineNature: "budget-derived, not an observed final matcher poll",
        settled: false,
      };
      mark("canvas-count-assertion-entered", { timeoutMs, inferredDeadlineNodeMonotonicMs: startMs + timeoutMs });
    },
    settleAssertion: (outcome, error) => {
      const settledAt = performance.now();
      assertion = {
        ...(assertion ?? {}),
        outcome,
        nodeCallSettlementMonotonicMs: settledAt,
        elapsedMs: typeof assertion?.nodeCallEntryMonotonicMs === "number"
          ? settledAt - assertion.nodeCallEntryMonotonicMs
          : null,
        settled: true,
        ...(error ? { errorSummary: error.split("\n")[0].slice(0, 240) } : {}),
      };
      mark("canvas-count-assertion-settled", { outcome, errorSummary: error?.split("\n")[0].slice(0, 240) ?? null });
    },
    captureBoundary,
    recordPollObservation: (observation) => appendBounded(diagnosticPollObservations, observation, "diagnosticPollObservations"),
    finish: async () => {
      if (finished) return;
      finished = true;
      mark("test-teardown-start");
      const teardownBoundary = await captureBoundary("test-teardown-browser-snapshot");
      if (!page.isClosed()) await page.close();
      mark("test-teardown-complete");
      clearInterval(nodeHeartbeat);
      const capture = {
        schemaVersion: 1,
        evaluatorRevision: "m7o-canvas-assertion-timing-evaluator-v1",
        captureId,
        source: {
          testFile: "src/tests/e2e/architecture-rise-focus-range.spec.ts",
          assertionIdentity: "Architecture Rise focus control stays within scene depth and preserves thin-lens extension",
        },
        testAttempt: {
          identity: testInfo.titlePath.join(" › "),
          status: testInfo.status,
          expectedStatus: testInfo.expectedStatus,
          projectName: testInfo.project.name,
          workerIndex: testInfo.workerIndex,
          parallelIndex: testInfo.parallelIndex,
          repeatEachIndex: testInfo.repeatEachIndex,
          retry: testInfo.retry,
          startedAtWallClock: captureStartedAtWallClock,
          captureStartedAtNodeMonotonicMs,
          durationMs: testInfo.duration,
        },
        assertion,
        assertionCatchBoundary,
        browserBoundaries,
        diagnosticPoll: {
          implementation: "independent public expect.poll callback; never an internal toHaveCount retry trace",
          executed: diagnosticPollObservations.length > 0,
          observations: diagnosticPollObservations,
        },
        browserAndNodeScheduling: {
          nodeHeartbeat: {
            expectedIntervalMs: heartbeatIntervalMs,
            delayedCallbackThresholdMs: heartbeatDelayThresholdMs,
            callbackCount: nodeHeartbeatCount,
            maxExcessDelayMs: maxNodeHeartbeatDelayMs,
            delays: nodeHeartbeatDelays,
          },
          teardownBrowserBoundary: teardownBoundary,
        },
        nodeTimeline,
        droppedEventCounts: dropped,
      };
      await testInfo.attach(`m7o-${captureId}-canvas-assertion-timing.json`, {
        body: JSON.stringify(capture, null, 2),
        contentType: "application/json",
      });
    },
  };
};

export type M7oCapture = Capture;
