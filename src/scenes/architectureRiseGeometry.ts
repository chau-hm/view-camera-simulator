// Canonical geometry for Architecture Rise scene (millimetres)
// Define unambiguous coordinate anchors so everything (subject, targets, bounds)
// derives from the same canonical values.

export type ArchitectureGroundGeometry = {
  y: number;
  nearZ: number;
  farZ: number;
  width: number;
  depth: number;
  centerZ: number;
};

const groundNearZ = -2000;
const groundFarZ = 13000;

export const ground: ArchitectureGroundGeometry = {
  y: -1200,
  nearZ: groundNearZ,
  farZ: groundFarZ,
  width: 16000,
  depth: groundFarZ - groundNearZ,
  centerZ: (groundNearZ + groundFarZ) / 2,
};

export const building = {
  // centre.x and z chosen so building sits forward in scene; centre.y computed below
  center: { x: 0, y: 0, z: 9500 },
  width: 2800,
  // main body height (mm) chosen so mainBodyTopY ~= +3000 relative to datum when ground.y = -1200
  height: 4200,
  // parapet/top block height (mm)
  topHeight: 650,
  depth: 1200,
  facadeVerticalDivisionCount: 6,
  facadeHorizontalDivisionCount: 6,
};

// place building so its bottom sits on canonical ground.y
building.center.y = ground.y + building.height / 2;

export const facade = {
  // the main body extents in world mm
  mainBodyBottomY: building.center.y - building.height / 2,
  mainBodyTopY: building.center.y + building.height / 2,
  // parapet extents (filled below)
  parapetBottomY: 0,
  parapetTopY: 0,
  // facade Z extents (front = nearer to camera)
  frontFacadeZ: building.center.z - building.depth / 2,
  backFacadeZ: building.center.z + building.depth / 2,
};

facade.parapetBottomY = facade.mainBodyTopY;
facade.parapetTopY = facade.parapetBottomY + building.topHeight;


export const compositionTargets = {
  buildingTop: {
    // region around roofline — expressed in world mm
    min: { x: -900, y: facade.parapetBottomY - 80, z: facade.frontFacadeZ - 400 },
    max: { x: 900, y: facade.parapetTopY + 80, z: facade.backFacadeZ + 400 },
  },
  buildingMain: {
    // focus main-body on a central lower-to-middle band to satisfy coverage at rise
    min: { x: -1400, y: facade.mainBodyBottomY + 200, z: facade.frontFacadeZ - 600 },
    max: { x: 1400, y: facade.mainBodyTopY - 400, z: facade.backFacadeZ + 1400 },
  },
};

export const focusTarget = {
  // place the focus target slightly in front of the façade to avoid z-fighting
  worldPosition: { x: 0, y: building.center.y, z: facade.frontFacadeZ - 10 },
};

// Reference objects to aid depth reading in Ground Glass: placed in front/side/far positions
// Units are millimetres and positions are in world coordinates.
export type ReferenceObjectDef = {
  id: string;
  role?: "foreground" | "midground" | "near-façade" | "side" | "far";
  x: number; // world X(mm)
  z: number; // world Z(mm)
  width: number; // mm
  depth: number; // mm
  height: number; // mm
  color?: string;
  // simple front-face detail pattern to aid blur perception
  detail?: "none" | "vertical-stripes" | "horizontal-bands" | "checker";
};

// Repositioned reference objects to create clear camera -> near -> mid -> building depth separation.
export const referenceObjects: ReferenceObjectDef[] = [
  // A: foreground-near — move back from extreme close so it's fully visible
  {
    id: "plinth-foreground-left",
    role: "foreground",
    x: -520,
    z: 3200, // foreground near camera but not clipped
    width: 220,
    depth: 220,
    height: 220,
    color: "#9aa6b2",
    detail: "vertical-stripes",
  },
  // B: foreground-mid / midground
  {
    id: "plinth-mid-right",
    role: "midground",
    x: 760,
    z: 5200, // mid distance
    width: 380,
    depth: 300,
    height: 300,
    color: "#8f98a3",
    detail: "checker",
  },
  // C: façade-near — move out from building edge so it's mostly visible
  {
    id: "plinth-near-facade-left",
    role: "near-façade",
    x: - (building.width / 2) - 420,
    z: facade.frontFacadeZ + 80,
    width: 260,
    depth: 240,
    height: 360,
    color: "#a3adb7",
    detail: "horizontal-bands",
  },
  // D: far-side — bring within bounds, subtle size
  {
    id: "plinth-far-right",
    role: "far",
    x: building.width / 2 + 400,
    z: facade.backFacadeZ + 500,
    width: 300,
    depth: 300,
    height: 200,
    color: "#b0bcc6",
    detail: "none",
  },
];

// recompute scene bounds to include reference objects extents and ensure no geometry falls outside
const padding = 300; // mm padding around extents
let minX = -building.width / 2 - 200;
let maxX = building.width / 2 + 200;
let minY = ground.y - 200;
let maxY = facade.parapetTopY + 400;
let minZ = ground.nearZ + 200;
let maxZ = Math.max(building.center.z + 2000, ground.farZ);

referenceObjects.forEach((r) => {
  const halfW = r.width / 2;
  const halfD = r.depth / 2;
  minX = Math.min(minX, r.x - halfW - padding);
  maxX = Math.max(maxX, r.x + halfW + padding);
  minY = Math.min(minY, ground.y - padding);
  maxY = Math.max(maxY, ground.y + r.height + padding);
  minZ = Math.min(minZ, r.z - halfD - padding);
  maxZ = Math.max(maxZ, r.z + halfD + padding);
});

export const sceneBounds = {
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ },
};

// canonical façade focus distance measured from lens centre (0,0,0) to focus target along +Z
export const architectureFacadeFocusDistanceMm = focusTarget.worldPosition.z;

// Façade detail canonical thickness & sizes (mm). Details are thin panels placed immediately in front of the front façade.
export const facadeDetailThicknessMm = 20; // 10-30 recommended
export const facadeDetailSmallGapMm = 2; // small gap to avoid z-fighting
export const mullionWidthMm = 40;
export const horizontalStripeHeightMm = 12;

// Focus chart canonical size and grid
export const focusChartSizeMm = 750; // ~700-800mm
export const focusChartCells = 8; // 6 or 8 recommended

// Canonical focus chart definition: explicit semantic fields and helpers
export const focusChart = {
  // physical task/focus target (world point used by tasks and optics)
  targetWorldPosition: {
    x: focusTarget.worldPosition.x,
    y: focusTarget.worldPosition.y,
    z: focusTarget.worldPosition.z,
  },
  // checkerboard surface centre (slightly in front of the façade detail)
  surfaceCenterWorld: {
    x: focusTarget.worldPosition.x,
    y: focusTarget.worldPosition.y,
    z: facade.frontFacadeZ - facadeDetailThicknessMm / 2 - facadeDetailSmallGapMm - 2,
  },
  // marker centre (red crosshair) placed a tiny amount in front of the surface to avoid z-fighting
  markerCenterWorld: {
    x: focusTarget.worldPosition.x,
    y: focusTarget.worldPosition.y,
    // marker placed in front of surface by markerOffsetMm (see markerOffsetMm below)
    z: (facade.frontFacadeZ - facadeDetailThicknessMm / 2 - facadeDetailSmallGapMm - 2) - 3,
  },
  // size and grid
  sizeMm: focusChartSizeMm,
  cells: focusChartCells,
  cellDepthMm: 2,
  // crosshair dimensions
  // increase crosshair physical size so it remains visible at typical camera distances
  crosshairLengthMm: 180,
  crosshairThicknessMm: 16,
  crosshairDepthMm: 3,
  // small marker offset from surface (mm)
  markerOffsetMm: 3,
} as const;

// Pure helpers to produce absolute world-space geometry definitions for the focus chart
export type ArchitectureFocusChartCell = {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  dark: boolean;
};

export type ArchitectureFocusChartBar = {
  id: "horizontal" | "vertical";
  x: number; // centre x
  y: number; // centre y
  z: number; // centre z
  width: number;
  height: number;
  depth: number;
};

export function getArchitectureFocusChartCells(): ArchitectureFocusChartCell[] {
  const cells: ArchitectureFocusChartCell[] = [];
  const patchSize = focusChart.sizeMm;
  const count = focusChart.cells;
  const cellSize = patchSize / count;
  const center = focusChart.surfaceCenterWorld;
  const half = patchSize / 2;
  let id = 0;
  for (let ix = 0; ix < count; ix++) {
    for (let iy = 0; iy < count; iy++) {
      const localX = -half + ix * cellSize + cellSize / 2;
      const localY = -half + iy * cellSize + cellSize / 2;
      const x = center.x + localX;
      const y = center.y + localY;
      const z = center.z;
      const dark = (ix + iy) % 2 === 0;
      cells.push({
        id: `cell-${id++}`,
        x,
        y,
        z,
        width: cellSize,
        height: cellSize,
        depth: focusChart.cellDepthMm,
        dark,
      });
    }
  }
  return cells;
}

export function getArchitectureFocusChartBars(): ArchitectureFocusChartBar[] {
  const marker = focusChart.markerCenterWorld;
  const hLen = focusChart.crosshairLengthMm;
  const t = focusChart.crosshairThicknessMm;
  const d = focusChart.crosshairDepthMm;
  return [
    {
      id: "horizontal",
      x: marker.x,
      y: marker.y,
      z: marker.z,
      width: hLen,
      height: t,
      depth: d,
    },
    {
      id: "vertical",
      x: marker.x,
      y: marker.y,
      z: marker.z,
      width: t,
      height: hLen,
      depth: d,
    },
  ];
}

export default {
  ground,
  building,
  facade,
  sceneBounds,
  compositionTargets,
  focusTarget,
  focusChart,
  architectureFacadeFocusDistanceMm,
  facadeDetailThicknessMm,
  facadeDetailSmallGapMm,
  mullionWidthMm,
  horizontalStripeHeightMm,
  focusChartSizeMm,
  focusChartCells,
  // helper exports for consumers that import the default geometry object
  getArchitectureFocusChartCells,
  getArchitectureFocusChartBars,
};
