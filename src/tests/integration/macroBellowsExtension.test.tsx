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
    expect(scene.cameraControlPolicy).toEqual({ movement: "fixed", infinityReset: false });
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
    const aperture = screen.getByRole("radiogroup", { name: "Aperture" });
    expect(aperture).not.toBeDisabled();
    expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
    expect(screen.queryByText("Aperture is fixed for this lesson")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Focus standard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Infinity Reset" })).not.toBeInTheDocument();
    expect(screen.queryByText("Movement", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /focal length/i })).not.toBeInTheDocument();
    const readout = within(screen.getByRole("region", { name: "Macro focus" }));
    expect(readout.getByText("180.0 mm")).toBeInTheDocument();
    expect(readout.getByText("0.20×")).toBeInTheDocument();
    expect(readout.getByText("Selected focus-plane magnification")).toBeInTheDocument();
    expect(readout.getByText("Selected focus-plane ratio")).toBeInTheDocument();
    expect(readout.getByText("1:5")).toBeInTheDocument();
    expect(readout.getByText("320.0 mm")).toBeInTheDocument();
    const initialOptics = selectDerivedOpticsState(useAppStore.getState().camera);
    fireEvent.click(within(aperture).getByRole("radio", { name: "f/11" }));
    expect(useAppStore.getState().camera.aperture).toBe(11);
    const stoppedDownOptics = selectDerivedOpticsState(useAppStore.getState().camera);
    expect(stoppedDownOptics.diagnostics.imageDistanceMm).toBeCloseTo(
      initialOptics.diagnostics.imageDistanceMm!,
      12,
    );
    expect(stoppedDownOptics.diagnostics.focusObjectDistanceMm).toBeCloseTo(
      initialOptics.diagnostics.focusObjectDistanceMm!,
      12,
    );
    expect(readout.getByText("180.0 mm")).toBeInTheDocument();
    expect(readout.getByText("0.20×")).toBeInTheDocument();
    expect(screen.getByTestId("ground-glass-scale-cue")).toHaveTextContent("Grid: 1 cm per square");
    expect(screen.getByTestId("ground-glass-grid")).toHaveAttribute("data-grid-mode", "physical");
    expect(readout.queryByTestId("macro-life-size-message")).not.toBeInTheDocument();
    fireEvent.keyDown(focus, { key: "Home" });
    expect(focus).toHaveValue("300");
    expect(readout.getByText("300.0 mm")).toBeInTheDocument();
    expect(readout.getByText("1.00×")).toBeInTheDocument();
    expect(readout.getByText("1:1")).toBeInTheDocument();
    expect(readout.getByText("4.00×")).toBeInTheDocument();
    expect(readout.getByText("+2.00 stops")).toBeInTheDocument();
    expect(readout.getByTestId("macro-life-size-message")).toHaveTextContent("Life-size reproduction reached (1:1)");
    fireEvent.keyDown(focus, { key: "ArrowRight" });
    expect(focus).toHaveValue("310");
    expect(readout.queryByTestId("macro-life-size-message")).not.toBeInTheDocument();
    expect(useAppStore.getState().camera.activeTaskId).toBeNull();
  });

  it("updates Scene 1 teaching feedback across the macro progression without affecting Scene 2", async () => {
    render(<MemoryRouter><SimulatorWorkspace mode="free" sceneId={scene.id} taskId={null} simulateAssetFailure={false} /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Open Task and Feedback" }));
    const taskView = screen.getByTestId("learning-overlay-task-view");
    expect(taskView).toHaveTextContent("Goal");
    expect(taskView).toHaveTextContent("selected focus plane is still well behind the specimen");
    expect(taskView).toHaveTextContent(/open the aperture while focusing/i);
    expect(taskView).not.toHaveTextContent("the specimen is currently");

    const focus = screen.getByRole("slider", { name: "Focus distance" });
    fireEvent.change(focus, { target: { value: "450" } });
    await waitFor(() => expect(taskView).toHaveTextContent(/approaching life size/i));
    expect(taskView).toHaveTextContent(/compare the specimen with the 1 cm Ground Glass grid/i);

    fireEvent.change(focus, { target: { value: "320" } });
    await waitFor(() => expect(taskView).toHaveTextContent(/very close to life size/i));
    expect(taskView).toHaveTextContent(/is approaching the 320\.0 mm of available bellows travel/i);

    fireEvent.change(focus, { target: { value: "300" } });
    await waitFor(() => expect(taskView).toHaveTextContent(/specimen is now sharply reproduced at 1:1/i));
    expect(taskView).toHaveTextContent(/specimen is now sharply reproduced at 1:1/i);
    expect(taskView).toHaveTextContent(/90 mm diameter spans about nine 10 mm squares/i);
    expect(taskView).toHaveTextContent(/\+2\.00 stops exposure compensation/i);
    expect(taskView).toHaveTextContent(/focus with the lens opened wide/i);

    fireEvent.click(screen.getByRole("button", { name: /^Feedback$/ }));
    expect(screen.getByTestId("macro-bellows-feedback")).toHaveTextContent(/life-size reproduction reached/i);

    cleanup();
    render(<MemoryRouter><SimulatorWorkspace mode="free" sceneId="macro-depth-of-field" taskId={null} simulateAssetFailure={false} /></MemoryRouter>);
    expect(screen.queryByTestId("macro-bellows-teaching")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ground-glass-scale-cue")).not.toBeInTheDocument();
    expect(screen.getByTestId("ground-glass-grid")).toHaveAttribute("data-grid-mode", "decorative");
    expect(within(screen.getByRole("region", { name: "Macro focus" })).queryByText("Reproduction ratio")).not.toBeInTheDocument();
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

  it("localizes the Scene 1 teaching stop unit", async () => {
    await i18n.changeLanguage("zh-HK");
    render(<MemoryRouter><SimulatorWorkspace mode="free" sceneId={scene.id} taskId={null} simulateAssetFailure={false} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "開啟任務及回饋" }));
    const taskView = screen.getByTestId("learning-overlay-task-view");
    const focus = screen.getByRole("slider", { name: "對焦距離" });
    fireEvent.change(focus, { target: { value: "300" } });

    await waitFor(() => expect(taskView).toHaveTextContent("級"));
    expect(taskView).toHaveTextContent("+2.00 級");
    expect(taskView).toHaveTextContent(/開大光圈/);
    expect(taskView).not.toHaveTextContent("stops");
  });
});
