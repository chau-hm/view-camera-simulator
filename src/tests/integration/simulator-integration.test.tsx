import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { getSceneById } from "../../scenes/definitions";
import { selectDerivedOpticsState } from "../../state/selectors";
import { useAppStore } from "../../state/appStore";

const renderWorkspace = (mode: "guided" | "free", sceneId: string, taskId: string | null) => {
  const route = taskId ? `/simulator/${mode}/${sceneId}/${taskId}` : `/simulator/${mode}/${sceneId}`;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SimulatorWorkspace mode={mode} sceneId={sceneId} taskId={taskId} simulateAssetFailure={false} />
    </MemoryRouter>,
  );
};

describe("phase 12 integration", () => {
  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
  });

  it("TST-INT-001 rise slider updates store", () => {
    renderWorkspace("guided", "architecture-rise", "task-rise-basics");
    fireEvent.change(screen.getByLabelText("Rise"), { target: { value: "18" } });
    expect(useAppStore.getState().camera.frontRiseMm).toBe(18);
  });

  it("TST-INT-002 tilt slider updates store", () => {
    renderWorkspace("guided", "table-tilt", "task-tilt-basics");
    fireEvent.change(screen.getByLabelText("Tilt"), { target: { value: "3.2" } });
    expect(useAppStore.getState().camera.frontTiltDeg).toBeCloseTo(3.2, 8);
  });

  it("TST-INT-003 swing slider updates store", () => {
    renderWorkspace("guided", "shelf-swing", "task-swing-basics");
    fireEvent.change(screen.getByLabelText("Swing"), { target: { value: "2.7" } });
    expect(useAppStore.getState().camera.frontSwingDeg).toBeCloseTo(2.7, 8);
  });

  it("TST-INT-004 rise sync updates 3D front Y readout", () => {
    renderWorkspace("guided", "architecture-rise", "task-rise-basics");
    fireEvent.change(screen.getByLabelText("Rise"), { target: { value: "20" } });
    expect(screen.getByTestId("scene-front-y-mm")).toHaveTextContent("20.0 mm");
  });

  it("TST-INT-005 tilt sync updates side diagram focus line", () => {
    renderWorkspace("guided", "table-tilt", "task-tilt-basics");
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
    renderWorkspace("guided", "shelf-swing", "task-swing-basics");
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
    fireEvent.click(screen.getByLabelText("Ground glass assist"));
    const after = selectDerivedOpticsState(useAppStore.getState().camera);
    expect(before.groundGlassProjection.invertHorizontal).toBe(true);
    expect(after.groundGlassProjection.invertHorizontal).toBe(false);
  });

  it("TST-INT-009 guided mode disables non-task controls", () => {
    renderWorkspace("guided", "architecture-rise", "task-rise-basics");
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
    renderWorkspace("guided", "shelf-swing", "task-swing-basics");
    fireEvent.change(screen.getByLabelText("Swing"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Focus distance"), { target: { value: "5000" } });
    fireEvent.click(screen.getByLabelText("Restart task"));
    const camera = useAppStore.getState().camera;
    expect(camera.activeSceneId).toBe("shelf-swing");
    expect(camera.activeTaskId).toBe("task-swing-basics");
    expect(camera.frontSwingDeg).toBe(0);
    expect(camera.focusDistanceMm).toBe(3200);
  });

  it("TST-INT-012 task evaluation display matches evaluator result", () => {
    renderWorkspace("guided", "architecture-rise", "task-rise-basics");
    const task = getTaskById("task-rise-basics");
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

    const { container } = renderWorkspace("guided", "architecture-rise", "task-rise-basics");

    expect(container.querySelector('[data-reduced-motion="true"]')).toBeInTheDocument();

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it("TST-INT-014 supports keyboard-only rise task completion", () => {
    renderWorkspace("guided", "architecture-rise", "task-rise-basics");
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
    expect(screen.getByLabelText("Ground glass assist")).toBeInTheDocument();
    expect(screen.getByLabelText("Focus assist")).toBeInTheDocument();
    expect(screen.getByLabelText("Grid")).toBeInTheDocument();
  });
});
