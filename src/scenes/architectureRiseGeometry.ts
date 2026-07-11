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

// scene bounds should contain ground and parapet top
export const sceneBounds = {
  min: { x: -building.width / 2 - 200, y: ground.y - 200, z: ground.nearZ + 200 },
  max: { x: building.width / 2 + 200, y: facade.parapetTopY + 400, z: Math.max(building.center.z + 2000, ground.farZ) },
};

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
  band?: boolean; // include a lighter top band for high-frequency cue
};

// Repositioned reference objects to create clear camera -> near -> mid -> building depth separation.
export const referenceObjects: ReferenceObjectDef[] = [
  // A: near foreground — moved significantly closer to camera
  {
    id: "plinth-foreground-left",
    role: "foreground",
    x: -700,
    z: 3000, // much closer than façade (~8900mm)
    width: 240,
    depth: 240,
    height: 160,
    color: "#9aa6b2",
    band: true,
  },
  // B: midground — in front of façade but not as close as A
  {
    id: "plinth-mid-right",
    role: "midground",
    x: 650,
    z: 5400, // between camera and façade
    width: 300,
    depth: 260,
    height: 220,
    color: "#8f98a3",
    band: false,
  },
  // C: near-façade object — kept close to the building plane
  {
    id: "plinth-near-facade-left",
    role: "near-façade",
    x: -building.width / 2 - 120,
    z: facade.frontFacadeZ + 120,
    width: 220,
    depth: 220,
    height: 360,
    color: "#a3adb7",
    band: true,
  },
  // D: optional far/side object — slightly behind the building back plane for depth contrast
  {
    id: "plinth-far-right",
    role: "far",
    x: building.width / 2 + 600,
    z: facade.backFacadeZ + 700,
    width: 280,
    depth: 280,
    height: 200,
    color: "#b0bcc6",
    band: false,
  },
];

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

export default {
  ground,
  building,
  facade,
  sceneBounds,
  compositionTargets,
  focusTarget,
  architectureFacadeFocusDistanceMm,
  facadeDetailThicknessMm,
  facadeDetailSmallGapMm,
  mullionWidthMm,
  horizontalStripeHeightMm,
  focusChartSizeMm,
  focusChartCells,
};
