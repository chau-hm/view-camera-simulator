import { useId } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../state/appStore";
import { selectApertureControlState } from "../../state/selectors";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { CAMERA_CONSTANTS, isApertureValue } from "../../utils/constants";

type ApertureControlProps = {
  apertureEnabled: boolean;
  lockReason: string;
  lockReasonId?: string;
  showLockReason?: boolean;
  showTitle?: boolean;
};

export const ApertureControl = ({
  apertureEnabled,
  lockReason,
  lockReasonId,
  showLockReason = true,
  showTitle = true,
}: ApertureControlProps) => {
  const { t } = useTranslation();
  const { aperture } = useAppStore(useShallow(selectApertureControlState));
  const setAperture = useAppStore((state) => state.setAperture);
  const apertureLockReasonId = useId();
  const hasApertureLockReason = !apertureEnabled && Boolean(lockReason);
  const describedById = lockReasonId ?? apertureLockReasonId;

  return (
    <section
      aria-label={t(simulatorMessageKeys.controls.apertureTitle)}
      className="aperture-control"
    >
      {showTitle && <h3>{t(simulatorMessageKeys.controls.apertureTitle)}</h3>}
      <fieldset
        role="radiogroup"
        aria-label={t(simulatorMessageKeys.controls.apertureTitle)}
        className="aperture-control__options"
        disabled={!apertureEnabled}
        aria-disabled={!apertureEnabled ? "true" : undefined}
        data-selected-aperture={String(aperture)}
      >
        {CAMERA_CONSTANTS.apertureOptions.map((option) => {
          const optionLabel = t(simulatorMessageKeys.controls.apertureOptionLabel, {
            value: option,
          });
          const selected = aperture === option;

          return (
            <label
              key={option}
              className="aperture-control__option"
              data-selected={selected}
            >
              <input
                type="radio"
                name="aperture"
                value={option}
                checked={selected}
                disabled={!apertureEnabled}
                aria-label={optionLabel}
                aria-describedby={hasApertureLockReason ? describedById : undefined}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (isApertureValue(parsed)) {
                    setAperture(parsed);
                  }
                }}
              />
              <span>{optionLabel}</span>
            </label>
          );
        })}
      </fieldset>
      {showLockReason && hasApertureLockReason ? (
        <small id={apertureLockReasonId} className="control-help aperture-control__lock-reason">
          {lockReason}
        </small>
      ) : null}
    </section>
  );
};
