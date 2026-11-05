import type { Page, TestInfo } from "@playwright/test";

const maxItems = 80;

type TimedResource = {
  resourceType: string;
  path: string;
  startedAtMs: number;
  completedAtMs?: number;
  status?: number;
  failure?: string;
};

const appendBounded = <T>(items: T[], value: T, dropped: { count: number }) => {
  if (items.length === maxItems) {
    items.shift();
    dropped.count += 1;
  }
  items.push(value);
};

export const installM7nRendererLifecycleCapture = async (
  page: Page,
  testInfo: TestInfo,
  runId: string,
) => {
  const startedAtMs = performance.now();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: Array<{ resourceType: string; path: string; failure: string | null }> = [];
  const relevantResources: TimedResource[] = [];
  const dropped = { pageErrors: { count: 0 }, consoleErrors: { count: 0 }, failedRequests: { count: 0 }, resources: { count: 0 } };
  const requestStartedAt = new WeakMap<object, number>();

  page.on("pageerror", (error) => appendBounded(pageErrors, error.message, dropped.pageErrors));
  page.on("console", (message) => {
    if (message.type() === "error") {
      appendBounded(consoleErrors, message.text().slice(0, 500), dropped.consoleErrors);
    }
  });
  page.on("request", (request) => {
    const resourceType = request.resourceType();
    if (resourceType === "document" || resourceType === "script" || resourceType === "stylesheet") {
      requestStartedAt.set(request, performance.now());
    }
  });
  page.on("response", (response) => {
    const request = response.request();
    const started = requestStartedAt.get(request);
    if (started === undefined) return;
    appendBounded(relevantResources, {
      resourceType: request.resourceType(),
      path: new URL(request.url()).pathname,
      startedAtMs: started - startedAtMs,
      completedAtMs: performance.now() - startedAtMs,
      status: response.status(),
    }, dropped.resources);
  });
  page.on("requestfailed", (request) => {
    const started = requestStartedAt.get(request);
    if (started === undefined) return;
    appendBounded(failedRequests, {
      resourceType: request.resourceType(),
      path: new URL(request.url()).pathname,
      failure: request.failure()?.errorText ?? null,
    }, dropped.failedRequests);
    appendBounded(relevantResources, {
      resourceType: request.resourceType(),
      path: new URL(request.url()).pathname,
      startedAtMs: started - startedAtMs,
      completedAtMs: performance.now() - startedAtMs,
      failure: request.failure()?.errorText ?? "failed",
    }, dropped.resources);
  });

  await page.addInitScript(() => {
    const limit = 50;
    const longTasks: Array<{ startTimeMs: number; durationMs: number }> = [];
    const lifecycleMilestones: Array<{
      event: string;
      timestampMs: number;
      routeId: string;
      sceneId: string | null;
      canvasCount: number;
      rendererStatus: string | null;
      rendererGeneration: string | null;
      workspaceMounted: boolean;
      suspenseVisible: boolean;
    }> = [];
    let droppedLongTasks = 0;
    let droppedLifecycleMilestones = 0;
    let observer: PerformanceObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let previousState: string | null = null;
    if (typeof PerformanceObserver !== "undefined") {
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (longTasks.length === limit) {
              longTasks.shift();
              droppedLongTasks += 1;
            }
            longTasks.push({ startTimeMs: entry.startTime, durationMs: entry.duration });
          }
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        observer?.disconnect();
        observer = null;
      }
    }
    const scanLifecycleState = () => {
      const scene = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
      const routeId = `${window.location.pathname}${window.location.search}`;
      const workspaceMounted = document.querySelector(".simulator-shell") !== null;
      const suspenseVisible = Array.from(document.querySelectorAll("p")).some((paragraph) => {
        if (!paragraph.textContent?.includes("Loading simulator workspace")) return false;
        const rect = paragraph.getBoundingClientRect();
        const style = getComputedStyle(paragraph);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      });
      const current = {
        routeId,
        sceneId: scene?.getAttribute("data-scene-subject-id") ?? null,
        canvasCount: scene?.querySelectorAll("canvas").length ?? 0,
        rendererStatus: scene?.getAttribute("data-observer-renderer-status") ?? null,
        rendererGeneration: scene?.getAttribute("data-observer-renderer-generation") ?? null,
        workspaceMounted,
        suspenseVisible,
      };
      const signature = JSON.stringify(current);
      if (signature === previousState) return;
      const previous = previousState ? JSON.parse(previousState) as typeof current : null;
      const events = [];
      if (!previous) events.push("document-start-observed");
      else {
        if (previous.routeId !== current.routeId) events.push("route-changed");
        if (previous.suspenseVisible !== current.suspenseVisible && current.suspenseVisible) events.push("workspace-suspense-visible");
        if (previous.workspaceMounted !== current.workspaceMounted) events.push(current.workspaceMounted ? "workspace-dom-mounted" : "workspace-dom-removed");
        if (previous.sceneId !== current.sceneId && current.sceneId) events.push("scene-identity-observed");
        if (previous.canvasCount !== current.canvasCount) events.push(current.canvasCount > 0 ? "observer-canvas-dom-attached" : "observer-canvas-dom-absent");
        if (previous.rendererStatus !== current.rendererStatus && current.rendererStatus) events.push(`observer-status-${current.rendererStatus}`);
      }
      previousState = signature;
      for (const event of events) {
        if (lifecycleMilestones.length === limit) {
          lifecycleMilestones.shift();
          droppedLifecycleMilestones += 1;
        }
        lifecycleMilestones.push({ event, timestampMs: performance.now(), ...current });
      }
    };
    scanLifecycleState();
    const observeDocument = () => {
      if (typeof MutationObserver === "undefined" || !document.documentElement) return;
      mutationObserver = new MutationObserver(scanLifecycleState);
      mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-observer-renderer-status", "data-observer-renderer-generation", "data-scene-subject-id"],
      });
      scanLifecycleState();
    };
    if (document.documentElement) observeDocument();
    else document.addEventListener("DOMContentLoaded", observeDocument, { once: true });
    Object.defineProperty(window, "__m7nBrowserDiagnostics", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        snapshot: () => Object.freeze({
          navigation: performance.getEntriesByType("navigation").map((entry) => ({
            startTimeMs: entry.startTime,
            durationMs: entry.duration,
            domInteractiveMs: (entry as PerformanceNavigationTiming).domInteractive,
            domContentLoadedMs: (entry as PerformanceNavigationTiming).domContentLoadedEventEnd,
            loadEventEndMs: (entry as PerformanceNavigationTiming).loadEventEnd,
          })),
          longTasks: Object.freeze([...longTasks]),
          droppedLongTasks,
          longTaskObserverAvailable: observer !== null,
          lifecycleMilestones: Object.freeze([...lifecycleMilestones]),
          droppedLifecycleMilestones,
          lifecycleMutationObserverAvailable: mutationObserver !== null,
        }),
      }),
    });
  });

  return async () => {
    let observed: Record<string, unknown> | null = null;
    let snapshotRetrievalError: string | null = null;
    try {
      observed = await page.evaluate(() => {
        const typedWindow = window as Window & {
          __m7nRendererLifecycleTrace?: {
            snapshot: () => {
              droppedEventCount: number;
              events: readonly { sequence: number; surface: string; event: string; timestampMs: number }[];
            } | null;
          };
          __m7nBrowserDiagnostics?: { snapshot: () => unknown };
        };
        const scene = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
        const glass = document.querySelector<HTMLElement>('[data-testid="ground-glass-rtt"]');
        const sceneAttributes = scene ? Object.fromEntries(
          Array.from(scene.attributes)
            .filter((attribute) => attribute.name.startsWith("data-observer-") || attribute.name === "data-scene-subject-id")
            .map((attribute) => [attribute.name, attribute.value]),
        ) : null;
        const glassAttributes = glass ? Object.fromEntries(
          Array.from(glass.attributes)
            .filter((attribute) => attribute.name.startsWith("data-rtt-") || attribute.name.startsWith("data-render-") || attribute.name.startsWith("data-frame-"))
            .map((attribute) => [attribute.name, attribute.value]),
        ) : null;
        const loadingFallback = Array.from(document.querySelectorAll("p"))
          .some((paragraph) => {
            if (!paragraph.textContent?.includes("Loading simulator workspace")) return false;
            const rect = paragraph.getBoundingClientRect();
            const style = getComputedStyle(paragraph);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          });
        const applicationTrace = typedWindow.__m7nRendererLifecycleTrace?.snapshot() ?? null;
        return {
          observedAtPageMonotonicMs: performance.now(),
          route: `${window.location.pathname}${window.location.search}`,
          documentReadyState: document.readyState,
          expectedScene: "architecture-rise",
          observedScene: scene?.getAttribute("data-scene-subject-id") ?? null,
          workspaceFallbackVisible: loadingFallback,
          sceneContainerExists: scene !== null,
          observerCanvasCount: scene?.querySelectorAll("canvas").length ?? 0,
          observerAttributes: sceneAttributes,
          groundGlassAttributes: glassAttributes,
          pageNavigationAndLongTaskTiming: typedWindow.__m7nBrowserDiagnostics?.snapshot() ?? null,
          applicationTrace,
          traceUnavailable: applicationTrace === null,
          traceOverflowCount: applicationTrace?.droppedEventCount ?? null,
          lastLifecycleEvents: applicationTrace?.events.slice(-20) ?? null,
        };
      });
    } catch (error) {
      snapshotRetrievalError = error instanceof Error ? error.message : String(error);
    }

    const failureSnapshot = {
      schemaVersion: 1,
      runId,
      testIdentity: testInfo.titlePath.join(" › "),
      testOutcome: testInfo.status,
      expectedStatus: testInfo.expectedStatus,
      browserVersion: page.context().browser()?.version() ?? "unknown",
      projectName: testInfo.project.name,
      captureStartedAtNodeMonotonicMs: startedAtMs,
      captureEndedAtNodeMonotonicMs: performance.now(),
      observed,
      pageErrors,
      consoleErrors,
      failedRequests,
      relevantResources,
      droppedEventCounts: {
        pageErrors: dropped.pageErrors.count,
        consoleErrors: dropped.consoleErrors.count,
        failedRequests: dropped.failedRequests.count,
        relevantResources: dropped.resources.count,
      },
      snapshotRetrievalError,
    };
    await testInfo.attach(`m7n-${runId}-lifecycle-snapshot.json`, {
      body: JSON.stringify(failureSnapshot, null, 2),
      contentType: "application/json",
    });
  };
};
