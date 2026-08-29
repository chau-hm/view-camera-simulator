import { fireEvent, render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SingleMovementControl } from "../../components/controls/SingleMovementControl";
import { useAppStore } from "../../state/appStore";
import type { CameraMovementField } from "../../types/scene";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../../utils/constants";

afterEach(cleanup);

const movementRangeCases: Array<{
  movement: CameraMovementField;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  {
    movement: "frontRiseMm",
    label: "Front Rise",
    min: CAMERA_CONSTANTS.riseMinMm,
    max: CAMERA_CONSTANTS.riseMaxMm,
    step: CAMERA_CONTROL_STEPS.riseMm,
  },
  {
    movement: "rearRiseMm",
    label: "Rear Rise",
    min: CAMERA_CONSTANTS.riseMinMm,
    max: CAMERA_CONSTANTS.riseMaxMm,
    step: CAMERA_CONTROL_STEPS.riseMm,
  },
  {
    movement: "frontShiftMm",
    label: "Front Shift",
    min: CAMERA_CONSTANTS.shiftMinMm,
    max: CAMERA_CONSTANTS.shiftMaxMm,
    step: CAMERA_CONTROL_STEPS.shiftMm,
  },
  {
    movement: "rearShiftMm",
    label: "Rear Shift",
    min: CAMERA_CONSTANTS.shiftMinMm,
    max: CAMERA_CONSTANTS.shiftMaxMm,
    step: CAMERA_CONTROL_STEPS.shiftMm,
  },
  {
    movement: "frontTiltDeg",
    label: "Front Tilt",
    min: CAMERA_CONSTANTS.tiltMinDeg,
    max: CAMERA_CONSTANTS.tiltMaxDeg,
    step: CAMERA_CONTROL_STEPS.tiltDeg,
  },
  {
    movement: "rearTiltDeg",
    label: "Rear Tilt",
    min: CAMERA_CONSTANTS.tiltMinDeg,
    max: CAMERA_CONSTANTS.tiltMaxDeg,
    step: CAMERA_CONTROL_STEPS.tiltDeg,
  },
  {
    movement: "frontSwingDeg",
    label: "Front Swing",
    min: CAMERA_CONSTANTS.swingMinDeg,
    max: CAMERA_CONSTANTS.swingMaxDeg,
    step: CAMERA_CONTROL_STEPS.swingDeg,
  },
  {
    movement: "rearSwingDeg",
    label: "Rear Swing",
    min: CAMERA_CONSTANTS.swingMinDeg,
    max: CAMERA_CONSTANTS.swingMaxDeg,
    step: CAMERA_CONTROL_STEPS.swingDeg,
  },
];

describe("SingleMovementControl", () => {
  beforeEach(() => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
  });

  for (const { movement, label, min, max, step } of movementRangeCases) {
    it(`${movement} uses its canonical movement range`, () => {
      const view = render(<SingleMovementControl movement={movement} />);
      const slider = view.getByRole("slider", { name: label });

      expect(slider).toHaveAttribute("min", String(min));
      expect(slider).toHaveAttribute("max", String(max));
      expect(slider).toHaveAttribute("step", String(step));
    });
  }

  it("updates frontSwingDeg through the public setter path", () => {
    const view = render(<SingleMovementControl movement="frontSwingDeg" />);
    const slider = view.getByRole("slider", { name: "Front Swing" });

    fireEvent.change(slider, { target: { value: "5" } });

    expect(useAppStore.getState().camera.frontSwingDeg).toBe(5);
  });
});
