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
        sceneId="macro-compound-movements"
        taskId={null}
        simulateAssetFailure={false}
      />
    </MemoryRouter>,
  );

describe("Macro Scene 4 teaching", () => {
  it("keeps the teaching stages driven by the three physical regions", async () => {
    renderScene();

    fireEvent.click(await screen.findByRole("button", { name: "Open Task and Feedback" }));
    const taskView = screen.getByTestId("learning-overlay-task-view");
    const teaching = screen.getByTestId("macro-compound-teaching");
    const focus = screen.getByRole("slider", { name: "Focus distance" });
    const tilt = screen.getByRole("slider", { name: "Tilt" });
    const swing = screen.getByRole("slider", { name: "Swing" });

    expect(focus).toHaveValue("500");
    expect(tilt).toHaveValue("0");
    expect(swing).toHaveValue("0");
    expect(teaching).toHaveAttribute("data-stage", "focus-exploration");
    expect(teaching).toHaveAttribute("data-strongest-region", "centre");
    expect(taskView).toHaveTextContent(/both movements neutral/i);
    expect(taskView).not.toHaveTextContent("+3.4°");
    expect(taskView).not.toHaveTextContent("-2.8°");
    expect(taskView).not.toHaveTextContent("490 mm");

    fireEvent.change(tilt, { target: { value: "2" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "tilt-only"));
    expect(taskView).toHaveTextContent(/one orientation component/i);
    expect(taskView).toHaveTextContent(/second orientation component/i);

    fireEvent.change(tilt, { target: { value: "0" } });
    fireEvent.change(swing, { target: { value: "-2" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "swing-only"));
    expect(taskView).toHaveTextContent(/lateral orientation component/i);

    fireEvent.change(tilt, { target: { value: "2" } });
    fireEvent.change(focus, { target: { value: "490" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "compound-alignment"));
    expect(teaching).toHaveAttribute("data-tilt-neutral", "false");
    expect(teaching).toHaveAttribute("data-swing-neutral", "false");
    expect(taskView).toHaveTextContent(/two orientation components/i);

    fireEvent.change(tilt, { target: { value: "3.3" } });
    fireEvent.change(swing, { target: { value: "-2.7" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "refine-compound"));
    expect(teaching).toHaveAttribute("data-sharp-count", "2");
    expect(taskView).toHaveTextContent(/public 0.1° Tilt and Swing steps/i);

    fireEvent.change(tilt, { target: { value: "3.4" } });
    fireEvent.change(swing, { target: { value: "-2.8" } });
    await waitFor(() => expect(teaching).toHaveAttribute("data-stage", "aligned"));
    expect(teaching).toHaveAttribute("data-sharp-count", "3");
    expect(teaching).toHaveAttribute("data-all-sharp", "true");
    expect(taskView).toHaveTextContent(/all three critical faces/i);
    expect(taskView).toHaveTextContent(/without relying on extra depth of field/i);

    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    const feedback = screen.getByTestId("macro-compound-feedback");
    expect(feedback).toHaveAttribute("data-stage", "aligned");
    expect(feedback).toHaveTextContent(/all Sharp/i);
    expect(screen.getAllByTestId("macro-compound-feedback")).toHaveLength(1);

    fireEvent.change(tilt, { target: { value: "3.9" } });
    await waitFor(() => expect(feedback).toHaveAttribute("data-all-sharp", "false"));
    expect(feedback).not.toHaveAttribute("data-stage", "aligned");

    fireEvent.click(screen.getByRole("button", { name: "Reset movements" }));
    await waitFor(() => expect(tilt).toHaveValue("0"));
    expect(swing).toHaveValue("0");
    expect(focus).toHaveValue("500");
    await waitFor(() => expect(feedback).toHaveAttribute("data-stage", "focus-exploration"));
  });

  it("renders the compound teaching copy in zh-HK", async () => {
    await i18n.changeLanguage("zh-HK");
    renderScene();

    fireEvent.click(await screen.findByRole("button", { name: "開啟任務及回饋" }));
    const taskView = screen.getByTestId("learning-overlay-task-view");
    expect(taskView).toHaveTextContent("複合平面對齊練習");
    expect(taskView).toHaveTextContent("前組傾斜及前組擺動");
    expect(taskView).toHaveTextContent("兩個移動均保持中立");

    const tilt = screen.getByRole("slider", { name: "傾斜" });
    const swing = screen.getByRole("slider", { name: "擺動" });
    const focus = screen.getByRole("slider", { name: "對焦距離" });
    fireEvent.change(tilt, { target: { value: "3.4" } });
    fireEvent.change(swing, { target: { value: "-2.8" } });
    fireEvent.change(focus, { target: { value: "490" } });
    await waitFor(() => expect(screen.getByTestId("macro-compound-teaching")).toHaveAttribute("data-stage", "aligned"));
    expect(taskView).toHaveTextContent("全部清晰");
    expect(taskView).toHaveTextContent("複合平面");
  });
});
