import type { Vec3 } from "../types/optics";
import { CAMERA_CONSTANTS } from "../utils/constants";

export type ConceptualRearBackMode = "ground-glass" | "film-holder";

export type ConceptualRearBackSurface = Readonly<{
  widthMm: number;
  heightMm: number;
  /** Local position in the canonical rear-standard frame. */
  centerLocal: Vec3;
  /** Local +Z is the canonical rear-standard / film-plane normal. */
  normalLocal: Vec3;
}>;

export type ConceptualGroundGlassGeometry = Readonly<{
  surface: ConceptualRearBackSurface;
  frame: Readonly<{
    outerWidthMm: number;
    outerHeightMm: number;
    barMm: number;
    depthMm: number;
    /** The frame is behind the sensitive surface, away from the lens. */
    centerLocal: Vec3;
  }>;
}>;

export type ConceptualFilmHolderGeometry = Readonly<{
  surface: ConceptualRearBackSurface;
  holder: Readonly<{
    widthMm: number;
    heightMm: number;
    depthMm: number;
    /** The holder shell extends rearward from the sensitive surface. */
    centerLocal: Vec3;
  }>;
  frame: Readonly<{
    outerWidthMm: number;
    outerHeightMm: number;
    barMm: number;
    depthMm: number;
    centerLocal: Vec3;
  }>;
}>;

const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

const canonicalRearBackSurface = (): ConceptualRearBackSurface => ({
  widthMm: CAMERA_CONSTANTS.filmWidthMm,
  heightMm: CAMERA_CONSTANTS.filmHeightMm,
  centerLocal: vec(0, 0, 0),
  normalLocal: vec(0, 0, 1),
});

const CONCEPTUAL_REAR_BACK_MARGIN_MM = 10;
const CONCEPTUAL_GROUND_GLASS_FRAME_BAR_MM = 6;
const CONCEPTUAL_GROUND_GLASS_FRAME_DEPTH_MM = 4;
const CONCEPTUAL_GROUND_GLASS_FRAME_OFFSET_MM = -3;
const CONCEPTUAL_FILM_HOLDER_MARGIN_MM = 24;
const CONCEPTUAL_FILM_HOLDER_DEPTH_MM = 18;
const CONCEPTUAL_FILM_HOLDER_FRAME_BAR_MM = 7;
const CONCEPTUAL_FILM_HOLDER_FRAME_DEPTH_MM = 4;
const CONCEPTUAL_FILM_HOLDER_FRAME_OFFSET_MM = -2;
const CONCEPTUAL_FILM_HOLDER_BODY_OFFSET_MM = -1;

/** Resolve the ground-glass anatomy in rear-standard local coordinates. */
export const resolveConceptualGroundGlassGeometry = (): ConceptualGroundGlassGeometry => {
  const surface = canonicalRearBackSurface();
  return {
    surface,
    frame: {
      outerWidthMm: surface.widthMm + CONCEPTUAL_REAR_BACK_MARGIN_MM,
      outerHeightMm: surface.heightMm + CONCEPTUAL_REAR_BACK_MARGIN_MM,
      barMm: CONCEPTUAL_GROUND_GLASS_FRAME_BAR_MM,
      depthMm: CONCEPTUAL_GROUND_GLASS_FRAME_DEPTH_MM,
      centerLocal: vec(0, 0, CONCEPTUAL_GROUND_GLASS_FRAME_OFFSET_MM),
    },
  };
};

/** Resolve a sheet-film holder whose sensitive film surface remains on z=0. */
export const resolveConceptualFilmHolderGeometry = (): ConceptualFilmHolderGeometry => {
  const surface = canonicalRearBackSurface();
  const holderWidthMm = surface.widthMm + CONCEPTUAL_FILM_HOLDER_MARGIN_MM;
  const holderHeightMm = surface.heightMm + CONCEPTUAL_FILM_HOLDER_MARGIN_MM;
  return {
    surface,
    holder: {
      widthMm: holderWidthMm,
      heightMm: holderHeightMm,
      depthMm: CONCEPTUAL_FILM_HOLDER_DEPTH_MM,
      centerLocal: vec(
        0,
        0,
        CONCEPTUAL_FILM_HOLDER_BODY_OFFSET_MM - CONCEPTUAL_FILM_HOLDER_DEPTH_MM / 2,
      ),
    },
    frame: {
      outerWidthMm: holderWidthMm,
      outerHeightMm: holderHeightMm,
      barMm: CONCEPTUAL_FILM_HOLDER_FRAME_BAR_MM,
      depthMm: CONCEPTUAL_FILM_HOLDER_FRAME_DEPTH_MM,
      centerLocal: vec(0, 0, CONCEPTUAL_FILM_HOLDER_FRAME_OFFSET_MM),
    },
  };
};

export const CONCEPTUAL_LENS_APERTURE_OUTER_RADIUS_MM = 22;
export const CONCEPTUAL_LENS_APERTURE_VISUAL_SCALE = 1.5;
export const CONCEPTUAL_LENS_APERTURE_MIN_RADIUS_MM = 1.5;
/** Six blades keep the conceptual diaphragm legible without implying a brand-specific lens. */
export const CONCEPTUAL_LENS_IRIS_BLADE_COUNT = 6;
const CONCEPTUAL_LENS_APERTURE_RIM_MM = 0.5;
// The longer fixed profile lets adjacent blades overlap at the widest pose,
// while the slightly outboard pivots preserve the large-format wide opening.
const CONCEPTUAL_LENS_IRIS_BLADE_PIVOT_RADIUS_MM = 22.6;
const CONCEPTUAL_LENS_IRIS_BLADE_LENGTH_MM = 34;
const CONCEPTUAL_LENS_IRIS_BLADE_OUTER_EXTENSION_MM = 1.5;
const CONCEPTUAL_LENS_IRIS_BLADE_WIDTH_MM = 5;
const CONCEPTUAL_LENS_IRIS_BLADE_TIP_WIDTH_MM = 3;
const CONCEPTUAL_LENS_IRIS_BLADE_TIP_SKEW_MM = 3;
const CONCEPTUAL_LENS_IRIS_BLADE_OPEN_ORIENTATION_RAD = Math.PI / 2;
const CONCEPTUAL_LENS_IRIS_BLADE_MAX_CLOSURE_RAD = (80 * Math.PI) / 180;
const CONCEPTUAL_LENS_IRIS_BLADE_LAYER_SPACING_MM = 0.08;
export const CONCEPTUAL_LENS_IRIS_EFFECTIVE_RADIUS_SAMPLE_COUNT = 720;
const CONCEPTUAL_LENS_IRIS_CLOSURE_SOLVER_ITERATIONS = 28;
const CONCEPTUAL_LENS_IRIS_GEOMETRY_EPSILON = 1e-9;

type ConceptualApertureInput = {
  aperture?: number;
  focalLengthMm?: number;
};

export type ConceptualAperturePoint = Readonly<{
  x: number;
  y: number;
}>;

export type ConceptualApertureOpening = Readonly<{
  /** Physical entrance-pupil diameter before visual scaling. */
  entrancePupilDiameterMm: number;
  /** Bounded visual opening dimensions used to select the blade pose. */
  openingDiameterMm: number;
  openingRadiusMm: number;
  outerRadiusMm: number;
}>;

/**
 * Resolve a bounded conceptual iris opening from the canonical f-number.
 * The physical inverse relationship is retained before fitting the opening
 * inside the existing lens-barrel diameter.
 */
export const resolveConceptualApertureOpening = ({
  aperture = CAMERA_CONSTANTS.apertureOptions[1],
  focalLengthMm = CAMERA_CONSTANTS.focalLengthMm,
}: ConceptualApertureInput = {}): ConceptualApertureOpening => {
  const safeAperture = Number.isFinite(aperture) && aperture > 0
    ? aperture
    : CAMERA_CONSTANTS.apertureOptions[1];
  const safeFocalLengthMm = Number.isFinite(focalLengthMm) && focalLengthMm > 0
    ? focalLengthMm
    : CAMERA_CONSTANTS.focalLengthMm;
  const entrancePupilDiameterMm = safeFocalLengthMm / safeAperture;
  const outerRadiusMm = CONCEPTUAL_LENS_APERTURE_OUTER_RADIUS_MM;
  const maximumOpeningRadiusMm = outerRadiusMm - CONCEPTUAL_LENS_APERTURE_RIM_MM;
  const openingRadiusMm = Math.min(
    maximumOpeningRadiusMm,
    Math.max(
      CONCEPTUAL_LENS_APERTURE_MIN_RADIUS_MM,
      (entrancePupilDiameterMm * CONCEPTUAL_LENS_APERTURE_VISUAL_SCALE) / 2,
    ),
  );
  return {
    entrancePupilDiameterMm,
    openingDiameterMm: openingRadiusMm * 2,
    openingRadiusMm,
    outerRadiusMm,
  };
};

const polarPoint = (radiusMm: number, angleRad: number): ConceptualAperturePoint => ({
  x: radiusMm * Math.cos(angleRad),
  y: radiusMm * Math.sin(angleRad),
});

export type ConceptualApertureBlade = Readonly<{
  index: number;
  /** The pivot is intentionally off-axis, as on a real rotating diaphragm blade. */
  pivot: ConceptualAperturePoint;
  /** Sixfold assembly orientation of this blade's pivot. */
  centerAngleRad: number;
  /** Rotation around the blade's own pivot; aperture closure is driven by this value. */
  rotationRad: number;
  /** Small separation between stacked blades prevents coplanar depth ambiguity. */
  layerOffsetMm: number;
  /** One shared straight-edged blade profile, reused for every aperture value. */
  points: readonly ConceptualAperturePoint[];
}>;

const CONCEPTUAL_LENS_IRIS_BLADE_PROFILE: readonly ConceptualAperturePoint[] = Object.freeze([
  { x: -CONCEPTUAL_LENS_IRIS_BLADE_LENGTH_MM, y: -CONCEPTUAL_LENS_IRIS_BLADE_TIP_WIDTH_MM / 2 },
  {
    x: -CONCEPTUAL_LENS_IRIS_BLADE_LENGTH_MM + CONCEPTUAL_LENS_IRIS_BLADE_TIP_SKEW_MM,
    y: CONCEPTUAL_LENS_IRIS_BLADE_TIP_WIDTH_MM / 2,
  },
  {
    x: CONCEPTUAL_LENS_IRIS_BLADE_OUTER_EXTENSION_MM,
    y: CONCEPTUAL_LENS_IRIS_BLADE_WIDTH_MM / 2,
  },
  {
    x: CONCEPTUAL_LENS_IRIS_BLADE_OUTER_EXTENSION_MM,
    y: -CONCEPTUAL_LENS_IRIS_BLADE_WIDTH_MM / 2,
  },
]);

/**
 * Transform one fixed blade profile into diaphragm-local coordinates. The
 * shared profile is rotated around its own off-axis pivot and then placed at
 * the blade's sixfold assembly pivot; no aperture-sized polygon is authored.
 */
export const resolveConceptualApertureBladePolygon = (
  blade: ConceptualApertureBlade,
): readonly ConceptualAperturePoint[] => {
  const rotationRad = blade.centerAngleRad + blade.rotationRad;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  return blade.points.map((point) => ({
    x: blade.pivot.x + point.x * cos - point.y * sin,
    y: blade.pivot.y + point.x * sin + point.y * cos,
  }));
};

export const resolveConceptualApertureBladePolygons = (
  blades: readonly ConceptualApertureBlade[],
): readonly (readonly ConceptualAperturePoint[])[] => blades.map(
  (blade) => resolveConceptualApertureBladePolygon(blade),
);

const resolveConceptualApertureBladesAtClosure = (
  closureRad: number,
): readonly ConceptualApertureBlade[] => {
  const safeClosureRad = Math.min(
    CONCEPTUAL_LENS_IRIS_BLADE_MAX_CLOSURE_RAD,
    Math.max(0, closureRad),
  );
  const segmentAngleRad = (Math.PI * 2) / CONCEPTUAL_LENS_IRIS_BLADE_COUNT;

  return Array.from(
    { length: CONCEPTUAL_LENS_IRIS_BLADE_COUNT },
    (_, index) => {
      const centerAngleRad = index * segmentAngleRad;

      return {
        index,
        pivot: polarPoint(CONCEPTUAL_LENS_IRIS_BLADE_PIVOT_RADIUS_MM, centerAngleRad),
        centerAngleRad,
        rotationRad: CONCEPTUAL_LENS_IRIS_BLADE_OPEN_ORIENTATION_RAD - safeClosureRad,
        layerOffsetMm: index * CONCEPTUAL_LENS_IRIS_BLADE_LAYER_SPACING_MM,
        points: CONCEPTUAL_LENS_IRIS_BLADE_PROFILE,
      };
    },
  );
};

const cross = (a: ConceptualAperturePoint, b: ConceptualAperturePoint): number =>
  a.x * b.y - a.y * b.x;

const polygonContainsOrigin = (
  polygon: readonly ConceptualAperturePoint[],
): boolean => {
  let inside = false;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const edge = { x: end.x - start.x, y: end.y - start.y };
    const toOrigin = { x: -start.x, y: -start.y };
    const onEdge = Math.abs(cross(edge, toOrigin)) <= CONCEPTUAL_LENS_IRIS_GEOMETRY_EPSILON &&
      toOrigin.x * edge.x + toOrigin.y * edge.y >= -CONCEPTUAL_LENS_IRIS_GEOMETRY_EPSILON &&
      toOrigin.x * edge.x + toOrigin.y * edge.y <=
        edge.x * edge.x + edge.y * edge.y + CONCEPTUAL_LENS_IRIS_GEOMETRY_EPSILON;
    if (onEdge) return true;

    if ((start.y > 0) !== (end.y > 0)) {
      const intersectionX = start.x + (end.x - start.x) * (-start.y) / (end.y - start.y);
      if (intersectionX > 0) inside = !inside;
    }
  }

  return inside;
};

const resolveRaySegmentIntersection = (
  direction: ConceptualAperturePoint,
  start: ConceptualAperturePoint,
  end: ConceptualAperturePoint,
): number | null => {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const denominator = cross(direction, segment);
  if (Math.abs(denominator) <= CONCEPTUAL_LENS_IRIS_GEOMETRY_EPSILON) return null;

  const rayDistance = cross(start, segment) / denominator;
  const segmentFraction = cross(start, direction) / denominator;
  if (
    rayDistance < -CONCEPTUAL_LENS_IRIS_GEOMETRY_EPSILON ||
    segmentFraction < -CONCEPTUAL_LENS_IRIS_GEOMETRY_EPSILON ||
    segmentFraction > 1 + CONCEPTUAL_LENS_IRIS_GEOMETRY_EPSILON
  ) {
    return null;
  }
  return Math.max(0, rayDistance);
};

/**
 * Measure the largest centred circle left by the transformed blade polygons.
 * Radial sampling is deliberately kept in this small pure geometry module so
 * the rendered mesh and the closure solver use the same transformed polygons.
 */
export const resolveConceptualApertureEffectiveRadius = (
  blades: readonly ConceptualApertureBlade[],
  sampleCount = CONCEPTUAL_LENS_IRIS_EFFECTIVE_RADIUS_SAMPLE_COUNT,
): number => {
  const polygons = resolveConceptualApertureBladePolygons(blades);
  if (polygons.length === 0 || polygons.some(polygonContainsOrigin)) return 0;

  const safeSampleCount = Math.max(16, Math.floor(sampleCount));
  let effectiveRadius = Number.POSITIVE_INFINITY;

  for (let index = 0; index < safeSampleCount; index += 1) {
    const angleRad = (Math.PI * 2 * index) / safeSampleCount;
    const direction = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
    let firstIntersection = Number.POSITIVE_INFINITY;

    for (const polygon of polygons) {
      for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
        const distance = resolveRaySegmentIntersection(
          direction,
          polygon[edgeIndex],
          polygon[(edgeIndex + 1) % polygon.length],
        );
        if (distance !== null) firstIntersection = Math.min(firstIntersection, distance);
      }
    }

    if (!Number.isFinite(firstIntersection)) return 0;
    effectiveRadius = Math.min(effectiveRadius, firstIntersection);
  }

  return Number.isFinite(effectiveRadius) ? effectiveRadius : 0;
};

/**
 * Solve blade closure against the measured transformed geometry. The bounds
 * are physical blade poses, and the bounded search avoids aperture-specific
 * angle tables while keeping the fixed profile and pivots unchanged.
 */
const resolveConceptualApertureBladeClosure = (
  input: ConceptualApertureInput,
): number => {
  const targetOpening = resolveConceptualApertureOpening(input).openingRadiusMm;
  let lowerClosureRad = 0;
  let upperClosureRad = CONCEPTUAL_LENS_IRIS_BLADE_MAX_CLOSURE_RAD;
  const widestRadius = resolveConceptualApertureEffectiveRadius(
    resolveConceptualApertureBladesAtClosure(lowerClosureRad),
  );
  const narrowestRadius = resolveConceptualApertureEffectiveRadius(
    resolveConceptualApertureBladesAtClosure(upperClosureRad),
  );

  if (targetOpening >= widestRadius) return lowerClosureRad;
  if (targetOpening <= narrowestRadius) return upperClosureRad;

  for (let iteration = 0; iteration < CONCEPTUAL_LENS_IRIS_CLOSURE_SOLVER_ITERATIONS; iteration += 1) {
    const candidateClosureRad = (lowerClosureRad + upperClosureRad) / 2;
    const candidateRadius = resolveConceptualApertureEffectiveRadius(
      resolveConceptualApertureBladesAtClosure(candidateClosureRad),
    );
    if (candidateRadius > targetOpening) lowerClosureRad = candidateClosureRad;
    else upperClosureRad = candidateClosureRad;
  }

  return (lowerClosureRad + upperClosureRad) / 2;
};

/**
 * Resolve one shared photographic blade profile at six off-axis pivots. Every
 * blade is identical; the aperture value changes only the rotation of each
 * blade around its pivot, which makes the inner cutting edges collectively
 * define the opening.
 */
export const resolveConceptualApertureBlades = (
  input: ConceptualApertureInput = {},
): readonly ConceptualApertureBlade[] => {
  const closureRad = resolveConceptualApertureBladeClosure(input);
  return resolveConceptualApertureBladesAtClosure(closureRad);
};
