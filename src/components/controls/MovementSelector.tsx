import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../state/appStore";
import type { CameraMovementField } from "../../types/scene";
import "../../i18n";
import { readoutMessageKeys, type ReadoutMessageKey } from "../../i18n/readoutMessageKeys";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";

const MOVEMENT_LABEL_KEYS: Record<CameraMovementField, ReadoutMessageKey> = {
  frontRiseMm: readoutMessageKeys.controls.frontRise,
  rearRiseMm: readoutMessageKeys.controls.rearRise,
  frontTiltDeg: readoutMessageKeys.controls.frontTilt,
  rearTiltDeg: readoutMessageKeys.controls.rearTilt,
  frontSwingDeg: readoutMessageKeys.controls.frontSwing,
};

type MovementSelectorProps = {
  available: readonly CameraMovementField[];
  selected: CameraMovementField;
};

export const MovementSelector = ({
  available,
  selected,
}: MovementSelectorProps) => {
  const { t } = useTranslation();
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
      <legend className="sim-section-label">{t(simulatorMessageKeys.controls.movementTitle)}</legend>
      <div className="choice-list choice-list--stacked" role="radiogroup" aria-label={t(simulatorMessageKeys.controls.movementTitle)}>
        {available.map((movement) => (
          <label key={movement} className="choice-item">
            <input
              type="radio"
              name="movement-selector"
              value={movement}
              checked={movement === selected}
              onChange={() => handleChange(movement)}
            />
            <span>{t(MOVEMENT_LABEL_KEYS[movement])}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
