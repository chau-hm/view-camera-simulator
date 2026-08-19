import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { i18n } from "../../i18n";
import { LOCALE_STORAGE_KEY } from "../../i18n/localePreference";
import { useAppStore } from "../../state/appStore";

const LocationProbe = () => <div data-testid="route-location">{useLocation().pathname}</div>;

const resetHarness = async () => {
  cleanup();
  useAppStore.getState().resetCamera();
  useAppStore.getState().setActiveTask(null);
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  await i18n.changeLanguage("en");
  document.documentElement.lang = "en";
};

beforeEach(resetHarness);
afterEach(resetHarness);

describe("simulator header", () => {
  it("renders shared brand and All Scenes and removes scene selector/subtitle", async () => {
    render(
      <MemoryRouter initialEntries={["/simulator/free/focus-fundamentals-two-targets"]}>
        <SimulatorWorkspace mode="free" sceneId="focus-fundamentals-two-targets" taskId={null} simulateAssetFailure={false} />
      </MemoryRouter>,
    );

    // Brand link present and links to /
    const brandLink = await screen.findByRole("link", { name: /View Camera Simulator home/i });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink.getAttribute("href")).toBe("/");

    // Subtitle should not be present in simulator header
    expect(screen.queryByText("Focus, perspective and camera movements")).toBeNull();

    // All Scenes link present and points to /scenes
    const allScenes = await screen.findByRole("link", { name: /All Scenes/i });
    expect(allScenes).toBeInTheDocument();
    expect(allScenes.getAttribute("href")).toBe("/scenes");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en");

    // Scene selector should be removed (there may be other selects on the page; ensure there's no Scene combobox)
    expect(screen.queryByRole("combobox", { name: "Scene" })).toBeNull();
  });

  it("switches locale without changing simulator route or camera state", async () => {
    render(
      <MemoryRouter initialEntries={["/simulator/free/understanding-camera-movements"]}>
        <LocationProbe />
        <SimulatorWorkspace mode="free" sceneId="understanding-camera-movements" taskId={null} simulateAssetFailure={false} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useAppStore.getState().camera.activeSceneId).toBe("understanding-camera-movements");
    });

    fireEvent.change(screen.getByRole("slider", { name: "Viewpoint" }), {
      target: { value: "0.5" },
    });
    await waitFor(() => {
      expect(useAppStore.getState().camera.cameraMovementLessonState?.viewpointT).toBe(0.5);
    });

    const beforeLocale = {
      camera: {
        activeSceneId: useAppStore.getState().camera.activeSceneId,
        viewpointAnchor: useAppStore.getState().camera.viewpointAnchor,
        lessonState: useAppStore.getState().camera.cameraMovementLessonState,
      },
      targetRegion: useAppStore.getState().scene.targetRegion,
      route: screen.getByTestId("route-location").textContent,
    };

    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "zh-HK" },
    });

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("zh-HK");
      expect(screen.getByRole("combobox", { name: "語言" })).toHaveValue("zh-HK");
      expect(screen.getByTestId("current-settings-readout")).toHaveTextContent("目前設定");
      expect(screen.getByTestId("current-settings-readout")).toHaveTextContent("移動關係");
      expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-HK");
    });

    expect(screen.getByTestId("route-location")).toHaveTextContent(
      "/simulator/free/understanding-camera-movements",
    );
    expect({
      camera: {
        activeSceneId: useAppStore.getState().camera.activeSceneId,
        viewpointAnchor: useAppStore.getState().camera.viewpointAnchor,
        lessonState: useAppStore.getState().camera.cameraMovementLessonState,
      },
      targetRegion: useAppStore.getState().scene.targetRegion,
      route: screen.getByTestId("route-location").textContent,
    }).toEqual(beforeLocale);
  });

  it("updates public control and viewport labels, including accessible names, without reload", async () => {
    render(
      <MemoryRouter initialEntries={["/simulator/free/understanding-camera-movements"]}>
        <SimulatorWorkspace mode="free" sceneId="understanding-camera-movements" taskId={null} simulateAssetFailure={false} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("slider", { name: "Viewpoint" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Focus distance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3D Scene" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset 3D view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand 3D Scene" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Focus assist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View overlays" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "zh-HK" },
    });

    await waitFor(() => {
      expect(screen.getByRole("slider", { name: "視點" })).toBeInTheDocument();
      expect(screen.getByRole("slider", { name: "對焦距離" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "3D 場景" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "重設 3D 視圖" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "展開 3D 場景" })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "對焦輔助" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "檢視疊加層" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("slider", { name: "Viewpoint" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand 3D Scene" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "語言" }), {
      target: { value: "en" },
    });

    await waitFor(() => {
      expect(screen.getByRole("slider", { name: "Viewpoint" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Expand 3D Scene" })).toBeInTheDocument();
    });
  });

  it("localizes scene-specific Mirror Shift controls and teaching geometry", async () => {
    render(
      <MemoryRouter initialEntries={["/simulator/free/mirror-shift"]}>
        <SimulatorWorkspace mode="free" sceneId="mirror-shift" taskId={null} simulateAssetFailure={false} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("slider", { name: "Camera Position" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Front Shift" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open 2D Geometry" }));
    expect(screen.getByRole("img", { name: "Mirror Shift top-view teaching geometry" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "zh-HK" },
    });

    await waitFor(() => {
      expect(screen.getByRole("slider", { name: "相機位置" })).toBeInTheDocument();
      expect(screen.getByRole("slider", { name: "前組橫移" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "反射鏡橫移頂部檢視教學幾何圖" })).toBeInTheDocument();
      expect(screen.getByText("反射鏡光圈")).toBeInTheDocument();
    });

    expect(screen.queryByRole("slider", { name: "Camera Position" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Front Shift" })).not.toBeInTheDocument();
  });
});
