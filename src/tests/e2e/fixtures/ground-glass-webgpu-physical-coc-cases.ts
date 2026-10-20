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
];

export type PhysicalClassificationCase = Readonly<{
  id: string;
  sourceProbeId: string;
  focalLengthMm: number | "object-distance";
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
    filmPlanePointMm: [0, 0, -250],
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
];
