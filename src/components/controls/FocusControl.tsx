import { useId } from "react";
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
import { CompactRangeRow } from "./CompactRangeRow";

type FocusControlProps = {
  focusEnabled: boolean;
  lockReason: string;
  lockReasonId?: string;
  showLockReason?: boolean;
  showTitle?: boolean;
  showInfinityReset?: boolean;
};

export const FocusControl = ({
  focusEnabled,
  lockReason,
  lockReasonId,
  showLockReason = true,
  showTitle = true,
  showInfinityReset = false,
}: FocusControlProps) => {
  const { t } = useTranslation();
  const focusControl = useAppStore(useShallow(selectFocusControlState));
  const setFocusDistance = useAppStore((state) => state.setFocusDistance);
  const setFocusStandard = useAppStore((state) => state.setFocusStandard);
  const setInfinityFocus = useAppStore((state) => state.setInfinityFocus);
  const focusLockReasonId = useId();

  const formatLastFiniteFocus = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? formatMillimeter(value) : "—";
  const hasFocusLockReason = !focusEnabled && Boolean(lockReason);
  const describedById = lockReasonId ?? focusLockReasonId;
  const focusValue = focusControl.focusMode === "infinity"
    ? t(simulatorMessageKeys.controls.focusInfinityLabel)
    : formatMillimeter(focusControl.focusDistanceMm);

  return (
    <section
      aria-label={t(simulatorMessageKeys.controls.focusTitle)}
      className="focus-control"
    >
      {showTitle && <h3>{t(simulatorMessageKeys.controls.focusTitle)}</h3>}

      <CompactRangeRow
        label={t(simulatorMessageKeys.controls.focusDistanceLabel)}
        value={focusValue}
        trailing={showInfinityReset ? (
          <button
            type="button"
            className="btn btn--compact btn--secondary focus-control__infinity"
            onClick={setInfinityFocus}
            aria-label={t(simulatorMessageKeys.controls.infinityReset)}
            title={t(simulatorMessageKeys.controls.infinityReset)}
          >
            ∞
          </button>
        ) : undefined}
        inputProps={{
          "aria-label": t(simulatorMessageKeys.controls.focusDistanceLabel),
          "aria-valuetext": focusControl.focusMode === "infinity" ? focusValue : undefined,
          "aria-describedby": hasFocusLockReason ? describedById : undefined,
          type: "range",
          min: focusControl.focusDistanceMinMm,
          max: focusControl.focusDistanceMaxMm,
          step: CAMERA_CONTROL_STEPS.focusDistanceMm,
          value: focusControl.focusDistanceMm,
          disabled: !focusEnabled,
          onKeyDown: (event) =>
            handleRangeInputKeyboard(event, {
              value: focusControl.focusDistanceMm,
              min: focusControl.focusDistanceMinMm,
              max: focusControl.focusDistanceMaxMm,
              step: CAMERA_CONTROL_STEPS.focusDistanceMm,
              onChangeValue: setFocusDistance,
            }),
          onChange: (event) => setFocusDistance(Number(event.target.value)),
        }}
      />

      {focusControl.focusMode === "infinity" ? (
        <div className="control-help focus-control__context">
          <span>
            {t(simulatorMessageKeys.controls.lastFiniteFocusLabel, {
              distance: formatLastFiniteFocus(focusControl.lastFiniteFocusDepthMm),
            })}
          </span>
          <span>{t(simulatorMessageKeys.controls.lastFiniteFocusHelp)}</span>
        </div>
      ) : null}

      {focusControl.supportsFocusStandard && (
        <fieldset
          aria-label={t(simulatorMessageKeys.controls.focusStandardGroupLabel)}
          className="focus-control__standard"
        >
          <legend>{t(simulatorMessageKeys.controls.focusWithLegend)}</legend>
          <div className="focus-control__standard-options">
            <label className="choice-label">
              <input
                className="form-radio"
                type="radio"
                name="focus-standard"
                value="front"
                checked={focusControl.focusStandard === "front"}
                disabled={!focusEnabled}
                aria-describedby={hasFocusLockReason ? describedById : undefined}
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
                aria-describedby={hasFocusLockReason ? describedById : undefined}
                onChange={() => setFocusStandard("rear")}
              />
              {t(simulatorMessageKeys.controls.rearStandard)}
            </label>
          </div>
          <small className="control-help focus-control__standard-help">
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

      {showLockReason && hasFocusLockReason ? (
        <small id={focusLockReasonId} className="control-help focus-control__lock-reason">
          {lockReason}
        </small>
      ) : null}

      {focusControl.activeSceneId === "focus-fundamentals-two-targets" && (
        <div className="focus-control__target-actions">
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
    </section>
  );
};
