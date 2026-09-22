import type {
  GroundGlassCoverageState,
  StandardFrame,
  Vec3,
} from "../types/optics";
import { add, isFiniteVec3, magnitude, scale, vec } from "../core/math/vec";

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

export type PhysicalImageCircleCoverageRay = Readonly<{
  startWorld: Vec3;
  endWorld: Vec3;
}>;

const hasUsableFrame = (frame: StandardFrame): boolean =>
  isFiniteVec3(frame.centerWorld) &&
  isFiniteVec3(frame.rightWorld) &&
  isFiniteVec3(frame.upWorld) &&
  isFiniteVec3(frame.normalWorld) &&
  magnitude(frame.rightWorld) > 1e-9 &&
  magnitude(frame.upWorld) > 1e-9 &&
  magnitude(frame.normalWorld) > 1e-9;

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
