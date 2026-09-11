import type { GroundGlassProfilingSnapshot } from "../../render/groundGlassProfiling";

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
