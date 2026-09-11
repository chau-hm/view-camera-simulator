import { describe, expect, it } from "vitest";
import type {
  GroundGlassProfilingBackend,
  GroundGlassProfilingSnapshot,
  GroundGlassGpuQueryState,
} from "../../render/groundGlassProfiling";
import {
  classifyGroundGlassProfilingReadiness,
  profilingProgressForSnapshot,
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
});
