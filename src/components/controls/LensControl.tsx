import { useTranslation } from "react-i18next";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { useAppStore } from "../../state/appStore";
import type { SceneFocalLengthCapability } from "../../types/scene";

type LensControlProps = {
  capability: SceneFocalLengthCapability;
};

/** Discrete, scene-declared focal-length choices for the camera controls. */
export const LensControl = ({ capability }: LensControlProps) => {
  const { t } = useTranslation();
  const focalLengthMm = useAppStore((state) => state.camera.focalLengthMm);
  const setFocalLength = useAppStore((state) => state.setFocalLength);

  if (!capability.enabled || capability.optionsMm.length === 0) return null;

  return (
    <fieldset className="lens-control">
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
          const optionLabel = semanticLabel
            ? String(
                t(
                  semanticLabel === "wide"
                    ? simulatorMessageKeys.controls.lensWide
                    : simulatorMessageKeys.controls.lensStandard,
                ),
              )
            : "";
          const accessibleLabel = t(
            simulatorMessageKeys.controls.lensOptionLabel,
            {
              focalLength: optionMm,
              label: optionLabel,
            },
          );
          const selected = focalLengthMm === optionMm;

          return (
            <label
              key={optionMm}
              className="lens-control__option"
              data-selected={selected}
            >
              <input
                type="radio"
                name="scene-focal-length"
                value={optionMm}
                checked={selected}
                aria-label={accessibleLabel}
                onChange={() => setFocalLength(optionMm)}
              />
              {optionLabel ? (
                <>
                  <span className="lens-control__option-label">{optionLabel}</span>
                  <span className="lens-control__option-separator" aria-hidden="true">·</span>
                </>
              ) : null}
              <span className="lens-control__option-value">{optionMm} mm</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
