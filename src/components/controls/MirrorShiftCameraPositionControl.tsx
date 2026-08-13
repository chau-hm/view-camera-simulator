import { useAppStore } from "../../state/appStore";
import {
  MIRROR_SHIFT_RIG_LATERAL_RANGE_MM,
} from "../../scenes/mirrorShiftLessonState";
import { formatMillimeter } from "../../utils/formatters";
import { handleRangeInputKeyboard } from "../../utils/rangeInputKeyboard";

export const MirrorShiftCameraPositionControl = () => {
  const value = useAppStore(
    (state) => state.camera.mirrorShiftLessonState?.rigLateralMm ?? 0,
  );
  const setRigLateralMm = useAppStore(
    (state) => state.setMirrorShiftRigLateralMm,
  );
  const range = MIRROR_SHIFT_RIG_LATERAL_RANGE_MM;

  return (
    <section aria-label="Camera Position">
      <div className="sim-section-label">Camera Position</div>
      <label className="control-label">
        <span>{formatMillimeter(value)}</span>
        <input
          aria-label="Camera Position"
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
        aria-label="Camera Position direction"
      >
        <span>Left</span>
        <span>Right</span>
      </div>
    </section>
  );
};
