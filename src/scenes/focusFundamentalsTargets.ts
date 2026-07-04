export const nearBoardCenterMm = { x: -180, y: -60, z: 1000 };
export const farBoardCenterMm = { x: 180, y: 40, z: 3000 };
export const boardWidthMm = 120;
export const boardHeightMm = 180;
export const floorYmm = -150;

export const focusTargetsDefs = [
  { id: "near-target", label: "Near target", worldPosition: nearBoardCenterMm, weight: 1 },
  { id: "far-target", label: "Far target", worldPosition: farBoardCenterMm, weight: 1 },
];
