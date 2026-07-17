import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FocusControl } from "../../components/controls/FocusControl";
import { useAppStore } from "../../state/appStore";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { cocDiameterMm } from "../../core/optics/thinLensModel";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../../utils/constants";
import { subtract, dot } from "../../core/math/vec";

describe("FocusControl presets for Focus Fundamentals", () => {
  beforeEach(() => {
    // ensure starting scene
    useAppStore.getState().setActiveScene(focusFundamentalsTwoTargets.id);
  });

  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
  });

  it("Focus Near Board sets finite focus to 1000mm and yields near-board CoC ≈ 0", () => {
    render(<FocusControl focusEnabled={true} lockReason="" />);

    // find the button by label
    const btn = screen.getByRole("button", { name: /Focus Near Board/i });
    fireEvent.click(btn);

    const camera = useAppStore.getState().camera;
    expect(camera.focusMode).toBe("finite");
    expect(camera.focusDistanceMm).toBe(1000);

    const optics = deriveOpticsState(camera, focusFundamentalsTwoTargets);
    // focus plane should be at S = 1000 mm
    expect(optics.focusPlane).not.toBeNull();
    expect(optics.focusPlane!.point.z).toBeCloseTo(1000, 6);

    // compute lens-relative axial distance U for near board and CoC
    const near = focusFundamentalsTwoTargets.focusTargets[0];
    const U = dot(subtract(near.worldPosition, optics.lensCenterWorld), optics.opticalAxis.direction);
    const imgDist = Math.abs(optics.filmPlane.point.z - optics.lensCenterWorld.z);
    const coc = cocDiameterMm(CAMERA_CONSTANTS.focalLengthMm, camera.aperture as number, imgDist, U);
    expect(Math.abs(coc)).toBeLessThan(0.05);
  });

  it("Focus Far Board sets finite focus to 3000mm and yields far-board CoC ≈ 0", () => {
    render(<FocusControl focusEnabled={true} lockReason="" />);

    const btn = screen.getByRole("button", { name: /Focus Far Board/i });
    fireEvent.click(btn);

    const camera = useAppStore.getState().camera;
    expect(camera.focusMode).toBe("finite");
    expect(camera.focusDistanceMm).toBe(3000);

    const optics = deriveOpticsState(camera, focusFundamentalsTwoTargets);
    expect(optics.focusPlane).not.toBeNull();
    expect(optics.focusPlane!.point.z).toBeCloseTo(3000, 6);

    const far = focusFundamentalsTwoTargets.focusTargets[1];
    const U = dot(subtract(far.worldPosition, optics.lensCenterWorld), optics.opticalAxis.direction);
    const imgDist = Math.abs(optics.filmPlane.point.z - optics.lensCenterWorld.z);
    const coc = cocDiameterMm(CAMERA_CONSTANTS.focalLengthMm, camera.aperture as number, imgDist, U);
    expect(Math.abs(coc)).toBeLessThan(0.05);
  });

  it("Clicking preset from Infinity exits infinity and restores finite focus plane", () => {
    // set infinity focus first
    useAppStore.getState().setInfinityFocus();
    render(<FocusControl focusEnabled={true} lockReason="" />);
    expect(useAppStore.getState().camera.focusMode).toBe("infinity");

    const btn = screen.getByRole("button", { name: /Focus Near Board/i });
    fireEvent.click(btn);

    const camera = useAppStore.getState().camera;
    expect(camera.focusMode).toBe("finite");
    expect(camera.focusDistanceMm).toBe(1000);

    const optics = deriveOpticsState(camera, focusFundamentalsTwoTargets);
    expect(optics.focusPlane).not.toBeNull();
    expect(optics.focusPlane!.point.z).toBeCloseTo(1000, 6);
  });

  it("Buttons do not change other camera controls", () => {
    const store = useAppStore.getState();
    // set some non-defaults
    store.setAperture(22);
    store.setRise(12);
    store.setTilt(3);
    store.setSwing(4);
    store.toggleFocusAssist();
    store.toggleGrid();

    render(<FocusControl focusEnabled={true} lockReason="" />);
    const apertureBefore = useAppStore.getState().camera.aperture;
    const riseBefore = useAppStore.getState().camera.frontRiseMm;
    const tiltBefore = useAppStore.getState().camera.frontTiltDeg;
    const swingBefore = useAppStore.getState().camera.frontSwingDeg;
    const focusAssistBefore = useAppStore.getState().camera.focusAssistEnabled;
    const gridBefore = useAppStore.getState().camera.gridEnabled;

    const btn = screen.getByRole("button", { name: /Focus Far Board/i });
    fireEvent.click(btn);

    expect(useAppStore.getState().camera.aperture).toBe(apertureBefore);
    expect(useAppStore.getState().camera.frontRiseMm).toBe(riseBefore);
    expect(useAppStore.getState().camera.frontTiltDeg).toBe(tiltBefore);
    expect(useAppStore.getState().camera.frontSwingDeg).toBe(swingBefore);
    expect(useAppStore.getState().camera.focusAssistEnabled).toBe(focusAssistBefore);
    expect(useAppStore.getState().camera.gridEnabled).toBe(gridBefore);
  });

  it("uses the shared focus step for range and keyboard movement", () => {
    render(<FocusControl focusEnabled={true} lockReason="" />);
    const slider = screen.getByLabelText("Focus distance");
    const before = useAppStore.getState().camera.focusDistanceMm;

    expect(slider).toHaveAttribute("step", String(CAMERA_CONTROL_STEPS.focusDistanceMm));
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    expect(useAppStore.getState().camera.focusDistanceMm).toBe(
      before + CAMERA_CONTROL_STEPS.focusDistanceMm,
    );
  });
});
