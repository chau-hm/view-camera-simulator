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

  it("removes Current Settings while keeping Focus Distribution in its learner readout slot", async () => {
    const { container } = renderWorkspace("table-tilt");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("table-tilt"));
    expect(screen.queryByTestId("current-settings-readout")).not.toBeInTheDocument();
    const panel = screen.getByTestId("focus-distribution-panel");
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByRole("table", { name: "Focus distribution" })).toBeInTheDocument();
    expect(panel.parentElement).not.toHaveClass("simulator-primary-info-grid");
    expect(container.querySelector(".simulator-primary-info-grid")).not.toBeInTheDocument();
  });

  it("does not leave an empty learner-readout area when a scene has no focus distribution", async () => {
    const { container } = renderWorkspace("mirror-shift");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("mirror-shift"));
    expect(screen.queryByTestId("current-settings-readout")).not.toBeInTheDocument();
    expect(screen.queryByTestId("focus-distribution-panel")).not.toBeInTheDocument();
    expect(container.querySelector(".simulator-primary-info-grid")).not.toBeInTheDocument();
    expect(screen.getByText("Optical Debug")).toBeInTheDocument();
  });

  it("keeps Understanding Camera Movements teaching summary in its controls", async () => {
    renderWorkspace("understanding-camera-movements");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("understanding-camera-movements"));
    expect(screen.queryByTestId("current-settings-readout")).not.toBeInTheDocument();
    expect(screen.queryByTestId("focus-distribution-panel")).not.toBeInTheDocument();
    const movementControls = screen.getByRole("region", { name: "Camera Movement" });
    const status = within(movementControls).getByRole("status");
    expect(status).toHaveTextContent("Neutral viewpoint");

    fireEvent.change(screen.getByRole("slider", { name: "Viewpoint" }), {
      target: { value: "0.5" },
    });
    await waitFor(() => expect(status).toHaveTextContent("Higher viewpoint · 50% toward higher viewpoint"));
  });

  it("localizes Understanding Camera Movements vertical framing in its teaching controls", async () => {
    renderWorkspace("understanding-camera-movements");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("understanding-camera-movements"));
    expect(screen.queryByTestId("current-settings-readout")).not.toBeInTheDocument();
    const movementControls = screen.getByRole("region", { name: "Camera Movement" });
    const status = within(movementControls).getByRole("status");
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
        expect(status).toHaveTextContent(`${standard} standard · ${framing} · ${movement}`);
      });
    };

    await setEnglishFraming("Front", "1", "Upper framing", "+20.0 mm");
    await setEnglishFraming("Front", "-1", "Lower framing", "-20.0 mm");
    await setEnglishFraming("Rear", "1", "Upper framing", "+20.0 mm");
    await setEnglishFraming("Rear", "-1", "Lower framing", "-20.0 mm");

    await i18n.changeLanguage("zh-HK");
    fireEvent.change(framingSlider, { target: { value: "1" } });
    await waitFor(() => {
      expect(status).toHaveTextContent("後組 · 上方構圖 · +20.0 mm");
      expect(status).not.toHaveTextContent("中間構圖");
    });

    fireEvent.change(framingSlider, { target: { value: "-1" } });
    await waitFor(() => {
      expect(status).toHaveTextContent("後組 · 下方構圖 · -20.0 mm");
      expect(status).not.toHaveTextContent("中間構圖");
    });
  });

  it("keeps Mirror Shift camera position and front shift controls without Current Settings", async () => {
    renderWorkspace("mirror-shift");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("mirror-shift"));
    expect(screen.queryByTestId("current-settings-readout")).not.toBeInTheDocument();
    expect(screen.queryByTestId("focus-distribution-panel")).not.toBeInTheDocument();
    const controls = screen.getByRole("region", { name: "Camera Controls" });
    const cameraPosition = within(controls).getByRole("slider", { name: "Camera Position" });
    const frontShift = within(controls).getByRole("slider", { name: "Front Shift" });
    expect(cameraPosition).toHaveValue("0");
    expect(frontShift).toHaveValue("0");

    fireEvent.change(cameraPosition, { target: { value: "100" } });
    fireEvent.change(frontShift, { target: { value: "-50" } });
    await waitFor(() => {
      expect(cameraPosition).toHaveValue("100");
      expect(frontShift).toHaveValue("-50");
    });

    await i18n.changeLanguage("zh-HK");
    expect(within(screen.getByRole("region", { name: "相機控制" })).getByRole("slider", { name: "相機位置" })).toHaveValue("100");
    expect(within(screen.getByRole("region", { name: "相機控制" })).getByRole("slider", { name: "前組橫移" })).toHaveValue("-50");
  });

  it("keeps Focus Fundamentals focus-method teaching in Focus controls", async () => {
    renderWorkspace("focus-fundamentals-two-targets");

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("focus-fundamentals-two-targets"));
    expect(screen.queryByTestId("current-settings-readout")).not.toBeInTheDocument();
    const targets = screen.getByTestId("focus-distribution-panel");
    const controls = screen.getByRole("region", { name: "Camera Controls" });
    expect(within(controls).getByRole("radio", { name: "Front standard" })).toBeChecked();
    expect(screen.getByText("Front focusing moves the lens/viewpoint. The film stays fixed.")).toBeInTheDocument();
    expect(within(controls).getByRole("combobox", { name: "Aperture" })).toBeDisabled();
    expect(targets).toHaveTextContent("Focus distribution");

    fireEvent.click(within(controls).getByRole("radio", { name: "Rear standard" }));
    await waitFor(() => expect(screen.getByText("Rear focusing moves the film while the lens/viewpoint stays fixed.")).toBeInTheDocument());

    await i18n.changeLanguage("zh-HK");
    expect(screen.getByTestId("focus-distribution-panel")).toHaveTextContent("對焦分佈");
  });

  it.each([
    ["architecture-rise", "Front Rise"],
    ["table-tilt", "Front Tilt"],
    ["shelf-swing", "Front Swing"],
  ])("keeps %s focused on its primary Front movement and focus targets", async (sceneId, movementLabel) => {
    renderWorkspace(sceneId);

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe(sceneId));
    expect(screen.queryByTestId("current-settings-readout")).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: movementLabel.replace("Front ", "") })).toBeInTheDocument();
    expect(screen.getByTestId("focus-distribution-panel")).toBeInTheDocument();
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
      const cell = target?.closest("td");
      const row = cell?.closest("tr");
      if (!target || !cell || !row) return null;
      const rows = within(panel).getAllByRole("row");
      return {
        rowIndex: rows.indexOf(row as HTMLElement),
        columnIndex: Array.from(row.children).indexOf(cell),
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
