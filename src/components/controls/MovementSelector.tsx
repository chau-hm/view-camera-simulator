import { useCallback } from "react";
import { useAppStore } from "../../state/appStore";
import type { CameraMovementField } from "../../types/scene";

const MOVEMENT_LABELS: Record<CameraMovementField, string> = {
  frontRiseMm: "Front Rise",
  rearRiseMm: "Rear Rise",
  frontTiltDeg: "Front Tilt",
  rearTiltDeg: "Rear Tilt",
  frontSwingDeg: "Front Swing",
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

  const handleChange = useCallback(
    (movement: CameraMovementField) => {
      setSelectedMovement(movement);
    },
    [setSelectedMovement],
  );

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
            <span>{MOVEMENT_LABELS[movement] ?? movement}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
