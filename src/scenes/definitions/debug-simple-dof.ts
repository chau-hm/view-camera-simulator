import type { SceneDefinition } from "../../types/scene";

export const debugSimpleDofScene: SceneDefinition = {
  id: "debug-simple-dof",
  name: "Debug: Simple DOF",
  description: "Minimal scene with a near box and a far sphere to test ground-glass DOF.",
  assets: [],
  cameraPreset: {
    focusDistanceMm: 2000,
    aperture: 5.6,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
  },
  // place the observer camera and targets at y=0 so scene objects align with optics lens center
  cameraPlacement: {
    position: { x: 0, y: 0, z: -800 },
    target: { x: 0, y: 0, z: 2200 },
  },
  bounds: {
    min: { x: -1000, y: -200, z: 200 },
    max: { x: 1000, y: 1200, z: 12000 },
  },
  focusTargets: [
    {
      id: "near-box",
      label: "Near box",
      // set Y to 0 to sit at lens center height
      worldPosition: { x: -300, y: 0, z: 1400 },
      weight: 1,
    },
    {
      id: "far-sphere",
      label: "Far sphere",
      worldPosition: { x: 300, y: 0, z: 4000 },
      weight: 1,
    },
  ],
  compositionTargets: [],
};
