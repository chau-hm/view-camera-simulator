import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectApertureControlState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";
import { CAMERA_CONSTANTS, isApertureValue } from "../../utils/constants";

type ApertureControlProps = {
  apertureEnabled: boolean;
  lockReason: string;
};

export const ApertureControl = ({ apertureEnabled, lockReason }: ApertureControlProps) => {
  const { aperture } = useAppStore(useShallow(selectApertureControlState));
  const setAperture = useAppStore((state) => state.setAperture);

  return (
    <section aria-label={UI_COPY.controls.apertureTitle}>
      <h3>{UI_COPY.controls.apertureTitle}</h3>
      <select
        aria-label={UI_COPY.controls.apertureTitle}
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
