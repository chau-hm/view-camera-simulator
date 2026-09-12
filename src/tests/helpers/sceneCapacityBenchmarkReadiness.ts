import type { GroundGlassProfilingSnapshot } from "../../render/groundGlassProfiling";

export type ProfilingProgressMarker = {
  backend: "cpu-fallback" | "gpu-query";
  progress: number;
  sessionResets: number;
};

export type FreshSnapshotCandidate<TSnapshot> = {
  snapshot: TSnapshot;
  marker: ProfilingProgressMarker | null;
};

export type QualifiedFreshSnapshot<TSnapshot> = {
  snapshot: TSnapshot;
  marker: ProfilingProgressMarker;
};

/**
 * Retain the first qualifying observation together with its marker.
 *
 * Keeping the pair from one observation prevents a later transient profiler
 * state from invalidating an already-qualified fresh timing window.
 */
export const selectQualifyingFreshSnapshot = <TSnapshot>(
  candidates: readonly FreshSnapshotCandidate<TSnapshot>[],
  qualifies: (
    candidate: FreshSnapshotCandidate<TSnapshot> & { marker: ProfilingProgressMarker },
  ) => boolean,
): QualifiedFreshSnapshot<TSnapshot> | null => {
  for (const candidate of candidates) {
    if (candidate.marker === null) continue;
    const qualifiedCandidate = candidate as FreshSnapshotCandidate<TSnapshot> & {
      marker: ProfilingProgressMarker;
    };
    if (qualifies(qualifiedCandidate)) return qualifiedCandidate;
  }
  return null;
};

export type GroundGlassProfilingReadiness =
  | "retryable"
  | "healthy"
  | "fatal"
  | "unavailable";

export const classifyGroundGlassProfilingReadiness = (
  snapshot: GroundGlassProfilingSnapshot | null,
): GroundGlassProfilingReadiness => {
  if (!snapshot) return "unavailable";
  if (snapshot.profilingBackend === "cpu-fallback") return "healthy";
  if (snapshot.profilingBackend !== "gpu-query") return "unavailable";

  switch (snapshot.profilingDiagnostics.gpuQueryState) {
    case "active":
      return "healthy";
    case "detected":
    case "stalled":
      return "retryable";
    case "disjoint":
    case "error":
      return "fatal";
    default:
      return "unavailable";
  }
};

export const profilingProgressForSnapshot = (
  snapshot: GroundGlassProfilingSnapshot | null,
): number | null => {
  if (classifyGroundGlassProfilingReadiness(snapshot) !== "healthy" || !snapshot) return null;
  if (snapshot.profilingBackend === "cpu-fallback") {
    return snapshot.profilingDiagnostics.framesAccepted;
  }
  if (snapshot.profilingBackend === "gpu-query") {
    return snapshot.profilingDiagnostics.framesCompletedGpu;
  }
  return null;
};
