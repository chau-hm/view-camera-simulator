import { useState, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectMovementControlState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";
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

  const closeHelp = () => {
    setHelpOpen(false);
    requestAnimationFrame(() => helpButtonRef.current?.focus());
  };

  return (
    <section aria-label={UI_COPY.controls.movementTitle}>
      {showTitle && <h3>{UI_COPY.controls.movementTitle}</h3>}
      <button ref={helpButtonRef} type="button" onClick={() => setHelpOpen(true)} aria-label={UI_COPY.controls.helpButton} className="btn btn--compact btn--secondary">
        {UI_COPY.controls.helpButton}
      </button>
      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="movement-help-title"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            closeHelp();
          }}
        >
          <h4 id="movement-help-title" style={{ marginTop: 0 }}>{UI_COPY.controls.helpTitle}</h4>
          <p>{UI_COPY.controls.helpRise}</p>
          <p>{UI_COPY.controls.helpTilt}</p>
          <p>{UI_COPY.controls.helpSwing}</p>
          <button ref={closeButtonRef} type="button" onClick={closeHelp} className="btn btn--compact btn--secondary">
            {UI_COPY.controls.closeHelpButton}
          </button>
        </div>
      )}

      <div className="control-stack">
        <label className="control-label">
          <span>{UI_COPY.controls.riseLabel} ({formatMillimeter(movement.frontRiseMm)})</span>
          <input
            aria-label={UI_COPY.controls.riseLabel}
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
          <span>{UI_COPY.controls.tiltLabel} ({formatDegrees(movement.frontTiltDeg)})</span>
          <input
            aria-label={UI_COPY.controls.tiltLabel}
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
          <span>{UI_COPY.controls.swingLabel} ({formatDegrees(movement.frontSwingDeg)})</span>
          <input
            aria-label={UI_COPY.controls.swingLabel}
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
