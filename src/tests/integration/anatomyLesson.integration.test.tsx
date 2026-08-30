import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "../../i18n";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { useAppStore } from "../../state/appStore";

beforeEach(async () => {
  await i18n.changeLanguage("en");
  useAppStore.getState().resetCamera();
});

afterEach(() => {
  cleanup();
  useAppStore.getState().resetCamera();
});

const renderAnatomyLesson = () =>
  render(
    <MemoryRouter initialEntries={["/simulator/free/view-camera-anatomy?lesson=1"]}>
      <SimulatorWorkspace
        mode="free"
        sceneId="view-camera-anatomy"
        taskId={null}
        anatomyLessonEnabled
        simulateAssetFailure={false}
      />
    </MemoryRouter>,
  );

describe("Lesson 0 integration", () => {
  it("progresses through anatomy without exposing movement controls", async () => {
    renderAnatomyLesson();

    expect(await screen.findByRole("heading", { name: "The complete camera" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Camera Controls" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Front Standard" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Aperture" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show a smaller opening" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show a smaller opening" }));
    expect(screen.getByRole("button", { name: "Show a wider opening" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(useAppStore.getState().camera.aperture).toBe(11);

    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByRole("heading", { name: "Ground Glass", level: 3 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Film Holder", level: 3 })).toBeInTheDocument();
    expect(useAppStore.getState().camera.aperture).toBe(11);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Recap", level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("resets the lesson and restores normal presentation on scene exit", async () => {
    const view = renderAnatomyLesson();
    await screen.findByRole("heading", { name: "The complete camera" });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Aperture" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show a smaller opening" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart lesson" }));

    expect(screen.getByRole("heading", { name: "The complete camera" })).toBeInTheDocument();
    expect(useAppStore.getState().camera).toMatchObject({
      activeSceneId: "view-camera-anatomy",
      frontRiseMm: 0,
      frontShiftMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearShiftMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
      aperture: 11,
    });

    view.rerender(
      <MemoryRouter initialEntries={["/simulator/free/architecture-rise"]}>
        <SimulatorWorkspace
          mode="free"
          sceneId="architecture-rise"
          taskId={null}
          simulateAssetFailure={false}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(useAppStore.getState().camera.activeSceneId).toBe("architecture-rise"));
    expect(screen.queryByRole("heading", { name: "The complete camera" })).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Rise" })).toBeInTheDocument();
  });
});
