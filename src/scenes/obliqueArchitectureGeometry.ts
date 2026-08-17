// Canonical geometry for the Oblique Architecture — Static Problem scene.
// All subject, focus, framing, and top-view guide values are expressed in mm.

export type ObliqueArchitectureGroundGeometry = {
  y: number;
  nearZ: number;
  farZ: number;
  width: number;
  centerX: number;
  centerZ: number;
};

export const ground: ObliqueArchitectureGroundGeometry = {
  y: -1200,
  nearZ: 8200,
  farZ: 19000,
  width: 11000,
  centerX: 2800,
  centerZ: (8200 + 19000) / 2,
};

export const building = {
  width: 2400,
  height: 5000,
  nearZ: 9600,
  farZ: 16800,
  leftX: 900,
  rightX: 3300,
  windowRows: 4,
  frontWindowColumns: 5,
  sideWindowColumns: 7,
  windowHeight: 620,
  frontWindowWidth: 320,
  sideWindowWidth: 620,
  parapetHeight: 420,
};

building.width = building.rightX - building.leftX;

export const buildingCenter = {
  x: (building.leftX + building.rightX) / 2,
  y: ground.y + building.height / 2,
  z: (building.nearZ + building.farZ) / 2,
};

export const buildingTopY = ground.y + building.height + building.parapetHeight;

export const windowRowCenters = Array.from({ length: building.windowRows }, (_, row) =>
  ground.y + 900 + row * 1050,
);

export const sideWindowColumnCenters = Array.from(
  { length: building.sideWindowColumns },
  (_, column) =>
    building.nearZ +
    800 +
    (column * (building.farZ - building.nearZ - 1600)) /
      (building.sideWindowColumns - 1),
);

export const frontWindowColumnCenters = Array.from(
  { length: building.frontWindowColumns },
  (_, column) =>
    building.leftX +
    420 +
    (column * (building.width - 840)) / (building.frontWindowColumns - 1),
);

export const facade = {
  cornerWorld: { x: building.leftX, y: buildingCenter.y, z: building.nearZ },
  targetPlaneX: building.leftX,
  nearZ: building.nearZ,
  farZ: building.farZ,
};

export const focusTargetRow = 1;
export const canonicalFocusDistanceMm = sideWindowColumnCenters[3] ?? buildingCenter.z;

// Derived from the full roof/base corner projection after the subject is
// placed at its calibrated depth. This is an evidence value for PR 6B, not a
// movement preset or a bypass around the public control step.
export const reachableFrontRiseMm = 20;

export const focusTargetIds = [
  "facade-near",
  "facade-middle",
  "facade-far",
] as const;

const focusColumnIndexes = [0, 3, 6] as const;

export const focusTargets = focusColumnIndexes.map((column, index) => {
  const z = sideWindowColumnCenters[column] ?? canonicalFocusDistanceMm;
  const y = windowRowCenters[focusTargetRow] ?? buildingCenter.y;
  const worldPosition = {
    x: facade.targetPlaneX - 18,
    y,
    z,
  };
  return {
    id: focusTargetIds[index],
    label:
      index === 0
        ? "Near façade window"
        : index === 1
          ? "Middle façade window"
          : "Far façade window",
    worldPosition,
    sampleWorldPositions: [
      worldPosition,
      { ...worldPosition, z: z - building.sideWindowWidth * 0.38 },
      { ...worldPosition, z: z + building.sideWindowWidth * 0.38 },
    ],
    weight: 1,
  };
});

export const compositionTargets = {
  buildingTop: {
    min: {
      x: building.leftX - 100,
      y: ground.y + building.height,
      z: building.nearZ - 100,
    },
    max: {
      x: building.rightX + 100,
      y: buildingTopY + 100,
      z: building.farZ + 100,
    },
  },
  buildingBase: {
    min: {
      x: building.leftX - 100,
      y: ground.y,
      z: building.nearZ - 100,
    },
    max: {
      x: building.rightX + 100,
      y: ground.y + 900,
      z: building.farZ + 100,
    },
  },
  targetFacade: {
    min: {
      x: building.leftX - 100,
      y: ground.y + 300,
      z: building.nearZ,
    },
    max: {
      x: building.leftX + 100,
      y: ground.y + building.height - 300,
      z: building.farZ,
    },
  },
};

export const sceneBounds = {
  min: {
    x: ground.centerX - ground.width / 2,
    y: ground.y - 20,
    z: ground.nearZ - 20,
  },
  max: {
    x: ground.centerX + ground.width / 2,
    y: buildingTopY + 120,
    z: ground.farZ + 20,
  },
};

export default {
  ground,
  building,
  buildingCenter,
  buildingTopY,
  windowRowCenters,
  sideWindowColumnCenters,
  frontWindowColumnCenters,
  facade,
  focusTargetRow,
  canonicalFocusDistanceMm,
  reachableFrontRiseMm,
  focusTargets,
  compositionTargets,
  sceneBounds,
};
