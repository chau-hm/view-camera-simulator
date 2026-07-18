import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SimulatorRoutePage } from "../../app/pages";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { getSceneById } from "../../scenes/definitions";
import { selectDerivedOpticsState } from "../../state/selectors";
import { useAppStore } from "../../state/appStore";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";

const renderWorkspace = (mode: "guided" | "free", sceneId: string, taskId: string | null) => {
  const route = taskId ? `/simulator/${mode}/${sceneId}/${taskId}` : `/simulator/${mode}/${sceneId}`;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SimulatorWorkspace mode={mode} sceneId={sceneId} taskId={taskId} simulateAssetFailure={false} />
    </MemoryRouter>,
  );
};

const renderWorkspaceRoute = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/scenes" element={<div>Scenes route</div>} />
        <Route path="/simulator/:mode/:sceneId" element={<SimulatorRoutePage />} />
        <Route path="/simulator/:mode/:sceneId/:taskId" element={<SimulatorRoutePage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("phase 12 integration", () => {
  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
  });

  it("TST-INT-001 rise slider updates store", () => {
    renderWorkspace("guided", "architecture-rise", "rise-01");
    fireEvent.change(screen.getByLabelText("Rise"), { target: { value: "18" } });
    expect(useAppStore.getState().camera.frontRiseMm).toBe(18);
  });

  it("TST-INT-002 tilt slider updates store", () => {
    renderWorkspace("guided", "table-tilt", "tilt-01");
    fireEvent.change(screen.getByLabelText("Tilt"), { target: { value: "3.2" } });
    expect(useAppStore.getState().camera.frontTiltDeg).toBeCloseTo(3.2, 8);
  });

  it("TST-INT-003 swing slider updates store", () => {
    renderWorkspace("guided", "shelf-swing", "swing-01");
    fireEvent.change(screen.getByLabelText("Swing"), { target: { value: "2.7" } });
    expect(useAppStore.getState().camera.frontSwingDeg).toBeCloseTo(2.7, 8);
  });

  it("TST-INT-004 rise sync updates 3D front Y readout", () => {
    renderWorkspace("guided", "architecture-rise", "rise-01");
    fireEvent.change(screen.getByLabelText("Rise"), { target: { value: "20" } });
    expect(screen.getByTestId("scene-front-y-mm")).toHaveTextContent("20.0 mm");
  });

  it("TST-INT-005 tilt sync updates side diagram focus line", () => {
    renderWorkspace("guided", "table-tilt", "tilt-01");
    // open the floating 2D Geometry panel to expose the geometry SVG
    fireEvent.click(screen.getByText(/Open 2D Geometry/i));
    const focusLine = screen.getByTestId("plane-line-focus");
    const before = [focusLine.getAttribute("x1"), focusLine.getAttribute("y1"), focusLine.getAttribute("x2"), focusLine.getAttribute("y2")].join("|");
    fireEvent.change(screen.getByLabelText("Tilt"), { target: { value: "4" } });
    const afterLine = screen.getByTestId("plane-line-focus");
    const after = [afterLine.getAttribute("x1"), afterLine.getAttribute("y1"), afterLine.getAttribute("x2"), afterLine.getAttribute("y2")].join("|");
    expect(after).not.toBe(before);
  });

  it("TST-INT-006 swing sync updates top diagram focus line", () => {
    renderWorkspace("guided", "shelf-swing", "swing-01");
    // open the floating 2D Geometry panel to expose the geometry SVG
    fireEvent.click(screen.getByText(/Open 2D Geometry/i));
    const focusLine = screen.getByTestId("plane-line-focus");
    const before = [focusLine.getAttribute("x1"), focusLine.getAttribute("y1"), focusLine.getAttribute("x2"), focusLine.getAttribute("y2")].join("|");
    fireEvent.change(screen.getByLabelText("Swing"), { target: { value: "5" } });
    const afterLine = screen.getByTestId("plane-line-focus");
    const after = [afterLine.getAttribute("x1"), afterLine.getAttribute("y1"), afterLine.getAttribute("x2"), afterLine.getAttribute("y2")].join("|");
    expect(after).not.toBe(before);
  });

  it("TST-INT-007 aperture sync updates DOF derived range", () => {
    renderWorkspace("free", "table-tilt", null);
    const before = selectDerivedOpticsState(useAppStore.getState().camera);
    const apertureSelect = screen.getAllByRole("combobox", { name: "Aperture" })[0];
    fireEvent.change(apertureSelect, { target: { value: "32" } });
    const after = selectDerivedOpticsState(useAppStore.getState().camera);
    const beforeWidth = before.depthOfFieldFarPlane!.distance - before.depthOfFieldNearPlane!.distance;
    const afterWidth = after.depthOfFieldFarPlane!.distance - after.depthOfFieldNearPlane!.distance;
    expect(afterWidth).toBeGreaterThan(beforeWidth);
  });

  it("TST-INT-008 orientation assist toggle updates flip state", () => {
    renderWorkspace("free", "architecture-rise", null);
    const before = selectDerivedOpticsState(useAppStore.getState().camera);
    // Use the Preview control (Upright Assist) which now drives groundGlassAssistEnabled
    fireEvent.click(screen.getByText("Upright Assist"));
    const after = selectDerivedOpticsState(useAppStore.getState().camera);
    expect(before.groundGlassProjection.invertHorizontal).toBe(true);
    expect(after.groundGlassProjection.invertHorizontal).toBe(false);
  });

  it("TST-INT-009 guided mode disables non-task controls", () => {
    renderWorkspace("guided", "architecture-rise", "rise-01");
    expect(screen.getByLabelText("Tilt")).toBeDisabled();
    expect(screen.getByLabelText("Swing")).toBeDisabled();
  });

  it("TST-INT-010 reset movements restores baseline", () => {
    renderWorkspace("free", "architecture-rise", null);
    fireEvent.change(screen.getByLabelText("Rise"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Tilt"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Swing"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Focus distance"), { target: { value: "9000" } });
    const apertureSelect = screen.getAllByRole("combobox", { name: "Aperture" })[0];
    fireEvent.change(apertureSelect, { target: { value: "22" } });
    fireEvent.click(screen.getByLabelText("Reset movements"));
    const camera = useAppStore.getState().camera;
    expect(camera.frontRiseMm).toBe(0);
    expect(camera.frontTiltDeg).toBe(0);
    expect(camera.frontSwingDeg).toBe(0);
    expect(camera.aperture).toBe(11);
  });

  it("TST-INT-011 restart task resets scene/task/movement baseline", () => {
    renderWorkspace("guided", "shelf-swing", "swing-01");
    fireEvent.change(screen.getByLabelText("Swing"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Focus distance"), { target: { value: "5000" } });
    fireEvent.click(screen.getByLabelText("Restart task"));
    const camera = useAppStore.getState().camera;
    expect(camera.activeSceneId).toBe("shelf-swing");
    expect(camera.activeTaskId).toBe("swing-01");
    expect(camera.frontSwingDeg).toBe(0);
    expect(camera.focusDistanceMm).toBe(shelfSwingGeometry.middleSubject.focusDetailProbeWorld.z);
  });

  it("TST-INT-012 task evaluation display matches evaluator result", () => {
    renderWorkspace("guided", "architecture-rise", "rise-01");
    const task = getTaskById("rise-01");
    const scene = getSceneById("architecture-rise");
    if (!task || !scene) {
      throw new Error("Missing task or scene");
    }
    const camera = useAppStore.getState().camera;
    const optics = selectDerivedOpticsState(camera);
    const evaluation = evaluateTask(task, scene, camera, optics);
    expect(screen.getByText(new RegExp(`Score: ${evaluation.score}`))).toBeInTheDocument();
    for (const criterion of evaluation.criteria) {
      expect(screen.getByText(new RegExp(criterion.label))).toBeInTheDocument();
    }
  });

  it("TST-INT-013 honors reduced motion preference", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
        addListener: () => undefined,
        removeListener: () => undefined,
      }),
    });

    const { container } = renderWorkspace("guided", "architecture-rise", "rise-01");

    expect(container.querySelector('[data-reduced-motion="true"]')).toBeInTheDocument();

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("TST-INT-014 supports keyboard-only rise task completion", () => {
    renderWorkspace("guided", "architecture-rise", "rise-01");
    const riseInput = screen.getByLabelText("Rise");
    riseInput.focus();

    for (let i = 0; i < 12; i += 1) {
      fireEvent.keyDown(riseInput, { key: "ArrowRight", code: "ArrowRight" });
    }

    expect(screen.getByRole("heading", { name: "Task completed" })).toBeInTheDocument();
  });

  it("TST-INT-015 exposes readable control labels", () => {
    renderWorkspace("free", "architecture-rise", null);

    expect(screen.getByLabelText("Rise")).toBeInTheDocument();
    expect(screen.getByLabelText("Tilt")).toBeInTheDocument();
    expect(screen.getByLabelText("Swing")).toBeInTheDocument();
    expect(screen.getByLabelText("Focus distance")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Aperture" })).toBeInTheDocument();
    // Ground glass assist control removed; preview mode (Raw/Upright) is now used instead
    expect(screen.getByLabelText("Focus assist")).toBeInTheDocument();
    expect(screen.getByLabelText("Grid")).toBeInTheDocument();
    expect(screen.getByLabelText("Rise")).toHaveAttribute("step", "1");
    expect(screen.getByLabelText("Tilt")).toHaveAttribute("step", "0.1");
    expect(screen.getByLabelText("Swing")).toHaveAttribute("step", "0.1");
    expect(screen.getByLabelText("Focus distance")).toHaveAttribute("step", "10");
  });

  it("keeps Shelf Swing task identity intact across guided and free routes", async () => {
    renderWorkspaceRoute("/simulator/guided/shelf-swing/swing-01");
    expect(await screen.findByText("Align the diagonal focus plane with swing")).toBeInTheDocument();
    expect(useAppStore.getState().camera.activeSceneId).toBe("shelf-swing");
    expect(useAppStore.getState().camera.activeTaskId).toBe("swing-01");

    cleanup();
    useAppStore.getState().resetCamera();
    useAppStore.getState().setActiveTask(null);
    renderWorkspaceRoute("/simulator/guided/shelf-swing/tilt-01");
    expect(await screen.findByText("Scenes route")).toBeInTheDocument();
    expect(screen.queryByText("Align the tabletop focus cards with tilt")).not.toBeInTheDocument();
    expect(useAppStore.getState().task.activeTaskId).toBeNull();

    cleanup();
    useAppStore.getState().resetCamera();
    useAppStore.getState().setActiveTask(null);
    renderWorkspaceRoute("/simulator/free/shelf-swing");
    expect(await screen.findByRole("heading", { name: "3D Scene", level: 2 })).toBeInTheDocument();
    expect(screen.queryByText("Align the diagonal focus plane with swing")).not.toBeInTheDocument();
    expect(useAppStore.getState().camera.activeSceneId).toBe("shelf-swing");
    expect(useAppStore.getState().task.activeTaskId).toBeNull();
  });
});
