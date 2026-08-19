import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { selectMovementControlState } from "../../state/selectors";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../../utils/constants";
import { formatDegrees, formatMillimeter } from "../../utils/formatters";
import { useAppStore } from "../../state/appStore";
import { handleRangeInputKeyboard } from "../../utils/rangeInputKeyboard";

type MovementControlsProps = {
  riseEnabled: boolean;
  tiltEnabled: boolean;
  swingEnabled: boolean;
  lockReason: string;
  showTitle?: boolean;
};

export const MovementControls = ({ riseEnabled, tiltEnabled, swingEnabled, lockReason, showTitle = true }: MovementControlsProps) => {
  const { t } = useTranslation();
  const movement = useAppStore(useShallow(selectMovementControlState));
  const setRise = useAppStore((state) => state.setRise);
  const setTilt = useAppStore((state) => state.setTilt);
  const setSwing = useAppStore((state) => state.setSwing);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (helpOpen) closeButtonRef.current?.focus();
  }, [helpOpen]);

  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    requestAnimationFrame(() => helpButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeHelp();
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [helpOpen, closeHelp]);

  return (
    <section aria-label={t(simulatorMessageKeys.controls.movementTitle)}>
      {showTitle && <h3>{t(simulatorMessageKeys.controls.movementTitle)}</h3>}
      <button ref={helpButtonRef} type="button" onClick={() => setHelpOpen(true)} aria-label={t(simulatorMessageKeys.movementHelp.button)} className="btn btn--compact btn--secondary">
        {t(simulatorMessageKeys.movementHelp.button)}
      </button>
      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="movement-help-title"
        >
          <h4 id="movement-help-title" style={{ marginTop: 0 }}>{t(simulatorMessageKeys.movementHelp.title)}</h4>
          <p>{t(simulatorMessageKeys.movementHelp.rise)}</p>
          <p>{t(simulatorMessageKeys.movementHelp.tilt)}</p>
          <p>{t(simulatorMessageKeys.movementHelp.swing)}</p>
          <button ref={closeButtonRef} type="button" onClick={closeHelp} className="btn btn--compact btn--secondary">
            {t(simulatorMessageKeys.movementHelp.close)}
          </button>
        </div>
      )}

      <div className="control-stack">
        <label className="control-label">
          <span>{t(simulatorMessageKeys.controls.riseLabel)} ({formatMillimeter(movement.frontRiseMm)})</span>
          <input
            aria-label={t(simulatorMessageKeys.controls.riseLabel)}
            type="range"
            min={CAMERA_CONSTANTS.riseMinMm}
            max={CAMERA_CONSTANTS.riseMaxMm}
            step={CAMERA_CONTROL_STEPS.riseMm}
            value={movement.frontRiseMm}
            disabled={!riseEnabled}
            className="range-slider"
            onKeyDown={(event) =>
              handleRangeInputKeyboard(event, {
                value: movement.frontRiseMm,
                min: CAMERA_CONSTANTS.riseMinMm,
                max: CAMERA_CONSTANTS.riseMaxMm,
                step: CAMERA_CONTROL_STEPS.riseMm,
                onChangeValue: setRise,
              })
            }
            onChange={(event) => setRise(Number(event.target.value))}
          />
          {!riseEnabled && <small className="control-help">{lockReason}</small>}
        </label>

        <label className="control-label">
          <span>{t(simulatorMessageKeys.controls.tiltLabel)} ({formatDegrees(movement.frontTiltDeg)})</span>
          <input
            aria-label={t(simulatorMessageKeys.controls.tiltLabel)}
            type="range"
            min={CAMERA_CONSTANTS.tiltMinDeg}
            max={CAMERA_CONSTANTS.tiltMaxDeg}
            step={CAMERA_CONTROL_STEPS.tiltDeg}
            value={movement.frontTiltDeg}
            disabled={!tiltEnabled}
            className="range-slider"
            onKeyDown={(event) =>
              handleRangeInputKeyboard(event, {
                value: movement.frontTiltDeg,
                min: CAMERA_CONSTANTS.tiltMinDeg,
                max: CAMERA_CONSTANTS.tiltMaxDeg,
                step: CAMERA_CONTROL_STEPS.tiltDeg,
                onChangeValue: setTilt,
              })
            }
            onChange={(event) => setTilt(Number(event.target.value))}
          />
          {!tiltEnabled && <small className="control-help">{lockReason}</small>}
        </label>

        <label className="control-label">
          <span>{t(simulatorMessageKeys.controls.swingLabel)} ({formatDegrees(movement.frontSwingDeg)})</span>
          <input
            aria-label={t(simulatorMessageKeys.controls.swingLabel)}
            type="range"
            min={CAMERA_CONSTANTS.swingMinDeg}
            max={CAMERA_CONSTANTS.swingMaxDeg}
            step={CAMERA_CONTROL_STEPS.swingDeg}
            value={movement.frontSwingDeg}
            disabled={!swingEnabled}
            className="range-slider"
            onKeyDown={(event) =>
              handleRangeInputKeyboard(event, {
                value: movement.frontSwingDeg,
                min: CAMERA_CONSTANTS.swingMinDeg,
                max: CAMERA_CONSTANTS.swingMaxDeg,
                step: CAMERA_CONTROL_STEPS.swingDeg,
                onChangeValue: setSwing,
              })
            }
            onChange={(event) => setSwing(Number(event.target.value))}
          />
          {!swingEnabled && <small className="control-help">{lockReason}</small>}
        </label>
      </div>
    </section>
  );
};
