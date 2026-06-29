import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectFocusControlState } from "../../state/selectors";
import { formatMillimeter } from "../../utils/formatters";

export const FocusControl = () => {
  const focusControl = useAppStore(useShallow(selectFocusControlState));
  const setFocusDistance = useAppStore((state) => state.setFocusDistance);

  return (
    <section>
      <h3>Focus</h3>
      <label>
        Focus distance ({formatMillimeter(focusControl.focusDistanceMm)})
        <input
          type="range"
          min={focusControl.focusDistanceMinMm}
          max={focusControl.focusDistanceMaxMm}
          step={10}
          value={focusControl.focusDistanceMm}
          onChange={(event) => setFocusDistance(Number(event.target.value))}
        />
      </label>
    </section>
  );
};
