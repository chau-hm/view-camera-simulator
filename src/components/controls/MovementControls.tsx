import { CAMERA_CONSTANTS } from "../../utils/constants";
import { formatDegrees, formatMillimeter } from "../../utils/formatters";
import { useAppStore } from "../../state/appStore";

export const MovementControls = () => {
  const camera = useAppStore((state) => state.camera);
  const setRise = useAppStore((state) => state.setRise);
  const setTilt = useAppStore((state) => state.setTilt);
  const setSwing = useAppStore((state) => state.setSwing);

  return (
    <section>
      <h3>Movement</h3>
      <label>
        Rise ({formatMillimeter(camera.frontRiseMm)})
        <input
          type="range"
          min={CAMERA_CONSTANTS.riseMinMm}
          max={CAMERA_CONSTANTS.riseMaxMm}
          value={camera.frontRiseMm}
          onChange={(event) => setRise(Number(event.target.value))}
        />
      </label>
      <label>
        Tilt ({formatDegrees(camera.frontTiltDeg)})
        <input
          type="range"
          min={CAMERA_CONSTANTS.tiltMinDeg}
          max={CAMERA_CONSTANTS.tiltMaxDeg}
          step={0.1}
          value={camera.frontTiltDeg}
          onChange={(event) => setTilt(Number(event.target.value))}
        />
      </label>
      <label>
        Swing ({formatDegrees(camera.frontSwingDeg)})
        <input
          type="range"
          min={CAMERA_CONSTANTS.swingMinDeg}
          max={CAMERA_CONSTANTS.swingMaxDeg}
          step={0.1}
          value={camera.frontSwingDeg}
          onChange={(event) => setSwing(Number(event.target.value))}
        />
      </label>
    </section>
  );
};
