import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { useAppStore } from "../../state/appStore";
import { matchCameraMovementTeachingCase } from "../../scenes/cameraMovementPublicTeaching";

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
  it("renders teaching controls and no workbench on the public route", () => {
    render(publicWorkspace());
    expect(screen.getByRole("radio", { name: "A — Front tilt" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Original", level: 3 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Current", level: 3 })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^Zoom in (?:Original|Current) Ground Glass view$/ })).toHaveLength(2);
    expect(screen.queryByRole("radiogroup", { name: "Camera movement calibration workbench" })).not.toBeInTheDocument();
    expect(screen.queryByText("Camera Movement Calibration")).not.toBeInTheDocument();
  });

  it("keeps Original and Current zoom controls independent while sharing preview controls", () => {
    render(publicWorkspace());
    const currentPanel = screen.getByRole("heading", { name: "Current", level: 3 }).closest("section");
    expect(currentPanel).not.toBeNull();
    expect(currentPanel!).toHaveTextContent("Neutral · No movement");

    fireEvent.click(screen.getByRole("radio", { name: "A — Front tilt" }));
    expect(currentPanel!).toHaveTextContent("A · Front tilt");

    const zoomButtons = screen.getAllByRole("button", { name: /^Zoom in (?:Original|Current) Ground Glass view$/ });
    fireEvent.click(zoomButtons[0]);

    expect(screen.getAllByRole("button", { name: /^Reset (?:Original|Current) Ground Glass view$/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Zoom in (?:Original|Current) Ground Glass view$/ })).toHaveLength(1);
    expect(screen.getByLabelText("Original and Current Ground Glass comparison")).toBeInTheDocument();
  });

  it("preserves both comparison panels when Ground Glass expands", () => {
    render(publicWorkspace());
    fireEvent.click(screen.getByRole("button", { name: "Expand Ground Glass" }));

    expect(screen.getByRole("heading", { name: "Original", level: 3 })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Current", level: 3 })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /(?:Zoom in|Reset) (?:Original|Current) Ground Glass view$/ })).toHaveLength(2);
  });

  it("hides teaching controls and preserves the workbench on the calibration route", () => {
    render(calibrationWorkspace());
    expect(screen.getByText("Camera Movement Calibration")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "A — Front tilt" })).not.toBeInTheDocument();
    expect(screen.queryByText("Movement examples")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Original", level: 3 })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current", level: 3 })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Zoom in Ground Glass view" })).toHaveLength(1);
  });

  it("keeps Neutral selected after rerender and applies a case", async () => {
    const view = render(publicWorkspace());
    const neutral = screen.getByRole("radio", { name: "Neutral" });
    expect(neutral).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "C3 — Higher viewpoint" }));
    const state = useAppStore.getState();
    expect(state.camera.viewpointAnchor).toBe("high");
    expect(state.scene.targetRegion).toBe("upper");
    expect(matchCameraMovementTeachingCase({ anchor: state.camera.viewpointAnchor, targetRegion: state.scene.targetRegion, camera: state.camera })).toBe("C3-high-viewpoint");

    view.rerender(publicWorkspace());
    expect(screen.getByRole("radio", { name: "C3 — Higher viewpoint" })).toBeChecked();
  });

  it("Reset Movements restores complete Neutral without a stale anchor", () => {
    render(publicWorkspace());
    fireEvent.click(screen.getByRole("radio", { name: "C3 — Higher viewpoint" }));
    expect(useAppStore.getState().camera.viewpointAnchor).toBe("high");

    fireEvent.click(screen.getByRole("button", { name: /Reset movements/i }));
    const state = useAppStore.getState();
    expect(state.camera.viewpointAnchor).toBe("mid");
    expect(state.scene.targetRegion).toBe("middle");
    expect(matchCameraMovementTeachingCase({ anchor: state.camera.viewpointAnchor, targetRegion: state.scene.targetRegion, camera: state.camera })).toBe("neutral");
  });

  it("route exit and re-entry restore Neutral", () => {
    render(publicWorkspace());
    fireEvent.click(screen.getByRole("radio", { name: "C3 — Higher viewpoint" }));
    expect(useAppStore.getState().camera.viewpointAnchor).toBe("high");

    // Leave the scene (unmount) then return with a fresh mount.
    cleanup();
    render(publicWorkspace());
    const state = useAppStore.getState();
    expect(state.camera.viewpointAnchor).toBe("mid");
    expect(state.scene.targetRegion).toBe("middle");
    expect(screen.getByRole("radio", { name: "Neutral" })).toBeChecked();
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
