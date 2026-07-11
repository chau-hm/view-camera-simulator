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

// canonical façade focus distance measured from lens centre (0,0,0) to focus target along +Z
export const architectureFacadeFocusDistanceMm = focusTarget.worldPosition.z;

export default {
  ground,
  building,
  facade,
  sceneBounds,
  compositionTargets,
  focusTarget,
  architectureFacadeFocusDistanceMm,
};
