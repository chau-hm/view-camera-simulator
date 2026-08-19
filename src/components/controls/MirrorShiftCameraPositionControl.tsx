import { useTranslation } from "react-i18next";
import { useAppStore } from "../../state/appStore";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import {
  MIRROR_SHIFT_RIG_LATERAL_RANGE_MM,
} from "../../scenes/mirrorShiftLessonState";
import { formatMillimeter } from "../../utils/formatters";
import { handleRangeInputKeyboard } from "../../utils/rangeInputKeyboard";

export const MirrorShiftCameraPositionControl = () => {
  const { t } = useTranslation();
  const value = useAppStore(
    (state) => state.camera.mirrorShiftLessonState?.rigLateralMm ?? 0,
  );
  const setRigLateralMm = useAppStore(
    (state) => state.setMirrorShiftRigLateralMm,
  );
  const range = MIRROR_SHIFT_RIG_LATERAL_RANGE_MM;

  return (
    <section aria-label={t(simulatorMessageKeys.controls.cameraPosition)}>
      <div className="sim-section-label">{t(simulatorMessageKeys.controls.cameraPosition)}</div>
      <label className="control-label">
        <span>{formatMillimeter(value)}</span>
        <input
          aria-label={t(simulatorMessageKeys.controls.cameraPosition)}
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value}
          className="range-slider"
          onKeyDown={(event) =>
            handleRangeInputKeyboard(event, {
              value,
              min: range.min,
              max: range.max,
              step: range.step,
              onChangeValue: setRigLateralMm,
            })
          }
          onChange={(event) => setRigLateralMm(Number(event.target.value))}
        />
      </label>
      <div
        className="camera-movement-controls__range-labels"
        role="group"
        aria-label={t(simulatorMessageKeys.controls.cameraPositionDirection)}
      >
        <span>{t(simulatorMessageKeys.controls.left)}</span>
        <span>{t(simulatorMessageKeys.controls.right)}</span>
      </div>
    </section>
  );
};
