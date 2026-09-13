import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("../../config/scenePublication", async () => {
  const actual = await vi.importActual<typeof import("../../config/scenePublication")>(
    "../../config/scenePublication",
  );

  return {
    ...actual,
    scenePublication: {
      ...actual.scenePublication,
      "shelf-swing": false,
    },
  };
});

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

import { ScenesPage, SimulatorRoutePage } from "../../app/pages";
import { publicSceneCatalog, publicSceneGroups, getPublicSceneEntryById } from "../../app/publicScenes";
import { isScenePublished, scenePublication } from "../../config/scenePublication";
import { getSceneById } from "../../scenes/definitions";
import { i18n } from "../../i18n";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

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

const expectedPublishedGroups = publicSceneGroups.flatMap((group) => {
  const entries = publicSceneCatalog.filter(
    (entry) =>
      entry.groupId === group.id &&
      isScenePublished(entry.id, scenePublication),
  );
  return entries.length > 0 ? [{ group, entries }] : [];
});

describe("scene publication gate", () => {
  it("hides an unpublished scene while preserving the remaining grouped catalog order", async () => {
    renderRoute("/scenes");

    expect(
      (await screen.findAllByRole("heading", { level: 2 })).map((heading) => heading.textContent),
    ).toEqual(expectedPublishedGroups.map(({ group }) => i18n.t(group.titleKey)));
    expect(
      (await screen.findAllByRole("heading", { level: 3 })).map((heading) => heading.textContent),
    ).toEqual(
      expectedPublishedGroups.flatMap(({ entries }) =>
        entries.map(({ titleKey }) => i18n.t(titleKey)),
      ),
    );
    expect(screen.queryByRole("heading", { name: "Shelf Swing", level: 3 })).toBeNull();
  });

  it.each([
    "/simulator/free/shelf-swing",
    "/simulator/free/shelf-swing?lesson=1",
    "/simulator/guided/shelf-swing/swing-01",
    "/simulator/guided/shelf-swing/swing-01?lesson=1",
  ])("redirects unpublished route %s to Scenes", async (route) => {
    renderRoute(route);

    await waitFor(() => expect(screen.getByTestId("route-location")).toHaveTextContent("/scenes"));
    expect(screen.queryByTestId("simulator-workspace")).not.toBeInTheDocument();
  });

  it("keeps an unpublished scene available through the internal registry only", () => {
    expect(getSceneById("shelf-swing")).toBeDefined();
    expect(getPublicSceneEntryById("shelf-swing")).toBeUndefined();
  });
});
