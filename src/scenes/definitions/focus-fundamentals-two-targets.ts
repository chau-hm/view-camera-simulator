import type { SceneDefinition } from "../../types/scene";

export const focusFundamentalsTwoTargets: SceneDefinition = {
  id: "focus-fundamentals-two-targets",
  name: "Focus Fundamentals — Two Targets",
  description:
    "Isolated scene to validate thin-lens focusing, ground-glass projection, and DOF before any front-standard movements are enabled.",
  assets: [],
  cameraPreset: {
    focusDistanceMm: 2000,
    aperture: 11,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
  },
  cameraPlacement: {
    // observer camera placed behind the lens looking forward along +Z
    position: { x: 0, y: 0, z: -800 },
    target: { x: 0, y: 0, z: 2000 },
  },
  bounds: {
    min: { x: -2000, y: -1000, z: 200 },
    max: { x: 2000, y: 2000, z: 12000 },
  },
  focusTargets: [
    {
      id: "near-target",
      label: "Near target",
      worldPosition: { x: -200, y: 0, z: 1000 },
      weight: 1,
    },
    {
      id: "far-target",
      label: "Far target",
      worldPosition: { x: 200, y: 0, z: 3000 },
      weight: 1,
    },
  ],
  compositionTargets: [],
};
