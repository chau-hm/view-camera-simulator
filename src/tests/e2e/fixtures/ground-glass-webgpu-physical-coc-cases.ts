export type DepthProbeCase = Readonly<{
  id: string;
  expectedSurfaceId: string;
  pointWorldM: readonly [number, number, number];
}>;

/** Fixed asymmetric points on fixture geometry; all coordinates are metres. */
export const DEPTH_PROBE_CASES: readonly DepthProbeCase[] = [
  {
    id: "near-front-center-left",
    expectedSurfaceId: "near-front-plane",
    pointWorldM: [-0.13, 0.015, 0.32],
  },
  {
    id: "far-front-upper-right",
    expectedSurfaceId: "far-front-plane",
    pointWorldM: [-0.24, 0.1, 0.55],
  },
  {
    id: "tilted-plane-left-edge",
    expectedSurfaceId: "tilted-plane",
    pointWorldM: [0.11, -0.035, 0.46],
  },
  {
    id: "tilted-plane-right-edge",
    expectedSurfaceId: "tilted-plane",
    pointWorldM: [0.23, 0.045, 0.44],
  },
  {
    id: "occluded-front-marker",
    expectedSurfaceId: "occlusion-marker",
    pointWorldM: [-0.1, 0.1, 0.72],
  },
  {
    id: "empty-background-corner",
    expectedSurfaceId: "background",
    pointWorldM: [-1.2, 0.9, 0.4],
  },
  {
    id: "far-clip-upper-right",
    expectedSurfaceId: "far-depth-plane",
    pointWorldM: [1.2, 0.12, -1.0498],
  },
];

export type FocalBoundaryRegime = "finite-virtual" | "parallel-limit" | "finite-real";
export type FocalBoundaryInputSource = "depth" | "controlled-world-point";

export type PhysicalClassificationCase = Readonly<{
  id: string;
  sourceProbeId: string;
  focalLengthMm: number | "object-distance";
  /** A test-only world point in mm; when present it replaces the depth point for this kernel sample. */
  controlledObjectPointMm?: readonly [number, number, number];
  focalBoundary?: Readonly<{
    targetObjectMinusFocalMm: number;
    expectedRegime: FocalBoundaryRegime;
    inputSource: FocalBoundaryInputSource;
    /** Omit exact-limit authority to verify unresolved-boundary fail-closed behavior. */
    explicitParallelLimitIdentity?: boolean;
  }>;
  apertureFNumber: number;
  lensCenterMm: readonly [number, number, number];
  lensPlaneNormal: readonly [number, number, number];
  lensPlaneBasisX: readonly [number, number, number];
  lensPlaneBasisY: readonly [number, number, number];
  filmPlanePointMm: readonly [number, number, number];
  filmPlaneNormal: readonly [number, number, number];
  filmPlaneBasisX: readonly [number, number, number];
  filmPlaneBasisY: readonly [number, number, number];
}>;

const rotateX = ([x, y, z]: readonly [number, number, number], angle: number): [number, number, number] => [
  x,
  y * Math.cos(angle) - z * Math.sin(angle),
  y * Math.sin(angle) + z * Math.cos(angle),
];
const rotateY = ([x, y, z]: readonly [number, number, number], angle: number): [number, number, number] => [
  x * Math.cos(angle) + z * Math.sin(angle),
  y,
  -x * Math.sin(angle) + z * Math.cos(angle),
];
const rotateCompound = (v: readonly [number, number, number], x: number, y: number) => rotateY(rotateX(v, x), y);
const baseline = {
  focalLengthMm: 50,
  apertureFNumber: 4,
  lensCenterMm: [0, 0, 0] as const,
  lensPlaneNormal: [0, 0, 1] as const,
  lensPlaneBasisX: [1, 0, 0] as const,
  lensPlaneBasisY: [0, 1, 0] as const,
  filmPlanePointMm: [0, 0, -55.55555555555556] as const,
  filmPlaneNormal: [0, 0, 1] as const,
  filmPlaneBasisX: [1, 0, 0] as const,
  filmPlaneBasisY: [0, 1, 0] as const,
};

const tiltedFilmNormal = rotateX(baseline.filmPlaneNormal, 18 * Math.PI / 180);
const tiltedFilmBasisY = rotateX(baseline.filmPlaneBasisY, 18 * Math.PI / 180);
const rotateFilmAxes = (
  x: readonly [number, number, number],
  y: readonly [number, number, number],
  angle: number,
) => {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: x.map((value, index) => value * cosine + y[index]! * sine) as [number, number, number],
    y: x.map((value, index) => -value * sine + y[index]! * cosine) as [number, number, number],
  };
};
const nearPiFilmAxes = rotateFilmAxes(baseline.filmPlaneBasisX, tiltedFilmBasisY, 0.95);
const cropNearPiFilmAxes = rotateFilmAxes(baseline.filmPlaneBasisX, tiltedFilmBasisY, 0.99);
const negativeUnwrappedFilmAxes = rotateFilmAxes(baseline.filmPlaneBasisX, tiltedFilmBasisY, 1.5);

/**
 * Fixed physical kernel vectors. Geometry comes from the rendered depth
 * fixture; these are explicit millimetre lens/film configurations.
 */
export const PHYSICAL_CLASSIFICATION_CASES: readonly PhysicalClassificationCase[] = [
  { id: "near-side", sourceProbeId: "near-front-center-left", ...baseline },
  {
    id: "near-side-stopped-down",
    sourceProbeId: "near-front-center-left",
    ...baseline,
    apertureFNumber: 8,
  },
  {
    id: "in-focus", sourceProbeId: "far-front-upper-right", ...baseline,
    filmPlanePointMm: [0, 0, -55],
  },
  { id: "far-side", sourceProbeId: "far-front-upper-right", ...baseline },
  { id: "off-axis-tilted-surface", sourceProbeId: "tilted-plane-right-edge", ...baseline },
  {
    id: "film-tilt", sourceProbeId: "tilted-plane-left-edge", ...baseline,
    filmPlaneNormal: rotateX(baseline.filmPlaneNormal, 18 * Math.PI / 180),
    filmPlaneBasisY: rotateX(baseline.filmPlaneBasisY, 18 * Math.PI / 180),
  },
  {
    id: "film-swing", sourceProbeId: "far-front-upper-right", ...baseline,
    filmPlaneNormal: rotateY(baseline.filmPlaneNormal, -13 * Math.PI / 180),
    filmPlaneBasisX: rotateY(baseline.filmPlaneBasisX, -13 * Math.PI / 180),
  },
  {
    id: "compound-lens-film", sourceProbeId: "tilted-plane-right-edge", ...baseline,
    lensPlaneNormal: rotateCompound(baseline.lensPlaneNormal, 8 * Math.PI / 180, -6 * Math.PI / 180),
    lensPlaneBasisX: rotateCompound(baseline.lensPlaneBasisX, 8 * Math.PI / 180, -6 * Math.PI / 180),
    lensPlaneBasisY: rotateCompound(baseline.lensPlaneBasisY, 8 * Math.PI / 180, -6 * Math.PI / 180),
    filmPlaneNormal: rotateCompound(baseline.filmPlaneNormal, -14 * Math.PI / 180, 10 * Math.PI / 180),
    filmPlaneBasisX: rotateCompound(baseline.filmPlaneBasisX, -14 * Math.PI / 180, 10 * Math.PI / 180),
    filmPlaneBasisY: rotateCompound(baseline.filmPlaneBasisY, -14 * Math.PI / 180, 10 * Math.PI / 180),
  },
  {
    id: "focal-plane-parallel-limit", sourceProbeId: "near-front-center-left", ...baseline,
    focalLengthMm: "object-distance",
    focalBoundary: {
      targetObjectMinusFocalMm: 0,
      expectedRegime: "parallel-limit",
      inputSource: "depth",
    },
    filmPlanePointMm: [0, 0, -250],
  },
  ...([
    { suffix: "below-0.01mm", targetDeltaMm: -0.01, expectedRegime: "finite-virtual" as const },
    { suffix: "below-0.001mm", targetDeltaMm: -0.001, expectedRegime: "finite-virtual" as const },
    { suffix: "exact", targetDeltaMm: 0, expectedRegime: "parallel-limit" as const },
    { suffix: "above-0.001mm", targetDeltaMm: 0.001, expectedRegime: "finite-real" as const },
    { suffix: "above-0.01mm", targetDeltaMm: 0.01, expectedRegime: "finite-real" as const },
  ] as const).map(({ suffix, targetDeltaMm, expectedRegime }) => ({
    id: `focal-depth-${suffix}`,
    sourceProbeId: "near-front-center-left",
    ...baseline,
    focalLengthMm: "object-distance" as const,
    focalBoundary: {
      targetObjectMinusFocalMm: targetDeltaMm,
      expectedRegime,
      inputSource: "depth" as const,
    },
  })),
  ...([
    { suffix: "below-0.01mm", objectDistanceMm: 49.99, targetDeltaMm: -0.01, expectedRegime: "finite-virtual" as const },
    { suffix: "below-0.001mm", objectDistanceMm: 49.999, targetDeltaMm: -0.001, expectedRegime: "finite-virtual" as const },
    { suffix: "exact", objectDistanceMm: 50, targetDeltaMm: 0, expectedRegime: "parallel-limit" as const },
    { suffix: "above-0.001mm", objectDistanceMm: 50.001, targetDeltaMm: 0.001, expectedRegime: "finite-real" as const },
    { suffix: "above-0.01mm", objectDistanceMm: 50.01, targetDeltaMm: 0.01, expectedRegime: "finite-real" as const },
  ] as const).map(({ suffix, objectDistanceMm, targetDeltaMm, expectedRegime }) => ({
    id: `focal-kernel-${suffix}`,
    sourceProbeId: "near-front-center-left",
    ...baseline,
    focalLengthMm: "object-distance" as const,
    controlledObjectPointMm: [0, 0, objectDistanceMm] as const,
    focalBoundary: {
      targetObjectMinusFocalMm: targetDeltaMm,
      expectedRegime,
      inputSource: "controlled-world-point" as const,
    },
  })),
  {
    id: "focal-kernel-exact-without-limit-identity",
    sourceProbeId: "near-front-center-left",
    ...baseline,
    focalLengthMm: "object-distance",
    controlledObjectPointMm: [0, 0, 50],
    focalBoundary: {
      targetObjectMinusFocalMm: 0,
      expectedRegime: "parallel-limit",
      inputSource: "controlled-world-point",
      explicitParallelLimitIdentity: false,
    },
  },
  {
    id: "invalid-lens-basis", sourceProbeId: "near-front-center-left", ...baseline,
    lensPlaneNormal: [0, 0, 0],
  },
  {
    id: "outside-binary16-range", sourceProbeId: "near-front-center-left", ...baseline,
    apertureFNumber: 0.00001,
  },
  { id: "occlusion-near-marker", sourceProbeId: "occluded-front-marker", ...baseline },
  { id: "background-no-depth", sourceProbeId: "empty-background-corner", ...baseline },
  {
    id: "far-clip-visible-surface",
    sourceProbeId: "far-clip-upper-right",
    ...baseline,
    lensPlaneNormal: [0, 0, -1],
    lensPlaneBasisY: [0, -1, 0],
    filmPlanePointMm: [0, 0, 55.55555555555556],
    filmPlaneNormal: [0, 0, -1],
    filmPlaneBasisY: [0, -1, 0],
  },
  {
    id: "film-tilt-near-pi",
    sourceProbeId: "tilted-plane-left-edge",
    ...baseline,
    filmPlaneNormal: tiltedFilmNormal,
    filmPlaneBasisX: nearPiFilmAxes.x,
    filmPlaneBasisY: nearPiFilmAxes.y,
  },
  {
    id: "film-negative-unwrapped-orientation",
    sourceProbeId: "tilted-plane-left-edge",
    ...baseline,
    filmPlaneNormal: tiltedFilmNormal,
    filmPlaneBasisX: negativeUnwrappedFilmAxes.x,
    filmPlaneBasisY: negativeUnwrappedFilmAxes.y,
  },
  {
    id: "crop-film-tilt-near-pi",
    sourceProbeId: "tilted-plane-right-edge",
    ...baseline,
    filmPlaneNormal: tiltedFilmNormal,
    filmPlaneBasisX: cropNearPiFilmAxes.x,
    filmPlaneBasisY: cropNearPiFilmAxes.y,
  },
];
