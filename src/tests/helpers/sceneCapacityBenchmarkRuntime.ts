import type { SceneCapacitySnapshot } from "../../render/sceneCapacityProfiling";

export type MeasurementStateEvidence = {
  finalContentful: boolean | null;
  inspectionWindowActive: boolean;
};

export type BenchmarkRuntimeMetadata = {
  finalContentful: boolean | null;
  internalResolution: [number, number] | null;
  gatherResolution: [number, number] | null;
  profilingBackend: string | null;
  inspectionWindowActive: boolean | null;
};

export const runtimeFromMeasurement = (
  snapshot: SceneCapacitySnapshot,
  evidence: MeasurementStateEvidence,
): BenchmarkRuntimeMetadata => {
  const groundGlass = snapshot.groundGlass;
  return {
    finalContentful: evidence.finalContentful,
    internalResolution: groundGlass?.internalResolution ?? null,
    gatherResolution: groundGlass?.gatherResolution ?? null,
    profilingBackend: groundGlass?.profilingBackend ?? null,
    inspectionWindowActive: evidence.inspectionWindowActive,
  };
};
