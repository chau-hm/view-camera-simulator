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

type MovementCategory = "rise" | "shift" | "tilt" | "swing";

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

  const movementCategory: MovementCategory =
    movement === "frontRiseMm" || movement === "rearRiseMm"
      ? "rise"
      : movement === "frontShiftMm" || movement === "rearShiftMm"
        ? "shift"
        : movement === "frontSwingDeg" || movement === "rearSwingDeg"
          ? "swing"
          : "tilt";

  const min = movementCategory === "rise"
    ? CAMERA_CONSTANTS.riseMinMm
    : movementCategory === "shift"
      ? CAMERA_CONSTANTS.shiftMinMm
      : movementCategory === "swing"
        ? CAMERA_CONSTANTS.swingMinDeg
        : CAMERA_CONSTANTS.tiltMinDeg;
  const max = movementCategory === "rise"
    ? CAMERA_CONSTANTS.riseMaxMm
    : movementCategory === "shift"
      ? CAMERA_CONSTANTS.shiftMaxMm
      : movementCategory === "swing"
        ? CAMERA_CONSTANTS.swingMaxDeg
        : CAMERA_CONSTANTS.tiltMaxDeg;
  const step = movementCategory === "rise"
    ? CAMERA_CONTROL_STEPS.riseMm
    : movementCategory === "shift"
      ? CAMERA_CONTROL_STEPS.shiftMm
      : movementCategory === "swing"
        ? CAMERA_CONTROL_STEPS.swingDeg
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

  const displayValue = movementCategory === "rise" || movementCategory === "shift"
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
