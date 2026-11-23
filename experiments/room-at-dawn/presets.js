// Upstream metres, VCS film 127 × 101.6 mm. All rigs face room +Z, +Y up.
// Positions are hypotheses for browser inspection, not verified visible feature points.
export const ROOM_PRESETS = Object.freeze({
  wide: {
    label: "Wide Room",
    origin: [1.7, 0.85, 0.35],
    focalLengthMm: 90,
    focusDistanceMm: 2500,
    aperture: 5.6,
    subjects: "bed near/mid, nightstand and back wall far",
  },
  desk: {
    label: "Desk / Material Detail",
    origin: [3.2, 0.84, 0.08],
    focalLengthMm: 90,
    focusDistanceMm: 310,
    aperture: 5.6,
    subjects: "desk objects near, chair mid, room far; near clipping/occlusion unverified",
  },
  depth: {
    label: "Depth / Focus Test",
    origin: [1.35, 0.82, 0.55],
    focalLengthMm: 90,
    focusDistanceMm: 2000,
    aperture: 5.6,
    subjects: "bed foreground, bedding mid, back wall far",
  },
});
