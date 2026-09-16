import { useState, useEffect, useRef, useCallback, useId } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { selectMovementControlState } from "../../state/selectors";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../../utils/constants";
import { formatDegrees, formatMillimeter } from "../../utils/formatters";
import { useAppStore } from "../../state/appStore";
import { handleRangeInputKeyboard } from "../../utils/rangeInputKeyboard";
import { CompactRangeRow } from "./CompactRangeRow";

type MovementControlsProps = {
  riseEnabled: boolean;
  tiltEnabled: boolean;
  swingEnabled: boolean;
  lockReason: string;
  lockReasonId?: string;
  showLockReason?: boolean;
  showTitle?: boolean;
};

export const MovementControls = ({
  riseEnabled,
  tiltEnabled,
  swingEnabled,
  lockReason,
  lockReasonId,
  showLockReason = true,
  showTitle = true,
}: MovementControlsProps) => {
  const { t } = useTranslation();
  const movement = useAppStore(useShallow(selectMovementControlState));
  const setRise = useAppStore((state) => state.setRise);
  const setTilt = useAppStore((state) => state.setTilt);
  const setSwing = useAppStore((state) => state.setSwing);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const helpTitleId = useId();
  const movementLockReasonId = useId();
  const hasLockedMovement = !riseEnabled || !tiltEnabled || !swingEnabled;
  const describedById = lockReasonId ?? movementLockReasonId;

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
    <section
      aria-label={t(simulatorMessageKeys.controls.movementTitle)}
      className="movement-controls"
      data-standard="front"
    >
      <div className="movement-controls__header">
        {showTitle ? (
          <h3 className="movement-controls__heading">
            {t(simulatorMessageKeys.controls.frontStandard)}
          </h3>
        ) : (
          <h4 className="movement-controls__heading">
            {t(simulatorMessageKeys.controls.frontStandard)}
          </h4>
        )}
        <button
          ref={helpButtonRef}
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label={t(simulatorMessageKeys.movementHelp.button)}
          title={t(simulatorMessageKeys.movementHelp.button)}
          className="btn btn--compact btn--secondary movement-controls__help"
        >
          <span aria-hidden="true">?</span>
        </button>
      </div>

      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={helpTitleId}
          className="movement-help-dialog"
        >
          <h4 id={helpTitleId}>{t(simulatorMessageKeys.movementHelp.title)}</h4>
          <p>{t(simulatorMessageKeys.movementHelp.rise)}</p>
          <p>{t(simulatorMessageKeys.movementHelp.tilt)}</p>
          <p>{t(simulatorMessageKeys.movementHelp.swing)}</p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeHelp}
            className="btn btn--compact btn--secondary"
          >
            {t(simulatorMessageKeys.movementHelp.close)}
          </button>
        </div>
      )}

      <div className="movement-controls__rows">
        <CompactRangeRow
          label={t(simulatorMessageKeys.controls.riseLabel)}
          value={formatMillimeter(movement.frontRiseMm)}
          active={movement.frontRiseMm !== 0}
          inputProps={{
            "aria-label": t(simulatorMessageKeys.controls.riseLabel),
            "aria-describedby": !riseEnabled && lockReason ? describedById : undefined,
            type: "range",
            min: CAMERA_CONSTANTS.riseMinMm,
            max: CAMERA_CONSTANTS.riseMaxMm,
            step: CAMERA_CONTROL_STEPS.riseMm,
            value: movement.frontRiseMm,
            disabled: !riseEnabled,
            onKeyDown: (event) =>
              handleRangeInputKeyboard(event, {
                value: movement.frontRiseMm,
                min: CAMERA_CONSTANTS.riseMinMm,
                max: CAMERA_CONSTANTS.riseMaxMm,
                step: CAMERA_CONTROL_STEPS.riseMm,
                onChangeValue: setRise,
              }),
            onChange: (event) => setRise(Number(event.target.value)),
          }}
        />

        <CompactRangeRow
          label={t(simulatorMessageKeys.controls.tiltLabel)}
          value={formatDegrees(movement.frontTiltDeg)}
          active={movement.frontTiltDeg !== 0}
          inputProps={{
            "aria-label": t(simulatorMessageKeys.controls.tiltLabel),
            "aria-describedby": !tiltEnabled && lockReason ? describedById : undefined,
            type: "range",
            min: CAMERA_CONSTANTS.tiltMinDeg,
            max: CAMERA_CONSTANTS.tiltMaxDeg,
            step: CAMERA_CONTROL_STEPS.tiltDeg,
            value: movement.frontTiltDeg,
            disabled: !tiltEnabled,
            onKeyDown: (event) =>
              handleRangeInputKeyboard(event, {
                value: movement.frontTiltDeg,
                min: CAMERA_CONSTANTS.tiltMinDeg,
                max: CAMERA_CONSTANTS.tiltMaxDeg,
                step: CAMERA_CONTROL_STEPS.tiltDeg,
                onChangeValue: setTilt,
              }),
            onChange: (event) => setTilt(Number(event.target.value)),
          }}
        />

        <CompactRangeRow
          label={t(simulatorMessageKeys.controls.swingLabel)}
          value={formatDegrees(movement.frontSwingDeg)}
          active={movement.frontSwingDeg !== 0}
          inputProps={{
            "aria-label": t(simulatorMessageKeys.controls.swingLabel),
            "aria-describedby": !swingEnabled && lockReason ? describedById : undefined,
            type: "range",
            min: CAMERA_CONSTANTS.swingMinDeg,
            max: CAMERA_CONSTANTS.swingMaxDeg,
            step: CAMERA_CONTROL_STEPS.swingDeg,
            value: movement.frontSwingDeg,
            disabled: !swingEnabled,
            onKeyDown: (event) =>
              handleRangeInputKeyboard(event, {
                value: movement.frontSwingDeg,
                min: CAMERA_CONSTANTS.swingMinDeg,
                max: CAMERA_CONSTANTS.swingMaxDeg,
                step: CAMERA_CONTROL_STEPS.swingDeg,
                onChangeValue: setSwing,
              }),
            onChange: (event) => setSwing(Number(event.target.value)),
          }}
        />
      </div>

      {showLockReason && hasLockedMovement && lockReason ? (
        <p id={movementLockReasonId} className="control-help movement-controls__lock-reason">
          <span aria-hidden="true">🔒</span>
          <span>{lockReason}</span>
        </p>
      ) : null}
    </section>
  );
};
