import { describe, expect, it } from "vitest";
import type { SceneCapacitySnapshot, SceneGraphCapacityMetrics } from "../../render/sceneCapacityProfiling";
import { isDreamLoopSubjectCaptureReady } from "../helpers/dreamLoopCaptureReadiness";

const validSubjectMetrics: SceneGraphCapacityMetrics = {
  objectCount: 4,
  meshCount: 2,
  renderableMeshCount: 2,
  instancedMeshCount: 0,
  lightCount: 0,
  lineCount: 0,
  pointsCount: 0,
  uniqueGeometryCount: 2,
  uniqueMaterialCount: 2,
  uniqueTextureCount: 0,
  triangleCount: 48,
  instancedTriangleCount: 0,
  effectiveTriangleCount: 48,
  renderableEffectiveTriangleCount: 48,
};

const snapshot = (
  viewportSubject: SceneGraphCapacityMetrics | null,
  sceneId = "architecture-rise",
): Pick<SceneCapacitySnapshot, "sceneId" | "viewportSubject"> => ({
  sceneId,
  viewportSubject,
});

describe("Dream Loop mounted-subject capture readiness", () => {
  it("does not treat registered scene identity alone as mounted-subject evidence", () => {
    expect(isDreamLoopSubjectCaptureReady(snapshot(null), "architecture-rise")).toBe(false);
  });

  it.each([
    ["empty mounted root", { ...validSubjectMetrics, objectCount: 0 }],
    ["no meshes", { ...validSubjectMetrics, meshCount: 0 }],
    ["no source triangles", { ...validSubjectMetrics, effectiveTriangleCount: 0 }],
    ["no visible renderable meshes", { ...validSubjectMetrics, renderableMeshCount: 0 }],
    ["no visible renderable triangles", { ...validSubjectMetrics, renderableEffectiveTriangleCount: 0 }],
  ])("rejects %s", (_label, metrics) => {
    expect(isDreamLoopSubjectCaptureReady(snapshot(metrics), "architecture-rise")).toBe(false);
  });

  it("rejects capacity evidence for a different active scene", () => {
    expect(isDreamLoopSubjectCaptureReady(snapshot(validSubjectMetrics, "other-scene"), "architecture-rise")).toBe(false);
  });

  it("accepts finite, renderable metrics from the selected scene's subject root", () => {
    expect(isDreamLoopSubjectCaptureReady(snapshot(validSubjectMetrics), "architecture-rise")).toBe(true);
  });
});
