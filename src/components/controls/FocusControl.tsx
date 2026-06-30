import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectFocusControlState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";
import { formatMillimeter } from "../../utils/formatters";
import { handleRangeInputKeyboard } from "../../utils/rangeInputKeyboard";

type FocusControlProps = {
  focusEnabled: boolean;
  lockReason: string;
};

export const FocusControl = ({ focusEnabled, lockReason }: FocusControlProps) => {
  const focusControl = useAppStore(useShallow(selectFocusControlState));
  const setFocusDistance = useAppStore((state) => state.setFocusDistance);

  return (
    <section aria-label={UI_COPY.controls.focusTitle}>
      <h3>{UI_COPY.controls.focusTitle}</h3>
      <label>
        {UI_COPY.controls.focusDistanceLabel} ({formatMillimeter(focusControl.focusDistanceMm)})
        <input
          aria-label={UI_COPY.controls.focusDistanceLabel}
          type="range"
          min={focusControl.focusDistanceMinMm}
          max={focusControl.focusDistanceMaxMm}
          step={10}
          value={focusControl.focusDistanceMm}
          disabled={!focusEnabled}
          onKeyDown={(event) =>
            handleRangeInputKeyboard(event, {
              value: focusControl.focusDistanceMm,
              min: focusControl.focusDistanceMinMm,
              max: focusControl.focusDistanceMaxMm,
              step: 10,
              onChangeValue: setFocusDistance,
            })
          }
          onChange={(event) => setFocusDistance(Number(event.target.value))}
        />
        {!focusEnabled && <small>{lockReason}</small>}
      </label>
    </section>
  );
};
