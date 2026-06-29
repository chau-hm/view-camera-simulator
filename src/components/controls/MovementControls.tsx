import { useShallow } from "zustand/react/shallow";
import { selectMovementControlState } from "../../state/selectors";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { formatDegrees, formatMillimeter } from "../../utils/formatters";
import { useAppStore } from "../../state/appStore";

export const MovementControls = () => {
  const movement = useAppStore(useShallow(selectMovementControlState));
  const setRise = useAppStore((state) => state.setRise);
  const setTilt = useAppStore((state) => state.setTilt);
  const setSwing = useAppStore((state) => state.setSwing);

  return (
    <section>
      <h3>Movement</h3>
      <label>
        Rise ({formatMillimeter(movement.frontRiseMm)})
        <input
          type="range"
          min={CAMERA_CONSTANTS.riseMinMm}
          max={CAMERA_CONSTANTS.riseMaxMm}
          value={movement.frontRiseMm}
          onChange={(event) => setRise(Number(event.target.value))}
        />
      </label>
      <label>
        Tilt ({formatDegrees(movement.frontTiltDeg)})
        <input
          type="range"
          min={CAMERA_CONSTANTS.tiltMinDeg}
          max={CAMERA_CONSTANTS.tiltMaxDeg}
          step={0.1}
          value={movement.frontTiltDeg}
          onChange={(event) => setTilt(Number(event.target.value))}
        />
      </label>
      <label>
        Swing ({formatDegrees(movement.frontSwingDeg)})
        <input
          type="range"
          min={CAMERA_CONSTANTS.swingMinDeg}
          max={CAMERA_CONSTANTS.swingMaxDeg}
          step={0.1}
          value={movement.frontSwingDeg}
          onChange={(event) => setSwing(Number(event.target.value))}
        />
      </label>
    </section>
  );
};
