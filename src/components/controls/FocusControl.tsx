import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectFocusControlState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";
import { focusTargetsDefs } from "../../scenes/focusFundamentalsTargets";
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
      <label className="control-label">
        {focusControl.focusMode === "infinity" ? (
          <>
            <div>Focus: ∞</div>
            <div>Last finite focus: {formatMillimeter(focusControl.lastFiniteFocusDepthMm ?? focusControl.focusDistanceMm)}</div>
          </>
        ) : (
          <>{UI_COPY.controls.focusDistanceLabel} ({formatMillimeter(focusControl.focusDistanceMm)})</>
        )}
        <input
          aria-label={UI_COPY.controls.focusDistanceLabel}
          type="range"
          min={focusControl.focusDistanceMinMm}
          max={focusControl.focusDistanceMaxMm}
          step={10}
          value={focusControl.focusDistanceMm}
          disabled={!focusEnabled}
          className="range-slider"
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
        {focusControl.focusMode === "infinity" ? (
          <small className="control-help">Last finite focus — drag to exit ∞</small>
        ) : (
          !focusEnabled && <small className="control-help">{lockReason}</small>
        )}
        {focusControl.activeSceneId === "focus-fundamentals-two-targets" && (
          <div className="control-row" style={{ marginTop: 8 }}>
            {focusTargetsDefs.map((t) => (
              <button
                key={t.id}
                type="button"
                className="btn btn--secondary btn--compact"
                onClick={() => {
                  if (typeof t.focusReferenceDepthFromRearDatumMm === "number") {
                    setFocusDistance(t.focusReferenceDepthFromRearDatumMm);
                  }
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </label>
    </section>
  );
};
