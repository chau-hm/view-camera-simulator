import { describe, expect, it } from "vitest";
import {
  createRendererLifecycleTraceCollector,
  createRendererLifecycleTraceRuntime,
  shouldEnableRendererLifecycleTrace,
} from "../../render/testing/m7nRendererLifecycleTrace";

describe("M7N renderer lifecycle trace", () => {
  it("assigns ordered sequence numbers and nondecreasing monotonic timestamps", () => {
    const times = [12, 9, 14];
    const trace = createRendererLifecycleTraceCollector({
      now: () => times.shift() ?? 14,
      timeOriginMs: 1_700_000_000_000,
      pageId: "page-a",
    });

    trace.record({ surface: "route", event: "navigation-observed" });
    trace.record({ surface: "simulator", event: "workspace-committed" });
    trace.record({ surface: "observer", event: "renderer-created" });

    const snapshot = trace.snapshot();
    expect(snapshot.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(snapshot.events.map((event) => event.timestampMs)).toEqual([12, 12, 14]);
    expect(snapshot.events.every((event) => Number.isFinite(event.timeOriginMs))).toBe(true);
  });

  it("bounds event storage and reports every dropped event", () => {
    const trace = createRendererLifecycleTraceCollector({
      capacity: 3,
      now: (() => {
        let value = 0;
        return () => ++value;
      })(),
      pageId: "bounded-page",
      timeOriginMs: 10,
    });
    for (let index = 0; index < 7; index += 1) {
      trace.record({ surface: "observer", event: `event-${index}` });
    }

    expect(trace.snapshot()).toMatchObject({
      capacity: 3,
      droppedEventCount: 4,
      events: [
        { sequence: 5, event: "event-4" },
        { sequence: 6, event: "event-5" },
        { sequence: 7, event: "event-6" },
      ],
    });
  });

  it("preserves route, scene, viewport, and renderer generation identity", () => {
    const trace = createRendererLifecycleTraceCollector({
      now: () => 1,
      timeOriginMs: 2,
      pageId: "identity-page",
    });
    trace.record({
      surface: "observer",
      event: "stale-capability-callback-rejected",
      routeId: "/simulator/free/architecture-rise",
      sceneId: "architecture-rise",
      mountGeneration: "viewport-a-3",
      rendererGeneration: 3,
      status: "rejected-stale",
      detail: { activeGeneration: 4 },
    });
    trace.record({
      surface: "ground-glass",
      event: "current-frame-published",
      sceneId: "architecture-rise",
      mountGeneration: "gg-host-a",
      rendererGeneration: "gg:5",
      status: "published",
    });

    const [observer, groundGlass] = trace.snapshot().events;
    expect(observer).toMatchObject({
      pageId: "identity-page",
      routeId: "/simulator/free/architecture-rise",
      sceneId: "architecture-rise",
      mountGeneration: "viewport-a-3",
      rendererGeneration: 3,
      status: "rejected-stale",
    });
    expect(groundGlass).toMatchObject({
      surface: "ground-glass",
      mountGeneration: "gg-host-a",
      rendererGeneration: "gg:5",
    });
    expect(groundGlass?.rendererGeneration).not.toBe(observer?.rendererGeneration);
  });

  it("freezes snapshots and drops non-scalar detail instead of serializing runtime objects", () => {
    const trace = createRendererLifecycleTraceCollector({ now: () => 2, timeOriginMs: 4 });
    trace.record({
      surface: "scene",
      event: "asset-configured",
      detail: {
        selectedCount: 2,
        nonFinite: Number.NaN,
        runtimeObject: { texture: true } as unknown as null,
      },
    });
    const snapshot = trace.snapshot();
    expect(snapshot.events[0]?.detail).toEqual({ selectedCount: 2 });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.events)).toBe(true);
    expect(Object.isFrozen(snapshot.events[0])).toBe(true);
    expect(Object.isFrozen(snapshot.events[0]?.detail)).toBe(true);
  });

  it("does not create an event buffer when the explicit development gate is closed", () => {
    let factoryCalls = 0;
    const disabled = createRendererLifecycleTraceRuntime(false, () => {
      factoryCalls += 1;
      return createRendererLifecycleTraceCollector();
    });
    expect(disabled.isInitialized()).toBe(false);
    expect(disabled.record({ surface: "observer", event: "must-not-record" })).toBeNull();
    expect(disabled.snapshot()).toBeNull();
    expect(disabled.isInitialized()).toBe(false);
    expect(factoryCalls).toBe(0);
  });

  it("requires both a development build and the explicit M7N opt-in", () => {
    expect(shouldEnableRendererLifecycleTrace(true, "true")).toBe(true);
    expect(shouldEnableRendererLifecycleTrace(false, "true")).toBe(false);
    expect(shouldEnableRendererLifecycleTrace(true, "false")).toBe(false);
    expect(shouldEnableRendererLifecycleTrace(true, undefined)).toBe(false);
  });

  it("keeps a missing Canvas observation distinct from renderer activation", () => {
    const trace = createRendererLifecycleTraceCollector({ now: () => 1, timeOriginMs: 0 });
    trace.record({
      surface: "observer",
      event: "canvas-dom-absent-at-observation",
      sceneId: "architecture-rise",
      rendererGeneration: 0,
      status: "absent",
    });

    const events = trace.snapshot().events;
    expect(events.map((event) => event.event)).toEqual(["canvas-dom-absent-at-observation"]);
    expect(events.some((event) => event.event === "observer-capabilities-published")).toBe(false);
  });

  it("does not add a readiness event or retry for an unobserved transition", () => {
    const trace = createRendererLifecycleTraceCollector({ now: () => 1, timeOriginMs: 0 });
    trace.record({ surface: "route", event: "simulator-route-component-committed" });
    trace.record({ surface: "simulator", event: "simulator-workspace-committed" });
    const events = trace.snapshot().events;

    expect(events.map((event) => event.event)).toEqual([
      "simulator-route-component-committed",
      "simulator-workspace-committed",
    ]);
    expect(events.some((event) => event.event.includes("renderer-active"))).toBe(false);
    expect(events.some((event) => event.event.includes("retry"))).toBe(false);
  });
});
