import type { SceneDefinition } from "../../types/scene";
import geometry from "../shelfSwingGeometry";

export const shelfSwingScene: SceneDefinition = {
  id: "shelf-swing",
  name: "Shelf Swing",
  description:
    "Use front swing to rotate the vertical plane of sharp focus through three subjects arranged diagonally from front-left to back-right.",
  assets: [
    {
      id: "shelf-floor",
      kind: "model",
      source: "placeholder://shelf-floor.webp",
      textureFormat: "webp",
      loadStrategy: "eager",
    },
    {
      id: "shelf-diagonal-structure",
      kind: "model",
      source: "placeholder://shelf-structure.ktx2",
      textureFormat: "ktx2",
      loadStrategy: "eager",
    },
    {
      id: "shelf-decor",
      kind: "model",
      source: "placeholder://shelf-decor.ktx2",
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
      id: "shelf-diagonal",
      label: "Diagonal shelf coverage",
      worldBounds: {
        min: geometry.compositionTargetBounds.min,
        max: geometry.compositionTargetBounds.max,
      },
    },
  ],
};
