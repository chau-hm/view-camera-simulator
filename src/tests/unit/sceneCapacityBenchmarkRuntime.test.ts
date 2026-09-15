import { describe, expect, it } from "vitest";
import type { SceneCapacitySnapshot } from "../../render/sceneCapacityProfiling";
import {
  runtimeFromMeasurement,
  type MeasurementStateEvidence,
} from "../helpers/sceneCapacityBenchmarkRuntime";

const makeSnapshot = (): SceneCapacitySnapshot => ({
  groundGlass: {
    internalResolution: [640, 480],
    gatherResolution: [320, 240],
    profilingBackend: "gpu-query",
  },
} as unknown as SceneCapacitySnapshot);

describe("scene capacity benchmark runtime metadata", () => {
  it.each([
    {
      name: "normal dev measurement",
      evidence: { finalContentful: true, inspectionWindowActive: false },
    },
    {
      name: "Focus Loupe measurement",
      evidence: { finalContentful: true, inspectionWindowActive: true },
    },
    {
      name: "production-preview measurement",
      evidence: { finalContentful: null, inspectionWindowActive: false },
    },
  ] satisfies Array<{ name: string; evidence: MeasurementStateEvidence }>) (
    "$name derives runtime metadata from the qualifying measurement",
    ({ evidence }) => {
      expect(runtimeFromMeasurement(makeSnapshot(), evidence)).toEqual({
        finalContentful: evidence.finalContentful,
        internalResolution: [640, 480],
        gatherResolution: [320, 240],
        profilingBackend: "gpu-query",
        inspectionWindowActive: evidence.inspectionWindowActive,
      });
    },
  );
});
