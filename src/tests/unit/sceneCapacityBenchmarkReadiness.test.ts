import { describe, expect, it } from "vitest";
import type {
  GroundGlassProfilingBackend,
  GroundGlassProfilingSnapshot,
  GroundGlassGpuQueryState,
} from "../../render/groundGlassProfiling";
import {
  classifyGroundGlassProfilingReadiness,
  profilingProgressForSnapshot,
  selectQualifyingFreshSnapshot,
  type ProfilingProgressMarker,
} from "../helpers/sceneCapacityBenchmarkReadiness";

const makeSnapshot = (
  profilingBackend: GroundGlassProfilingBackend,
  gpuQueryState: GroundGlassGpuQueryState,
  framesAccepted = 0,
  framesCompletedGpu = 0,
): GroundGlassProfilingSnapshot => ({
  profilingBackend,
  profilingDiagnostics: {
    gpuQueryState,
    framesAttempted: framesAccepted,
    framesAccepted,
    framesRejectedCapacity: 0,
    framesInvalidated: 0,
    framesCompletedGpu,
    queriesBegun: 0,
    queriesBeginFailed: 0,
    queriesEnded: 0,
    queriesEndFailed: 0,
    queriesPolled: 0,
    queriesCompleted: 0,
    queriesUnavailable: 0,
    disjointEvents: 0,
    queriesDiscardedDisjoint: 0,
    queriesDroppedOwnership: 0,
    pendingQueries: 0,
    queryPoolSize: 24,
    availableQuerySlots: 24,
    pendingFrames: 0,
    sessionResets: 1,
    lastResetReason: null,
    lastRejectedReason: null,
    lastGpuQueryError: null,
  },
} as unknown as GroundGlassProfilingSnapshot);

describe("scene capacity benchmark profiling readiness", () => {
  it.each(["detected", "stalled"] as const)("treats GPU state %s as retryable", (state) => {
    const snapshot = makeSnapshot("gpu-query", state);

    expect(classifyGroundGlassProfilingReadiness(snapshot)).toBe("retryable");
    expect(profilingProgressForSnapshot(snapshot)).toBeNull();
  });

  it("accepts active GPU progress", () => {
    const snapshot = makeSnapshot("gpu-query", "active", 20, 17);

    expect(classifyGroundGlassProfilingReadiness(snapshot)).toBe("healthy");
    expect(profilingProgressForSnapshot(snapshot)).toBe(17);
  });

  it.each(["disjoint", "error"] as const)("treats GPU state %s as fatal", (state) => {
    const snapshot = makeSnapshot("gpu-query", state);

    expect(classifyGroundGlassProfilingReadiness(snapshot)).toBe("fatal");
    expect(profilingProgressForSnapshot(snapshot)).toBeNull();
  });

  it("accepts CPU fallback progress", () => {
    const snapshot = makeSnapshot("cpu-fallback", "unavailable", 23, 0);

    expect(classifyGroundGlassProfilingReadiness(snapshot)).toBe("healthy");
    expect(profilingProgressForSnapshot(snapshot)).toBe(23);
  });

  it("retains the qualifying snapshot when the next observation stalls", () => {
    const qualifyingSnapshot = { id: "qualifying" };
    const stalledSnapshot = { id: "stalled" };
    const qualifyingMarker: ProfilingProgressMarker = {
      backend: "gpu-query",
      progress: 60,
      sessionResets: 1,
    };

    const result = selectQualifyingFreshSnapshot(
      [
        { snapshot: qualifyingSnapshot, marker: qualifyingMarker },
        { snapshot: stalledSnapshot, marker: null },
      ],
      ({ snapshot, marker }) => snapshot.id === "qualifying" && marker.progress >= 60,
    );

    expect(result).toEqual({ snapshot: qualifyingSnapshot, marker: qualifyingMarker });
  });

  it("skips stalled and incomplete observations until a complete fresh window qualifies", () => {
    const stalledSnapshot = { id: "stalled" };
    const incompleteSnapshot = { id: "incomplete" };
    const qualifyingSnapshot = { id: "qualifying" };
    const marker = (progress: number): ProfilingProgressMarker => ({
      backend: "gpu-query",
      progress,
      sessionResets: 1,
    });

    const result = selectQualifyingFreshSnapshot(
      [
        { snapshot: stalledSnapshot, marker: null },
        { snapshot: incompleteSnapshot, marker: marker(40) },
        { snapshot: qualifyingSnapshot, marker: marker(60) },
      ],
      ({ snapshot, marker: candidateMarker }) =>
        snapshot.id === "qualifying" && candidateMarker.progress >= 60,
    );

    expect(result?.snapshot).toBe(qualifyingSnapshot);
    expect(result?.marker.progress).toBe(60);
  });
});
