import { useAppStore } from "../../state/appStore";
import type {
  CameraConfigurationMode,
  VerticalDirection,
} from "../../scenes/cameraConfigurationPresets";

const CONFIGURATION_OPTIONS: readonly {
  mode: CameraConfigurationMode;
  label: string;
}[] = [
  { mode: "whole-camera-pitch", label: "Whole camera" },
  { mode: "direct-shift", label: "Direct shift" },
  { mode: "indirect-shift", label: "Indirect shift" },
];

const DIRECTION_OPTIONS: readonly {
  direction: VerticalDirection;
  label: string;
}[] = [
  { direction: "upward", label: "Upward" },
  { direction: "downward", label: "Downward" },
];

/** Compact configuration preset selector for Understanding Camera Movements. */
export const CameraConfigurationControl = () => {
  const configurationMode = useAppStore((state) => state.configurationMode);
  const configurationDirection = useAppStore((state) => state.configurationDirection);
  const applyCameraConfiguration = useAppStore((state) => state.applyCameraConfiguration);

  return (
    <div className="camera-configuration-control" data-testid="camera-configuration-control">
      <fieldset className="camera-configuration-control__modes">
        <legend className="sim-section-label">Configuration</legend>
        <div
          className="choice-list choice-list--stacked"
          role="radiogroup"
          aria-label="Configuration"
        >
          {CONFIGURATION_OPTIONS.map(({ mode, label }) => (
            <label key={mode} className="choice-item">
              <input
                type="radio"
                name="camera-configuration-mode"
                value={mode}
                checked={configurationMode === mode}
                onChange={() => applyCameraConfiguration(mode, configurationDirection)}
                aria-label={label}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="camera-configuration-control__direction" style={{ marginTop: 8 }}>
        <legend className="sim-section-label">Direction</legend>
        <div
          className="choice-list choice-list--inline"
          role="radiogroup"
          aria-label="Direction"
        >
          {DIRECTION_OPTIONS.map(({ direction, label }) => (
            <label key={direction} className="choice-item">
              <input
                type="radio"
                name="camera-configuration-direction"
                value={direction}
                checked={
                  configurationMode !== null && configurationDirection === direction
                }
                onChange={() => {
                  // Direction alone is not a complete preset; require or reuse a mode.
                  // If no mode is active, pick Direct shift as the applies starting point.
                  const mode = configurationMode ?? "direct-shift";
                  applyCameraConfiguration(mode, direction);
                }}
                aria-label={label}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
};
