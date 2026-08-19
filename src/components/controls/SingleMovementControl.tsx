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
  rearRiseMm: readoutMessageKeys.controls.rearRise,
  frontTiltDeg: readoutMessageKeys.controls.frontTilt,
  rearTiltDeg: readoutMessageKeys.controls.rearTilt,
  frontSwingDeg: readoutMessageKeys.controls.frontSwing,
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
        case "rearRiseMm":
          return state.camera.rearRiseMm;
        case "frontTiltDeg":
          return state.camera.frontTiltDeg;
        case "rearTiltDeg":
          return state.camera.rearTiltDeg;
        case "frontSwingDeg":
          return state.camera.frontSwingDeg;
      }
    }),
  );

  const setFrontRise = useAppStore((s) => s.setRise);
  const setRearRise = useAppStore((s) => s.setRearRise);
  const setFrontTilt = useAppStore((s) => s.setTilt);
  const setRearTilt = useAppStore((s) => s.setRearTilt);

  const label = t(MOVEMENT_LABEL_KEYS[movement]);

  const isRise = movement === "frontRiseMm" || movement === "rearRiseMm";

  const min = isRise ? CAMERA_CONSTANTS.riseMinMm : CAMERA_CONSTANTS.tiltMinDeg;
  const max = isRise ? CAMERA_CONSTANTS.riseMaxMm : CAMERA_CONSTANTS.tiltMaxDeg;
  const step = isRise
    ? CAMERA_CONTROL_STEPS.riseMm
    : CAMERA_CONTROL_STEPS.tiltDeg;

  const setter = useCallback(
    (v: number) => {
      switch (movement) {
        case "frontRiseMm":
          setFrontRise(v);
          break;
        case "rearRiseMm":
          setRearRise(v);
          break;
        case "frontTiltDeg":
          setFrontTilt(v);
          break;
        case "rearTiltDeg":
          setRearTilt(v);
          break;
      }
    },
    [movement, setFrontRise, setRearRise, setFrontTilt, setRearTilt],
  );

  const displayValue = isRise
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
