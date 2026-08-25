import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FocusControl } from "../../components/controls/FocusControl";
import { useAppStore } from "../../state/appStore";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { cocDiameterMm } from "../../core/optics/thinLensModel";
import { CAMERA_CONTROL_STEPS } from "../../utils/constants";
import {
  focusFundamentalsFocalLengthMm,
  focusFundamentalsReferenceFocusDepthMm,
} from "../../scenes/focusFundamentalsTargets";
import { subtract, dot } from "../../core/math/vec";

const nearFocusDepthMm = focusFundamentalsTwoTargets.focusTargets[0].focusReferenceDepthFromRearDatumMm!;
const farFocusDepthMm = focusFundamentalsTwoTargets.focusTargets[1].focusReferenceDepthFromRearDatumMm!;

describe("FocusControl presets for Focus Fundamentals", () => {
  beforeEach(() => {
    // ensure starting scene
    useAppStore.getState().setActiveScene(focusFundamentalsTwoTargets.id);
  });

  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
  });

  it("Focus Near Detail sets finite focus to the canonical near depth and yields near-detail CoC ≈ 0", () => {
    render(<FocusControl focusEnabled={true} lockReason="" />);

    // find the button by label
    const btn = screen.getByRole("button", { name: /Focus Near Detail/i });
    fireEvent.click(btn);

    const camera = useAppStore.getState().camera;
    expect(camera.focusMode).toBe("finite");
    expect(camera.focusDistanceMm).toBe(nearFocusDepthMm);

    const optics = deriveOpticsState(camera, focusFundamentalsTwoTargets);
    // focus plane should be at the canonical near-detail depth
    expect(optics.focusPlane).not.toBeNull();
    expect(optics.focusPlane!.point.z).toBeCloseTo(nearFocusDepthMm, 6);

    // compute lens-relative axial distance U for the near detail and CoC
    const near = focusFundamentalsTwoTargets.focusTargets[0];
    const U = dot(subtract(near.worldPosition, optics.lensCenterWorld), optics.opticalAxis.direction);
    const imgDist = Math.abs(optics.filmPlane.point.z - optics.lensCenterWorld.z);
    const coc = cocDiameterMm(focusFundamentalsFocalLengthMm, camera.aperture as number, imgDist, U);
    expect(Math.abs(coc)).toBeLessThan(0.05);
  });

  it("Focus Far Detail sets finite focus to the canonical far depth and yields far-detail CoC ≈ 0", () => {
    render(<FocusControl focusEnabled={true} lockReason="" />);

    const btn = screen.getByRole("button", { name: /Focus Far Detail/i });
    fireEvent.click(btn);

    const camera = useAppStore.getState().camera;
    expect(camera.focusMode).toBe("finite");
    expect(camera.focusDistanceMm).toBe(farFocusDepthMm);

    const optics = deriveOpticsState(camera, focusFundamentalsTwoTargets);
    expect(optics.focusPlane).not.toBeNull();
    expect(optics.focusPlane!.point.z).toBeCloseTo(farFocusDepthMm, 6);

    const far = focusFundamentalsTwoTargets.focusTargets[1];
    const U = dot(subtract(far.worldPosition, optics.lensCenterWorld), optics.opticalAxis.direction);
    const imgDist = Math.abs(optics.filmPlane.point.z - optics.lensCenterWorld.z);
    const coc = cocDiameterMm(focusFundamentalsFocalLengthMm, camera.aperture as number, imgDist, U);
    expect(Math.abs(coc)).toBeLessThan(0.05);
  });

  it("Clicking preset from Infinity exits infinity and restores finite focus plane", () => {
    // set infinity focus first
    useAppStore.getState().setInfinityFocus();
    render(<FocusControl focusEnabled={true} lockReason="" />);
    expect(useAppStore.getState().camera.focusMode).toBe("infinity");

    const btn = screen.getByRole("button", { name: /Focus Near Detail/i });
    fireEvent.click(btn);

    const camera = useAppStore.getState().camera;
    expect(camera.focusMode).toBe("finite");
    expect(camera.focusDistanceMm).toBe(nearFocusDepthMm);

    const optics = deriveOpticsState(camera, focusFundamentalsTwoTargets);
    expect(optics.focusPlane).not.toBeNull();
    expect(optics.focusPlane!.point.z).toBeCloseTo(nearFocusDepthMm, 6);
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

    const btn = screen.getByRole("button", { name: /Focus Far Detail/i });
    fireEvent.click(btn);

    expect(useAppStore.getState().camera.aperture).toBe(apertureBefore);
    expect(useAppStore.getState().camera.frontRiseMm).toBe(riseBefore);
    expect(useAppStore.getState().camera.frontTiltDeg).toBe(tiltBefore);
    expect(useAppStore.getState().camera.frontSwingDeg).toBe(swingBefore);
    expect(useAppStore.getState().camera.focusAssistEnabled).toBe(focusAssistBefore);
    expect(useAppStore.getState().camera.gridEnabled).toBe(gridBefore);
  });

  it("uses the shared focus step for range and keyboard movement", () => {
    useAppStore.getState().setFocusDistance(focusFundamentalsReferenceFocusDepthMm);
    render(<FocusControl focusEnabled={true} lockReason="" />);
    const slider = screen.getByLabelText("Focus distance");
    const before = useAppStore.getState().camera.focusDistanceMm;

    expect(slider).toHaveAttribute("step", String(CAMERA_CONTROL_STEPS.focusDistanceMm));
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    expect(useAppStore.getState().camera.focusDistanceMm).toBe(
      before + CAMERA_CONTROL_STEPS.focusDistanceMm,
    );
  });

  it("renders accessible focus-standard radios and updates concise mode copy", () => {
    render(<FocusControl focusEnabled={true} lockReason="" />);

    expect(screen.getByText("Focus with")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Front standard" })).toBeChecked();
    const rear = screen.getByRole("radio", { name: "Rear standard" });
    fireEvent.click(rear);
    expect(rear).toBeChecked();
    expect(screen.getByText("Rear focusing moves the film while the lens/viewpoint stays fixed.")).toBeInTheDocument();
    expect(screen.getByText("Watch the white frame (near gate) and far pointer.")).toBeInTheDocument();
    expect(screen.getByText("Front focus changes their alignment; Rear focus keeps them aligned.")).toBeInTheDocument();
    expect(screen.getByText("Watch the white frame (near gate) and far pointer.").closest(".focus-parallax-help")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Front standard" }));
    expect(screen.getByText("Front focusing moves the lens/viewpoint. The film stays fixed.")).toBeInTheDocument();
  });

  it("does not render focus-standard radios for an unrelated scene", () => {
    useAppStore.getState().setActiveScene("architecture-rise");
    render(<FocusControl focusEnabled={true} lockReason="" />);
    expect(screen.queryByText("Focus with")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Front standard" })).not.toBeInTheDocument();
  });

  it("exposes the real-image minimum for a 150 mm Architecture Rise lens", () => {
    useAppStore.getState().setActiveScene("architecture-rise");
    render(<FocusControl focusEnabled={true} lockReason="" />);

    expect(screen.getByLabelText("Focus distance")).toHaveAttribute("min", "160");
  });
});
