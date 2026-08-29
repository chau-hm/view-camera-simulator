import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../../state/appStore";
import type { CameraMovementField } from "../../types/scene";
import "../../i18n";
import { readoutMessageKeys, type ReadoutMessageKey } from "../../i18n/readoutMessageKeys";

import {
  CAMERA_CONSTANTS,
  CAMERA_CONTROL_STEPS,
} from "../../utils/constants";
import { formatDegrees, formatMillimeter } from "../../utils/formatters";
import { handleRangeInputKeyboard } from "../../utils/rangeInputKeyboard";

type SingleMovementControlProps = {
  movement: CameraMovementField;
};

const MOVEMENT_LABEL_KEYS: Record<CameraMovementField, ReadoutMessageKey> = {
  frontRiseMm: readoutMessageKeys.controls.frontRise,
  frontShiftMm: readoutMessageKeys.controls.frontShift,
  rearRiseMm: readoutMessageKeys.controls.rearRise,
  rearShiftMm: readoutMessageKeys.controls.rearShift,
  frontTiltDeg: readoutMessageKeys.controls.frontTilt,
  rearTiltDeg: readoutMessageKeys.controls.rearTilt,
  frontSwingDeg: readoutMessageKeys.controls.frontSwing,
  rearSwingDeg: readoutMessageKeys.controls.rearSwing,
};

export const SingleMovementControl = ({
  movement,
}: SingleMovementControlProps) => {
  const { t } = useTranslation();
  const value = useAppStore(
    useShallow((state) => {
      switch (movement) {
        case "frontRiseMm":
          return state.camera.frontRiseMm;
        case "frontShiftMm":
          return state.camera.frontShiftMm;
        case "rearRiseMm":
          return state.camera.rearRiseMm;
        case "rearShiftMm":
          return state.camera.rearShiftMm;
        case "frontTiltDeg":
          return state.camera.frontTiltDeg;
        case "rearTiltDeg":
          return state.camera.rearTiltDeg;
        case "frontSwingDeg":
          return state.camera.frontSwingDeg;
        case "rearSwingDeg":
          return state.camera.rearSwingDeg;
      }
    }),
  );

  const setFrontRise = useAppStore((s) => s.setRise);
  const setFrontShift = useAppStore((s) => s.setFrontShiftMm);
  const setRearRise = useAppStore((s) => s.setRearRise);
  const setRearShift = useAppStore((s) => s.setRearShift);
  const setFrontTilt = useAppStore((s) => s.setTilt);
  const setRearTilt = useAppStore((s) => s.setRearTilt);
  const setFrontSwing = useAppStore((s) => s.setSwing);
  const setRearSwing = useAppStore((s) => s.setRearSwing);

  const label = t(MOVEMENT_LABEL_KEYS[movement]);

  const isRise = movement === "frontRiseMm" || movement === "rearRiseMm";
  const isShift = movement === "frontShiftMm" || movement === "rearShiftMm";

  const min = isRise
    ? CAMERA_CONSTANTS.riseMinMm
    : isShift
      ? CAMERA_CONSTANTS.shiftMinMm
      : CAMERA_CONSTANTS.tiltMinDeg;
  const max = isRise
    ? CAMERA_CONSTANTS.riseMaxMm
    : isShift
      ? CAMERA_CONSTANTS.shiftMaxMm
      : CAMERA_CONSTANTS.tiltMaxDeg;
  const step = isRise
    ? CAMERA_CONTROL_STEPS.riseMm
    : isShift
      ? CAMERA_CONTROL_STEPS.shiftMm
      : CAMERA_CONTROL_STEPS.tiltDeg;

  const setter = useCallback(
    (v: number) => {
      switch (movement) {
        case "frontRiseMm":
          setFrontRise(v);
          break;
        case "frontShiftMm":
          setFrontShift(v);
          break;
        case "rearRiseMm":
          setRearRise(v);
          break;
        case "rearShiftMm":
          setRearShift(v);
          break;
        case "frontTiltDeg":
          setFrontTilt(v);
          break;
        case "rearTiltDeg":
          setRearTilt(v);
          break;
        case "frontSwingDeg":
          setFrontSwing(v);
          break;
        case "rearSwingDeg":
          setRearSwing(v);
          break;
      }
    },
    [
      movement,
      setFrontRise,
      setFrontShift,
      setRearRise,
      setRearShift,
      setFrontTilt,
      setRearTilt,
      setFrontSwing,
      setRearSwing,
    ],
  );

  const displayValue = isRise || isShift
    ? formatMillimeter(value)
    : formatDegrees(value);

  return (
    <label className="control-label">
      <span>
        {label} ({displayValue})
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="range-slider"
        onKeyDown={(event) =>
          handleRangeInputKeyboard(event, {
            value,
            min,
            max,
            step,
            onChangeValue: setter,
          })
        }
        onChange={(event) => setter(Number(event.target.value))}
      />
    </label>
  );
};
