import { useAppStore } from "../../state/appStore";
import { formatMillimeter } from "../../utils/formatters";

export const FocusControl = () => {
  const focusDistanceMm = useAppStore((state) => state.camera.focusDistanceMm);
  const setFocusDistance = useAppStore((state) => state.setFocusDistance);

  return (
    <section>
      <h3>Focus</h3>
      <label>
        Focus distance ({formatMillimeter(focusDistanceMm)})
        <input
          type="range"
          min={100}
          max={12000}
          step={10}
          value={focusDistanceMm}
          onChange={(event) => setFocusDistance(Number(event.target.value))}
        />
      </label>
    </section>
  );
};
