import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { useAppStore } from "../../state/appStore";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { focusFundamentalsReferenceFocusDepthMm } from "../../scenes/focusFundamentalsTargets";

const renderRoute = (sceneId: string) =>
  render(
    <MemoryRouter>
      <SimulatorWorkspace
        mode="free"
        sceneId={sceneId}
        taskId={null}
        simulateAssetFailure={false}
      />
    </MemoryRouter>,
  );

const readZ = (element: HTMLElement, attribute: string): number => {
  const value = element.getAttribute(attribute);
  const z = Number(value?.split(",")[2]);
  if (!Number.isFinite(z)) throw new Error(`Invalid ${attribute}: ${value}`);
  return z;
};

describe("Focus Fundamentals selectable focus integration", () => {
  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
  });

  it("routes focus-standard changes through the canonical optics state", async () => {
    renderRoute(focusFundamentalsTwoTargets.id);

    await waitFor(() =>
      expect(useAppStore.getState().camera.activeSceneId).toBe(focusFundamentalsTwoTargets.id),
    );

    const front = screen.getByRole("radio", { name: "Front standard" });
    const rear = screen.getByRole("radio", { name: "Rear standard" });
    const slider = screen.getByLabelText("Focus distance");
    const sceneCanvas = screen.getByTestId("scene-canvas");

    expect(front).toBeChecked();
    expect(rear).not.toBeChecked();
    expect(slider).toHaveAttribute("min", "1500");
    expect(slider).toHaveAttribute("max", "2500");
    expect(sceneCanvas).toHaveAttribute("data-focus-standard-selected", "front");
    expect(sceneCanvas).toHaveAttribute("data-focus-standard-resolved", "front");
    expect(sceneCanvas).toHaveAttribute("data-optics-fallback-applied", "false");

    const referenceLensZ = readZ(sceneCanvas, "data-camera-lens-center-world");
    expect(readZ(sceneCanvas, "data-camera-film-center-world")).toBeCloseTo(0, 10);

    fireEvent.change(slider, { target: { value: "2180" } });
    await waitFor(() => expect(useAppStore.getState().camera.focusDistanceMm).toBe(2180));
    expect(readZ(sceneCanvas, "data-camera-film-center-world")).toBeCloseTo(0, 10);
    expect(readZ(sceneCanvas, "data-camera-lens-center-world")).not.toBeCloseTo(referenceLensZ, 10);

    fireEvent.click(rear);
    await waitFor(() => expect(useAppStore.getState().camera.focusStandard).toBe("rear"));
    expect(rear).toBeChecked();
    expect(sceneCanvas).toHaveAttribute("data-focus-standard-selected", "rear");
    expect(sceneCanvas).toHaveAttribute("data-focus-standard-resolved", "rear");
    expect(readZ(sceneCanvas, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 10);
    expect(readZ(sceneCanvas, "data-camera-film-center-world")).not.toBeCloseTo(0, 10);

    fireEvent.click(screen.getByRole("button", { name: "Infinity Reset" }));
    await waitFor(() => expect(useAppStore.getState().camera.focusMode).toBe("infinity"));
    expect(screen.getByText("Focus: ∞")).toBeInTheDocument();
    expect(sceneCanvas).toHaveAttribute("data-focus-standard-selected", "rear");
    expect(sceneCanvas).toHaveAttribute("data-focus-standard-resolved", "rear");
    expect(readZ(sceneCanvas, "data-camera-film-center-world")).toBeCloseTo(
      readZ(sceneCanvas, "data-camera-lens-center-world") - useAppStore.getState().camera.focalLengthMm,
      10,
    );

    fireEvent.click(front);
    await waitFor(() => expect(useAppStore.getState().camera.focusStandard).toBe("front"));
    expect(sceneCanvas).toHaveAttribute("data-focus-standard-resolved", "front");
    expect(readZ(sceneCanvas, "data-camera-film-center-world")).toBeCloseTo(0, 10);

    fireEvent.click(screen.getByRole("button", { name: "Reset movements" }));
    await waitFor(() =>
      expect(useAppStore.getState().camera).toMatchObject({
        focusStandard: "front",
        focusDistanceMm: focusFundamentalsReferenceFocusDepthMm,
        focusMode: "finite",
      }),
    );
    expect(sceneCanvas).toHaveAttribute("data-focus-standard-selected", "front");
    expect(sceneCanvas).toHaveAttribute("data-focus-standard-resolved", "front");
  });

  it("only exposes selectable focus controls on the capable scene", async () => {
    renderRoute("architecture-rise");

    await waitFor(() =>
      expect(useAppStore.getState().camera.activeSceneId).toBe("architecture-rise"),
    );
    expect(screen.queryByRole("group", { name: "Focus standard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Front standard" })).not.toBeInTheDocument();
  });
});
