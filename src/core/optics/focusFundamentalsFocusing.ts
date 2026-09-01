import type { FocusStandard } from "../../types/camera";
import { imageDistanceMm, solveLensExtensionForRearDatumFocusDepth } from "./thinLensModel";

export type FocusFundamentalsFocusingResult = {
  /** Resolved standard; invalid rear requests safely fall back to front geometry. */
  standard: FocusStandard;
  /** Focus depth used for the physical focus point. Null for infinity focus. */
  focusDepthMm: number | null;
  /** Lens and film positions in the rear-datum coordinate system. */
  lensZMm: number;
  filmZMm: number;
  /** Resolved image distance and actual lens-to-subject distance for finite focus. */
  imageDistanceVMm: number;
  objectDistanceUMm: number | null;
  fallbackApplied: boolean;
  fallbackReason: string | null;
};

export type SceneRelativeSelectableFocus = {
  focusing: FocusFundamentalsFocusingResult;
  /** Fixed translation from the rear-datum solution into the scene body datum. */
  sceneOffsetZMm: number;
  /** Complete solved lens position after applying the scene translation. */
  lensZMm: number;
  /** Complete solved film position after applying the scene translation. */
  filmZMm: number;
};

type FiniteLensSolution = {
  focusDepthMm: number;
  lensZMm: number;
  filmZMm: number;
  imageDistanceVMm: number;
  objectDistanceUMm: number;
};

const solveFiniteAtRearDatum = (S: number, f: number): FiniteLensSolution | null => {
  if (!Number.isFinite(S) || !Number.isFinite(f) || f <= 0 || S < 4 * f) {
    return null;
  }

  const solved = solveLensExtensionForRearDatumFocusDepth(S, f);
  if (
    !Number.isFinite(solved.v) ||
    !Number.isFinite(solved.U) ||
    solved.v <= 0 ||
    solved.U <= f
  ) {
    return null;
  }

  return {
    focusDepthMm: S,
    lensZMm: solved.v,
    filmZMm: 0,
    imageDistanceVMm: solved.v,
    objectDistanceUMm: solved.U,
  };
};

const resolveReferenceSolution = (
  referenceFocusDepthMm: number,
  f: number,
): FiniteLensSolution | null => solveFiniteAtRearDatum(referenceFocusDepthMm, f);

const safeFiniteFallback = (
  requestedFocusDepthMm: number,
  referenceFocusDepthMm: number,
  f: number,
): FiniteLensSolution => {
  const referenceCandidate = Number.isFinite(referenceFocusDepthMm) && referenceFocusDepthMm > 0
    ? referenceFocusDepthMm
    : 0;
  const minimumPhysicalDepth = 4 * f;
  const fallbackDepth = Math.max(
    Number.isFinite(requestedFocusDepthMm) && requestedFocusDepthMm > 0
      ? requestedFocusDepthMm
      : 0,
    referenceCandidate,
    Number.isFinite(minimumPhysicalDepth) ? minimumPhysicalDepth : 0,
  );
  const resolved = solveFiniteAtRearDatum(fallbackDepth, f);
  if (resolved) return resolved;

  // deriveOpticsState rejects invalid focal lengths before this helper is called.
  // Keep this final guard finite even if a future caller violates that boundary.
  const safeFocalLength = Number.isFinite(f) && f > 0 ? f : 1;
  const safeDepth = Math.max(4 * safeFocalLength, safeFocalLength + 1);
  const safeSolution = solveFiniteAtRearDatum(safeDepth, safeFocalLength);
  if (safeSolution) return safeSolution;

  return {
    focusDepthMm: safeDepth,
    lensZMm: 2 * safeFocalLength,
    filmZMm: 0,
    imageDistanceVMm: 2 * safeFocalLength,
    objectDistanceUMm: 2 * safeFocalLength,
  };
};

export const resolveFocusFundamentalsFocusing = ({
  standard,
  focusMode,
  focusDepthMm,
  focalLengthMm,
  referenceFocusDepthMm,
}: {
  standard: FocusStandard;
  focusMode: "finite" | "infinity";
  focusDepthMm: number;
  focalLengthMm: number;
  referenceFocusDepthMm: number;
}): FocusFundamentalsFocusingResult => {
  const requestedStandard: FocusStandard = standard === "rear" ? "rear" : "front";
  const reference = resolveReferenceSolution(referenceFocusDepthMm, focalLengthMm);

  if (focusMode === "infinity") {
    if (requestedStandard === "rear" && reference) {
      const lensZMm = reference.lensZMm;
      const filmZMm = lensZMm - focalLengthMm;
      if (Number.isFinite(filmZMm)) {
        return {
          standard: "rear",
          focusDepthMm: null,
          lensZMm,
          filmZMm,
          imageDistanceVMm: focalLengthMm,
          objectDistanceUMm: null,
          fallbackApplied: false,
          fallbackReason: null,
        };
      }
    }

    return {
      standard: "front",
      focusDepthMm: null,
      lensZMm: focalLengthMm,
      filmZMm: 0,
      imageDistanceVMm: focalLengthMm,
      objectDistanceUMm: null,
      fallbackApplied: requestedStandard === "rear",
      fallbackReason:
        requestedStandard === "rear" ? "Invalid rear-standard reference focus geometry" : null,
    };
  }

  if (requestedStandard === "front") {
    const front = solveFiniteAtRearDatum(focusDepthMm, focalLengthMm);
    if (front) {
      return {
        standard: "front",
        ...front,
        fallbackApplied: false,
        fallbackReason: null,
      };
    }

    const fallback = safeFiniteFallback(focusDepthMm, referenceFocusDepthMm, focalLengthMm);
    return {
      standard: "front",
      ...fallback,
      fallbackApplied: true,
      fallbackReason: "Invalid finite front-standard focus geometry",
    };
  }

  if (reference) {
    const lensZMm = reference.lensZMm;
    const objectDistanceUMm = focusDepthMm - lensZMm;
    const imageDistanceVMm = imageDistanceMm(focalLengthMm, objectDistanceUMm);
    if (
      Number.isFinite(objectDistanceUMm) &&
      objectDistanceUMm > focalLengthMm &&
      Number.isFinite(imageDistanceVMm) &&
      imageDistanceVMm > 0
    ) {
      return {
        standard: "rear",
        focusDepthMm,
        lensZMm,
        filmZMm: lensZMm - imageDistanceVMm,
        imageDistanceVMm,
        objectDistanceUMm,
        fallbackApplied: false,
        fallbackReason: null,
      };
    }
  }

  const fallback = solveFiniteAtRearDatum(focusDepthMm, focalLengthMm)
    ?? safeFiniteFallback(focusDepthMm, referenceFocusDepthMm, focalLengthMm);
  return {
    standard: "front",
    ...fallback,
    fallbackApplied: true,
    fallbackReason: reference
      ? "Invalid rear-standard focus distance; using front-standard geometry"
      : "Invalid rear-standard reference focus geometry; using front-standard geometry",
  };
};

/**
 * Translate the complete selectable-focus solution into a scene's body datum.
 *
 * The shared solver is authoritative in the rear-datum coordinate system. The
 * scene-baseline contract changes only that coordinate origin: its fixed
 * translation is derived from the front-standard reference solution so the
 * reference lens lands at the requested scene lens datum. Translating both
 * solved lens and film coordinates preserves their optical separation.
 */
export const resolveSceneRelativeSelectableFocus = ({
  standard,
  focusMode,
  focusDepthMm,
  focalLengthMm,
  referenceFocusDepthMm,
  sceneLensDatumZMm,
}: {
  standard: FocusStandard;
  focusMode: "finite" | "infinity";
  focusDepthMm: number;
  focalLengthMm: number;
  referenceFocusDepthMm: number;
  sceneLensDatumZMm: number;
}): SceneRelativeSelectableFocus => {
  const focusing = resolveFocusFundamentalsFocusing({
    standard,
    focusMode,
    focusDepthMm,
    focalLengthMm,
    referenceFocusDepthMm,
  });

  const reference = resolveFocusFundamentalsFocusing({
    standard: "front",
    focusMode,
    focusDepthMm: referenceFocusDepthMm,
    focalLengthMm,
    referenceFocusDepthMm,
  });

  const sceneOffsetZMm = sceneLensDatumZMm - reference.lensZMm;

  return {
    focusing,
    sceneOffsetZMm,
    lensZMm: focusing.lensZMm + sceneOffsetZMm,
    filmZMm: focusing.filmZMm + sceneOffsetZMm,
  };
};
