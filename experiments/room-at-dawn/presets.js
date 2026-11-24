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
    referenceStates: [
      { id: "near", label: "150 mm · near bed", camera: { focalLengthMm: 150, focusDistanceMm: 1550, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: 0 } },
      { id: "middle", label: "150 mm · middle bedding", camera: { focalLengthMm: 150, focusDistanceMm: 2500, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: 0 } },
      { id: "far", label: "150 mm · far wall", camera: { focalLengthMm: 150, focusDistanceMm: 3600, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: 0 } },
    ],
  },
  desk: {
    label: "Desk / Material Detail",
    origin: [3.2, 0.84, 0.08],
    focalLengthMm: 90,
    focusDistanceMm: 310,
    aperture: 5.6,
    subjects: "desk objects near, chair mid, room far; near clipping/occlusion unverified",
    referenceStates: [
      { id: "near", label: "90 mm · near desk", camera: { focalLengthMm: 90, focusDistanceMm: 330, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: 0 } },
      { id: "middle", label: "90 mm · cardigan", camera: { focalLengthMm: 90, focusDistanceMm: 1170, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: 0 } },
      { id: "far", label: "90 mm · far wall", camera: { focalLengthMm: 90, focusDistanceMm: 3920, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: 0 } },
    ],
  },
  depth: {
    label: "Depth / Focus Test",
    origin: [1.35, 0.82, 0.55],
    focalLengthMm: 90,
    focusDistanceMm: 2000,
    aperture: 5.6,
    subjects: "bed foreground, bedding mid, back wall far",
  },
  bedTilt: {
    label: "Bed / Tilt Study (experimental)",
    origin: [1.2, 1.15, 0.8],
    focalLengthMm: 90,
    focusDistanceMm: 3120,
    aperture: 5.6,
    subjects: "receding bedding; approximate horizontal surface is not planar",
    referenceStates: [
      { id: "neutral", label: "Neutral · 3.12 m", camera: { focalLengthMm: 90, focusDistanceMm: 3120, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: 0 } },
      { id: "plane", label: "Plane calibration · +9.8°", camera: { focalLengthMm: 90, focusDistanceMm: 3120, aperture: 5.6, frontTiltDeg: 9.8, frontSwingDeg: 0 } },
      { id: "opposite", label: "Opposite · −9.8°", camera: { focalLengthMm: 90, focusDistanceMm: 3120, aperture: 5.6, frontTiltDeg: -9.8, frontSwingDeg: 0 } },
    ],
  },
  doorSwing: {
    label: "Door / Swing Study (experimental)",
    origin: [4.2, 1.2, 0.8],
    focalLengthMm: 90,
    focusDistanceMm: 3840,
    aperture: 5.6,
    subjects: "right-hand door and trim at oblique viewing angle",
    referenceStates: [
      { id: "neutral", label: "Neutral · 3.84 m", camera: { focalLengthMm: 90, focusDistanceMm: 3840, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: 0 } },
      { id: "plane", label: "Plane calibration · +8.8°", camera: { focalLengthMm: 90, focusDistanceMm: 3840, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: 8.8 } },
      { id: "opposite", label: "Opposite · −8.8°", camera: { focalLengthMm: 90, focusDistanceMm: 3840, aperture: 5.6, frontTiltDeg: 0, frontSwingDeg: -8.8 } },
    ],
  },
});
