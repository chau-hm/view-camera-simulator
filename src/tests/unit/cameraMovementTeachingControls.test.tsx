import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CameraMovementTeachingControls } from "../../components/controls/CameraMovementTeachingControls";
import {
  resolveCameraMovementLessonPresentationTargetRegion,
} from "../../scenes/cameraMovementLessonState";
import { useAppStore } from "../../state/appStore";

afterEach(() => {
  cleanup();
  useAppStore.getState().resetCamera();
});

const onPublicRoute = () => {
  useAppStore.getState().initializeSimulatorRoute({
    mode: "free",
    sceneId: "understanding-camera-movements",
  });
};

describe("CameraMovementTeachingControls", () => {
  it("renders the three continuous semantic movement studies", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);

    expect(screen.getByRole("heading", { name: "Camera Movement", level: 3 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Viewpoint", level: 4 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Tilt", level: 4 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Vertical Framing", level: 4 })).toBeVisible();
    expect(screen.getByRole("slider", { name: "Viewpoint" })).toHaveAttribute("min", "-1");
    expect(screen.getByRole("slider", { name: "Viewpoint" })).toHaveAttribute("max", "1");
    expect(screen.getByRole("slider", { name: "Viewpoint" })).toHaveAttribute("step", "0.01");
    expect(screen.getByRole("slider", { name: "Tilt" })).toHaveAttribute("min", "-5");
    expect(screen.getByRole("slider", { name: "Tilt" })).toHaveAttribute("max", "5");
    expect(screen.getByRole("slider", { name: "Tilt" })).toHaveAttribute("step", "0.1");
    expect(screen.getByRole("slider", { name: "Vertical framing" })).toHaveAttribute("min", "-1");
    expect(screen.getByRole("slider", { name: "Vertical framing" })).toHaveAttribute("max", "1");
    expect(screen.getByRole("slider", { name: "Vertical framing" })).toHaveAttribute("step", "0.01");
    expect(screen.getAllByRole("slider")).toHaveLength(3);

    const tiltStandards = within(screen.getByRole("group", { name: "Tilt standard" }));
    expect(tiltStandards.getByRole("radio", { name: "Front standard" })).toBeChecked();
    expect(tiltStandards.getByRole("radio", { name: "Rear standard" })).not.toBeChecked();
    const framingStandards = within(screen.getByRole("group", { name: "Vertical framing standard" }));
    expect(framingStandards.getByRole("radio", { name: "Front standard" })).toBeChecked();
    expect(framingStandards.getByRole("radio", { name: "Rear standard" })).not.toBeChecked();
    const framingPositions = within(screen.getByRole("group", { name: "Vertical framing positions" }));
    expect(framingPositions.getByText("Lower", { exact: true })).toBeInTheDocument();
    expect(framingPositions.getByText("Middle", { exact: true })).toBeInTheDocument();
    expect(framingPositions.getByText("Upper", { exact: true })).toBeInTheDocument();
    expect(framingPositions.queryByText("Neutral", { exact: true })).not.toBeInTheDocument();
    expect(framingPositions.queryByText("Higher", { exact: true })).not.toBeInTheDocument();

    for (const label of [
      "C1 — Front rise",
      "C2 — Rear rise",
      "D1 — Front fall",
      "D2 — Rear fall",
    ]) {
      expect(screen.queryByRole("radio", { name: label })).not.toBeInTheDocument();
    }
    for (const label of [
      "Neutral",
      "A — Front tilt",
      "B — Rear tilt",
      "C3 — Higher viewpoint",
      "D3 — Lower viewpoint",
    ]) {
      expect(screen.queryByRole("radio", { name: label })).not.toBeInTheDocument();
    }
  });

  it("starts at neutral Viewpoint with semantic value text", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);

    const viewpoint = screen.getByRole("slider", { name: "Viewpoint" });
    const tilt = screen.getByRole("slider", { name: "Tilt" });
    const framing = screen.getByRole("slider", { name: "Vertical framing" });
    expect(viewpoint).toHaveValue("0");
    expect(viewpoint).toHaveAttribute("aria-valuetext", "Neutral viewpoint");
    expect(tilt).toHaveValue("0");
    expect(tilt).toHaveAttribute("aria-valuetext", "Front standard, zero tilt");
    expect(framing).toHaveValue("0");
    expect(framing).toHaveAttribute("aria-valuetext", "Front standard, middle framing");
    expect(screen.getByRole("status")).toHaveTextContent("Neutral viewpoint");
  });

  it.each([
    ["-1", -1, "low", "Lower viewpoint", "lower"],
    ["0.37", 0.37, "high", "Higher viewpoint", "upper"],
    ["1", 1, "high", "Higher viewpoint", "upper"],
  ] as const)(
    "sets continuous Viewpoint value %s through the canonical lesson state",
    (value, expectedT, expectedAnchor, expectedReadout, expectedTargetRegion) => {
      onPublicRoute();
      render(<CameraMovementTeachingControls />);

      fireEvent.change(screen.getByRole("slider", { name: "Viewpoint" }), {
        target: { value },
      });

      const state = useAppStore.getState();
      expect(state.camera.cameraMovementLessonState).toMatchObject({
        study: "viewpoint",
        viewpointT: expectedT,
        activeStandard: "front",
        tiltDeg: 0,
        framingT: 0,
      });
      expect(state.camera.viewpointAnchor).toBe(expectedAnchor);
      expect(state.camera.frontRiseMm).toBe(0);
      expect(state.camera.rearRiseMm).toBe(0);
      expect(state.camera.frontTiltDeg).toBe(0);
      expect(state.camera.rearTiltDeg).toBe(0);
      expect(state.scene.targetRegion).toBe(expectedTargetRegion);
      expect(screen.getByRole("status")).toHaveTextContent(expectedReadout);
      expect(screen.getByRole("status")).not.toHaveTextContent(/C3|D3|Custom/);
      if (state.camera.cameraMovementLessonState) {
        expect(resolveCameraMovementLessonPresentationTargetRegion(state.camera.cameraMovementLessonState)).toBe("whole");
      }
    },
  );

  it("keeps the complete lattice presentation for the neutral viewpoint endpoint", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    fireEvent.change(screen.getByRole("slider", { name: "Viewpoint" }), {
      target: { value: "0.5" },
    });
    fireEvent.change(screen.getByRole("slider", { name: "Viewpoint" }), {
      target: { value: "0" },
    });

    const state = useAppStore.getState();
    expect(state.camera.cameraMovementLessonState?.viewpointT).toBe(0);
    expect(state.camera.viewpointAnchor).toBe("mid");
    expect(resolveCameraMovementLessonPresentationTargetRegion(state.camera.cameraMovementLessonState!)).toBe("whole");
    expect(screen.getByRole("status")).toHaveTextContent("Neutral viewpoint");
  });

  it("applies positive Front tilt only and transfers the signed value to Rear", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);

    fireEvent.change(screen.getByRole("slider", { name: "Tilt" }), {
      target: { value: "5" },
    });
    let state = useAppStore.getState();
    expect(state.camera.cameraMovementLessonState).toMatchObject({
      study: "tilt",
      viewpointT: 0,
      activeStandard: "front",
      tiltDeg: 5,
      framingT: 0,
    });
    expect(state.camera.frontTiltDeg).toBe(5);
    expect(state.camera.rearTiltDeg).toBe(0);
    expect(state.camera.viewpointAnchor).toBe("mid");
    expect(resolveCameraMovementLessonPresentationTargetRegion(state.camera.cameraMovementLessonState!)).toBe("middle");
    expect(screen.getByRole("status")).toHaveTextContent("Front tilt · +5.0°");

    fireEvent.click(
      within(screen.getByRole("group", { name: "Tilt standard" })).getByRole("radio", {
        name: "Rear standard",
      }),
    );
    state = useAppStore.getState();
    expect(state.camera.cameraMovementLessonState).toMatchObject({
      study: "tilt",
      viewpointT: 0,
      activeStandard: "rear",
      tiltDeg: 5,
      framingT: 0,
    });
    expect(state.camera.frontTiltDeg).toBe(0);
    expect(state.camera.rearTiltDeg).toBe(5);
    expect(screen.getByRole("slider", { name: "Tilt" })).toHaveValue("5");
    expect(screen.getByRole("status")).toHaveTextContent("Rear tilt · +5.0°");
  });

  it("keeps negative Tilt signed and does not mix in viewpoint or framing", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    fireEvent.click(
      within(screen.getByRole("group", { name: "Tilt standard" })).getByRole("radio", {
        name: "Rear standard",
      }),
    );
    fireEvent.change(screen.getByRole("slider", { name: "Tilt" }), {
      target: { value: "-3.2" },
    });

    const state = useAppStore.getState();
    expect(state.camera.cameraMovementLessonState).toMatchObject({
      study: "tilt",
      viewpointT: 0,
      activeStandard: "rear",
      tiltDeg: -3.2,
      framingT: 0,
    });
    expect(state.camera.frontTiltDeg).toBe(0);
    expect(state.camera.rearTiltDeg).toBe(-3.2);
    expect(state.camera.viewpointAnchor).toBe("mid");
    expect(screen.getByRole("slider", { name: "Tilt" })).toHaveAttribute(
      "aria-valuetext",
      "Rear standard, negative 3.2 degrees",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Rear tilt · -3.2°");
    expect(screen.getByRole("status")).not.toHaveTextContent(/A|B|Custom/);
  });

  it("activates Tilt from Vertical Framing and clears rise/fall", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    fireEvent.change(screen.getByRole("slider", { name: "Vertical framing" }), {
      target: { value: "0.5" },
    });
    expect(useAppStore.getState().camera.cameraMovementLessonState).toMatchObject({
      study: "vertical-framing",
      framingT: 0.5,
    });

    fireEvent.change(screen.getByRole("slider", { name: "Tilt" }), {
      target: { value: "-3" },
    });
    const state = useAppStore.getState();
    expect(state.camera.cameraMovementLessonState).toMatchObject({
      study: "tilt",
      viewpointT: 0,
      tiltDeg: -3,
      framingT: 0,
    });
    expect(state.camera.frontRiseMm).toBe(0);
    expect(state.camera.rearRiseMm).toBe(0);
    expect(state.camera.frontTiltDeg).toBe(-3);
    expect(state.camera.viewpointAnchor).toBe("mid");
  });

  it("resolves continuous Front vertical framing into physical rise and semantic readout", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);

    fireEvent.change(screen.getByRole("slider", { name: "Vertical framing" }), {
      target: { value: "0.5" },
    });
    let state = useAppStore.getState();
    expect(state.camera.cameraMovementLessonState).toMatchObject({
      study: "vertical-framing",
      activeStandard: "front",
      framingT: 0.5,
    });
    expect(state.camera.frontRiseMm).toBe(10);
    expect(state.camera.rearRiseMm).toBe(0);
    expect(screen.getByRole("slider", { name: "Vertical framing" })).toHaveAttribute(
      "aria-valuetext",
      "Front standard, 50% toward upper framing",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Front standard · Upper framing · +10.0 mm",
    );

    fireEvent.change(screen.getByRole("slider", { name: "Vertical framing" }), {
      target: { value: "-0.25" },
    });
    state = useAppStore.getState();
    expect(state.camera.frontRiseMm).toBe(-5);
    expect(state.scene.targetRegion).toBe("middle");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Front standard · Lower framing · -5.0 mm",
    );
  });

  it("preserves vertical framing while transferring it to the selected Rear standard", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    const framingStandards = within(
      screen.getByRole("group", { name: "Vertical framing standard" }),
    );

    fireEvent.change(screen.getByRole("slider", { name: "Vertical framing" }), {
      target: { value: "0.35" },
    });
    fireEvent.click(framingStandards.getByRole("radio", { name: "Rear standard" }));

    const state = useAppStore.getState();
    expect(state.camera.cameraMovementLessonState).toMatchObject({
      study: "vertical-framing",
      activeStandard: "rear",
      framingT: 0.35,
      viewpointT: 0,
      tiltDeg: 0,
    });
    expect(state.camera.frontRiseMm).toBe(0);
    expect(state.camera.rearRiseMm).toBe(7);
    expect(screen.getByRole("slider", { name: "Vertical framing" })).toHaveValue("0.35");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Rear standard · Upper framing · +7.0 mm",
    );
  });

  it("resets continuous studies to the canonical neutral state", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    fireEvent.change(screen.getByRole("slider", { name: "Viewpoint" }), {
      target: { value: "-0.6" },
    });
    act(() => {
      useAppStore.getState().resetMovements();
    });

    const state = useAppStore.getState();
    expect(state.camera.cameraMovementLessonState).toMatchObject({
      study: "viewpoint",
      viewpointT: 0,
      tiltDeg: 0,
      framingT: 0,
    });
    expect(state.camera.viewpointAnchor).toBe("mid");
    expect(state.camera.cameraBodyPitchDeg).toBe(0);
    expect(state.camera.frontRiseMm).toBe(0);
    expect(state.camera.rearRiseMm).toBe(0);
    expect(screen.getByRole("slider", { name: "Viewpoint" })).toHaveValue("0");
  });
});
