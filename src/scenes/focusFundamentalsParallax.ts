import type { CameraState } from "../types/camera";
import type { Bounds3, DerivedOpticsState, Vec3 } from "../types/optics";
import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import { add, cross, distance, magnitude, normalize, scale, subtract } from "../core/math/vec";
import { DEFAULT_CAMERA_STATE } from "../utils/constants";
import { deriveFocusFundamentalsReferenceOptics } from "./focusFundamentalsPresentation";
import { focusFundamentalsTwoTargets } from "./definitions/focus-fundamentals-two-targets";
import {
  focusFundamentalsFrameGeometry,
  focusFundamentalsFocalLengthMm,
  focusFundamentalsObjectCenterMm,
  focusFundamentalsObjectBoundsMm,
  focusFundamentalsObjectRotationYDeg,
  focusFundamentalsReferenceFocusDepthMm,
  transformFocusFundamentalsLocalPointToWorld,
} from "./focusFundamentalsTargets";

/**
 * The parallax detector deliberately spans most of the existing subject depth
 * while leaving a small margin from the open-frame bounds. These are not focus
 * targets: they are a physical visual cue mounted on the same connected object.
 */
export const focusFundamentalsParallaxNearDepthMm = 960;
export const focusFundamentalsParallaxFarDepthMm = 1440;

/** Film-plane offset used to choose a readable, deliberately off-axis sight ray. */
export const focusFundamentalsParallaxReferenceFilmOffsetMm = {
  x: -38,
  y: -10,
} as const;

export const focusFundamentalsParallaxBracketHeightMm = 64;
export const focusFundamentalsParallaxBracketGapMm = 12;
export const focusFundamentalsParallaxBracketBarWidthMm = 10;
export const focusFundamentalsParallaxFeatureDepthMm = 8;
export const focusFundamentalsParallaxPointerHeightMm = 52;
export const focusFundamentalsParallaxPointerWidthMm = 8;
export const focusFundamentalsParallaxSupportWidthMm = 8;

export type FocusFundamentalsParallaxFeature = {
  id: "near-alignment-gate" | "far-alignment-pointer";
  label: string;
  depthMm: number;
  referenceWorldPositionMm: Vec3;
  localPositionMm: Vec3;
  supportAnchorWorldPositionMm: Vec3;
  supportAnchorLocalPositionMm: Vec3;
};

export type FocusFundamentalsParallaxReferenceGeometry = {
  opticsState: DerivedOpticsState;
  lensCenterWorldMm: Vec3;
  filmReferencePointWorldMm: Vec3;
  projectedFilmOffsetMm: Readonly<{ x: number; y: number }>;
  features: readonly FocusFundamentalsParallaxFeature[];
};

const transformWorldPointToFocusFundamentalsLocal = (worldPositionMm: Vec3): Vec3 => {
  const translated = subtract(worldPositionMm, focusFundamentalsObjectCenterMm);
  const angleRad = (-focusFundamentalsObjectRotationYDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: cos * translated.x + sin * translated.z,
    y: translated.y,
    z: -sin * translated.x + cos * translated.z,
  };
};

const deriveCanonicalReferenceOptics = (): DerivedOpticsState => {
  const referenceCamera: CameraState = {
    ...DEFAULT_CAMERA_STATE,
    ...focusFundamentalsTwoTargets.cameraPreset,
    activeSceneId: focusFundamentalsTwoTargets.id,
    focusDistanceMm: focusFundamentalsReferenceFocusDepthMm,
    focusMode: "finite",
    focusStandard: "front",
  };
  const referenceState = deriveOpticsState(referenceCamera, focusFundamentalsTwoTargets);
  const resolved = deriveFocusFundamentalsReferenceOptics(
    referenceState,
    focusFundamentalsTwoTargets,
    focusFundamentalsFocalLengthMm,
  );
  if (!resolved || resolved.diagnostics.fallbackApplied) {
    throw new Error("Focus Fundamentals parallax reference optics are invalid");
  }
  return resolved;
};

const getFilmBasis = (opticsState: DerivedOpticsState) => {
  const { topLeft, topRight, bottomLeft, bottomRight } = opticsState.filmPlaneCornersWorld;
  const center = scale(add(add(topLeft, topRight), add(bottomLeft, bottomRight)), 0.25);
  return {
    center,
    right: normalize(subtract(topRight, topLeft)),
    up: normalize(subtract(topLeft, bottomLeft)),
  };
};

const pointOnReferenceRayAtDepth = (
  lensCenterWorldMm: Vec3,
  filmReferencePointWorldMm: Vec3,
  depthMm: number,
): Vec3 => {
  const rayDirection = normalize(subtract(lensCenterWorldMm, filmReferencePointWorldMm));
  const depthParameter = (depthMm - lensCenterWorldMm.z) / rayDirection.z;
  if (!Number.isFinite(depthParameter) || depthParameter <= 0) {
    throw new Error(`Invalid Focus Fundamentals parallax depth ${depthMm}`);
  }
  return add(lensCenterWorldMm, scale(rayDirection, depthParameter));
};

const getSupportAnchorLocalPositions = () => {
  const { front, back, depthMm, memberWidthMm } = focusFundamentalsFrameGeometry;
  const frontBackSurfaceZ = front.centerZMm + depthMm / 2;
  const backFrontSurfaceZ = back.centerZMm - depthMm / 2;
  const frontHalfWidth = front.widthMm / 2 - memberWidthMm / 2;
  const frontHalfHeight = front.heightMm / 2 - memberWidthMm / 2;
  const backHalfWidth = back.widthMm / 2 - memberWidthMm / 2;
  const backHalfHeight = back.heightMm / 2 - memberWidthMm / 2;

  return {
    near: {
      x: frontHalfWidth,
      y: frontHalfHeight,
      z: frontBackSurfaceZ,
    },
    far: {
      x: backHalfWidth,
      y: backHalfHeight,
      z: backFrontSurfaceZ,
    },
  } as const;
};

const deriveGeometry = (): FocusFundamentalsParallaxReferenceGeometry => {
  const opticsState = deriveCanonicalReferenceOptics();
  const { center, right, up } = getFilmBasis(opticsState);
  const filmReferencePointWorldMm = add(
    add(center, scale(right, focusFundamentalsParallaxReferenceFilmOffsetMm.x)),
    scale(up, focusFundamentalsParallaxReferenceFilmOffsetMm.y),
  );
  const lensCenterWorldMm = { ...opticsState.lensCenterWorld };
  const nearPoint = pointOnReferenceRayAtDepth(
    lensCenterWorldMm,
    filmReferencePointWorldMm,
    focusFundamentalsParallaxNearDepthMm,
  );
  const farPoint = pointOnReferenceRayAtDepth(
    lensCenterWorldMm,
    filmReferencePointWorldMm,
    focusFundamentalsParallaxFarDepthMm,
  );
  const anchors = getSupportAnchorLocalPositions();
  const nearAnchorWorld = transformFocusFundamentalsLocalPointToWorld(anchors.near);
  const farAnchorWorld = transformFocusFundamentalsLocalPointToWorld(anchors.far);

  const features: readonly FocusFundamentalsParallaxFeature[] = [
    {
      id: "near-alignment-gate",
      label: "Near alignment gate",
      depthMm: focusFundamentalsParallaxNearDepthMm,
      referenceWorldPositionMm: nearPoint,
      localPositionMm: transformWorldPointToFocusFundamentalsLocal(nearPoint),
      supportAnchorWorldPositionMm: nearAnchorWorld,
      supportAnchorLocalPositionMm: anchors.near,
    },
    {
      id: "far-alignment-pointer",
      label: "Far alignment pointer",
      depthMm: focusFundamentalsParallaxFarDepthMm,
      referenceWorldPositionMm: farPoint,
      localPositionMm: transformWorldPointToFocusFundamentalsLocal(farPoint),
      supportAnchorWorldPositionMm: farAnchorWorld,
      supportAnchorLocalPositionMm: anchors.far,
    },
  ];

  return {
    opticsState,
    lensCenterWorldMm,
    filmReferencePointWorldMm,
    projectedFilmOffsetMm: focusFundamentalsParallaxReferenceFilmOffsetMm,
    features,
  };
};

export const focusFundamentalsParallaxReferenceGeometry = deriveGeometry();
export const focusFundamentalsParallaxFeatures =
  focusFundamentalsParallaxReferenceGeometry.features;
export const focusFundamentalsParallaxReferenceLensCenterWorldMm =
  focusFundamentalsParallaxReferenceGeometry.lensCenterWorldMm;

const connectedSubjectBoundsPoints = [
  focusFundamentalsObjectBoundsMm.min,
  focusFundamentalsObjectBoundsMm.max,
  ...focusFundamentalsParallaxFeatures.flatMap((feature) => [
    feature.referenceWorldPositionMm,
    feature.supportAnchorWorldPositionMm,
  ]),
];

/** Bounds of the rigid open-frame subject plus its physical alignment supports. */
export const focusFundamentalsConnectedSubjectBoundsMm: Bounds3 = {
  min: {
    x: Math.min(...connectedSubjectBoundsPoints.map((point) => point.x)),
    y: Math.min(...connectedSubjectBoundsPoints.map((point) => point.y)),
    z: Math.min(...connectedSubjectBoundsPoints.map((point) => point.z)),
  },
  max: {
    x: Math.max(...connectedSubjectBoundsPoints.map((point) => point.x)),
    y: Math.max(...connectedSubjectBoundsPoints.map((point) => point.y)),
    z: Math.max(...connectedSubjectBoundsPoints.map((point) => point.z)),
  },
};

/** Residual of the reference-lens collinearity contract, in mm². */
export const focusFundamentalsParallaxCollinearityResidual = (): number => {
  const [near, far] = focusFundamentalsParallaxFeatures;
  const nearVector = subtract(near.referenceWorldPositionMm, focusFundamentalsParallaxReferenceLensCenterWorldMm);
  const farVector = subtract(far.referenceWorldPositionMm, focusFundamentalsParallaxReferenceLensCenterWorldMm);
  return magnitude(cross(nearVector, farVector));
};

/** Distance from the reference lens to the alignment ray, in mm. */
export const focusFundamentalsParallaxRayLengthMm = (): number => {
  const [near] = focusFundamentalsParallaxFeatures;
  return distance(
    near.referenceWorldPositionMm,
    focusFundamentalsParallaxReferenceLensCenterWorldMm,
  );
};

/** Distance of the reference sight ray from the film centre in film-plane mm. */
export const focusFundamentalsParallaxReferenceOffsetDistanceMm = (): number => {
  const { opticsState } = focusFundamentalsParallaxReferenceGeometry;
  const { topLeft, topRight, bottomLeft, bottomRight } = opticsState.filmPlaneCornersWorld;
  const center = scale(add(add(topLeft, topRight), add(bottomLeft, bottomRight)), 0.25);
  const projected = subtract(
    focusFundamentalsParallaxReferenceGeometry.filmReferencePointWorldMm,
    center,
  );
  return magnitude(projected);
};
