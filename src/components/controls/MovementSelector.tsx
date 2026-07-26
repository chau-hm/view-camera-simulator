import { useCallback } from "react";
import { resolveSceneRiseRangeMm } from "../../scenes/cameraConfigurationPresets";
import { useAppStore } from "../../state/appStore";
import type { CameraMovementField } from "../../types/scene";

const MOVEMENT_LABELS: Record<CameraMovementField, string> = {
  frontRiseMm: "Front Rise",
  rearRiseMm: "Rear Rise",
  frontTiltDeg: "Front Tilt",
  rearTiltDeg: "Rear Tilt",
  frontSwingDeg: "Front Swing",
};

const SIGNED_RISE_LABELS: Partial<Record<CameraMovementField, string>> = {
  frontRiseMm: "Front Rise / Fall",
  rearRiseMm: "Rear Rise / Fall",
};

type MovementSelectorProps = {
  available: readonly CameraMovementField[];
  selected: CameraMovementField;
};

export const MovementSelector = ({
  available,
  selected,
}: MovementSelectorProps) => {
  const setSelectedMovement = useAppStore(
    (state) => state.setSelectedMovement,
  );
  const sceneId = useAppStore((state) => state.camera.activeSceneId);
  const signedRise = resolveSceneRiseRangeMm(sceneId).minMm < 0;

  const handleChange = useCallback(
    (movement: CameraMovementField) => {
      setSelectedMovement(movement);
    },
    [setSelectedMovement],
  );

  const labelFor = (movement: CameraMovementField): string => {
    if (signedRise && SIGNED_RISE_LABELS[movement]) {
      return SIGNED_RISE_LABELS[movement] as string;
    }
    return MOVEMENT_LABELS[movement] ?? movement;
  };

  return (
    <fieldset className="movement-selector">
      <legend className="sim-section-label">Movement</legend>
      <div className="choice-list choice-list--stacked" role="radiogroup" aria-label="Movement">
        {available.map((movement) => (
          <label key={movement} className="choice-item">
            <input
              type="radio"
              name="movement-selector"
              value={movement}
              checked={movement === selected}
              onChange={() => handleChange(movement)}
            />
            <span>{labelFor(movement)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
