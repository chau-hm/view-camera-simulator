import type { SceneDefinition } from "../../types/scene";
import geometry from "../tableTiltGeometry";

export const tableTiltScene: SceneDefinition = {
  id: "table-tilt",
  name: "Table Tilt",
  description: "Use front tilt to align the plane of sharp focus with three coplanar focus cards above the tabletop.",
  assets: [
    {
      id: "table-floor",
      kind: "model",
      source: "placeholder://table-floor.webp",
      textureFormat: "webp",
      loadStrategy: "eager",
    },
    {
      id: "table-top",
      kind: "model",
      source: "placeholder://table-top.ktx2",
      textureFormat: "ktx2",
      loadStrategy: "eager",
    },
    {
      id: "table-props",
      kind: "model",
      source: "placeholder://table-props.ktx2",
      textureFormat: "ktx2",
      loadStrategy: "lazy",
    },
  ],
  cameraPreset: {
    focusDistanceMm: geometry.canonicalFocusDistanceMm,
   aperture: 11,
   frontRiseMm: 0,
   frontTiltDeg: 0,
   frontSwingDeg: 0,
    rearRiseMm: 0,
    rearTiltDeg: 0,
 },
  cameraPlacement: {
    position: geometry.observerCamera.position,
    target: geometry.observerCamera.target,
  },
  bounds: {
    min: geometry.sceneBounds.min,
    max: geometry.sceneBounds.max,
  },
  focusTargets: geometry.focusTargets,
  compositionTargets: [
    {
      id: "table-surface",
      label: "Table surface alignment",
      worldBounds: {
        min: geometry.compositionTargetBounds.min,
        max: geometry.compositionTargetBounds.max,
      },
    },
  ],
};
