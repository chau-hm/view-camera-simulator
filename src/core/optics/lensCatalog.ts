import type { LensDefinition, LensCoverageSpec } from "../../types/lens";

const UNBOUNDED_IDEAL_COVERAGE: LensCoverageSpec = Object.freeze({
  kind: "unbounded-ideal",
});

/**
 * Published simulator teaching profiles, not measured or manufacturer data.
 * They intentionally share the infinity reference Image Circle calibrated by
 * the existing 150 mm / 72° profile. This keeps movement room approximately
 * constant while learners compare focal length and framing; it is a catalog
 * design choice, not a claim that real short lenses inherently cover wider.
 * Keep each finite angle explicit here. Runtime optics consume LensDefinition
 * data and must not infer coverage from focal length for other lenses.
 */
const SIMULATOR_PARAMETRIC_90MM_COVERAGE: LensCoverageSpec = Object.freeze({
  kind: "angular",
  fullCoverageAngleDeg: 100.8982256313,
});
const SIMULATOR_PARAMETRIC_105MM_COVERAGE: LensCoverageSpec = Object.freeze({
  kind: "angular",
  fullCoverageAngleDeg: 92.1318668688,
});
const SIMULATOR_PARAMETRIC_120MM_COVERAGE: LensCoverageSpec = Object.freeze({
  kind: "angular",
  fullCoverageAngleDeg: 84.4900859515,
});
const SIMULATOR_PARAMETRIC_150MM_COVERAGE: LensCoverageSpec = Object.freeze({
  kind: "angular",
  fullCoverageAngleDeg: 72,
});

/**
 * Explicit finite profiles for the published simulator lens choices. Their
 * angles are calibrated from R_reference = 150 * tan(72° / 2), then
 * alpha_f = 2 * atan(R_reference / f). Unknown positive focal lengths below
 * remain unbounded rather than receiving invented coverage.
 */
export const SIMULATOR_LENS_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "simulator-parametric-90mm",
    focalLengthMm: 90,
    coverage: SIMULATOR_PARAMETRIC_90MM_COVERAGE,
  }),
  Object.freeze({
    id: "simulator-parametric-105mm",
    focalLengthMm: 105,
    coverage: SIMULATOR_PARAMETRIC_105MM_COVERAGE,
  }),
  Object.freeze({
    id: "simulator-parametric-120mm",
    focalLengthMm: 120,
    coverage: SIMULATOR_PARAMETRIC_120MM_COVERAGE,
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
