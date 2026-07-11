// Canonical geometry for Architecture Rise scene (millimetres)
// Define unambiguous coordinate anchors so everything (subject, targets, bounds)
// derives from the same canonical values.

// Ground plane baseline: below the camera datum (camera datum ~= y=0)
export const groundHeightMm = -1400;

export const building = {
  // centre.y will be computed so the building sits on the ground baseline
  center: { x: 0, y: 0, z: 9500 }, // centre.y overwritten below
  width: 2800, // total building width (mm)
  height: 2400, // main body height (mm)
  topHeight: 600, // parapet/top block height (mm)
  depth: 1200, // building depth (mm)
  facadeVerticalDivisionCount: 6,
  facadeHorizontalDivisionCount: 6,
};

// compute sensible center.y so main body bottom sits on the ground
// mainBodyBottomY = groundHeightMm
// center.y = ground + height/2
building.center.y = groundHeightMm + building.height / 2;

export const facade = {
  // the main body extents in world mm
  mainBodyBottomY: building.center.y - building.height / 2,
  mainBodyTopY: building.center.y + building.height / 2,
  // parapet extents
  parapetBottomY: null as unknown as number, // filled next
  parapetTopY: null as unknown as number,
  // facade Z extents (front = nearer to camera)
  frontFacadeZ: building.center.z - building.depth / 2,
  backFacadeZ: building.center.z + building.depth / 2,
};

facade.parapetBottomY = facade.mainBodyTopY;
facade.parapetTopY = facade.parapetBottomY + building.topHeight;

// scene bounds should contain ground and parapet top
export const sceneBounds = {
  // keep a broad Z range so older focus-distance assumptions and clamping remain compatible
  min: { x: -building.width / 2 - 200, y: groundHeightMm - 200, z: 800 },
  max: { x: building.width / 2 + 200, y: facade.parapetTopY + 400, z: 13200 },
};

export const compositionTargets = {
  buildingTop: {
    // region around roofline — expressed in world mm
    min: { x: -900, y: facade.parapetBottomY - 120, z: facade.frontFacadeZ - 400 },
    max: { x: 900, y: facade.parapetTopY + 120, z: facade.backFacadeZ + 400 },
  },
  buildingMain: {
    min: { x: -1400, y: facade.mainBodyBottomY + 100, z: facade.frontFacadeZ - 600 },
    max: { x: 1400, y: facade.mainBodyTopY - 100, z: facade.backFacadeZ + 1400 },
  },
};

export const focusTarget = {
  // place the focus target just in front of the façade to avoid z-fighting
  worldPosition: { x: 0, y: building.center.y, z: facade.frontFacadeZ - 10 },
};

export default {
  groundHeightMm,
  building,
  facade,
  sceneBounds,
  compositionTargets,
  focusTarget,
};
