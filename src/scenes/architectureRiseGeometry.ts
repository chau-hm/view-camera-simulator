// Canonical geometry for Architecture Rise scene (millimetres)
export const groundHeightMm = 0; // ground plane baseline

export const building = {
  center: { x: 0, y: 1200, z: 9500 }, // centre of façade
  width: 2800, // total building width
  height: 2400, // main body height
  topHeight: 600, // top/parapet height
  depth: 1200, // building depth (towards camera negative Z is nearer)
  facadeVerticalDivisionCount: 6, // number of vertical mullions
  facadeHorizontalDivisionCount: 6, // number of floors/windows rows
};

export const facade = {
  // positions measured relative to building.center
  mainBodyBottomY: building.center.y - building.height / 2,
  mainBodyTopY: building.center.y + building.height / 2,
  roofTopY: building.center.y + building.height / 2 + building.topHeight,
};

export const sceneBounds = {
  min: { x: -building.width / 2 - 200, y: groundHeightMm, z: 800 },
  max: { x: building.width / 2 + 200, y: facade.roofTopY + 400, z: 13200 },
};

export const compositionTargets = {
  buildingTop: {
    // region around roofline — expressed in world mm
    min: { x: -900, y: facade.roofTopY - 200, z: building.center.z - 400 },
    max: { x: 900, y: facade.roofTopY + 200, z: building.center.z + 400 },
  },
  buildingMain: {
    min: { x: -1400, y: facade.mainBodyBottomY + 100, z: building.center.z - 600 },
    max: { x: 1400, y: facade.mainBodyTopY - 100, z: building.center.z + 1400 },
  },
};

export const focusTarget = {
  // a point on the façade roughly at eye level
  worldPosition: { x: 0, y: building.center.y, z: building.center.z },
};

export default {
  groundHeightMm,
  building,
  facade,
  sceneBounds,
  compositionTargets,
  focusTarget,
};
