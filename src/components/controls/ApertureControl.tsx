import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectApertureControlState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";
import { CAMERA_CONSTANTS, isApertureValue } from "../../utils/constants";

export const ApertureControl = () => {
  const { aperture } = useAppStore(useShallow(selectApertureControlState));
  const setAperture = useAppStore((state) => state.setAperture);

  return (
    <section>
      <h3>{UI_COPY.controls.apertureTitle}</h3>
      <select
        value={aperture}
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
    </section>
  );
};
