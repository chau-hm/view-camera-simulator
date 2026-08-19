import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../state/appStore";
import { selectFocusControlState } from "../../state/selectors";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
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
  const { t } = useTranslation();
  const focusControl = useAppStore(useShallow(selectFocusControlState));
  const setFocusDistance = useAppStore((state) => state.setFocusDistance);
  const setFocusStandard = useAppStore((state) => state.setFocusStandard);

  const formatLastFiniteFocus = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? formatMillimeter(value) : '—');

  return (
    <section aria-label={t(simulatorMessageKeys.controls.focusTitle)}>
      {showTitle && <h3>{t(simulatorMessageKeys.controls.focusTitle)}</h3>}
      {focusControl.supportsFocusStandard && (
        <fieldset aria-label={t(simulatorMessageKeys.controls.focusStandardGroupLabel)}>
          <legend>{t(simulatorMessageKeys.controls.focusWithLegend)}</legend>
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
            {t(simulatorMessageKeys.controls.frontStandard)}
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
            {t(simulatorMessageKeys.controls.rearStandard)}
          </label>
          <small className="control-help">
            {focusControl.focusStandard === "rear"
              ? t(simulatorMessageKeys.controls.rearFocusHelp)
              : t(simulatorMessageKeys.controls.frontFocusHelp)}
          </small>
          {focusControl.activeSceneId === "focus-fundamentals-two-targets" && (
            <small className="control-help focus-parallax-help">
              <span>{t(simulatorMessageKeys.controls.focusTargetObservationNear)}</span>
              <span>{t(simulatorMessageKeys.controls.focusTargetObservationAlignment)}</span>
            </small>
          )}
        </fieldset>
      )}
      <label className="control-label">
        {focusControl.focusMode === "infinity" ? (
          <>
            <div>{t(simulatorMessageKeys.controls.focusInfinityLabel)}</div>
            <div>
              {t(simulatorMessageKeys.controls.lastFiniteFocusLabel, {
                distance: formatLastFiniteFocus(focusControl.lastFiniteFocusDepthMm),
              })}
            </div>
          </>
        ) : (
          <>{t(simulatorMessageKeys.controls.focusDistanceLabel)} ({formatMillimeter(focusControl.focusDistanceMm)})</>
        )}
        <input
          aria-label={t(simulatorMessageKeys.controls.focusDistanceLabel)}
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
          <small className="control-help">{t(simulatorMessageKeys.controls.lastFiniteFocusHelp)}</small>
        ) : (
          !focusEnabled && <small className="control-help">{lockReason}</small>
        )}
        {focusControl.activeSceneId === "focus-fundamentals-two-targets" && (
          <div className="control-row" style={{ marginTop: 8 }}>
            {focusTargetsDefs.map((target) => (
              <button
                key={target.id}
                type="button"
                className="btn btn--secondary btn--compact"
                onClick={() => {
                  if (typeof target.focusReferenceDepthFromRearDatumMm === "number") {
                    setFocusDistance(target.focusReferenceDepthFromRearDatumMm);
                  }
                }}
              >
                {t(
                  target.id === "focus-near-detail"
                    ? simulatorMessageKeys.controls.focusNearDetailButton
                    : simulatorMessageKeys.controls.focusFarDetailButton,
                )}
              </button>
            ))}
          </div>
        )}
      </label>
    </section>
  );
};
