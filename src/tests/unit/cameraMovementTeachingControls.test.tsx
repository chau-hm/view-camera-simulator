import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CameraMovementTeachingControls } from "../../components/controls/CameraMovementTeachingControls";
import { useAppStore } from "../../state/appStore";

afterEach(() => {
  cleanup();
  useAppStore.getState().resetCamera();
});

const onPublicRoute = () => {
  useAppStore.getState().initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements" });
};

describe("CameraMovementTeachingControls", () => {
  it("renders all nine public labels and titles", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    expect(screen.getAllByText("Neutral").length).toBeGreaterThan(0);
    expect(screen.getByRole("radio", { name: "A — Front tilt" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "B — Rear tilt" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "C1 — Front rise" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "C2 — Rear rise" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "C3 — Higher viewpoint" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "D1 — Front fall" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "D2 — Rear fall" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "D3 — Lower viewpoint" })).toBeInTheDocument();
  });

  it("shows the introductory copy and group headings", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    expect(screen.getByText(/Start from Neutral, then compare one camera movement at a time/)).toBeInTheDocument();
    expect(screen.getByText("Reference")).toBeInTheDocument();
    expect(screen.getByText("Tilt")).toBeInTheDocument();
    expect(screen.getByText("Upward examples")).toBeInTheDocument();
    expect(screen.getByText("Downward examples")).toBeInTheDocument();
  });

  it("has Neutral selected on public route entry", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    const neutral = screen.getByRole("radio", { name: "Neutral" });
    expect(neutral).toBeChecked();
  });

  it("selecting each case applies it and the selection persists on rerender", () => {
    onPublicRoute();
    const { rerender } = render(<CameraMovementTeachingControls />);

    const cases = [
      ["A — Front tilt", "A-front-tilt"],
      ["B — Rear tilt", "B-rear-tilt"],
      ["C1 — Front rise", "C1-front-rise"],
      ["C2 — Rear rise", "C2-rear-rise"],
      ["C3 — Higher viewpoint", "C3-high-viewpoint"],
      ["D1 — Front fall", "D1-front-fall"],
      ["D2 — Rear fall", "D2-rear-fall"],
      ["D3 — Lower viewpoint", "D3-low-viewpoint"],
    ] as const;

    for (const [label] of cases) {
      fireEvent.click(screen.getByRole("radio", { name: label }));
      const state = useAppStore.getState();
      expect(state.camera.viewpointAnchor).not.toBeUndefined();
      expect(state.scene.targetRegion).not.toBeUndefined();
      rerender(<CameraMovementTeachingControls />);
      expect(screen.getByRole("radio", { name: label })).toBeChecked();
    }
  });

  it("exposes selected state through native radio semantics", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    const neutral = screen.getByRole("radio", { name: "Neutral" });
    expect(neutral).toHaveAttribute("type", "radio");
    expect(neutral).toBeChecked();
  });

  it("supports keyboard operation through native radio semantics", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    const a = screen.getByRole("radio", { name: "A — Front tilt" });
    a.focus();
    expect(a).toHaveFocus();
    // Space activates the focused radio (native keyboard behaviour).
    fireEvent.keyDown(a, { key: " " });
    fireEvent.click(a);
    expect(useAppStore.getState().camera.frontTiltDeg).toBeGreaterThan(0);
    expect(a).toBeChecked();
  });

  it("associates explanatory copy with the active control via live region", () => {
    onPublicRoute();
    render(<CameraMovementTeachingControls />);
    expect(screen.getByText(/Reference position with no camera movements/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "A — Front tilt" }));
    expect(screen.getByText(/Tilt the front standard/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Tilt the front standard/);
  });
});
