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
  showTitle?: boolean;
};

export const ApertureControl = ({ apertureEnabled, lockReason, showTitle = true }: ApertureControlProps) => {
  const { t } = useTranslation();
  const { aperture } = useAppStore(useShallow(selectApertureControlState));
  const setAperture = useAppStore((state) => state.setAperture);

  return (
    <section aria-label={t(simulatorMessageKeys.controls.apertureTitle)}>
      {showTitle && <h3>{t(simulatorMessageKeys.controls.apertureTitle)}</h3>}
      <select
        aria-label={t(simulatorMessageKeys.controls.apertureTitle)}
        value={aperture}
        disabled={!apertureEnabled}
        className="form-select"
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (isApertureValue(parsed)) {
            setAperture(parsed);
          }
        }}
      >
        {CAMERA_CONSTANTS.apertureOptions.map((option) => (
          <option key={option} value={option}>
            f/{option}
          </option>
        ))}
      </select>
      {!apertureEnabled && <small className="control-help">{lockReason}</small>}
    </section>
  );
};
