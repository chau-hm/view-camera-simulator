import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectFocusControlState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";
import { formatMillimeter } from "../../utils/formatters";

export const FocusControl = () => {
  const focusControl = useAppStore(useShallow(selectFocusControlState));
  const setFocusDistance = useAppStore((state) => state.setFocusDistance);

  return (
    <section>
      <h3>{UI_COPY.controls.focusTitle}</h3>
      <label>
        {UI_COPY.controls.focusDistanceLabel} ({formatMillimeter(focusControl.focusDistanceMm)})
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
