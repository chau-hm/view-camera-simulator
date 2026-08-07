import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import { selectFocusControlState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";
import { focusTargetsDefs } from "../../scenes/focusFundamentalsTargets";
import { formatMillimeter } from "../../utils/formatters";
import { handleRangeInputKeyboard } from "../../utils/rangeInputKeyboard";
import { CAMERA_CONTROL_STEPS } from "../../utils/constants";

type FocusControlProps = {
  focusEnabled: boolean;
  lockReason: string;
  showTitle?: boolean;
};

export const FocusControl = ({ focusEnabled, lockReason, showTitle = true }: FocusControlProps) => {
  const focusControl = useAppStore(useShallow(selectFocusControlState));
  const setFocusDistance = useAppStore((state) => state.setFocusDistance);
  const setFocusStandard = useAppStore((state) => state.setFocusStandard);

  const formatLastFiniteFocus = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? formatMillimeter(value) : '—');

  return (
    <section aria-label={UI_COPY.controls.focusTitle}>
      {showTitle && <h3>{UI_COPY.controls.focusTitle}</h3>}
      {focusControl.supportsFocusStandard && (
        <fieldset aria-label="Focus standard">
          <legend>Focus with</legend>
          <label className="choice-label">
            <input
              className="form-radio"
              type="radio"
              name="focus-standard"
              value="front"
              checked={focusControl.focusStandard === "front"}
              disabled={!focusEnabled}
              onChange={() => setFocusStandard("front")}
            />
            Front standard
          </label>
          <label className="choice-label">
            <input
              className="form-radio"
              type="radio"
              name="focus-standard"
              value="rear"
              checked={focusControl.focusStandard === "rear"}
              disabled={!focusEnabled}
              onChange={() => setFocusStandard("rear")}
            />
            Rear standard
          </label>
          <small className="control-help">
            {focusControl.focusStandard === "rear"
              ? "Moving the rear standard changes focus while keeping the lens position stable."
              : "Moving the front standard changes focus and moves the lens."}
          </small>
        </fieldset>
      )}
      <label className="control-label">
        {focusControl.focusMode === "infinity" ? (
          <>
            <div>Focus: ∞</div>
            <div>Last finite focus: {formatLastFiniteFocus(focusControl.lastFiniteFocusDepthMm)}</div>
          </>
        ) : (
          <>{UI_COPY.controls.focusDistanceLabel} ({formatMillimeter(focusControl.focusDistanceMm)})</>
        )}
        <input
          aria-label={UI_COPY.controls.focusDistanceLabel}
          type="range"
          min={focusControl.focusDistanceMinMm}
          max={focusControl.focusDistanceMaxMm}
          step={CAMERA_CONTROL_STEPS.focusDistanceMm}
          value={focusControl.focusDistanceMm}
          disabled={!focusEnabled}
          className="range-slider"
          onKeyDown={(event) =>
            handleRangeInputKeyboard(event, {
              value: focusControl.focusDistanceMm,
              min: focusControl.focusDistanceMinMm,
              max: focusControl.focusDistanceMaxMm,
              step: CAMERA_CONTROL_STEPS.focusDistanceMm,
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
