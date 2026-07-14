import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpticalDebugPanel } from "../../components/simulator/OpticalDebugPanel";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const renderDebug = (frontTiltDeg: number) => {
  const camera = {
    ...DEFAULT_CAMERA_STATE,
    ...tableTiltScene.cameraPreset,
    activeSceneId: tableTiltScene.id,
    frontTiltDeg,
    focusDistanceMm: tableTiltGeometry.tableTiltCalibration.focusDistanceMm,
  };
  const opticsState = deriveOpticsState(camera, tableTiltScene);
  return render(
    <OpticalDebugPanel
      sceneId={tableTiltScene.id}
      mode="free"
      opticsState={opticsState}
      focalLengthMm={camera.focalLengthMm}
      focusDistanceMm={camera.focusDistanceMm}
      aperture={camera.aperture}
    />,
  );
};

describe("Optical Debug Scheimpflug diagnostics", () => {
  it("shows the validated line and residual values", () => {
    const { container } = renderDebug(tableTiltGeometry.tableTiltCalibration.frontTiltDeg);
    expect(container.textContent).toContain("Construction valid: Yes");
    expect(container.textContent).toContain("Scheimpflug line point:");
    expect(container.textContent).toContain("Scheimpflug line direction:");
    expect(container.textContent).toContain("Scheimpflug point residual:");
    expect(container.textContent).toContain("Scheimpflug direction residual:");
  });

  it("shows the documented unavailable reason for parallel planes", () => {
    const { container } = renderDebug(0);
    expect(container.textContent).toContain("Construction valid: No");
    expect(container.textContent).toContain("Film and lens planes are parallel.");
  });
});
