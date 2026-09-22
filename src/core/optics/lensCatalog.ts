import type { LensDefinition, LensCoverageSpec } from "../../types/lens";

const UNBOUNDED_IDEAL_COVERAGE: LensCoverageSpec = Object.freeze({
  kind: "unbounded-ideal",
});

/**
 * Explicit simulator teaching profile, not measured or manufacturer data.
 * The complete included angle is consumed by the canonical lens-coverage
 * model, which derives the radius from the current physical image distance.
 */
const SIMULATOR_PARAMETRIC_150MM_COVERAGE: LensCoverageSpec = Object.freeze({
  kind: "angular",
  fullCoverageAngleDeg: 72,
});

/**
 * Simulator compatibility definitions for the focal lengths currently used
 * by the application. They intentionally carry no finite manufacturer or
 * measured coverage claims.
 */
export const SIMULATOR_LENS_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "simulator-ideal-90mm",
    focalLengthMm: 90,
    coverage: UNBOUNDED_IDEAL_COVERAGE,
  }),
  Object.freeze({
    id: "simulator-ideal-105mm",
    focalLengthMm: 105,
    coverage: UNBOUNDED_IDEAL_COVERAGE,
  }),
  Object.freeze({
    id: "simulator-ideal-120mm",
    focalLengthMm: 120,
    coverage: UNBOUNDED_IDEAL_COVERAGE,
  }),
  Object.freeze({
    id: "simulator-parametric-150mm",
    focalLengthMm: 150,
    coverage: SIMULATOR_PARAMETRIC_150MM_COVERAGE,
  }),
] as const satisfies readonly LensDefinition[]);

/**
 * Resolve the lens specification while retaining focalLengthMm as the
 * current runtime compatibility boundary. Unknown positive focal lengths
 * remain ideal and unbounded instead of receiving an invented finite profile.
 */
export const resolveLensDefinitionForFocalLengthMm = (
  focalLengthMm: number,
): LensDefinition | null => {
  if (!Number.isFinite(focalLengthMm) || focalLengthMm <= 0) return null;

  return (
    SIMULATOR_LENS_DEFINITIONS.find((definition) => definition.focalLengthMm === focalLengthMm) ?? {
      id: `simulator-ideal-${focalLengthMm}mm`,
      focalLengthMm,
      coverage: UNBOUNDED_IDEAL_COVERAGE,
    }
  );
};
