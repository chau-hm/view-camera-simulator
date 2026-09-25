import { useTranslation } from "react-i18next";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { useAppStore } from "../../state/appStore";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneFocalLengthCapability } from "../../types/scene";
import { resolveLensControlOptionPresentation } from "./lensControlPresentation";

type LensControlProps = {
  capability: SceneFocalLengthCapability;
  opticsState: DerivedOpticsState;
};

/** Discrete, scene-declared focal-length choices for the camera controls. */
export const LensControl = ({ capability, opticsState }: LensControlProps) => {
  const { t } = useTranslation();
  const focalLengthMm = useAppStore((state) => state.camera.focalLengthMm);
  const setFocalLength = useAppStore((state) => state.setFocalLength);

  if (!capability.enabled || capability.optionsMm.length === 0) return null;

  const selectedSemanticLabel = capability.optionLabels?.[focalLengthMm];
  const selectedPresentation = resolveLensControlOptionPresentation(
    focalLengthMm,
    selectedSemanticLabel,
  );
  const selectedLabel = selectedSemanticLabel
    ? String(
        t(
          selectedSemanticLabel === "wide"
            ? simulatorMessageKeys.controls.lensWide
            : simulatorMessageKeys.controls.lensStandard,
        ),
      )
    : null;
  const selectedLensValue = selectedLabel
    ? t(simulatorMessageKeys.controls.lensSelectedValue, {
        focalLength: focalLengthMm,
        label: selectedLabel,
      })
    : t(simulatorMessageKeys.controls.lensFocalLengthValue, {
        focalLength: focalLengthMm,
      });
  const selectedCoverageText = selectedPresentation.coveragePresentation.kind === "finite-angular"
    ? t(simulatorMessageKeys.controls.lensSimulatorCoverage, {
        angle: selectedPresentation.coveragePresentation.fullCoverageAngleDeg,
      })
    : t(simulatorMessageKeys.controls.lensCoverageNotModelled);
  const derivedFiniteCoverage = opticsState.lensCoverage?.kind === "angular" &&
    Number.isFinite(opticsState.lensCoverage.imageCircleDiameterMm)
    ? opticsState.lensCoverage
    : null;
  const imageCircleText = derivedFiniteCoverage
    ? t(
        opticsState.diagnostics.isInfinityFocus
          ? simulatorMessageKeys.controls.lensImageCircleAtInfinity
          : simulatorMessageKeys.controls.lensImageCircleAtCurrentFocus,
        { diameter: derivedFiniteCoverage.imageCircleDiameterMm.toFixed(1) },
      )
    : selectedPresentation.coveragePresentation.kind === "not-modelled"
      ? t(simulatorMessageKeys.controls.lensCoverageNotModelled)
      : t(simulatorMessageKeys.controls.lensImageCircleUnavailable);
  const hasTiltedFilmCoverage = opticsState.groundGlassCoverage.kind === "nonparallel-conic";
  const imageCircleLabel = t(
    hasTiltedFilmCoverage
      ? simulatorMessageKeys.controls.lensReferenceImageCircleLabel
      : simulatorMessageKeys.controls.lensImageCircleLabel,
  );
  const imageCircleReferenceNote = hasTiltedFilmCoverage && derivedFiniteCoverage
    ? t(simulatorMessageKeys.controls.lensImageCircleReferenceNote)
    : null;

  const selectedLensId = opticsState.lensDefinition?.id ?? selectedPresentation.lensId;
  const selectedCoverageKind = opticsState.lensCoverage?.kind ?? selectedPresentation.coveragePresentation.kind;

  // This remains the perpendicular reference-circle diagnostic, including when the film intersection is a conic.
  return (
    <fieldset
      className="lens-control"
      data-testid="lens-control"
      data-selected-lens-id={selectedLensId ?? undefined}
      data-selected-lens-coverage-kind={selectedCoverageKind}
      data-selected-lens-image-circle-diameter-mm={derivedFiniteCoverage
        ? derivedFiniteCoverage.imageCircleDiameterMm.toFixed(6)
        : undefined}
    >
      <legend className="sim-section-label">
        {t(simulatorMessageKeys.controls.lensTitle)}
      </legend>
      <p className="lens-control__copy">
        {t(simulatorMessageKeys.controls.lensCopy)}
      </p>
      <div
        className="lens-control__options"
        role="radiogroup"
        aria-label={t(simulatorMessageKeys.controls.lensOptionsLabel)}
      >
        {capability.optionsMm.map((optionMm) => {
          const semanticLabel = capability.optionLabels?.[optionMm];
          const presentation = resolveLensControlOptionPresentation(optionMm, semanticLabel);
          const optionLabel = semanticLabel
            ? String(
                t(
                  semanticLabel === "wide"
                    ? simulatorMessageKeys.controls.lensWide
                    : simulatorMessageKeys.controls.lensStandard,
                ),
              )
            : "";
          const coverageText = presentation.coveragePresentation.kind === "finite-angular"
            ? t(simulatorMessageKeys.controls.lensSimulatorCoverage, {
                angle: presentation.coveragePresentation.fullCoverageAngleDeg,
              })
            : t(simulatorMessageKeys.controls.lensCoverageNotModelled);
          const accessibleLabel = t(
            simulatorMessageKeys.controls.lensOptionLabel,
            {
              focalLength: optionMm,
              label: optionLabel,
              coverage: `${t(simulatorMessageKeys.controls.lensCoverageLabel)}: ${coverageText}`,
            },
          );
          const selected = focalLengthMm === optionMm;

          return (
            <label
              key={optionMm}
              className="lens-control__option"
              data-selected={selected}
              data-lens-id={presentation.lensId ?? undefined}
              data-coverage-kind={presentation.coveragePresentation.kind}
            >
              <input
                type="radio"
                name="scene-focal-length"
                value={optionMm}
                checked={selected}
                aria-label={accessibleLabel}
                onChange={() => setFocalLength(optionMm)}
              />
              <span className="lens-control__option-heading">
                {optionLabel ? (
                  <>
                    <span className="lens-control__option-label">{optionLabel}</span>
                    <span className="lens-control__option-separator" aria-hidden="true">·</span>
                  </>
                ) : null}
                <span className="lens-control__option-value">{optionMm} mm</span>
              </span>
              <span className="lens-control__option-coverage">
                {t(simulatorMessageKeys.controls.lensCoverageLabel)}: {coverageText}
              </span>
            </label>
          );
        })}
      </div>
      <div className="lens-control__summary" aria-live="polite">
        <div className="lens-control__summary-title">
          {t(simulatorMessageKeys.controls.lensSelectedLens)}
        </div>
        <div className="lens-control__summary-value">{selectedLensValue}</div>
        <div className="lens-control__summary-row">
          <span>{t(simulatorMessageKeys.controls.lensCoverageLabel)}</span>
          <span data-testid="lens-control-coverage-value">{selectedCoverageText}</span>
        </div>
        <div className="lens-control__summary-row">
          <span data-testid="lens-control-image-circle-label">{imageCircleLabel}</span>
          <span data-testid="lens-control-image-circle-value">{imageCircleText}</span>
        </div>
        {imageCircleReferenceNote ? (
          <p className="lens-control__copy" data-testid="lens-control-image-circle-reference-note">
            {imageCircleReferenceNote}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
};
