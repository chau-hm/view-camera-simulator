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
const CONCEPTUAL_LENS_IRIS_BLADE_PIVOT_RADIUS_MM = 19;
const CONCEPTUAL_LENS_IRIS_BLADE_LENGTH_MM = 23;
const CONCEPTUAL_LENS_IRIS_BLADE_OUTER_EXTENSION_MM = 2.5;
const CONCEPTUAL_LENS_IRIS_BLADE_WIDTH_MM = 9;
const CONCEPTUAL_LENS_IRIS_BLADE_TIP_WIDTH_MM = 5.5;
const CONCEPTUAL_LENS_IRIS_BLADE_TIP_SKEW_MM = 4;
const CONCEPTUAL_LENS_IRIS_BLADE_OPEN_ORIENTATION_RAD = Math.PI / 2;
const CONCEPTUAL_LENS_IRIS_BLADE_MAX_CLOSURE_RAD = (34 * Math.PI) / 180;
const CONCEPTUAL_LENS_IRIS_BLADE_LAYER_SPACING_MM = 0.08;

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

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Convert the canonical opening diameter into a blade rotation amount. The
 * opening radius is used only to select the pose; blade dimensions stay fixed
 * so the diaphragm closes by rotating overlapping blades instead of resizing
 * radial wedges.
 */
const resolveConceptualApertureBladeClosure = (
  opening: ConceptualApertureOpening,
): number => {
  const widestAperture = Math.min(...CAMERA_CONSTANTS.apertureOptions);
  const smallestAperture = Math.max(...CAMERA_CONSTANTS.apertureOptions);
  const widestOpening = resolveConceptualApertureOpening({ aperture: widestAperture });
  const smallestOpening = resolveConceptualApertureOpening({ aperture: smallestAperture });
  const openingRange = widestOpening.openingRadiusMm - smallestOpening.openingRadiusMm;
  const openingFraction = openingRange > 0
    ? clampUnit(
        (opening.openingRadiusMm - smallestOpening.openingRadiusMm) / openingRange,
      )
    : 1;
  return (1 - openingFraction) * CONCEPTUAL_LENS_IRIS_BLADE_MAX_CLOSURE_RAD;
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
  const opening = resolveConceptualApertureOpening(input);
  const closureRad = resolveConceptualApertureBladeClosure(opening);
  const segmentAngleRad = (Math.PI * 2) / CONCEPTUAL_LENS_IRIS_BLADE_COUNT;

  return Array.from(
    { length: CONCEPTUAL_LENS_IRIS_BLADE_COUNT },
    (_, index) => {
      const centerAngleRad = index * segmentAngleRad;

      return {
        index,
        pivot: polarPoint(CONCEPTUAL_LENS_IRIS_BLADE_PIVOT_RADIUS_MM, centerAngleRad),
        centerAngleRad,
        rotationRad: centerAngleRad + CONCEPTUAL_LENS_IRIS_BLADE_OPEN_ORIENTATION_RAD - closureRad,
        layerOffsetMm: index * CONCEPTUAL_LENS_IRIS_BLADE_LAYER_SPACING_MM,
        points: CONCEPTUAL_LENS_IRIS_BLADE_PROFILE,
      };
    },
  );
};
