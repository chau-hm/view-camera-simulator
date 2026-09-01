import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "../../i18n";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { resolveFocusFundamentalsFocusing } from "../../core/optics/focusFundamentalsFocusing";
import { viewCameraAnatomyScene } from "../../scenes/definitions/view-camera-anatomy";
import { useAppStore } from "../../state/appStore";

beforeEach(async () => {
  await i18n.changeLanguage("en");
  useAppStore.getState().resetCamera();
});

afterEach(() => {
  cleanup();
  useAppStore.getState().resetCamera();
});

const renderAnatomyLesson = () =>
  render(
    <MemoryRouter initialEntries={["/simulator/free/view-camera-anatomy?lesson=1"]}>
      <SimulatorWorkspace
        mode="free"
        sceneId="view-camera-anatomy"
        taskId={null}
        anatomyLessonEnabled
        simulateAssetFailure={false}
      />
    </MemoryRouter>,
  );

describe("Lesson 0 integration", () => {
  it("progresses through anatomy and lets the learner use the canonical controls", async () => {
    renderAnatomyLesson();

    expect(await screen.findByRole("heading", { name: "The complete camera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Front Standard" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Aperture" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show a smaller opening" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show a smaller opening" }));
    expect(screen.getByRole("button", { name: "Show a wider opening" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(useAppStore.getState().camera.aperture).toBe(11);

    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByRole("heading", { name: "Ground Glass", level: 3 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Film Holder", level: 3 })).toBeInTheDocument();
    expect(useAppStore.getState().camera.aperture).toBe(11);

    for (let index = 0; index < 2; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByRole("heading", { name: "Recap", level: 3 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Now try the controls" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Front Rise" })).toBeInTheDocument();
    const rise = screen.getByRole("slider", { name: "Front Rise" });
    expect(rise).toHaveValue("0");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toHaveClass("btn--disabled");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Move the control enough to make the physical change clear.",
    );
    fireEvent.change(rise, { target: { value: "3" } });
    expect(rise).toHaveValue("3");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toHaveClass("btn--disabled");

    fireEvent.change(rise, { target: { value: "12" } });
    expect(useAppStore.getState().camera.frontRiseMm).toBe(12);
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).not.toHaveClass("btn--disabled");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Good — the physical change is now visible.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const frontShift = screen.getByRole("slider", { name: "Front Shift" });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    fireEvent.change(frontShift, { target: { value: "12" } });
    expect(useAppStore.getState().camera.frontShiftMm).toBe(12);
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const tilt = screen.getByRole("slider", { name: "Front Tilt" });
    fireEvent.change(tilt, { target: { value: "3" } });
    expect(useAppStore.getState().camera.frontTiltDeg).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const swing = screen.getByRole("slider", { name: "Front Swing" });
    fireEvent.change(swing, { target: { value: "3" } });
    expect(useAppStore.getState().camera.frontSwingDeg).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Focus — Front Standard" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Front standard" })).toBeChecked();
    fireEvent.change(screen.getByRole("slider", { name: "Focus distance" }), {
      target: { value: "2200" },
    });
    expect(useAppStore.getState().camera).toMatchObject({
      focusStandard: "front",
      focusDistanceMm: 2200,
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Focus — Rear Standard" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Rear standard" })).toBeChecked();
    fireEvent.change(screen.getByRole("slider", { name: "Focus distance" }), {
      target: { value: "2200" },
    });
    expect(useAppStore.getState().camera).toMatchObject({
      focusStandard: "rear",
      focusDistanceMm: 2200,
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Aperture control" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Aperture" }), {
      target: { value: "5.6" },
    });
    expect(useAppStore.getState().camera.aperture).toBe(5.6);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Controls recap" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Lesson complete");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    const recapOptics = deriveOpticsState(
      useAppStore.getState().camera,
      viewCameraAnatomyScene,
    );
    const recapCamera = useAppStore.getState().camera;
    const referenceFocusDepthMm =
      viewCameraAnatomyScene.focusStandardCapability!.referenceFocusDepthMm;
    const referenceSolution = resolveFocusFundamentalsFocusing({
      standard: "front",
      focusMode: "finite",
      focusDepthMm: referenceFocusDepthMm,
      focalLengthMm: recapCamera.focalLengthMm,
      referenceFocusDepthMm,
    });
    const recapSolution = resolveFocusFundamentalsFocusing({
      standard: "rear",
      focusMode: "finite",
      focusDepthMm: recapCamera.focusDistanceMm,
      focalLengthMm: recapCamera.focalLengthMm,
      referenceFocusDepthMm,
    });
    expect(recapOptics.diagnostics.fallbackApplied).toBe(false);
    expect(recapOptics.lensCenterWorld).toEqual({ x: 0, y: 0, z: 0 });
    expect(recapOptics.filmCenterWorld.z).toBeCloseTo(
      recapSolution.filmZMm - referenceSolution.lensZMm,
      12,
    );
    expect(Math.abs(recapOptics.lensCenterWorld.z - recapOptics.filmCenterWorld.z)).toBeCloseTo(
      recapSolution.imageDistanceVMm,
      12,
    );
    expect(recapOptics.focusPointWorld.z).toBeCloseTo(
      recapCamera.focusDistanceMm - referenceSolution.lensZMm,
      12,
    );
  });

  it("resets the lesson and restores normal presentation on scene exit", async () => {
    const view = renderAnatomyLesson();
    await screen.findByRole("heading", { name: "The complete camera" });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Aperture" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show a smaller opening" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart lesson" }));

    expect(screen.getByRole("heading", { name: "The complete camera" })).toBeInTheDocument();
    expect(useAppStore.getState().camera).toMatchObject({
      activeSceneId: "view-camera-anatomy",
      frontRiseMm: 0,
      frontShiftMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearShiftMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
      aperture: 11,
    });

    view.rerender(
      <MemoryRouter initialEntries={["/simulator/free/architecture-rise"]}>
        <SimulatorWorkspace
          mode="free"
          sceneId="architecture-rise"
          taskId={null}
          simulateAssetFailure={false}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("architecture-rise"));
    expect(screen.queryByRole("heading", { name: "The complete camera" })).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Rise" })).toBeInTheDocument();
  });
});
