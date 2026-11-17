// Canonical millimetre geometry for the Still-Life Studio. The optical axis
// leaves the lens datum (0, 0, 0) along +Z, with Y up.

import type { Bounds3 } from "../types/optics";
import type { CameraPlacement, FocusTarget } from "../types/scene";

export const stillLifeStudioTable = {
  centerMm: { x: 0, y: -40, z: 4100 },
  sizeMm: { width: 3000, height: 80, depth: 3400 },
  topYmm: 0,
  boundsXZMm: {
    min: { x: -1500, z: 2400 },
    max: { x: 1500, z: 5800 },
  },
} as const;

export const stillLifeStudioBackdrop = {
  centerMm: { x: 0, y: 562.5, z: 6200 },
  sizeMm: { width: 3600, height: 2775, depth: 100 },
  nearSurfaceZmm: 6150,
} as const;

export const stillLifeStudioFloor = {
  centerMm: { x: 0, y: -850, z: 4100 },
  sizeMm: { width: 7000, height: 50, depth: 8000 },
} as const;

export const stillLifeStudioFocusReferences = [
  { id: "still-life-near", label: "Near tabletop reference", x: -1120, z: 3000 },
  { id: "still-life-middle", label: "Middle tabletop reference", x: 1120, z: 4150 },
  { id: "still-life-far", label: "Far tabletop reference", x: -1120, z: 5300 },
] as const;

export const stillLifeStudioFocusTileHalfSizeMm = 95;
const focusTileTopYmm = 16;
const focusSampleOffsetMm = 48;

/** Fixed surface samples on three rendered tabletop reference tiles. */
export const stillLifeStudioFocusTargets: FocusTarget[] =
  stillLifeStudioFocusReferences.map((reference) => {
    const worldPosition = {
      x: reference.x,
      y: focusTileTopYmm,
      z: reference.z,
    };
    return {
      id: reference.id,
      label: reference.label,
      worldPosition,
      sampleWorldPositions: [
        worldPosition,
        { ...worldPosition, x: reference.x - focusSampleOffsetMm },
        { ...worldPosition, x: reference.x + focusSampleOffsetMm },
        { ...worldPosition, z: reference.z - focusSampleOffsetMm },
        { ...worldPosition, z: reference.z + focusSampleOffsetMm },
      ],
      weight: 1,
    };
  });

export const stillLifeStudioDepthRegions = [
  { id: "near", minZmm: 2800, maxZmm: 3650 },
  { id: "middle", minZmm: 3650, maxZmm: 4550 },
  { id: "far", minZmm: 4550, maxZmm: 5550 },
] as const;

export const stillLifeStudioSceneBounds: Bounds3 = {
  min: { x: -3550, y: -900, z: 100 },
  max: { x: 3550, y: 2050, z: 8120 },
};

export const stillLifeStudioCameraPlacement: CameraPlacement = {
  position: { x: -2600, y: 1700, z: 300 },
  target: { x: 0, y: 400, z: 4100 },
};

export const stillLifeStudioCompositionBounds: Bounds3 = {
  min: { x: -1500, y: 0, z: 2800 },
  max: { x: 1500, y: 800, z: 5550 },
};

export default {
  stillLifeStudioTable,
  stillLifeStudioBackdrop,
  stillLifeStudioFloor,
  stillLifeStudioFocusReferences,
  stillLifeStudioFocusTargets,
  stillLifeStudioDepthRegions,
  stillLifeStudioSceneBounds,
  stillLifeStudioCameraPlacement,
  stillLifeStudioCompositionBounds,
};
