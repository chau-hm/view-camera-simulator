import type { SceneFiniteFocusStrategy } from "../../types/scene";
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
 * places the film at Z = -v, where v = fU / (U - f).
 */
export const calculateFiniteFocusFilmPlane = ({
  focalLengthMm,
  focusDistanceMm,
  strategy,
}: {
  focalLengthMm: number;
  focusDistanceMm: number;
  strategy?: SceneFiniteFocusStrategy;
}): FiniteFocusFilmPlaneResult => {
  const rawImageDistanceMm =
    strategy?.kind === "rear-standard-thin-lens"
      ? imageDistanceMm(focalLengthMm, focusDistanceMm)
      : focalLengthMm;
  const isValid = Number.isFinite(rawImageDistanceMm) && rawImageDistanceMm > 0;
  const resolvedImageDistanceMm = isValid ? rawImageDistanceMm : focalLengthMm;

  return {
    ...createFilmPlane(resolvedImageDistanceMm),
    rawImageDistanceMm,
    imageDistanceMm: resolvedImageDistanceMm,
    fallbackApplied: !isValid,
  };
};
