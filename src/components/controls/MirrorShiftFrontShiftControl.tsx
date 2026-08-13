import { useAppStore } from "../../state/appStore";
import {
  MIRROR_SHIFT_FRONT_SHIFT_RANGE_MM,
} from "../../scenes/mirrorShiftLessonState";
import { formatMillimeter } from "../../utils/formatters";
import { handleRangeInputKeyboard } from "../../utils/rangeInputKeyboard";

export const MirrorShiftFrontShiftControl = () => {
  const value = useAppStore((state) => state.camera.frontShiftMm);
  const setFrontShiftMm = useAppStore((state) => state.setFrontShiftMm);
  const range = MIRROR_SHIFT_FRONT_SHIFT_RANGE_MM;

  return (
    <section aria-label="Front Shift">
      <div className="sim-section-label">Front Shift</div>
      <label className="control-label">
        <span>{formatMillimeter(value)}</span>
        <input
          aria-label="Front Shift"
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
              onChangeValue: setFrontShiftMm,
            })
          }
          onChange={(event) => setFrontShiftMm(Number(event.target.value))}
        />
      </label>
      <div
        className="camera-movement-controls__range-labels"
        role="group"
        aria-label="Front Shift direction"
      >
        <span>Left</span>
        <span>Right</span>
      </div>
    </section>
  );
};
