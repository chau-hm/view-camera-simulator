import { resolveLensDefinitionForFocalLengthMm } from "../../core/optics/lensCatalog";
import type { LensId } from "../../types/lens";
import type { SceneFocalLengthOptionLabel } from "../../types/scene";

export type LensControlCoveragePresentation = Readonly<
  | {
      kind: "finite-angular";
      fullCoverageAngleDeg: number;
    }
  | {
      kind: "not-modelled";
    }
>;

export type LensControlOptionPresentation = Readonly<{
  focalLengthMm: number;
  semanticLabel: SceneFocalLengthOptionLabel | null;
  lensId: LensId | null;
  coveragePresentation: LensControlCoveragePresentation;
}>;

/**
 * Resolve learner-facing lens metadata from the existing focal-length
 * compatibility boundary. This helper deliberately exposes no physical
 * calculations and does not duplicate the catalog's definitions.
 */
export const resolveLensControlOptionPresentation = (
  focalLengthMm: number,
  semanticLabel?: SceneFocalLengthOptionLabel,
): LensControlOptionPresentation => {
  const definition = resolveLensDefinitionForFocalLengthMm(focalLengthMm);
  const coveragePresentation = definition?.coverage.kind === "angular"
    ? {
        kind: "finite-angular" as const,
        fullCoverageAngleDeg: definition.coverage.fullCoverageAngleDeg,
      }
    : { kind: "not-modelled" as const };

  return {
    focalLengthMm,
    semanticLabel: semanticLabel ?? null,
    lensId: definition?.id ?? null,
    coveragePresentation,
  };
};
