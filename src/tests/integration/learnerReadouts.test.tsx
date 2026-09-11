import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { quantizeFocusDistributionDisplayUv } from "../../components/simulator/focusDistributionLayout";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { i18n } from "../../i18n";
import {
  projectSceneFocusTargetsToGroundGlass,
  type GroundGlassPreviewMode,
} from "../../render/groundGlassTargetProjection";
import { obliqueTabletopScene } from "../../scenes/definitions/oblique-tabletop";
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
    expect(screen.queryByTestId("focus-distribution-panel")).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("focus-distribution-panel")).not.toBeInTheDocument();
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
    const targets = screen.getByTestId("focus-distribution-panel");
    expect(current).toHaveTextContent("Focus method");
    expect(current).toHaveTextContent("Front standard");
    expect(current).toHaveTextContent("Focus");
    expect(current).toHaveTextContent("Aperture: f/11");
    expect(current.querySelector("dt")).not.toHaveTextContent("Movement");
    expect(current).not.toHaveTextContent("Rise");
    expect(current).not.toHaveTextContent("Tilt");
    expect(current).not.toHaveTextContent("Swing");
    expect(targets).toHaveTextContent("Focus distribution");

    await i18n.changeLanguage("zh-HK");
    const localizedCurrent = screen.getByTestId("current-settings-readout");
    expect(localizedCurrent).toHaveTextContent("對焦方式");
    expect(localizedCurrent).toHaveTextContent("前組");
    expect(localizedCurrent).toHaveTextContent("光圈: f/11");
    expect(screen.getByTestId("focus-distribution-panel")).toHaveTextContent("對焦分佈");
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
    expect(screen.getByTestId("focus-distribution-panel")).toBeInTheDocument();
  });

  it("keeps single-movement scenes collapsed to their selected movement", async () => {
    render(
      <MemoryRouter>
        <SimulatorWorkspace
          mode="free"
          sceneId="understanding-camera-movements"
          taskId={null}
          calibrationEnabled
          simulateAssetFailure={false}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("understanding-camera-movements"));
    const current = screen.getByTestId("current-settings-readout");
    expect(current).toHaveTextContent("Front Rise: 0.0 mm");
    expect(current).not.toHaveTextContent("Front Tilt: 0.0°");
    expect(current).not.toHaveTextContent("Front Swing: 0.0°");
  });

  it("preserves the Table Tilt patch-coverage metric in the guided readout", async () => {
    renderWorkspace("table-tilt", "guided", "tilt-01");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("table-tilt"));
    expect(within(screen.getByTestId("focus-distribution-panel")).getByRole("heading", { name: "Focus distribution" })).toBeInTheDocument();
  });

  it("keeps Focus distribution synchronized with the actual Ground Glass orientation control", async () => {
    renderWorkspace("oblique-tabletop");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("oblique-tabletop"));
    const panel = screen.getByTestId("focus-distribution-panel");
    const targetPosition = (targetId: string) => {
      const target = panel.querySelector<HTMLElement>(`[data-focus-target-id="${targetId}"]`);
      const row = target?.closest("tr");
      if (!target || !row) return null;
      const rows = within(panel).getAllByRole("row");
      return {
        rowIndex: rows.indexOf(row as HTMLElement),
        columnIndex: Array.from(row.children).indexOf(target),
      };
    };
    const projectedPosition = (previewMode: GroundGlassPreviewMode, targetId: string) => {
      const camera = useAppStore.getState().camera;
      const opticsState = deriveOpticsState(camera, obliqueTabletopScene);
      const projectedTarget = projectSceneFocusTargetsToGroundGlass({
        sceneDef: obliqueTabletopScene,
        opticsState,
        aperture: camera.aperture,
        previewMode,
      }).find((target) => target.id === targetId);
      return quantizeFocusDistributionDisplayUv(
        projectedTarget?.displayUv ?? null,
        projectedTarget?.visible ?? false,
      );
    };

    expect(screen.getByTestId("focus-distribution-orientation")).toHaveTextContent("Raw");
    expect(targetPosition("far-right")).toEqual(projectedPosition("raw", "far-right"));

    fireEvent.click(screen.getByRole("radio", { name: "Upright Assist" }));
    await waitFor(() => {
      expect(screen.getByTestId("focus-distribution-orientation")).toHaveTextContent("Upright");
      expect(targetPosition("near-left")).toEqual(projectedPosition("upright", "near-left"));
    });

    fireEvent.click(screen.getByRole("radio", { name: "Raw Ground Glass" }));
    await waitFor(() => {
      expect(screen.getByTestId("focus-distribution-orientation")).toHaveTextContent("Raw");
      expect(targetPosition("far-right")).toEqual(projectedPosition("raw", "far-right"));
    });
  });
});
