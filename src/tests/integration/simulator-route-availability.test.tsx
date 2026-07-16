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
  it("opens Shelf Swing in free mode", async () => {
    renderRoute("/simulator/free/shelf-swing");

    expect(await screen.findByTestId("simulator-workspace")).toHaveTextContent(
      "free:shelf-swing:none",
    );
    expect(screen.getByTestId("route-location")).toHaveTextContent(
      "/simulator/free/shelf-swing",
    );
  });

  it("opens the rebuilt Shelf Swing guided route", async () => {
    renderRoute("/simulator/guided/shelf-swing/swing-01");

    expect(await screen.findByTestId("simulator-workspace")).toHaveTextContent(
      "guided:shelf-swing:swing-01",
    );
    expect(screen.getByTestId("route-location")).toHaveTextContent(
      "/simulator/guided/shelf-swing/swing-01",
    );
  });

  it.each([
    ["/simulator/free/table-tilt", "free:table-tilt:none"],
    ["/simulator/guided/table-tilt/tilt-01", "guided:table-tilt:tilt-01"],
  ])("keeps available simulator route %s open", async (route, expectedWorkspace) => {
    renderRoute(route);

    expect(await screen.findByTestId("simulator-workspace")).toHaveTextContent(expectedWorkspace);
    expect(screen.getByTestId("route-location")).toHaveTextContent(route);
  });

  it("redirects unknown registered-state requests to Scenes", async () => {
    renderRoute("/simulator/free/not-a-scene");

    await waitFor(() => expect(screen.getByTestId("route-location")).toHaveTextContent("/scenes"));
    expect(await screen.findByRole("heading", { name: "Scenes", level: 1 })).toBeInTheDocument();
  });
});
