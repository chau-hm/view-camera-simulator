export const nearBoardCenterMm = { x: -180, y: -60, z: 1000 };
export const farBoardCenterMm = { x: 180, y: 40, z: 3000 };
export const boardWidthMm = 120;
export const boardHeightMm = 180;
export const floorYmm = -150;

// Canonical focus targets used across Focus Fundamentals: IDs and labels are authoritative
export const focusTargetsDefs = [
  { id: "focus-near-board", label: "Focus Near Board", worldPosition: nearBoardCenterMm, weight: 1 },
  { id: "focus-far-board", label: "Focus Far Board", worldPosition: farBoardCenterMm, weight: 1 },
];
