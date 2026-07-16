import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

  it("keeps the unfinished Shelf Swing guided route blocked", async () => {
    renderRoute("/simulator/guided/shelf-swing/swing-01");

    await waitFor(() => expect(screen.getByTestId("route-location")).toHaveTextContent("/scenes"));
    expect(await screen.findByRole("heading", { name: "Scenes", level: 1 })).toBeInTheDocument();
    const shelfCard = screen
      .getByRole("heading", { name: "Shelf Swing", level: 2 })
      .closest("article");
    expect(shelfCard).not.toBeNull();
    expect(within(shelfCard!).getByRole("link", { name: "Open Scene" })).toBeInTheDocument();
    expect(
      within(shelfCard!).queryByRole("link", { name: "Start Guided Task" }),
    ).not.toBeInTheDocument();
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
