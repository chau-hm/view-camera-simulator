import type { SceneDefinition } from "../../types/scene";
import geometry from "../obliqueArchitectureGeometry";

export const obliqueArchitectureScene: SceneDefinition = {
  id: "oblique-architecture",
  name: "Oblique Architecture — Static Problem",
  description: "See the architectural framing and depth-of-focus problem before any movement is applied.",
  assets: [
    {
      id: "oblique-architecture-ground",
      kind: "model",
      source: "placeholder://oblique-architecture-ground.webp",
      textureFormat: "webp",
      loadStrategy: "eager",
    },
    {
      id: "oblique-architecture-building",
      kind: "model",
      source: "placeholder://oblique-architecture-building.ktx2",
      textureFormat: "ktx2",
      loadStrategy: "eager",
    },
  ],
  cameraPreset: {
    focusDistanceMm: geometry.canonicalFocusDistanceMm,
    aperture: 5.6,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearTiltDeg: 0,
  },
  finiteFocusStrategy: {
    kind: "rear-standard-thin-lens",
    lensDatum: "baseline-origin",
    focusDistanceReference: "lens-to-focus-plane",
  },
  cameraPlacement: {
    position: { x: -6200, y: 3200, z: -5200 },
    target: { x: 1800, y: 1000, z: 9000 },
  },
  bounds: geometry.sceneBounds,
  focusTargets: geometry.focusTargets,
  compositionTargets: [
    {
      id: "building-top",
      label: "Building top",
      worldBounds: geometry.compositionTargets.buildingTop,
    },
    {
      id: "target-facade",
      label: "Target façade",
      worldBounds: geometry.compositionTargets.targetFacade,
    },
  ],
  // PR 6A is a stable before-state. Later slices will deliberately relax this
  // policy when Rise, Swing, and the compound task become public.
  cameraControlPolicy: {
    movement: "fixed",
    focusDistance: "fixed",
    aperture: "fixed",
    infinityReset: false,
  },
};
