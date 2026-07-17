import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ScenesPage, SimulatorRoutePage } from "../../app/pages";

vi.mock("../../components/layout/SimulatorWorkspace", () => ({
  SimulatorWorkspace: ({
    mode,
    sceneId,
    taskId,
  }: {
    mode: string;
    sceneId: string;
    taskId: string | null;
  }) => (
    <div data-testid="simulator-workspace">
      {mode}:{sceneId}:{taskId ?? "none"}
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
    ["/simulator/free/focus-fundamentals-two-targets", "free:focus-fundamentals-two-targets:none"],
    ["/simulator/free/architecture-rise", "free:architecture-rise:none"],
    ["/simulator/free/shelf-swing", "free:shelf-swing:none"],
    ["/simulator/guided/architecture-rise/rise-01", "guided:architecture-rise:rise-01"],
    ["/simulator/guided/shelf-swing/swing-01", "guided:shelf-swing:swing-01"],
    ["/simulator/free/table-tilt", "free:table-tilt:none"],
    ["/simulator/guided/table-tilt/tilt-01", "guided:table-tilt:tilt-01"],
  ])("keeps available simulator route %s open", async (route, expectedWorkspace) => {
    renderRoute(route);

    expect(await screen.findByTestId("simulator-workspace")).toHaveTextContent(expectedWorkspace);
    expect(screen.getByTestId("route-location")).toHaveTextContent(route);
  });

  it.each([
    "/simulator/guided/shelf-swing",
    "/simulator/guided/shelf-swing/tilt-01",
    "/simulator/guided/shelf-swing/rise-01",
    "/simulator/guided/shelf-swing/not-a-task",
    "/simulator/free/shelf-swing/swing-01",
    "/simulator/guided/table-tilt/swing-01",
    "/simulator/free/table-tilt/tilt-01",
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
