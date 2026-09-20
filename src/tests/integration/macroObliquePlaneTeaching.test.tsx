import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { i18n } from "../../i18n";
import { useAppStore } from "../../state/appStore";

afterEach(async () => {
  cleanup();
  useAppStore.getState().resetCamera();
  useAppStore.getState().clearSimulatorRouteInitialization();
  await i18n.changeLanguage("en");
});

const renderScene = () =>
  render(
    <MemoryRouter>
      <SimulatorWorkspace
        mode="free"
        sceneId="macro-oblique-plane"
        taskId={null}
        simulateAssetFailure={false}
      />
    </MemoryRouter>,
  );

describe("Macro Scene 3 teaching", () => {
  it("keeps the physical exploration dynamic as focus and tilt change", async () => {
    renderScene();

    fireEvent.click(await screen.findByRole("button", { name: "Open Task and Feedback" }));
    const taskView = screen.getByTestId("learning-overlay-task-view");
    const teaching = screen.getByTestId("macro-oblique-teaching");
    const focus = screen.getByRole("slider", { name: "Focus distance" });
    const tilt = screen.getByRole("slider", { name: "Front Tilt" });

    expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");
    expect(teaching).toHaveAttribute("data-sharp-count", "1");
    expect(teaching).toHaveAttribute("data-strongest-region", "middle");
    expect(taskView).toHaveTextContent(/refocusing moves the sharp region/i);
    expect(taskView).toHaveTextContent(/cannot make this oblique plane all Sharp/i);

    fireEvent.change(focus, { target: { value: "380" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-strongest-region", "near"));
    expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");

    fireEvent.change(focus, { target: { value: "420" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-strongest-region", "far"));
    expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");

    fireEvent.change(tilt, { target: { value: "2" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "tilt-and-focus"));
    expect(taskView).toHaveTextContent(/orientation of the sharp-focus plane/i);
    expect(taskView).toHaveTextContent(/positions that rotated plane/i);

    fireEvent.change(tilt, { target: { value: "6.2" } });
    fireEvent.change(focus, { target: { value: "390" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "refine-alignment"));
    expect(teaching).toHaveAttribute("data-sharp-count", "2");
    expect(taskView).toHaveTextContent(/Two PCB regions are Sharp/i);

    fireEvent.change(tilt, { target: { value: "6.3" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "aligned"));
    expect(teaching).toHaveAttribute("data-sharp-count", "3");
    expect(teaching).toHaveAttribute("data-all-sharp", "true");
    expect(taskView).toHaveTextContent(/Near, Middle, and Far are all Sharp/i);
    expect(taskView).toHaveTextContent(/without increasing depth of field/i);

    fireEvent.change(tilt, { target: { value: "0" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "parallel-exploration"));
  });

  it("renders the Scene 3 teaching copy in zh-HK", async () => {
    await i18n.changeLanguage("zh-HK");
    renderScene();

    fireEvent.click(await screen.findByRole("button", { name: "開啟任務及回饋" }));
    const taskView = screen.getByTestId("learning-overlay-task-view");
    expect(taskView).toHaveTextContent("目標");
    expect(taskView).toHaveTextContent("傾斜平面對齊");
    expect(taskView).toHaveTextContent("重新對焦會移動清晰區域");

    const tilt = screen.getByRole("slider", { name: "前組傾斜" });
    const focus = screen.getByRole("slider", { name: "對焦距離" });
    fireEvent.change(tilt, { target: { value: "6.3" } });
    fireEvent.change(focus, { target: { value: "390" } });
    await waitFor(() => expect(screen.getByTestId("macro-oblique-teaching")).toHaveAttribute("data-stage", "aligned"));
    expect(taskView).toHaveTextContent("全部清晰");
    expect(taskView).toHaveTextContent("不是增加景深");
  });
});
