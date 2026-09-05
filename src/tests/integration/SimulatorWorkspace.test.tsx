import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { useAppStore } from "../../state/appStore";
import { interiorCornerSwingFocusCalibration } from "../../scenes/interiorCornerSwingFocus";

const workspace = (sceneId = "shelf-swing") => (
  <MemoryRouter>
    <SimulatorWorkspace
      mode="guided"
      sceneId={sceneId}
      taskId={sceneId === "shelf-swing" ? "swing-01" : "tilt-01"}
      simulateAssetFailure={false}
    />
  </MemoryRouter>
);

const workspaceRoute = (
  mode: "guided" | "free",
  sceneId: string,
  taskId: string | null,
) => (
  <MemoryRouter>
    <SimulatorWorkspace
      mode={mode}
      sceneId={sceneId}
      taskId={taskId}
      simulateAssetFailure={false}
    />
  </MemoryRouter>
);

const interiorCornerLessonWorkspace = (mode: "guided" | "free", taskId: string | null) => (
  <MemoryRouter>
    <SimulatorWorkspace
      mode={mode}
      sceneId="interior-corner"
      taskId={taskId}
      guidedLessonEnabled
      simulateAssetFailure={false}
    />
  </MemoryRouter>
);

describe("SimulatorWorkspace expanded Geometry accessibility", () => {
  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
    useAppStore.getState().setActiveTask(null);
  });

  it("focuses Restore, restores with Escape, and returns focus to its trigger", async () => {
    render(workspace());
    const trigger = screen.getByRole("button", { name: "Expand 2D Geometry" });

    expect(trigger).toHaveAttribute("title", "Expand 2D Geometry");
    expect(trigger).toHaveAttribute("data-viewport-expanded", "false");
    expect(trigger).toHaveTextContent("2D Geometry");
    expect(trigger.querySelector(".material-symbols-outlined")).toHaveTextContent("open_in_new");

    fireEvent.click(trigger);

    expect(screen.queryByRole("dialog", { name: "2D Geometry" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2D Geometry" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "3D Scene" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ground Glass" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Camera Controls" })).toBeInTheDocument();
    const restore = screen.getByRole("button", { name: "Restore 2D Geometry" });
    expect(restore).toHaveAttribute("title", "Restore 2D Geometry");
    expect(restore).toHaveAttribute("data-viewport-expanded", "true");
    expect(restore.querySelector(".material-symbols-outlined")).toHaveTextContent("close_fullscreen");
    await waitFor(() => expect(restore).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("heading", { name: "2D Geometry" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand 2D Geometry" })).toHaveFocus());
  });

  it("allows focus and camera control interaction while Geometry is expanded", async () => {
    render(workspace());
    fireEvent.click(screen.getByRole("button", { name: "Expand 2D Geometry" }));
    const swing = screen.getByLabelText("Swing");
    const backgroundLink = screen.getByRole("link", { name: "All Scenes" });

    backgroundLink.focus();
    expect(backgroundLink).toHaveFocus();
    swing.focus();
    expect(swing).toHaveFocus();
    expect(swing).toBeEnabled();
    fireEvent.change(swing, { target: { value: "2" } });
    expect(useAppStore.getState().camera.frontSwingDeg).toBe(2);
  });

  it("passes the application geometry view through the explicit viewport boundary", async () => {
    render(workspaceRoute("free", "table-tilt", null));
    useAppStore.getState().setGeometryView("top");

    fireEvent.click(screen.getByRole("button", { name: "Expand 2D Geometry" }));
    expect(await screen.findByTestId("geometry-svg-top")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Side" }));
    await waitFor(() => expect(useAppStore.getState().camera.geometryView).toBe("side"));
    expect(screen.getByTestId("geometry-svg-side")).toBeInTheDocument();
  });

  it("restores focus after Restore and closes safely on route changes", async () => {
    const { rerender } = render(workspace());
    const trigger = screen.getByRole("button", { name: "Expand 2D Geometry" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Restore 2D Geometry" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand 2D Geometry" })).toHaveFocus());

    fireEvent.click(trigger);
    rerender(workspace("table-tilt"));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "2D Geometry" })).not.toBeInTheDocument());
    expect(document.activeElement).not.toBe(trigger);
  });

  it("cancels Geometry expansion when scene, mode, or task route identity changes", async () => {
    const view = render(workspaceRoute("guided", "shelf-swing", "swing-01"));
    fireEvent.click(screen.getByRole("button", { name: "Expand 2D Geometry" }));
    expect(screen.getByRole("heading", { name: "2D Geometry" })).toBeInTheDocument();

    view.rerender(workspaceRoute("guided", "table-tilt", "tilt-01"));
    await screen.findByRole("button", { name: "Expand 2D Geometry" });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "2D Geometry" })).not.toBeInTheDocument());
    expect(screen.queryByTestId("geometry-svg-top")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand 2D Geometry" }));
    view.rerender(workspaceRoute("free", "table-tilt", null));
    await screen.findByRole("button", { name: "Expand 2D Geometry" });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "2D Geometry" })).not.toBeInTheDocument());
    expect(screen.queryByTestId("geometry-svg-top")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand 2D Geometry" }));
    view.rerender(workspaceRoute("guided", "table-tilt", "tilt-01"));
    await screen.findByRole("button", { name: "Expand 2D Geometry" });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "2D Geometry" })).not.toBeInTheDocument());
  });

  it("restores Top view after the Shelf task restarts", async () => {
    render(workspace());
    fireEvent.click(screen.getByRole("button", { name: "Expand 2D Geometry" }));
    fireEvent.click(screen.getByRole("button", { name: "Side" }));
    expect(screen.getByTestId("geometry-svg-side")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore 2D Geometry" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand 2D Geometry" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Restart task" }));

    fireEvent.click(screen.getByRole("button", { name: "Expand 2D Geometry" }));
    expect(screen.getByTestId("geometry-svg-top")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit Construction" })).toBeDisabled();
  });

  it("preserves the requested Scheimpflug construction across Geometry replacement", async () => {
    render(workspaceRoute("free", "table-tilt", null));
    fireEvent.change(screen.getByLabelText("Tilt"), { target: { value: "4" } });

    fireEvent.click(screen.getByRole("button", { name: "View overlays" }));
    const showConstruction = screen.getByRole("button", { name: "Show Scheimpflug construction" });
    expect(showConstruction).toBeEnabled();
    fireEvent.click(showConstruction);
    expect(screen.getByRole("button", { name: "Hide Scheimpflug construction" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand 2D Geometry" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore 2D Geometry" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Restore 2D Geometry" }));

    await waitFor(() => expect(screen.getByTestId("scheimpflug-construction-note")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "View overlays" }));
    expect(screen.getByRole("button", { name: "Hide Scheimpflug construction" })).toBeInTheDocument();
  });

  it("clears the requested Scheimpflug construction when the scene identity changes", async () => {
    const view = render(workspaceRoute("free", "table-tilt", null));
    fireEvent.change(screen.getByLabelText("Tilt"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "View overlays" }));
    fireEvent.click(screen.getByRole("button", { name: "Show Scheimpflug construction" }));
    expect(screen.getByRole("button", { name: "Hide Scheimpflug construction" })).toBeInTheDocument();

    view.rerender(workspaceRoute("free", "architecture-rise", null));
    await screen.findByRole("button", { name: "Expand 2D Geometry" });
    expect(screen.queryByRole("button", { name: /Scheimpflug construction/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("scheimpflug-construction-note")).not.toBeInTheDocument();
  });

  it("defaults View Focus to Scene and restores Optical Geometry on Restart", () => {
    render(workspace());

    const sceneFocus = screen.getByRole("button", { name: "Scene" });
    const cameraFocus = screen.getByRole("button", { name: "Camera" });
    expect(sceneFocus).toHaveAttribute("aria-pressed", "true");
    expect(cameraFocus).toHaveAttribute("aria-pressed", "false");

    cameraFocus.focus();
    fireEvent.keyDown(cameraFocus, { key: "Enter" });
    fireEvent.click(cameraFocus);
    expect(cameraFocus).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(sceneFocus);
    expect(sceneFocus).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "View overlays" }));
    const hideOpticalGeometry = screen.getByRole("button", { name: "Hide Optical geometry" });
    expect(hideOpticalGeometry).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(hideOpticalGeometry);
    expect(screen.getByRole("button", { name: "Show Optical geometry" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Restart task" }));
    fireEvent.click(screen.getByRole("button", { name: "View overlays" }));
    expect(screen.getByRole("button", { name: "Hide Optical geometry" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("discards stale Camera focus across an in-place scene round trip", () => {
    const view = render(workspace("shelf-swing"));
    fireEvent.click(screen.getByRole("button", { name: "Camera" }));
    expect(screen.getByRole("button", { name: "Camera" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    view.rerender(workspace("table-tilt"));
    expect(screen.getByRole("button", { name: "Scene" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    view.rerender(workspace("shelf-swing"));
    expect(screen.getByRole("button", { name: "Scene" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Camera" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows the Interior Corner Rise composition state from the public free-mode control", async () => {
    render(workspaceRoute("free", "interior-corner", null));

    const feedback = await screen.findByTestId("interior-corner-rise-composition-feedback");
    const focusFeedback = await screen.findByTestId("interior-corner-focus-feedback");
    expect(feedback).toHaveTextContent(/upper architecture is still too close to the top edge/i);
    expect(focusFeedback).toHaveTextContent(/Focus alone cannot hold the near, middle, and far details together/i);

    const rise = screen.getByLabelText("Rise");
    expect(rise).toHaveValue("0");
    expect(rise).toBeEnabled();
    fireEvent.change(rise, { target: { value: "33" } });

    await waitFor(() => {
      expect(feedback).toHaveTextContent(/upper architecture is now inside a safer frame/i);
    });
    expect(rise).toHaveValue("33");
    expect(useAppStore.getState().camera.frontSwingDeg).toBe(0);

    fireEvent.change(screen.getByLabelText("Swing"), {
      target: { value: interiorCornerSwingFocusCalibration.public.frontSwingDeg },
    });
    fireEvent.change(screen.getByLabelText("Focus distance"), {
      target: { value: interiorCornerSwingFocusCalibration.public.focusDistanceMm },
    });
    await waitFor(() => {
      expect(focusFeedback).toHaveTextContent(
        /near, middle, and far details on the receding side wall are acceptably sharp/i,
      );
    });
    expect(useAppStore.getState().camera.frontSwingDeg).toBe(
      interiorCornerSwingFocusCalibration.public.frontSwingDeg,
    );
    expect(useAppStore.getState().camera.focusDistanceMm).toBe(
      interiorCornerSwingFocusCalibration.public.focusDistanceMm,
    );
  });

  it("stages Interior Corner controls and preserves solved state between lesson stages", async () => {
    const view = render(interiorCornerLessonWorkspace("free", null));

    expect(screen.getByRole("heading", { name: "Observe the Problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Rise")).toBeDisabled();
    expect(screen.getByLabelText("Swing")).toBeDisabled();
    expect(screen.getByLabelText("Focus distance")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Aperture" })).toBeDisabled();

    useAppStore.getState().setRise(33);
    view.rerender(
      interiorCornerLessonWorkspace("guided", "interior-corner-compose-01"),
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Compose the Interior Corner with Rise" })).toBeInTheDocument());
    expect(screen.getByLabelText("Rise")).toBeEnabled();
    expect(screen.getByLabelText("Swing")).toBeDisabled();
    expect(screen.getByLabelText("Focus distance")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
    expect(useAppStore.getState().camera.frontRiseMm).toBe(33);
    expect(screen.getByRole("link", { name: "Continue" })).toBeInTheDocument();

    view.rerender(
      interiorCornerLessonWorkspace("guided", "interior-corner-align-focus-01"),
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Align the Receding-Wall Focus" })).toBeInTheDocument());
    expect(screen.getByLabelText("Rise")).toBeDisabled();
    expect(screen.getByLabelText("Swing")).toBeEnabled();
    expect(screen.getByLabelText("Focus distance")).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
    expect(useAppStore.getState().camera.frontRiseMm).toBe(33);

    fireEvent.change(screen.getByLabelText("Swing"), {
      target: { value: interiorCornerSwingFocusCalibration.public.frontSwingDeg },
    });
    fireEvent.change(screen.getByLabelText("Focus distance"), {
      target: { value: interiorCornerSwingFocusCalibration.public.focusDistanceMm },
    });
    await waitFor(() => expect(screen.getByRole("link", { name: "Continue" })).toBeInTheDocument());

    view.rerender(
      interiorCornerLessonWorkspace("guided", "interior-corner-depth-of-field-01"),
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Add Usable Depth with Aperture" })).toBeInTheDocument());
    expect(screen.getByLabelText("Rise")).toBeDisabled();
    expect(screen.getByLabelText("Swing")).toBeDisabled();
    expect(screen.getByLabelText("Focus distance")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Aperture" })).toBeEnabled();
    expect(useAppStore.getState().camera).toMatchObject({
      frontRiseMm: 33,
      frontSwingDeg: interiorCornerSwingFocusCalibration.public.frontSwingDeg,
      focusDistanceMm: interiorCornerSwingFocusCalibration.public.focusDistanceMm,
      aperture: 5.6,
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Aperture" }), { target: { value: "11" } });
    await waitFor(() => expect(screen.getByText("Lesson complete")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Restart lesson" })).toHaveAttribute(
      "href",
      "/simulator/free/interior-corner?lesson=1",
    );
  });
});

describe("SimulatorWorkspace viewport expansion", () => {
  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
    useAppStore.getState().setActiveTask(null);
  });

  it("keeps one SceneRenderer mounted while the workspace hides and restores other main content", async () => {
    const { container } = render(workspace());
    const originalSceneRenderer = screen.getByTestId("scene-canvas");
    const expand = screen.getByRole("button", { name: "Expand 3D Scene" });
    const normalHost = container.querySelector(".scene-viewport-host");

    expect(screen.getAllByTestId("scene-canvas")).toHaveLength(1);
    expect(normalHost).toBeInTheDocument();
    expect(normalHost).not.toHaveClass("scene-viewport-host--expanded");
    fireEvent.click(expand);

    const restore = screen.getByRole("button", { name: "Restore 3D Scene" });
    await waitFor(() => expect(restore).toHaveFocus());
    expect(container.querySelector(".scene-viewport-host")).toBe(normalHost);
    expect(normalHost).toHaveClass("scene-viewport-host--expanded");
    expect(screen.getAllByTestId("scene-canvas")).toHaveLength(1);
    expect(screen.getByTestId("scene-canvas")).toBe(originalSceneRenderer);
    expect(screen.queryByLabelText("GroundGlassColumn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("current-settings-readout")).not.toBeInTheDocument();
    expect(screen.queryByTestId("focus-targets-readout")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Task")).not.toBeInTheDocument();
    expect(screen.queryByText("Optical Debug")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const controls = screen.getByRole("region", { name: "Camera Controls" });
    const swing = screen.getByLabelText("Swing");
    expect(controls).toContainElement(swing);
    expect(swing).toBeEnabled();
    fireEvent.change(swing, { target: { value: "2" } });
    expect(useAppStore.getState().camera.frontSwingDeg).toBe(2);

    fireEvent.click(restore);
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand 3D Scene" })).toHaveFocus());
    expect(container.querySelector(".scene-viewport-host")).toBe(normalHost);
    expect(normalHost).not.toHaveClass("scene-viewport-host--expanded");
    expect(screen.getByTestId("scene-canvas")).toBe(originalSceneRenderer);
    expect(screen.getByLabelText("GroundGlassColumn")).toBeInTheDocument();
    expect(screen.getByTestId("current-settings-readout")).toBeInTheDocument();
  });

  it("removes every expanded sizing class after repeated restore cycles", async () => {
    const { container } = render(workspace());
    const host = container.querySelector(".scene-viewport-host");

    for (let cycle = 0; cycle < 3; cycle += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Expand 3D Scene" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Restore 3D Scene" })).toHaveFocus());
      expect(host).toHaveClass("scene-viewport-host--expanded");
      expect(container.querySelector(".scene-panel")).toHaveClass("scene-panel--expanded");
      expect(container.querySelector(".scene-viewport-shell")).toHaveClass("scene-viewport-shell--expanded");

      fireEvent.click(screen.getByRole("button", { name: "Restore 3D Scene" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Expand 3D Scene" })).toHaveFocus());
      expect(host).not.toHaveClass("scene-viewport-host--expanded");
      expect(container.querySelector(".scene-panel")).not.toHaveClass("scene-panel--expanded");
      expect(container.querySelector(".scene-viewport-shell")).not.toHaveClass("scene-viewport-shell--expanded");
      expect(container.querySelector(".simulator-main")).not.toHaveClass("simulator-main--viewport-expanded");
      expect(container.querySelector(".simulator-viewport-grid")).not.toHaveClass("simulator-viewport-grid--expanded");
      expect(container.querySelector(".simulator-card--expanded")).not.toBeInTheDocument();
      expect(screen.getAllByTestId("scene-canvas")).toHaveLength(1);
      expect(screen.getByLabelText("GroundGlassColumn")).toBeInTheDocument();
    }
  });

  it("restores normal layout with Escape without trapping focus in the 3D Scene", async () => {
    render(workspace());
    fireEvent.click(screen.getByRole("button", { name: "Expand 3D Scene" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore 3D Scene" })).toHaveFocus());

    screen.getByRole("button", { name: "Infinity Reset" }).focus();
    expect(screen.getByRole("button", { name: "Infinity Reset" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.getByRole("button", { name: "Expand 3D Scene" })).toHaveFocus());
    expect(screen.getByLabelText("GroundGlassColumn")).toBeInTheDocument();
  });

  it("restores normal layout when scene, mode, or task route identity changes", async () => {
    const view = render(workspaceRoute("guided", "shelf-swing", "swing-01"));

    fireEvent.click(screen.getByRole("button", { name: "Expand 3D Scene" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore 3D Scene" })).toHaveFocus());
    view.rerender(workspaceRoute("guided", "table-tilt", "tilt-01"));
    const sceneChangeExpand = await screen.findByRole("button", { name: "Expand 3D Scene" });
    expect(sceneChangeExpand).not.toHaveFocus();
    expect(screen.getByLabelText("GroundGlassColumn")).toBeInTheDocument();

    fireEvent.click(sceneChangeExpand);
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore 3D Scene" })).toHaveFocus());
    view.rerender(workspaceRoute("free", "table-tilt", null));
    const modeChangeExpand = await screen.findByRole("button", { name: "Expand 3D Scene" });
    expect(modeChangeExpand).not.toHaveFocus();
    expect(screen.getByLabelText("GroundGlassColumn")).toBeInTheDocument();

    fireEvent.click(modeChangeExpand);
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore 3D Scene" })).toHaveFocus());
    view.rerender(workspaceRoute("guided", "table-tilt", "tilt-01"));
    const taskChangeExpand = await screen.findByRole("button", { name: "Expand 3D Scene" });
    expect(taskChangeExpand).not.toHaveFocus();
    expect(screen.getByLabelText("Task")).toBeInTheDocument();
  });

  it("keeps one Ground Glass renderer and its interaction state through expansion", async () => {
    render(workspace());
    const originalGroundGlassRenderer = screen.getByTestId("ground-glass-rtt");

    expect(screen.getAllByTestId("scene-canvas")).toHaveLength(1);
    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("Upright Assist"));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in Ground Glass view" }));
    expect(screen.getByRole("region", { name: "Pan Ground Glass" })).toHaveAttribute("data-zoomed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Expand Ground Glass" }));

    const restore = screen.getByRole("button", { name: "Restore Ground Glass" });
    await waitFor(() => expect(restore).toHaveFocus());
    expect(screen.queryByTestId("scene-canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand 3D Scene" })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
    expect(screen.getByTestId("ground-glass-rtt")).toBe(originalGroundGlassRenderer);
    expect(screen.getByLabelText("Upright Assist")).toBeChecked();
    expect(screen.getByRole("region", { name: "Pan Ground Glass" })).toHaveAttribute("data-zoomed", "true");
    expect(screen.queryByTestId("current-settings-readout")).not.toBeInTheDocument();
    expect(screen.queryByTestId("focus-targets-readout")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Task")).not.toBeInTheDocument();
    expect(screen.queryByText("Optical Debug")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const controls = screen.getByRole("region", { name: "Camera Controls" });
    const swing = screen.getByLabelText("Swing");
    expect(controls).toContainElement(swing);
    expect(swing).toBeEnabled();
    fireEvent.change(swing, { target: { value: "2" } });
    expect(useAppStore.getState().camera.frontSwingDeg).toBe(2);

    const zoomedStage = screen.getByRole("region", { name: "Pan Ground Glass" });
    fireEvent.keyDown(zoomedStage, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Restore Ground Glass" })).toBeInTheDocument();
    expect(screen.queryByTestId("scene-canvas")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in Ground Glass" })).toHaveAttribute("data-zoomed", "false");
    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
    expect(screen.getByTestId("ground-glass-rtt")).toBe(originalGroundGlassRenderer);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand Ground Glass" })).toHaveFocus());
    expect(screen.getAllByTestId("scene-canvas")).toHaveLength(1);
    expect(screen.getByTestId("ground-glass-rtt")).toBe(originalGroundGlassRenderer);
    expect(screen.getByLabelText("GroundGlassColumn")).toBeInTheDocument();
    expect(screen.getByTestId("current-settings-readout")).toBeInTheDocument();
    expect(screen.getByLabelText("Upright Assist")).toBeChecked();
    expect(screen.getByRole("button", { name: "Zoom in Ground Glass" })).toHaveAttribute("data-zoomed", "false");
  });

  it("restores Ground Glass expansion with Escape and on route identity changes", async () => {
    const view = render(workspaceRoute("guided", "shelf-swing", "swing-01"));
    fireEvent.click(screen.getByRole("button", { name: "Expand Ground Glass" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore Ground Glass" })).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand Ground Glass" })).toHaveFocus());
    expect(screen.getByTestId("scene-canvas")).toBeInTheDocument();
    expect(screen.getByLabelText("GroundGlassColumn")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand Ground Glass" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore Ground Glass" })).toHaveFocus());
    view.rerender(workspaceRoute("guided", "table-tilt", "tilt-01"));
    const routedExpand = await screen.findByRole("button", { name: "Expand Ground Glass" });
    expect(routedExpand).not.toHaveFocus();
    expect(screen.getByTestId("scene-canvas")).toBeInTheDocument();
    expect(screen.getByLabelText("GroundGlassColumn")).toBeInTheDocument();
  });

  it("closes nested expanded-view UI before restoring the active viewport", async () => {
    render(workspace());
    const originalGroundGlassRenderer = screen.getByTestId("ground-glass-rtt");
    fireEvent.click(screen.getByRole("button", { name: "Expand Ground Glass" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore Ground Glass" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    const closeHelp = screen.getByRole("button", { name: "Close help" });
    expect(closeHelp).toHaveFocus();
    const swing = screen.getByLabelText("Swing");
    swing.focus();
    expect(swing).toHaveFocus();

    fireEvent.keyDown(swing, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Movement help" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Help" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Restore Ground Glass" })).toBeInTheDocument();
    expect(screen.queryByTestId("scene-canvas")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
    expect(screen.getByTestId("ground-glass-rtt")).toBe(originalGroundGlassRenderer);
    expect(screen.getByRole("region", { name: "Camera Controls" })).toContainElement(
      screen.getByRole("button", { name: "Help" }),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand Ground Glass" })).toHaveFocus());

    const originalSceneRenderer = screen.getByTestId("scene-canvas");

    fireEvent.click(screen.getByRole("button", { name: "Expand 3D Scene" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore 3D Scene" })).toHaveFocus());
    const overlayMenu = screen.getByRole("button", { name: "View overlays" });
    fireEvent.click(overlayMenu);
    expect(overlayMenu).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(overlayMenu, { key: "Escape" });

    expect(screen.getByRole("button", { name: "Restore 3D Scene" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View overlays" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("GroundGlassColumn")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("scene-canvas")).toHaveLength(1);
    expect(screen.getByTestId("scene-canvas")).toBe(originalSceneRenderer);
    expect(screen.getByRole("region", { name: "Camera Controls" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand 3D Scene" })).toHaveFocus());
    expect(screen.getAllByTestId("scene-canvas")).toHaveLength(1);
    expect(screen.getByTestId("scene-canvas")).toBe(originalSceneRenderer);
    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
  });
});
