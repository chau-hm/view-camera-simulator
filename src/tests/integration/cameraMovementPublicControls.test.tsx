import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { GroundGlassViewport } from "../../components/simulator/GroundGlassViewport";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { resolveCameraMovementGroundGlassComparison } from "../../scenes/cameraMovementGroundGlassComparison";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { resolveCameraRigViewpointAnchor } from "../../scenes/cameraRigViewpointGeometry";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { useAppStore } from "../../state/appStore";
import { matchCameraMovementTeachingCase } from "../../scenes/cameraMovementPublicTeaching";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const publicWorkspace = () => (
  <MemoryRouter>
    <SimulatorWorkspace
      mode="free"
      sceneId="understanding-camera-movements"
      taskId={null}
      simulateAssetFailure={false}
    />
  </MemoryRouter>
);

const calibrationWorkspace = () => (
  <MemoryRouter>
    <SimulatorWorkspace
      mode="free"
      sceneId="understanding-camera-movements"
      taskId={null}
      calibrationEnabled
      simulateAssetFailure={false}
    />
  </MemoryRouter>
);

afterEach(() => {
  cleanup();
  useAppStore.getState().resetCamera();
  useAppStore.getState().setActiveTask(null);
});

describe("public camera movement controls in the workspace", () => {
  it("renders one live Current Ground Glass and no comparison panes on the public route", () => {
    render(publicWorkspace());
    const movementControls = screen.getByRole("region", { name: "Camera Movement" });
    expect(within(movementControls).getByRole("slider", { name: "Viewpoint" })).toBeInTheDocument();
    expect(within(movementControls).getByRole("slider", { name: "Tilt" })).toBeInTheDocument();
    expect(within(movementControls).getByRole("slider", { name: "Vertical framing" })).toBeInTheDocument();
    expect(within(movementControls).getAllByRole("slider")).toHaveLength(3);
    expect(
      within(screen.getByRole("group", { name: "Tilt standard" })).getByRole("radio", {
        name: "Front standard",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Vertical framing standard" })).getByRole("radio", {
        name: "Rear standard",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "C1 — Front rise" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "A — Front tilt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "C3 — Higher viewpoint" })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
    expect(screen.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-channel", "default");
    expect(screen.queryByRole("region", { name: "Original and Current Ground Glass comparison" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Original", level: 3 })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current", level: 3 })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Zoom in Ground Glass preview view" })).toHaveLength(1);
    expect(screen.queryByRole("radiogroup", { name: "Camera movement calibration workbench" })).not.toBeInTheDocument();
    expect(screen.queryByText("Camera Movement Calibration")).not.toBeInTheDocument();
  });

  it("renders the retained Original/Current comparison composition with independent RTT channels and zoom", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...understandingCameraMovementsScene.cameraPreset,
      activeSceneId: understandingCameraMovementsScene.id,
      activeTaskId: null,
      mode: "free" as const,
      cameraRigPlacement: resolveCameraRigViewpointAnchor(
        CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig,
        "mid",
      ),
    };
    const opticsState = deriveOpticsState(camera, understandingCameraMovementsScene);
    const comparison = resolveCameraMovementGroundGlassComparison({
      camera,
      opticsState,
    });

    render(
      <GroundGlassViewport
        opticsState={opticsState}
        scene={understandingCameraMovementsScene}
        runtimeInfoByChannel={{
          default: null,
          "camera-movement-original": null,
          "camera-movement-current": null,
        }}
        onRuntimeInfoChange={() => undefined}
        groundGlassAssistEnabled={camera.groundGlassAssistEnabled}
        onGroundGlassAssistEnabledChange={() => undefined}
        focusAssistEnabled={camera.focusAssistEnabled}
        gridEnabled={camera.gridEnabled}
        canToggleFocusAssist
        canToggleGrid
        riseMm={camera.frontRiseMm}
        tiltDeg={camera.frontTiltDeg}
        swingDeg={camera.frontSwingDeg}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        renderQuality="standard"
        focalLengthMm={camera.focalLengthMm}
        expanded={false}
        restoreFocusOnCollapse
        onRequestExpand={() => undefined}
        onRequestRestore={() => undefined}
        comparison={comparison}
        comparisonLabels={{
          original: "Neutral · No camera movements",
          current: "A · Front tilt",
        }}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Original and Current Ground Glass comparison" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Original", level: 3 })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: "Current", level: 3 })).toHaveLength(1);

    const rttHosts = document.querySelectorAll('[data-testid="ground-glass-rtt"]');
    expect(rttHosts).toHaveLength(2);
    expect(document.querySelectorAll('[data-rtt-channel="camera-movement-original"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-rtt-channel="camera-movement-current"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-rtt-channel="default"]')).toHaveLength(0);

    expect(
      screen.getByRole("button", { name: "Zoom in Original Ground Glass view" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Zoom in Current Ground Glass view" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in Original Ground Glass view" }));
    expect(
      screen.getByRole("button", { name: "Reset Original Ground Glass view" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Zoom in Current Ground Glass view" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reset Current Ground Glass view" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the single Current Ground Glass renderer and its zoom state through case changes", () => {
    render(publicWorkspace());
    const rtt = screen.getByTestId("ground-glass-rtt");

    fireEvent.change(screen.getByRole("slider", { name: "Viewpoint" }), {
      target: { value: "0.75" },
    });
    expect(screen.getByTestId("ground-glass-rtt")).toBe(rtt);
    expect(screen.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-channel", "default");

    fireEvent.click(screen.getByRole("button", { name: "Zoom in Ground Glass preview view" }));

    expect(screen.getByRole("button", { name: "Reset Ground Glass preview view" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Tilt" }), {
      target: { value: "3.2" },
    });
    expect(screen.getByTestId("ground-glass-rtt")).toBe(rtt);
    expect(screen.getByRole("button", { name: "Reset Ground Glass preview view" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: "Vertical framing" }), {
      target: { value: "0.5" },
    });
    expect(screen.getByTestId("ground-glass-rtt")).toBe(rtt);
    expect(screen.getByRole("status")).toHaveTextContent("Upper framing");
    fireEvent.click(
      within(screen.getByRole("group", { name: "Vertical framing standard" })).getByRole("radio", {
        name: "Rear standard",
      }),
    );
    expect(screen.getByTestId("ground-glass-rtt")).toBe(rtt);
    expect(screen.getByRole("status")).toHaveTextContent("Rear standard · Upper framing");
  });

  it("exposes the live default RTT channel in optical diagnostics", () => {
    const view = render(publicWorkspace());
    fireEvent.click(screen.getByText("Optical Debug", { exact: true }));
    const debugLayers = view.container.querySelectorAll(".optical-debug__layer");
    expect(debugLayers).toHaveLength(0);
    expect(view.container.querySelector(".optical-debug__content")).toHaveTextContent("Channel: default");
    expect(view.container.querySelector(".optical-debug__content")).not.toHaveTextContent("camera-movement-original");
    expect(view.container.querySelector(".optical-debug__content")).not.toHaveTextContent("camera-movement-current");
  });

  it("preserves one Current Ground Glass renderer when Ground Glass expands", () => {
    render(publicWorkspace());
    const rtt = screen.getByTestId("ground-glass-rtt");
    fireEvent.click(screen.getByRole("button", { name: "Expand Ground Glass" }));

    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
    expect(screen.getByTestId("ground-glass-rtt")).toBe(rtt);
    expect(screen.getByRole("button", { name: "Zoom in Ground Glass preview view" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Original", level: 3 })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current", level: 3 })).not.toBeInTheDocument();
  });

  it("hides teaching controls and preserves the workbench on the calibration route", () => {
    render(calibrationWorkspace());
    expect(screen.getByText("Camera Movement Calibration")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "A — Front tilt" })).not.toBeInTheDocument();
    expect(screen.queryByText("Movement examples")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Original", level: 3 })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current", level: 3 })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Zoom in Ground Glass preview view" })).toHaveLength(1);
  });

  it("keeps the continuous Viewpoint state after rerender", () => {
    const view = render(publicWorkspace());
    const viewpoint = screen.getByRole("slider", { name: "Viewpoint" });
    expect(viewpoint).toHaveValue("0");

    fireEvent.change(viewpoint, { target: { value: "1" } });
    const state = useAppStore.getState();
    expect(state.camera.viewpointAnchor).toBe("high");
    expect(state.scene.targetRegion).toBe("upper");
    expect(matchCameraMovementTeachingCase({ anchor: state.camera.viewpointAnchor, targetRegion: state.scene.targetRegion, camera: state.camera })).toBe("C3-high-viewpoint");

    view.rerender(publicWorkspace());
    expect(screen.getByRole("slider", { name: "Viewpoint" })).toHaveValue("1");
    expect(screen.getByRole("status")).toHaveTextContent("Higher viewpoint");
  });

  it("Reset Movements restores complete Neutral without a stale anchor", () => {
    render(publicWorkspace());
    fireEvent.change(screen.getByRole("slider", { name: "Viewpoint" }), { target: { value: "1" } });
    expect(useAppStore.getState().camera.viewpointAnchor).toBe("high");

    fireEvent.click(screen.getByRole("button", { name: /Reset movements/i }));
    const state = useAppStore.getState();
    expect(state.camera.viewpointAnchor).toBe("mid");
    expect(state.scene.targetRegion).toBe("middle");
    expect(matchCameraMovementTeachingCase({ anchor: state.camera.viewpointAnchor, targetRegion: state.scene.targetRegion, camera: state.camera })).toBe("neutral");
    expect(screen.getByRole("slider", { name: "Viewpoint" })).toHaveValue("0");
    expect(screen.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  });

  it("route exit and re-entry restore Neutral", () => {
    render(publicWorkspace());
    fireEvent.change(screen.getByRole("slider", { name: "Viewpoint" }), { target: { value: "1" } });
    expect(useAppStore.getState().camera.viewpointAnchor).toBe("high");

    // Leave the scene (unmount) then return with a fresh mount.
    cleanup();
    render(publicWorkspace());
    const state = useAppStore.getState();
    expect(state.camera.viewpointAnchor).toBe("mid");
    expect(state.scene.targetRegion).toBe("middle");
    expect(screen.getByRole("slider", { name: "Viewpoint" })).toHaveValue("0");
    expect(screen.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  });

  it("calibration route does not apply Neutral after workbench edits", () => {
    render(calibrationWorkspace());
    fireEvent.click(screen.getByRole("button", { name: "Reset calibration" }));
    const state = useAppStore.getState();
    expect(state.cameraMovementCalibrationSession.active).toBe(true);
    expect(state.scene.targetRegion).toBe("middle");
    expect(state.camera.viewpointAnchor).toBe("mid");
  });
});

describe("non-teaching scene leave-and-return preserves in-memory state", () => {
  it("architecture-rise free route preserves movement state on unmount/return", () => {
    const workspace = (
      <MemoryRouter>
        <SimulatorWorkspace
          mode="free"
          sceneId="architecture-rise"
          taskId={null}
          simulateAssetFailure={false}
        />
      </MemoryRouter>
    );
    render(workspace);
    useAppStore.getState().setRise(20);
    expect(useAppStore.getState().camera.frontRiseMm).toBe(20);

    cleanup();
    render(workspace);
    // Non-teaching free scenes must NOT re-initialize to preset on leave/return.
    expect(useAppStore.getState().camera.frontRiseMm).toBe(20);
  });
});
