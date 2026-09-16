import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { selectDerivedOpticsState } from "../../state/selectors";
import { useAppStore } from "../../state/appStore";
import { macroDepthOfFieldScene as scene } from "../../scenes/definitions/macro-depth-of-field";
import { i18n } from "../../i18n";

afterEach(async () => {
  cleanup();
  useAppStore.getState().resetCamera();
  useAppStore.getState().clearSimulatorRouteInitialization();
  await i18n.changeLanguage("en");
});

describe("Macro Depth of Field", () => {
  it("enters finite focus with an immediately available macro readout after prior Infinity Focus", async () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "architecture-rise", taskId: null });
    store.setInfinityFocus();
    expect(useAppStore.getState().camera.focusMode).toBe("infinity");
    store.clearSimulatorRouteInitialization();

    render(
      <MemoryRouter>
        <SimulatorWorkspace
          mode="free"
          sceneId={scene.id}
          taskId={null}
          simulateAssetFailure={false}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(useAppStore.getState().camera).toMatchObject({
        activeSceneId: scene.id,
        focusMode: "finite",
        focusDistanceMm: 400,
        lastFiniteFocusDepthMm: 400,
      }),
    );

    const optics = selectDerivedOpticsState(useAppStore.getState().camera);
    expect(optics.diagnostics.imageDistanceMm).toBeCloseTo(240, 12);
    expect(optics.filmCenterWorld.z).toBeCloseTo(-240, 12);
    const readout = await screen.findByRole("region", { name: "Macro focus" });
    expect(readout).toHaveTextContent("240.0 mm");
    expect(readout).toHaveTextContent("0.60×");
  });

  it("exposes only Focus Distance and Aperture plus three physical Focus Distribution targets", async () => {
    render(
      <MemoryRouter>
        <SimulatorWorkspace
          mode="free"
          sceneId={scene.id}
          taskId={null}
          simulateAssetFailure={false}
        />
      </MemoryRouter>,
    );

    const focus = await screen.findByRole("slider", { name: "Focus distance" });
    expect(focus).toHaveAttribute("min", "360");
    expect(focus).toHaveAttribute("max", "440");
    expect(focus).toHaveValue("400");
    expect(focus).not.toBeDisabled();

    const aperture = screen.getByRole("radiogroup", { name: "Aperture" });
    expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
    expect(aperture).not.toBeDisabled();
    expect(screen.queryByText("Movement", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Infinity Reset" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /focal length/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Focus standard" })).not.toBeInTheDocument();

    const panel = await screen.findByTestId("focus-distribution-panel");
    const targets = panel.querySelectorAll("[data-focus-target-id]");
    expect(targets).toHaveLength(3);
    expect(within(panel).getByText("Near detail")).toBeInTheDocument();
    expect(within(panel).getByText("Middle detail")).toBeInTheDocument();
    expect(within(panel).getByText("Far detail")).toBeInTheDocument();
  });
});
