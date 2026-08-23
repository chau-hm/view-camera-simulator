import type { SceneFiniteFocusStrategy } from "../../types/scene";
import type { Vec3 } from "../../types/optics";
import { createFilmPlane } from "./calculateLensPlane";
import { imageDistanceMm } from "./thinLensModel";

export type FiniteFocusFilmPlaneResult = ReturnType<typeof createFilmPlane> & {
  /** Raw physical lens-to-film distance before any safety fallback. */
  rawImageDistanceMm: number;
  /** Finite positive lens-to-film distance used to construct the film plane. */
  imageDistanceMm: number;
  fallbackApplied: boolean;
};

/**
 * Resolve the zero-movement film datum from a declarative scene strategy.
 *
 * The default preserves the historical focal-length baseline. A
 * rear-standard thin-lens scene keeps its lens at the baseline origin and
 * places the film at the on-axis image point's world-Z depth, where
 * v = fU / (U - f). For a swung/tilted lens this is Z = -v * normal.z.
 */
export const calculateFiniteFocusFilmPlane = ({
  focalLengthMm,
  focusDistanceMm,
  strategy,
  lensNormalLocal,
}: {
  focalLengthMm: number;
  focusDistanceMm: number;
  strategy?: SceneFiniteFocusStrategy;
  /**
   * Object-side optical-axis direction in the camera-local frame. When a
   * rear-standard finite-focus scene has a swung/tilted lens, the on-axis
   * ideal image point has a local Z coordinate of -v * normal.z. Supplying the
   * canonical lens normal keeps the resolved film plane conjugate with that
   * focus point instead of treating v as a world-Z distance.
   */
  lensNormalLocal?: Vec3;
}): FiniteFocusFilmPlaneResult => {
  const rawImageDistanceMm =
    strategy?.kind === "rear-standard-thin-lens"
      ? imageDistanceMm(focalLengthMm, focusDistanceMm)
      : focalLengthMm;
  const isValid = Number.isFinite(rawImageDistanceMm) && rawImageDistanceMm > 0;
  const resolvedImageDistanceMm = isValid ? rawImageDistanceMm : focalLengthMm;
  const projectedImageDepthMm =
    strategy?.kind === "rear-standard-thin-lens" &&
    lensNormalLocal &&
    Number.isFinite(lensNormalLocal.z) &&
    lensNormalLocal.z > 0
      ? resolvedImageDistanceMm * lensNormalLocal.z
      : resolvedImageDistanceMm;

  return {
    ...createFilmPlane(projectedImageDepthMm),
    rawImageDistanceMm,
    imageDistanceMm: resolvedImageDistanceMm,
    fallbackApplied: !isValid,
  };
};
