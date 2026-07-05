import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectMovementControlState } from "../../state/selectors";
import { UI_COPY } from "../../ui/copy";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { formatDegrees, formatMillimeter } from "../../utils/formatters";
import { useAppStore } from "../../state/appStore";
import { handleRangeInputKeyboard } from "../../utils/rangeInputKeyboard";

type MovementControlsProps = {
  riseEnabled: boolean;
  tiltEnabled: boolean;
  swingEnabled: boolean;
  lockReason: string;
};

export const MovementControls = ({ riseEnabled, tiltEnabled, swingEnabled, lockReason }: MovementControlsProps) => {
  const movement = useAppStore(useShallow(selectMovementControlState));
  const setRise = useAppStore((state) => state.setRise);
  const setTilt = useAppStore((state) => state.setTilt);
  const setSwing = useAppStore((state) => state.setSwing);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <section aria-label={UI_COPY.controls.movementTitle}>
      <h3>{UI_COPY.controls.movementTitle}</h3>
      <button type="button" onClick={() => setHelpOpen(true)} aria-label={UI_COPY.controls.helpButton}>
        {UI_COPY.controls.helpButton}
      </button>
      {helpOpen && (
        <div role="dialog" aria-label={UI_COPY.controls.helpTitle}>
          <p>{UI_COPY.controls.helpRise}</p>
          <p>{UI_COPY.controls.helpTilt}</p>
          <p>{UI_COPY.controls.helpSwing}</p>
          <button type="button" onClick={() => setHelpOpen(false)}>
            {UI_COPY.controls.closeHelpButton}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          {UI_COPY.controls.riseLabel} ({formatMillimeter(movement.frontRiseMm)})
          <input
            aria-label={UI_COPY.controls.riseLabel}
            type="range"
            min={CAMERA_CONSTANTS.riseMinMm}
            max={CAMERA_CONSTANTS.riseMaxMm}
            value={movement.frontRiseMm}
            disabled={!riseEnabled}
            onKeyDown={(event) =>
              handleRangeInputKeyboard(event, {
                value: movement.frontRiseMm,
                min: CAMERA_CONSTANTS.riseMinMm,
                max: CAMERA_CONSTANTS.riseMaxMm,
                step: 1,
                onChangeValue: setRise,
              })
            }
            onChange={(event) => setRise(Number(event.target.value))}
          />
          {!riseEnabled && <small>{lockReason}</small>}
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          {UI_COPY.controls.tiltLabel} ({formatDegrees(movement.frontTiltDeg)})
          <input
            aria-label={UI_COPY.controls.tiltLabel}
            type="range"
            min={CAMERA_CONSTANTS.tiltMinDeg}
            max={CAMERA_CONSTANTS.tiltMaxDeg}
            step={0.1}
            value={movement.frontTiltDeg}
            disabled={!tiltEnabled}
            onKeyDown={(event) =>
              handleRangeInputKeyboard(event, {
                value: movement.frontTiltDeg,
                min: CAMERA_CONSTANTS.tiltMinDeg,
                max: CAMERA_CONSTANTS.tiltMaxDeg,
                step: 0.1,
                onChangeValue: setTilt,
              })
            }
            onChange={(event) => setTilt(Number(event.target.value))}
          />
          {!tiltEnabled && <small>{lockReason}</small>}
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          {UI_COPY.controls.swingLabel} ({formatDegrees(movement.frontSwingDeg)})
          <input
            aria-label={UI_COPY.controls.swingLabel}
            type="range"
            min={CAMERA_CONSTANTS.swingMinDeg}
            max={CAMERA_CONSTANTS.swingMaxDeg}
            step={0.1}
            value={movement.frontSwingDeg}
            disabled={!swingEnabled}
            onKeyDown={(event) =>
              handleRangeInputKeyboard(event, {
                value: movement.frontSwingDeg,
                min: CAMERA_CONSTANTS.swingMinDeg,
                max: CAMERA_CONSTANTS.swingMaxDeg,
                step: 0.1,
                onChangeValue: setSwing,
              })
            }
            onChange={(event) => setSwing(Number(event.target.value))}
          />
          {!swingEnabled && <small>{lockReason}</small>}
        </label>
      </div>
    </section>
  );
};
