import { useAppStore } from "../../state/appStore";
import { CAMERA_CONSTANTS, isApertureValue } from "../../utils/constants";

export const ApertureControl = () => {
  const aperture = useAppStore((state) => state.camera.aperture);
  const setAperture = useAppStore((state) => state.setAperture);

  return (
    <section>
      <h3>Aperture</h3>
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
