import type {
  GroundGlassCoverageState,
  StandardFrame,
  Vec3,
} from "../types/optics";
import {
  add,
  cross,
  dot,
  isFiniteVec3,
  magnitude,
  scale,
  vec,
} from "../core/math/vec";

/** Stable perimeter resolution for the physical 3D teaching overlay. */
export const PHYSICAL_IMAGE_CIRCLE_SEGMENT_COUNT = 72;

/** Sparse boundary rays keep the coverage-cone cue readable beside FOV rays. */
export const PHYSICAL_IMAGE_CIRCLE_COVERAGE_RAY_COUNT = 12;

export type PhysicalImageCircleRenderGeometry = Readonly<{
  /** Physical circle centre in the canonical world-space rear-standard basis. */
  centerWorld: Vec3;
  /** Canonical rear-standard normal; all perimeter points lie on this plane. */
  normalWorld: Vec3;
  /** Radius copied from the canonical Ground Glass finite-coverage state. */
  radiusMm: number;
  /** Canonical film-relative offsets used to resolve `centerWorld`. */
  opticalAxisOffsetXMm: number;
  opticalAxisOffsetYMm: number;
  /** Unique perimeter samples in canonical world-space millimetres. */
  perimeterWorld: readonly Vec3[];
  /** Sparse endpoints selected from `perimeterWorld`, never recalculated from angle. */
  coverageRayEndpointsWorld: readonly Vec3[];
}>;

export type PhysicalLensCoverageRenderGeometry =
  | (PhysicalImageCircleRenderGeometry & Readonly<{ kind: "parallel-circle" }>)
  | Readonly<{
      kind: "nonparallel-conic";
      /** Conic centre in the canonical rear-standard film-local basis. */
      centerFilmXMm: number;
      centerFilmYMm: number;
      /** Principal semi-axes and orientation of the local closed-ellipse display. */
      semiAxis1Mm: number;
      semiAxis2Mm: number;
      orientationRad: number;
      centerWorld: Vec3;
      normalWorld: Vec3;
      perimeterWorld: readonly Vec3[];
      coverageRayEndpointsWorld: readonly Vec3[];
    }>;

export type PhysicalLensCoverageRay = Readonly<{
  startWorld: Vec3;
  endWorld: Vec3;
}>;

/** Legacy name retained for callers that explicitly deal with the circle. */
export type PhysicalImageCircleCoverageRay = PhysicalLensCoverageRay;

export type PhysicalLensCoverageSurfaceMesh = Readonly<{
  /** Centre followed by the exact boundary perimeter samples. */
  verticesWorld: readonly Vec3[];
  /** One triangle per perimeter segment, using a centre fan. */
  triangleIndices: readonly number[];
}>;

const hasUsableFrame = (frame: StandardFrame): boolean =>
  isFiniteVec3(frame.centerWorld) &&
  isFiniteVec3(frame.rightWorld) &&
  isFiniteVec3(frame.upWorld) &&
  isFiniteVec3(frame.normalWorld) &&
  magnitude(frame.rightWorld) > 1e-9 &&
  magnitude(frame.upWorld) > 1e-9 &&
  magnitude(frame.normalWorld) > 1e-9;

const FRAME_TOLERANCE = 1e-6;
const CONIC_RELATIVE_TOLERANCE = 1e-12;
const CONIC_RESIDUAL_TOLERANCE = 1e-8;
const IMAGE_SIDE_RELATIVE_TOLERANCE = 1e-10;

const hasUsableConicFrame = (frame: StandardFrame): boolean => {
  const { centerWorld, rightWorld, upWorld, normalWorld, plane } = frame;
  if (
    !isFiniteVec3(centerWorld) ||
    !isFiniteVec3(rightWorld) ||
    !isFiniteVec3(upWorld) ||
    !isFiniteVec3(normalWorld) ||
    !isFiniteVec3(plane.point) ||
    !isFiniteVec3(plane.normal) ||
    !Number.isFinite(plane.distance)
  ) {
    return false;
  }

  const rightLength = magnitude(rightWorld);
  const upLength = magnitude(upWorld);
  const normalLength = magnitude(normalWorld);
  const planeNormalLength = magnitude(plane.normal);
  return (
    Math.abs(rightLength - 1) <= FRAME_TOLERANCE &&
    Math.abs(upLength - 1) <= FRAME_TOLERANCE &&
    Math.abs(normalLength - 1) <= FRAME_TOLERANCE &&
    Math.abs(planeNormalLength - 1) <= FRAME_TOLERANCE &&
    Math.abs(dot(rightWorld, upWorld)) <= FRAME_TOLERANCE &&
    Math.abs(dot(rightWorld, normalWorld)) <= FRAME_TOLERANCE &&
    Math.abs(dot(upWorld, normalWorld)) <= FRAME_TOLERANCE &&
    Math.abs(dot(cross(rightWorld, upWorld), normalWorld)) >= 1 - FRAME_TOLERANCE &&
    Math.abs(dot(normalWorld, plane.normal)) >= 1 - FRAME_TOLERANCE &&
    Math.abs(dot(rightWorld, plane.normal)) <= FRAME_TOLERANCE &&
    Math.abs(dot(upWorld, plane.normal)) <= FRAME_TOLERANCE &&
    Math.abs(dot(plane.normal, plane.point) - plane.distance) <= 1e-5 &&
    Math.abs(dot(plane.normal, centerWorld) - plane.distance) <= 1e-5
  );
};

type NormalizedQuadratic = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

const normalizeClosedQuadratic = (
  quadratic: Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>["quadratic"],
): NormalizedQuadratic | null => {
  const source = [
    quadratic.a,
    quadratic.b,
    quadratic.c,
    quadratic.d,
    quadratic.e,
    quadratic.f,
  ];
  if (!source.every(Number.isFinite)) return null;
  const coefficientScale = Math.max(...source.map(Math.abs));
  if (!Number.isFinite(coefficientScale) || coefficientScale <= 0) return null;

  let [a, b, c, d, e, f] = source.map((value) => value / coefficientScale);
  const halfB = b / 2;
  const matrixScale = Math.max(Math.abs(a), Math.abs(halfB), Math.abs(c));
  if (!Number.isFinite(matrixScale) || matrixScale <= 0) return null;

  const determinant = a * c - halfB * halfB;
  const determinantTolerance =
    matrixScale * matrixScale * CONIC_RELATIVE_TOLERANCE;
  if (
    !Number.isFinite(determinant) ||
    determinant <= determinantTolerance
  ) {
    return null;
  }

  // The canonical Q may be multiplied by any non-zero scalar. Flip only this
  // render-local copy when the quadratic matrix is negative definite.
  if (a + c < 0) {
    a = -a;
    b = -b;
    c = -c;
    d = -d;
    e = -e;
    f = -f;
  }
  if (a <= 0 || c <= 0) return null;
  return { a, b, c, d, e, f };
};

const evaluateQuadratic = (
  quadratic: NormalizedQuadratic,
  x: number,
  y: number,
): { value: number; termScale: number } => {
  const terms = [
    quadratic.a * x * x,
    quadratic.b * x * y,
    quadratic.c * y * y,
    quadratic.d * x,
    quadratic.e * y,
    quadratic.f,
  ];
  return {
    value: terms.reduce((sum, term) => sum + term, 0),
    termScale: terms.reduce((sum, term) => sum + Math.abs(term), 0),
  };
};

const resolveNonparallelConicGeometry = (input: {
  coverage: Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>;
  rearStandardFrame: StandardFrame;
  segmentCount: number;
}): Extract<PhysicalLensCoverageRenderGeometry, { kind: "nonparallel-conic" }> | null => {
  const { coverage, rearStandardFrame, segmentCount } = input;
  if (
    !Number.isInteger(segmentCount) ||
    segmentCount < PHYSICAL_IMAGE_CIRCLE_COVERAGE_RAY_COUNT ||
    !hasUsableConicFrame(rearStandardFrame)
  ) {
    return null;
  }

  const axial = coverage.axial;
  if (![axial.x, axial.y, axial.constant].every(Number.isFinite)) return null;

  const quadratic = normalizeClosedQuadratic(coverage.quadratic);
  if (!quadratic) return null;
  const { a, b, c, d, e, f } = quadratic;
  const halfB = b / 2;
  const determinant = a * c - halfB * halfB;
  if (!Number.isFinite(determinant) || determinant <= 0) return null;

  // Solve 2 M centre + linear = 0 for M = [[a,b/2],[b/2,c]].
  const centerFilmXMm = (halfB * e - c * d) / (2 * determinant);
  const centerFilmYMm = (halfB * d - a * e) / (2 * determinant);
  if (!Number.isFinite(centerFilmXMm) || !Number.isFinite(centerFilmYMm)) {
    return null;
  }

  // At the stationary point, cᵀMc = -0.5 lᵀc.
  const centerLinearTerm = d * centerFilmXMm + e * centerFilmYMm;
  const centeredValue = f + 0.5 * centerLinearTerm;
  const centeredScale = Math.max(
    1,
    Math.abs(f),
    0.5 * Math.abs(d * centerFilmXMm),
    0.5 * Math.abs(e * centerFilmYMm),
  );
  if (
    !Number.isFinite(centeredValue) ||
    !Number.isFinite(centeredScale) ||
    centeredValue >= -CONIC_RELATIVE_TOLERANCE * centeredScale
  ) {
    return null;
  }

  const orientationRad = 0.5 * Math.atan2(b, a - c);
  const cosine = Math.cos(orientationRad);
  const sine = Math.sin(orientationRad);
  const eigenvalue1 =
    a * cosine * cosine + b * cosine * sine + c * sine * sine;
  const eigenvalue2 =
    a * sine * sine - b * cosine * sine + c * cosine * cosine;
  const matrixScale = Math.max(Math.abs(a), Math.abs(halfB), Math.abs(c));
  const eigenvalueTolerance = matrixScale * CONIC_RELATIVE_TOLERANCE;
  if (
    !Number.isFinite(eigenvalue1) ||
    !Number.isFinite(eigenvalue2) ||
    eigenvalue1 <= eigenvalueTolerance ||
    eigenvalue2 <= eigenvalueTolerance
  ) {
    return null;
  }

  const semiAxis1Mm = Math.sqrt(-centeredValue / eigenvalue1);
  const semiAxis2Mm = Math.sqrt(-centeredValue / eigenvalue2);
  if (
    !Number.isFinite(semiAxis1Mm) ||
    !Number.isFinite(semiAxis2Mm) ||
    semiAxis1Mm <= 0 ||
    semiAxis2Mm <= 0
  ) {
    return null;
  }

  const imageSideAtCenter =
    axial.x * centerFilmXMm + axial.y * centerFilmYMm + axial.constant;
  const imageSideCosine =
    (axial.x * cosine + axial.y * sine) * semiAxis1Mm;
  const imageSideSine =
    (axial.x * -sine + axial.y * cosine) * semiAxis2Mm;
  const minimumImageSideDistance =
    imageSideAtCenter - Math.hypot(imageSideCosine, imageSideSine);
  const imageSideScale = Math.max(
    1,
    Math.abs(imageSideAtCenter),
    Math.abs(imageSideCosine),
    Math.abs(imageSideSine),
  );
  if (
    !Number.isFinite(imageSideAtCenter) ||
    !Number.isFinite(imageSideCosine) ||
    !Number.isFinite(imageSideSine) ||
    !Number.isFinite(minimumImageSideDistance) ||
    minimumImageSideDistance <= IMAGE_SIDE_RELATIVE_TOLERANCE * imageSideScale
  ) {
    return null;
  }

  const right = rearStandardFrame.rightWorld;
  const up = rearStandardFrame.upWorld;
  const centerWorld = add(
    rearStandardFrame.centerWorld,
    add(scale(right, centerFilmXMm), scale(up, centerFilmYMm)),
  );
  if (!isFiniteVec3(centerWorld)) return null;

  const perimeterWorld: Vec3[] = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const angleRad = (index / segmentCount) * Math.PI * 2;
    const cosineDistance = semiAxis1Mm * Math.cos(angleRad);
    const sineDistance = semiAxis2Mm * Math.sin(angleRad);
    const x =
      centerFilmXMm + cosine * cosineDistance - sine * sineDistance;
    const y =
      centerFilmYMm + sine * cosineDistance + cosine * sineDistance;
    const { value, termScale } = evaluateQuadratic(quadratic, x, y);
    const imageSideDistance = axial.x * x + axial.y * y + axial.constant;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(value) ||
      !Number.isFinite(termScale) ||
      Math.abs(value) > CONIC_RESIDUAL_TOLERANCE * Math.max(termScale, 1e-12) ||
      !Number.isFinite(imageSideDistance) ||
      imageSideDistance <= IMAGE_SIDE_RELATIVE_TOLERANCE * imageSideScale
    ) {
      return null;
    }
    const point = add(
      centerWorld,
      add(
        scale(right, x - centerFilmXMm),
        scale(up, y - centerFilmYMm),
      ),
    );
    if (!isFiniteVec3(point)) return null;
    perimeterWorld.push(point);
  }

  const coverageRayEndpointsWorld = Array.from(
    { length: PHYSICAL_IMAGE_CIRCLE_COVERAGE_RAY_COUNT },
    (_, index) =>
      perimeterWorld[
        Math.floor((index * segmentCount) / PHYSICAL_IMAGE_CIRCLE_COVERAGE_RAY_COUNT)
      ],
  );
  if (coverageRayEndpointsWorld.some((point) => !point || !isFiniteVec3(point))) {
    return null;
  }

  return {
    kind: "nonparallel-conic",
    centerFilmXMm,
    centerFilmYMm,
    semiAxis1Mm,
    semiAxis2Mm,
    orientationRad,
    centerWorld,
    normalWorld: rearStandardFrame.normalWorld,
    perimeterWorld,
    coverageRayEndpointsWorld,
  };
};

/**
 * Spatialize the canonical finite parallel-film coverage state for Three.js.
 *
 * This is deliberately a render adapter, not another coverage model. The
 * radius and film-relative offsets come from `GroundGlassCoverageState`; the
 * rear-standard frame supplies the rigid world-space basis. Invalid and
 * non-parallel states return null rather than fabricating display geometry.
 */
export const resolvePhysicalImageCircleRenderGeometry = (input: {
  coverage: GroundGlassCoverageState;
  rearStandardFrame: StandardFrame;
  segmentCount?: number;
}): PhysicalImageCircleRenderGeometry | null => {
  const { coverage, rearStandardFrame } = input;
  const segmentCount = input.segmentCount ?? PHYSICAL_IMAGE_CIRCLE_SEGMENT_COUNT;
  if (
    coverage.kind !== "parallel-circle" ||
    !Number.isInteger(segmentCount) ||
    segmentCount < PHYSICAL_IMAGE_CIRCLE_COVERAGE_RAY_COUNT ||
    !Number.isFinite(coverage.imageCircleRadiusMm) ||
    coverage.imageCircleRadiusMm <= 0 ||
    !Number.isFinite(coverage.opticalAxisOffsetXMm) ||
    !Number.isFinite(coverage.opticalAxisOffsetYMm) ||
    !hasUsableFrame(rearStandardFrame)
  ) {
    return null;
  }

  const centerWorld = add(
    rearStandardFrame.centerWorld,
    add(
      scale(rearStandardFrame.rightWorld, coverage.opticalAxisOffsetXMm),
      scale(rearStandardFrame.upWorld, coverage.opticalAxisOffsetYMm),
    ),
  );
  if (!isFiniteVec3(centerWorld)) return null;

  const perimeterWorld = Array.from({ length: segmentCount }, (_, index) => {
    const angleRad = (index / segmentCount) * Math.PI * 2;
    return add(
      centerWorld,
      add(
        scale(rearStandardFrame.rightWorld, coverage.imageCircleRadiusMm * Math.cos(angleRad)),
        scale(rearStandardFrame.upWorld, coverage.imageCircleRadiusMm * Math.sin(angleRad)),
      ),
    );
  });
  if (perimeterWorld.some((point) => !isFiniteVec3(point))) return null;

  const coverageRayEndpointsWorld = Array.from(
    { length: PHYSICAL_IMAGE_CIRCLE_COVERAGE_RAY_COUNT },
    (_, index) => perimeterWorld[Math.floor((index * segmentCount) / PHYSICAL_IMAGE_CIRCLE_COVERAGE_RAY_COUNT)],
  );
  if (coverageRayEndpointsWorld.some((point) => !point || !isFiniteVec3(point))) {
    return null;
  }

  return {
    centerWorld,
    normalWorld: rearStandardFrame.normalWorld,
    radiusMm: coverage.imageCircleRadiusMm,
    opticalAxisOffsetXMm: coverage.opticalAxisOffsetXMm,
    opticalAxisOffsetYMm: coverage.opticalAxisOffsetYMm,
    perimeterWorld,
    coverageRayEndpointsWorld,
  };
};

/**
 * Decompose the canonical film-local quadratic only for its finite 3D
 * visualization. No lens angle, coverage cone, or optical state is rebuilt.
 */
export const resolvePhysicalLensCoverageRenderGeometry = (input: {
  coverage: GroundGlassCoverageState;
  rearStandardFrame: StandardFrame;
  segmentCount?: number;
}): PhysicalLensCoverageRenderGeometry | null => {
  const segmentCount =
    input.segmentCount ?? PHYSICAL_IMAGE_CIRCLE_SEGMENT_COUNT;
  if (input.coverage.kind === "parallel-circle") {
    const circle = resolvePhysicalImageCircleRenderGeometry({
      coverage: input.coverage,
      rearStandardFrame: input.rearStandardFrame,
      segmentCount,
    });
    return circle ? { kind: "parallel-circle", ...circle } : null;
  }
  if (input.coverage.kind !== "nonparallel-conic") return null;
  return resolveNonparallelConicGeometry({
    coverage: input.coverage,
    rearStandardFrame: input.rearStandardFrame,
    segmentCount,
  });
};

/** Resolve the same lens-to-perimeter rays for either finite-coverage shape. */
export const resolvePhysicalLensCoverageRays = (input: {
  geometry: PhysicalLensCoverageRenderGeometry | null;
  lensCenterWorld: Vec3;
}): readonly PhysicalLensCoverageRay[] => {
  if (!input.geometry || !isFiniteVec3(input.lensCenterWorld)) return [];
  return input.geometry.coverageRayEndpointsWorld.map((endWorld) => ({
    startWorld: vec(
      input.lensCenterWorld.x,
      input.lensCenterWorld.y,
      input.lensCenterWorld.z,
    ),
    endWorld,
  }));
};

/** Triangulate the exact rendered perimeter as a convex centre fan. */
export const createPhysicalLensCoverageSurfaceMesh = (
  geometry: PhysicalLensCoverageRenderGeometry,
): PhysicalLensCoverageSurfaceMesh | null => {
  const { perimeterWorld, centerWorld } = geometry;
  if (
    !isFiniteVec3(centerWorld) ||
    perimeterWorld.length < 3 ||
    perimeterWorld.some((point) => !isFiniteVec3(point))
  ) {
    return null;
  }

  const triangleIndices: number[] = [];
  for (let index = 0; index < perimeterWorld.length; index += 1) {
    triangleIndices.push(
      0,
      index + 1,
      ((index + 1) % perimeterWorld.length) + 1,
    );
  }
  return {
    verticesWorld: [centerWorld, ...perimeterWorld],
    triangleIndices,
  };
};

/** Build sparse image-side rays from the lens centre to the canonical circle. */
export const resolvePhysicalImageCircleCoverageRays = (input: {
  geometry: PhysicalImageCircleRenderGeometry | null;
  lensCenterWorld: Vec3;
}): readonly PhysicalImageCircleCoverageRay[] => {
  if (!input.geometry || !isFiniteVec3(input.lensCenterWorld)) return [];
  return input.geometry.coverageRayEndpointsWorld.map((endWorld) => ({
    startWorld: vec(
      input.lensCenterWorld.x,
      input.lensCenterWorld.y,
      input.lensCenterWorld.z,
    ),
    endWorld,
  }));
};
