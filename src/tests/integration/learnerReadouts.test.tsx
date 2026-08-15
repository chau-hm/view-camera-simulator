import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { i18n } from "../../i18n";
import { useAppStore } from "../../state/appStore";

const renderWorkspace = (
  sceneId: string,
  mode: "free" | "guided" = "free",
  taskId: string | null = null,
) =>
  render(
    <MemoryRouter>
      <SimulatorWorkspace
        mode={mode}
        sceneId={sceneId}
        taskId={taskId}
        simulateAssetFailure={false}
      />
    </MemoryRouter>,
  );

describe("scene-aware learner readouts", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
    useAppStore.getState().setActiveTask(null);
  });

  it("keeps Understanding Camera Movements focused on movement relationships", async () => {
    renderWorkspace("understanding-camera-movements");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("understanding-camera-movements"));
    const current = screen.getByTestId("current-settings-readout");
    expect(current).toHaveTextContent("Movement relationship");
    expect(current).toHaveTextContent("Neutral viewpoint");
    expect(current).not.toHaveTextContent("Exposure & focus");
    expect(screen.queryByTestId("focus-targets-readout")).not.toBeInTheDocument();
    expect(screen.queryByText("No focus targets")).not.toBeInTheDocument();

    await i18n.changeLanguage("zh-HK");
    expect(screen.getByTestId("current-settings-readout")).toHaveTextContent("目前設定");
    expect(screen.getByTestId("current-settings-readout")).toHaveTextContent("移動關係");
    expect(screen.getByTestId("current-settings-readout")).toHaveTextContent("中立視點");
  });

  it("localizes Understanding Camera Movements vertical framing for both standards and directions", async () => {
    renderWorkspace("understanding-camera-movements");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("understanding-camera-movements"));
    const current = screen.getByTestId("current-settings-readout");
    const framingSlider = screen.getByRole("slider", { name: "Vertical framing" });
    const standardGroup = screen.getByRole("group", { name: "Vertical framing standard" });

    const setEnglishFraming = async (
      standard: "Front" | "Rear",
      value: "1" | "-1",
      framing: "Upper framing" | "Lower framing",
      movement: "+20.0 mm" | "-20.0 mm",
    ) => {
      fireEvent.click(within(standardGroup).getByRole("radio", { name: `${standard} standard` }));
      fireEvent.change(framingSlider, { target: { value } });

      await waitFor(() => {
        expect(current).toHaveTextContent(
          `${standard} Vertical Framing · ${framing} · ${movement}`,
        );
      });
    };

    await setEnglishFraming("Front", "1", "Upper framing", "+20.0 mm");
    await setEnglishFraming("Front", "-1", "Lower framing", "-20.0 mm");
    await setEnglishFraming("Rear", "1", "Upper framing", "+20.0 mm");
    await setEnglishFraming("Rear", "-1", "Lower framing", "-20.0 mm");

    await i18n.changeLanguage("zh-HK");
    fireEvent.change(framingSlider, { target: { value: "1" } });
    await waitFor(() => {
      expect(current).toHaveTextContent("後組垂直構圖 · 上方構圖 · +20.0 mm");
      expect(current).not.toHaveTextContent("中間構圖");
    });

    fireEvent.change(framingSlider, { target: { value: "-1" } });
    await waitFor(() => {
      expect(current).toHaveTextContent("後組垂直構圖 · 下方構圖 · -20.0 mm");
      expect(current).not.toHaveTextContent("中間構圖");
    });
  });

  it("shows Mirror Shift viewpoint and framing values without a focus card", async () => {
    renderWorkspace("mirror-shift");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("mirror-shift"));
    const current = screen.getByTestId("current-settings-readout");
    expect(current).toHaveTextContent("Viewpoint & framing");
    expect(current).toHaveTextContent("Camera Position: 0.0 mm");
    expect(current).toHaveTextContent("Front Shift: 0.0 mm");
    expect(screen.queryByTestId("focus-targets-readout")).not.toBeInTheDocument();
    expect(current).not.toHaveTextContent("Rise");
    expect(current).not.toHaveTextContent("Tilt");
    expect(current).not.toHaveTextContent("Swing");
    expect(current).not.toHaveTextContent("Focus");
    expect(current).not.toHaveTextContent("Aperture");

    fireEvent.change(screen.getByRole("slider", { name: "Camera Position" }), { target: { value: "100" } });
    fireEvent.change(screen.getByRole("slider", { name: "Front Shift" }), { target: { value: "-50" } });
    await waitFor(() => {
      expect(current).toHaveTextContent("Camera Position: 100.0 mm");
      expect(current).toHaveTextContent("Front Shift: -50.0 mm");
    });

    await i18n.changeLanguage("zh-HK");
    expect(screen.getByTestId("current-settings-readout")).toHaveTextContent("視點與構圖");
    expect(screen.getByTestId("current-settings-readout")).toHaveTextContent("相機位置");
    expect(screen.getByTestId("current-settings-readout")).toHaveTextContent("前組橫移");
  });

  it("shows the Front-versus-Rear focus method and fixed aperture", async () => {
    renderWorkspace("focus-fundamentals-two-targets");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("focus-fundamentals-two-targets"));
    const current = screen.getByTestId("current-settings-readout");
    const targets = screen.getByTestId("focus-targets-readout");
    expect(current).toHaveTextContent("Focus method");
    expect(current).toHaveTextContent("Front standard");
    expect(current).toHaveTextContent("Focus");
    expect(current).toHaveTextContent("Aperture: f/32");
    expect(current.querySelector("dt")).not.toHaveTextContent("Movement");
    expect(current).not.toHaveTextContent("Rise");
    expect(current).not.toHaveTextContent("Tilt");
    expect(current).not.toHaveTextContent("Swing");
    expect(targets).toHaveTextContent("Focus targets · Focus");

    await i18n.changeLanguage("zh-HK");
    const localizedCurrent = screen.getByTestId("current-settings-readout");
    expect(localizedCurrent).toHaveTextContent("對焦方式");
    expect(localizedCurrent).toHaveTextContent("前組");
    expect(localizedCurrent).toHaveTextContent("光圈: f/32");
    expect(screen.getByTestId("focus-targets-readout")).toHaveTextContent("對焦目標 · 對焦");
  });

  it.each([
    ["architecture-rise", "Front Rise"],
    ["table-tilt", "Front Tilt"],
    ["shelf-swing", "Front Swing"],
  ])("keeps %s focused on its primary Front movement and focus targets", async (sceneId, movementLabel) => {
    renderWorkspace(sceneId);

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe(sceneId));
    const current = screen.getByTestId("current-settings-readout");
    expect(current).toHaveTextContent(movementLabel);
    expect(current).toHaveTextContent("Focus");
    expect(current).toHaveTextContent("Aperture");
    expect(screen.getByTestId("focus-targets-readout")).toBeInTheDocument();
  });

  it("preserves the Table Tilt patch-coverage metric in the guided readout", async () => {
    renderWorkspace("table-tilt", "guided", "tilt-01");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("table-tilt"));
    expect(within(screen.getByTestId("focus-targets-readout")).getByRole("heading", { name: "Focus targets · Patch coverage" })).toBeInTheDocument();
  });
});
