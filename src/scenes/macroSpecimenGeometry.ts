import type { FocusTarget } from "../types/scene";

/** Data-only physical subject contract shared by viewport, RTT, and scene focus targets. */
export const MACRO_SPECIMEN = {
  faceCenterMm: { x: 0, y: 0, z: 300 },
  diameterMm: 90,
  thicknessMm: 2,
  reliefDepthMm: 0.6,
} as const;

export const MACRO_SPECIMEN_RADIAL_DOT_ORBIT_RADIUS_MM = 32.5;
export const MACRO_SPECIMEN_RADIAL_DOT_RADIUS_MM = 0.48;

export const macroSpecimenBoundsMm = {
  min: { x: -45, y: -45, z: 299.4 },
  max: { x: 45, y: 45, z: 302 },
};

export const macroBellowsExtensionFocusTargets: FocusTarget[] = [
  {
    id: "specimen-coin",
    label: "Specimen coin",
    worldPosition: { x: 0, y: 0, z: 299.5 },
    sampleWorldPositions: [
      { x: 0, y: 0, z: 299.5 },
      { x: 0, y: -23, z: 299.88 },
      { x: 0, y: 44.4, z: 299.4 },
      {
        x: MACRO_SPECIMEN_RADIAL_DOT_ORBIT_RADIUS_MM,
        y: 0,
        z: MACRO_SPECIMEN.faceCenterMm.z - MACRO_SPECIMEN_RADIAL_DOT_RADIUS_MM,
      },
    ],
    weight: 1,
  },
];

export const macroBellowsExtensionCameraPlacement = {
  position: { x: 650, y: 380, z: 650 },
  target: { x: 0, y: -25, z: 0 },
};

/** Includes specimen, standards, and rail throughout the assigned extension range. */
export const macroBellowsExtensionSceneBoundsMm = {
  min: { x: -180, y: -220, z: -380 },
  max: { x: 180, y: 180, z: 320 },
};
