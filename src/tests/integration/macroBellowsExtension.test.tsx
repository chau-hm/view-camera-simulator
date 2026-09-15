import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { MacroFocusReadout } from "../../components/simulator/MacroFocusReadout";
import { useAppStore } from "../../state/appStore";
import { selectDerivedOpticsState } from "../../state/selectors";
import { macroBellowsExtensionScene as scene } from "../../scenes/definitions/macro-bellows-extension";
import { macroBellowsExtensionFocusTargets, macroBellowsExtensionSceneBoundsMm } from "../../scenes/macroSpecimenGeometry";
import { CAMERA_CONTROL_STEPS } from "../../utils/constants";
import { i18n } from "../../i18n";

afterEach(async () => {
  cleanup();
  useAppStore.getState().resetCamera();
  useAppStore.getState().clearSimulatorRouteInitialization();
  await i18n.changeLanguage("en");
});

describe("Macro Bellows Extension", () => {
  it("uses the shared specimen contract and fixed finite-focus scene policy", () => {
    expect(scene.focusTargets).toBe(macroBellowsExtensionFocusTargets);
    expect(scene.bounds).toBe(macroBellowsExtensionSceneBoundsMm);
    expect(scene.finiteFocusStrategy).toEqual({
      kind: "rear-standard-thin-lens", lensDatum: "baseline-origin",
      focusDistanceReference: "lens-to-focus-plane", filmDepthReference: "optical-axis-conjugate",
    });
    expect(scene.cameraControlPolicy).toEqual({ movement: "fixed", aperture: "fixed", infinityReset: false });
    expect(scene.focusStandardCapability).toBeUndefined();
    expect(scene.focalLengthCapability).toBeUndefined();
  });

  it("restores finite focus and the initial macro readout after prior Infinity Focus", async () => {
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
        focusDistanceMm: 900,
        lastFiniteFocusDepthMm: 900,
      }),
    );
    const optics = selectDerivedOpticsState(useAppStore.getState().camera);
    expect(optics.diagnostics.imageDistanceMm).toBeCloseTo(180, 12);
    expect(optics.filmCenterWorld.z).toBeCloseTo(-180, 12);

    const readout = await screen.findByRole("region", { name: "Macro focus" });
    expect(readout).toHaveTextContent("180.0 mm");
    expect(readout).toHaveTextContent("0.20×");
  });

  it("exposes only finite focus and updates informational readouts through public keyboard steps", () => {
    render(<MemoryRouter><SimulatorWorkspace mode="free" sceneId={scene.id} taskId={null} simulateAssetFailure={false} /></MemoryRouter>);
    const focus = screen.getByRole("slider", { name: "Focus distance" });
    expect(focus).toHaveAttribute("min", "300");
    expect(focus).toHaveAttribute("max", "900");
    expect(focus).toHaveAttribute("step", String(CAMERA_CONTROL_STEPS.focusDistanceMm));
    expect(focus).toHaveValue("900");
    expect(screen.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
    expect(screen.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute("data-selected-aperture", "11");
    expect(screen.queryByRole("group", { name: "Focus standard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Infinity Reset" })).not.toBeInTheDocument();
    expect(screen.queryByText("Movement", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /focal length/i })).not.toBeInTheDocument();
    const readout = within(screen.getByRole("region", { name: "Macro focus" }));
    expect(readout.getByText("180.0 mm")).toBeInTheDocument();
    expect(readout.getByText("0.20×")).toBeInTheDocument();
    expect(readout.queryByText("Approximately life-size (1:1)")).not.toBeInTheDocument();
    fireEvent.keyDown(focus, { key: "Home" });
    expect(focus).toHaveValue("300");
    expect(readout.getByText("300.0 mm")).toBeInTheDocument();
    expect(readout.getByText("1.00×")).toBeInTheDocument();
    expect(readout.getByText("4.00×")).toBeInTheDocument();
    expect(readout.getByText("+2.00 stops")).toBeInTheDocument();
    expect(readout.getByText("Approximately life-size (1:1)")).toBeInTheDocument();
    fireEvent.keyDown(focus, { key: "ArrowRight" });
    expect(focus).toHaveValue("310");
    expect(readout.queryByText("Approximately life-size (1:1)")).not.toBeInTheDocument();
    expect(useAppStore.getState().camera.activeTaskId).toBeNull();
  });

  it("uses canonical diagnostics, translates copy, and suppresses unavailable metrics", async () => {
    useAppStore.getState().setActiveScene(scene.id);
    const diagnostics = selectDerivedOpticsState(useAppStore.getState().camera).diagnostics;
    await i18n.changeLanguage("zh-HK");
    const { rerender } = render(<MacroFocusReadout diagnostics={diagnostics} focalLengthMm={150} />);
    expect(screen.getByRole("region", { name: "微距對焦" })).toHaveTextContent("180.0 mm");
    expect(screen.getByText("放大倍率")).toBeInTheDocument();
    rerender(<MacroFocusReadout diagnostics={{ ...diagnostics, imageDistanceMm: null }} focalLengthMm={150} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    rerender(<MacroFocusReadout diagnostics={{ ...diagnostics, fallbackApplied: true }} focalLengthMm={150} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
