import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("renders Scene 2 teaching stages from the physical focus distribution metrics", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: "Open Task and Feedback" }));
    const taskView = screen.getByTestId("learning-overlay-task-view");
    const focus = screen.getByRole("slider", { name: "Focus distance" });
    const aperture = screen.getByRole("radiogroup", { name: "Aperture" });
    const teaching = screen.getByTestId("macro-depth-teaching");

    expect(teaching).toHaveAttribute("data-stage", "wide-open");
    expect(teaching).toHaveAttribute("data-focused-region", "middle");
    expect(taskView).toHaveTextContent("three-dimensional subject");
    expect(taskView).toHaveTextContent(/Refocusing moves/);
    expect(taskView).toHaveTextContent(/does not increase total depth of field/);
    expect(taskView).not.toHaveTextContent(/bellows travel/);

    fireEvent.change(focus, { target: { value: "360" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-focused-region", "near"));
    expect(taskView).toHaveTextContent(/Near detail is currently strongest/);

    fireEvent.change(focus, { target: { value: "440" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-focused-region", "far"));
    expect(taskView).toHaveTextContent(/Far detail is currently strongest/);

    fireEvent.change(focus, { target: { value: "390" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-focused-region", "near"));
    expect(taskView).toHaveTextContent(/Near detail is currently strongest/);

    fireEvent.change(focus, { target: { value: "410" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-focused-region", "far"));
    expect(taskView).toHaveTextContent(/Far detail is currently strongest/);

    fireEvent.change(focus, { target: { value: "400" } });
    fireEvent.click(within(aperture).getByRole("radio", { name: "f/11" }));
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "begin-stopping-down"));
    expect(taskView).toHaveTextContent(/Changing Focus relocates the sharp zone/);
    expect(taskView).toHaveTextContent(/Stopping down reduces actual blur/);
    expect(taskView).toHaveTextContent(/same acceptable-sharpness range/);

    fireEvent.click(within(aperture).getByRole("radio", { name: "f/22" }));
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "moderate-stopping-down"));
    expect(taskView).toHaveTextContent(/expanded usable depth/);

    fireEvent.click(within(aperture).getByRole("radio", { name: "f/32" }));
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "minimum-aperture"));
    expect(taskView).toHaveTextContent(/remain Soft/);
    expect(taskView).toHaveTextContent(/aperture alone cannot always cover/);
    expect(focus).toHaveValue("400");
  });

  it("localizes the Scene 2 teaching content", async () => {
    await i18n.changeLanguage("zh-HK");
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

    fireEvent.click(await screen.findByRole("button", { name: "開啟任務及回饋" }));
    const taskView = screen.getByTestId("learning-overlay-task-view");
    expect(taskView).toHaveTextContent("目標");
    expect(taskView).toHaveTextContent("探索在微距距離下");
    expect(taskView).toHaveTextContent("重新對焦只會移動");

    const aperture = screen.getByRole("radiogroup", { name: "光圈" });
    fireEvent.click(within(aperture).getByRole("radio", { name: "f/11" }));
    await waitFor(() => expect(taskView).toHaveTextContent("實際模糊"));
    expect(taskView).not.toHaveTextContent("減少可接受的模糊");

    fireEvent.click(within(aperture).getByRole("radio", { name: "f/32" }));
    await waitFor(() => expect(taskView).toHaveTextContent("仍然柔化"));
    expect(taskView).toHaveTextContent("收細光圈有幫助");
  });
});
