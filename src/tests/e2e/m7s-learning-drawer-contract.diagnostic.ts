import { test, type Page, type TestInfo } from "@playwright/test";
import { openLearningDrawer, openPinnedLearningDrawer } from "./helpers/learningOverlay";

type DrawerWorkflow = "transient" | "pinned";

const installDrawerTimeline = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    type TimelineEntry = {
      browserTimeMs: number;
      reason: string;
      drawerState: string | null;
      ariaExpanded: string | null;
      ariaHidden: string | null;
      transform: string | null;
      visibility: string | null;
      transitionDuration: string | null;
      bounds: { x: number; y: number; width: number; height: number } | null;
      focusWithin: boolean;
      documentVisibility: DocumentVisibilityState;
      propertyName: string | null;
    };
    type DiagnosticWindow = Window & {
      __m7sDrawerTimeline?: TimelineEntry[];
      __m7sRecordDrawerState?: (reason: string, propertyName?: string | null) => void;
    };

    const diagnosticWindow = window as DiagnosticWindow;
    const timeline: TimelineEntry[] = [];
    diagnosticWindow.__m7sDrawerTimeline = timeline;

    const record = (reason: string, propertyName: string | null = null) => {
      const panel = document.querySelector<HTMLElement>('[data-testid="learning-overlay-panel"]');
      const rail = panel?.querySelector<HTMLElement>(".learning-overlay-panel__rail");
      const drawer = panel?.querySelector<HTMLElement>('[data-testid="learning-overlay-drawer"]');
      const style = drawer ? getComputedStyle(drawer) : null;
      const rect = drawer?.getBoundingClientRect();
      timeline.push({
        browserTimeMs: performance.now(),
        reason,
        drawerState: panel?.dataset.drawerState ?? null,
        ariaExpanded: rail?.getAttribute("aria-expanded") ?? null,
        ariaHidden: drawer?.getAttribute("aria-hidden") ?? null,
        transform: style?.transform ?? null,
        visibility: style?.visibility ?? null,
        transitionDuration: style?.transitionDuration ?? null,
        bounds: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
        focusWithin: Boolean(panel?.contains(document.activeElement)),
        documentVisibility: document.visibilityState,
        propertyName,
      });
      if (timeline.length > 128) timeline.shift();
    };

    diagnosticWindow.__m7sRecordDrawerState = record;
    for (const eventName of ["transitionrun", "transitionstart", "transitionend", "transitioncancel"]) {
      document.addEventListener(eventName, (event) => {
        const transition = event as TransitionEvent;
        if (
          transition.target instanceof HTMLElement &&
          transition.target.matches('[data-testid="learning-overlay-drawer"]') &&
          (transition.propertyName === "transform" || transition.propertyName === "visibility")
        ) {
          record(eventName, transition.propertyName);
        }
      }, true);
    }

    const observer = new MutationObserver((records) => {
      if (records.some((entry) => ["data-drawer-state", "aria-expanded", "aria-hidden"].includes(entry.attributeName ?? ""))) {
        record("mutation-observer-callback");
      }
    });
    observer.observe(document, {
      attributes: true,
      attributeFilter: ["data-drawer-state", "aria-expanded", "aria-hidden"],
      subtree: true,
    });
  });
};

const runDiagnostic = async (
  page: Page,
  testInfo: TestInfo,
  workflow: DrawerWorkflow,
  reducedMotion = false,
): Promise<void> => {
  await installDrawerTimeline(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
  const route = workflow === "transient"
    ? "/simulator/free/architecture-foreground?rttDiagnostics=1"
    : "/simulator/guided/architecture-foreground/architecture-foreground-dof-01?rttDiagnostics=1";
  await page.goto(route);
  await page.evaluate(() =>
    (window as Window & { __m7sRecordDrawerState?: (reason: string) => void })
      .__m7sRecordDrawerState?.("post-navigation"),
  );

  const nodeStart = { wallTime: new Date().toISOString(), monotonicNs: process.hrtime.bigint().toString() };
  let outcome: "passed" | "failed" = "passed";
  let errorMessage: string | null = null;
  try {
    if (workflow === "transient") {
      await openLearningDrawer(page);
    } else {
      await openPinnedLearningDrawer(page);
    }
  } catch (error) {
    outcome = "failed";
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  const nodeSettled = { wallTime: new Date().toISOString(), monotonicNs: process.hrtime.bigint().toString() };
  const browserTimeline = await page.evaluate(() => {
    const diagnosticWindow = window as Window & {
      __m7sDrawerTimeline?: Array<{ reason: string; transitionDuration: string | null }>;
      __m7sRecordDrawerState?: (reason: string) => void;
    };
    diagnosticWindow.__m7sRecordDrawerState?.("after-helper-settled");
    return diagnosticWindow.__m7sDrawerTimeline ?? [];
  });
  if (reducedMotion) {
    const reducedMotionState = browserTimeline.at(-1);
    const durationValues = reducedMotionState?.transitionDuration
      ?.split(",")
      .map((value) => Number.parseFloat(value)) ?? [];
    const transitionEvents = browserTimeline.filter((entry) => entry.reason.startsWith("transition"));
    if (durationValues.length === 0 || durationValues.some((value) => value !== 0) || transitionEvents.length > 0) {
      outcome = "failed";
      errorMessage = "Reduced-motion open state did not settle without CSS transition events";
    }
  }
  await testInfo.attach(`m7s-drawer-${workflow}-timeline`, {
    body: Buffer.from(JSON.stringify({
      schema: "m7s-learning-drawer-timeline-v1",
      workflow,
      reducedMotion,
      route,
      outcome,
      errorMessage,
      nodeStart,
      nodeSettled,
      browserTimeline,
      clocksAligned: false,
    }, null, 2)),
    contentType: "application/json",
  });
  if (outcome === "failed") throw new Error(errorMessage ?? "Learning Drawer helper failed");
};

test("M7S diagnostic captures the transient open-state boundary", async ({ page }, testInfo) => {
  test.skip(process.env.M7S_DRAWER_CAPTURE !== "1", "Opt-in M7S evidence capture");
  test.setTimeout(120_000);
  await runDiagnostic(page, testInfo, "transient");
});

test("M7S diagnostic captures the pinned open-state boundary", async ({ page }, testInfo) => {
  test.skip(process.env.M7S_DRAWER_CAPTURE !== "1", "Opt-in M7S evidence capture");
  test.setTimeout(120_000);
  await runDiagnostic(page, testInfo, "pinned");
});

test("M7S diagnostic verifies reduced-motion open state without transition events", async ({ page }, testInfo) => {
  test.skip(process.env.M7S_DRAWER_CAPTURE !== "1", "Opt-in M7S evidence capture");
  test.setTimeout(120_000);
  await runDiagnostic(page, testInfo, "transient", true);
});
