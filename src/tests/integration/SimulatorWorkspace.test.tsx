import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { useAppStore } from "../../state/appStore";

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

describe("SimulatorWorkspace geometry dialog accessibility", () => {
  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
    useAppStore.getState().setActiveTask(null);
  });

  it("focuses Close, closes with Escape, and restores focus to its trigger", async () => {
    render(workspace());
    const trigger = screen.getByRole("button", { name: "Open 2D Geometry" });

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "2D Geometry" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close 2D Geometry" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2D Geometry" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("wraps keyboard focus and blocks focus behind the modal", async () => {
    render(workspace());
    const trigger = screen.getByRole("button", { name: "Open 2D Geometry" });
    fireEvent.click(trigger);
    const close = screen.getByRole("button", { name: "Close 2D Geometry" });
    const fitScene = screen.getByRole("button", { name: "Fit Scene" });
    const backgroundLink = screen.getByRole("link", { name: "All Scenes" });

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(fitScene).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    backgroundLink.focus();
    expect(close).toHaveFocus();
  });

  it("restores focus after Close and closes safely on route changes", async () => {
    const { rerender } = render(workspace());
    const trigger = screen.getByRole("button", { name: "Open 2D Geometry" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close 2D Geometry" }));
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    rerender(workspace("table-tilt"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2D Geometry" })).not.toBeInTheDocument());
    expect(document.activeElement).not.toBe(trigger);
  });

  it("closes the dialog when the routed scene changes", async () => {
    const { rerender } = render(workspace());
    fireEvent.click(screen.getByRole("button", { name: "Open 2D Geometry" }));
    expect(screen.getByRole("dialog", { name: "2D Geometry" })).toBeInTheDocument();

    rerender(workspace("table-tilt"));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2D Geometry" })).not.toBeInTheDocument());
    expect(screen.queryByTestId("geometry-svg-top")).not.toBeInTheDocument();
  });

  it("keeps an open dialog safe and restores Top view when the Shelf task restarts", () => {
    render(workspace());
    fireEvent.click(screen.getByRole("button", { name: "Open 2D Geometry" }));
    fireEvent.click(screen.getByRole("button", { name: "Side" }));
    expect(screen.getByRole("dialog", { name: "2D Geometry" })).toBeInTheDocument();
    expect(screen.getByTestId("geometry-svg-side")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restart task" }));

    expect(screen.getByRole("dialog", { name: "2D Geometry" })).toBeInTheDocument();
    expect(screen.getByTestId("geometry-svg-top")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit Construction" })).toBeDisabled();
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
    expect(screen.queryByLabelText("CurrentSettingsReadout")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("FocusTargetsReadout")).not.toBeInTheDocument();
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
    expect(screen.getByLabelText("CurrentSettingsReadout")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Zoom out Ground Glass" })).toHaveAttribute("data-zoomed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Expand Ground Glass" }));

    const restore = screen.getByRole("button", { name: "Restore Ground Glass" });
    await waitFor(() => expect(restore).toHaveFocus());
    expect(screen.queryByTestId("scene-canvas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand 3D Scene" })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("ground-glass-rtt")).toHaveLength(1);
    expect(screen.getByTestId("ground-glass-rtt")).toBe(originalGroundGlassRenderer);
    expect(screen.getByLabelText("Upright Assist")).toBeChecked();
    expect(screen.getByRole("button", { name: "Zoom out Ground Glass" })).toHaveAttribute("data-zoomed", "true");
    expect(screen.queryByLabelText("CurrentSettingsReadout")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("FocusTargetsReadout")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Task")).not.toBeInTheDocument();
    expect(screen.queryByText("Optical Debug")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const controls = screen.getByRole("region", { name: "Camera Controls" });
    const swing = screen.getByLabelText("Swing");
    expect(controls).toContainElement(swing);
    expect(swing).toBeEnabled();
    fireEvent.change(swing, { target: { value: "2" } });
    expect(useAppStore.getState().camera.frontSwingDeg).toBe(2);

    const zoomedStage = screen.getByRole("button", { name: "Zoom out Ground Glass" });
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
    expect(screen.getByLabelText("CurrentSettingsReadout")).toBeInTheDocument();
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
