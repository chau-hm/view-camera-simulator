import type { FocusTarget } from "../types/scene";

/** Physical watch-head placement shared by Observer, RTT, and focus evaluation. */
export const MACRO_BELLOWS_WATCH = Object.freeze({
  caseOriginMm: Object.freeze({ x: 0, y: 0, z: 303.55 }),
  caseDiameterMm: 42,
  caseThicknessMm: 12,
  tourbillonApertureDiameterMm: 13,
  /** Lens-facing chapter-ring plane; this stays the scene's 300 mm focus datum. */
  dialDatumMm: Object.freeze({ x: 0, y: 0, z: 300 }),
});

/** Measured watch-head bounds after the canonical dial-toward-lens transform. */
export const macroBellowsExtensionWatchBoundsMm = {
  min: { x: -24.56, y: -25.674, z: 297.55 },
  max: { x: 21, y: 25.674, z: 309.55 },
} as const;

/**
 * The lesson focuses the exposed chapter ring at its real 300 mm plane.
 * Keeping both primary samples on this plane preserves the existing 1:1
 * focus-distance behavior while the raised hands and recessed mechanism stay
 * available as separately validated depth samples.
 */
export const macroBellowsExtensionFocusTargets: FocusTarget[] = [
  {
    id: "tourbillon-watch-dial",
    label: "Tourbillon watch dial",
    worldPosition: { x: -2.65, y: 15.45, z: 300 },
    sampleWorldPositions: [{ x: -15.45, y: -1.4, z: 300 }],
    weight: 1,
  },
];

/** As-built points for surfaces checked behind the retained front crystal. */
export const macroBellowsExtensionDiagnosticSamplesMm = [
  { surface: "hobnail dial field", worldPosition: { x: -5.8, y: 1.7, z: 300.133 } },
  { surface: "hand collet", worldPosition: { x: 0, y: 0, z: 299.015 } },
  { surface: "tourbillon wheel", worldPosition: { x: -0.3, y: -13.2, z: 305.69 } },
  { surface: "front bezel", worldPosition: { x: -20, y: 0, z: 298.687 } },
] as const;

export const macroBellowsExtensionCameraPlacement = {
  position: { x: 280, y: 180, z: 650 },
  target: { x: 0, y: -15, z: 150 },
};

/** Includes watch, camera standards, and rail throughout the assigned range. */
export const macroBellowsExtensionSceneBoundsMm = {
  min: { x: -180, y: -220, z: -380 },
  max: { x: 180, y: 180, z: 320 },
};
