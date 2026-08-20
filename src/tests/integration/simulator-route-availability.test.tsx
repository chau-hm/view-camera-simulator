import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ScenesPage, SimulatorRoutePage } from "../../app/pages";

vi.mock("../../components/layout/SimulatorWorkspace", () => ({
  SimulatorWorkspace: ({
    mode,
    sceneId,
    taskId,
    guidedLessonEnabled,
    calibrationEnabled,
  }: {
    mode: string;
    sceneId: string;
    taskId: string | null;
    guidedLessonEnabled?: boolean;
    calibrationEnabled?: boolean;
  }) => (
    <div data-testid="simulator-workspace">
      {mode}:{sceneId}:{taskId ?? "none"}:lesson={String(Boolean(guidedLessonEnabled))}:calibration={String(Boolean(calibrationEnabled))}
    </div>
  ),
}));

afterEach(cleanup);

const LocationProbe = () => <div data-testid="route-location">{useLocation().pathname}</div>;

const renderRoute = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/scenes" element={<ScenesPage />} />
        <Route path="/simulator/:mode/:sceneId" element={<SimulatorRoutePage />} />
        <Route path="/simulator/:mode/:sceneId/:taskId" element={<SimulatorRoutePage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("simulator route availability", () => {
  it.each([
    ["/simulator/free/focus-fundamentals-two-targets", "free:focus-fundamentals-two-targets:none:lesson=false"],
    ["/simulator/free/architecture-rise", "free:architecture-rise:none:lesson=false"],
    ["/simulator/free/architecture-foreground", "free:architecture-foreground:none:lesson=false"],
    ["/simulator/free/oblique-architecture", "free:oblique-architecture:none:lesson=false"],
    ["/simulator/free/shelf-swing", "free:shelf-swing:none:lesson=false"],
    ["/simulator/free/mirror-shift", "free:mirror-shift:none:lesson=false"],
    ["/simulator/guided/architecture-rise/rise-01", "guided:architecture-rise:rise-01:lesson=false"],
    [
      "/simulator/guided/architecture-foreground/architecture-foreground-rise-01",
      "guided:architecture-foreground:architecture-foreground-rise-01:lesson=false",
    ],
    ["/simulator/guided/shelf-swing/swing-01", "guided:shelf-swing:swing-01:lesson=false"],
    ["/simulator/free/table-tilt", "free:table-tilt:none:lesson=false"],
    ["/simulator/guided/table-tilt/tilt-01", "guided:table-tilt:tilt-01:lesson=false"],
  ])("keeps available simulator route %s open", async (route, expectedWorkspace) => {
    renderRoute(route);

    expect(await screen.findByTestId("simulator-workspace")).toHaveTextContent(expectedWorkspace);
    expect(screen.getByTestId("route-location")).toHaveTextContent(route);
  });

  it("marks only the Oblique Architecture lesson query for lesson UI", async () => {
    renderRoute("/simulator/free/oblique-architecture?lesson=1");

    expect(await screen.findByTestId("simulator-workspace")).toHaveTextContent(
      "free:oblique-architecture:none:lesson=true",
    );
  });

  it.each([
    ["/simulator/free/understanding-camera-movements?cameraCalibration=1", true],
    ["/simulator/free/understanding-camera-movements", false],
    ["/simulator/guided/architecture-rise/rise-01?cameraCalibration=1", false],
    ["/simulator/free/architecture-rise?cameraCalibration=1", false],
  ])("gates calibration workbench flag for %s", async (route, enabled) => {
    renderRoute(route);
    const workspace = await screen.findByTestId("simulator-workspace");
    expect(workspace).toHaveTextContent(`calibration=${String(enabled)}`);
  });

  it.each([
    "/simulator/guided/shelf-swing",
    "/simulator/guided/shelf-swing/tilt-01",
    "/simulator/guided/shelf-swing/rise-01",
    "/simulator/guided/shelf-swing/not-a-task",
    "/simulator/free/shelf-swing/swing-01",
    "/simulator/guided/table-tilt/swing-01",
    "/simulator/free/table-tilt/tilt-01",
    "/simulator/guided/focus-fundamentals-two-targets",
    "/simulator/guided/focus-fundamentals-two-targets/rise-01",
    "/simulator/guided/oblique-architecture",
    "/simulator/guided/oblique-architecture/rise-01",
    "/simulator/guided/architecture-foreground",
    "/simulator/guided/architecture-foreground/architecture-foreground-tilt-focus-01",
  ])("redirects invalid simulator route %s to Scenes", async (route) => {
    renderRoute(route);

    await waitFor(() =>
      expect(screen.getByTestId("route-location")).toHaveTextContent("/scenes"),
    );
    expect(screen.queryByTestId("simulator-workspace")).not.toBeInTheDocument();
  });

  it("redirects unknown registered-state requests to Scenes", async () => {
    renderRoute("/simulator/free/not-a-scene");

    await waitFor(() => expect(screen.getByTestId("route-location")).toHaveTextContent("/scenes"));
    expect(screen.queryByTestId("simulator-workspace")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Scenes", level: 1 })).toBeInTheDocument();
  });
});
