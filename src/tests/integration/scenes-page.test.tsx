import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import {
  getPublicSceneEntryById,
  getPublicScenes,
  publicSceneCatalog,
  publicSceneIds,
} from "../../app/publicScenes";
import { routes } from "../../app/router";

describe("scenes page", () => {
  it("shows the enabled public scene cards in catalog order", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/scenes"] });
    render(<RouterProvider router={memoryRouter} />);

    // Focus Fundamentals card
    expect(
      await screen.findByRole("heading", { name: "Focus Fundamentals — Two Targets", level: 2 }),
    ).toBeInTheDocument();
    const openButtons = await screen.findAllByText(/Open Scene/);
    expect(openButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Compare two targets at different distances/)).toBeInTheDocument();
    expect(screen.getByText("Focus")).toBeInTheDocument();
    expect(screen.getByText("Aperture")).toBeInTheDocument();
    expect(screen.getByText("Depth of field")).toBeInTheDocument();
    const focusHeading = await screen.findByRole("heading", {
      name: "Focus Fundamentals — Two Targets",
      level: 2,
    });
    const focusCard = focusHeading.closest("article");
    expect(focusCard).not.toBeNull();
    expect(within(focusCard!).queryByRole("link", { name: "Start Guided Task" })).not.toBeInTheDocument();

    // Architecture Rise card should be present with its description and topics
    expect(
      await screen.findByRole("heading", { name: "Architecture Rise", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Use front rise to include the top of a building/)).toBeInTheDocument();
    expect(screen.getByText("Rise")).toBeInTheDocument();
    expect(screen.getByText("Architecture")).toBeInTheDocument();
    expect(screen.getByText("Perspective control")).toBeInTheDocument();

    // Table Tilt follows Architecture Rise and uses the standard enabled SceneCard link.
    const tableHeading = await screen.findByRole("heading", { name: "Table Tilt", level: 2 });
    const tableCard = tableHeading.closest("article");
    expect(tableCard).not.toBeNull();
    const scopedTableCard = within(tableCard!);
    expect(
      scopedTableCard.getByText(
        "Use front tilt to align the plane of sharp focus with three coplanar focus cards above the tabletop.",
      ),
    ).toBeInTheDocument();
    expect(scopedTableCard.getByText("Tilt")).toBeInTheDocument();
    expect(scopedTableCard.getByText("Plane of focus")).toBeInTheDocument();
    expect(scopedTableCard.getByText("Scheimpflug principle")).toBeInTheDocument();
    expect(tableCard!.querySelector("img")).toHaveAttribute("src", "/assets/table-tilt.png");
    expect(scopedTableCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
      "href",
      "/simulator/free/table-tilt",
    );
    expect(scopedTableCard.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
      "href",
      "/simulator/guided/table-tilt/tilt-01",
    );

    const shelfHeading = await screen.findByRole("heading", { name: "Shelf Swing", level: 2 });
    const shelfCard = shelfHeading.closest("article");
    expect(shelfCard).not.toBeNull();
    const scopedShelfCard = within(shelfCard!);
    expect(
      scopedShelfCard.getByText(
        "Use front swing to rotate the plane of sharp focus through three subjects arranged diagonally from front-left to back-right.",
      ),
    ).toBeInTheDocument();
    expect(scopedShelfCard.getByText("Swing")).toBeInTheDocument();
    expect(scopedShelfCard.getByText("Plane of focus")).toBeInTheDocument();
    expect(scopedShelfCard.getByText("Scheimpflug principle")).toBeInTheDocument();
    expect(shelfCard!.querySelector("img")).toHaveAttribute("src", "/assets/shelf-swing.png");
    expect(scopedShelfCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
      "href",
      "/simulator/free/shelf-swing",
    );
    expect(scopedShelfCard.queryByText("In development")).toBeNull();
    expect(scopedShelfCard.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
      "href",
      "/simulator/guided/shelf-swing/swing-01",
    );

    expect(publicSceneIds).toEqual([
      "focus-fundamentals-two-targets",
      "architecture-rise",
      "table-tilt",
      "shelf-swing",
    ]);
    expect(publicSceneCatalog.map((entry) => entry.id)).toEqual(publicSceneIds);
    expect(getPublicSceneEntryById("focus-fundamentals-two-targets")?.availableModes).toEqual([
      "free",
    ]);
    expect(getPublicSceneEntryById("focus-fundamentals-two-targets")?.guidedTaskId).toBeUndefined();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "Focus Fundamentals — Two Targets",
      "Architecture Rise",
      "Table Tilt",
      "Shelf Swing",
    ]);
    expect(getPublicScenes().map((scene) => scene.id)).toContain("shelf-swing");
    expect(getPublicSceneEntryById("shelf-swing")?.availability).toBe("available");
    expect(getPublicSceneEntryById("shelf-swing")?.availableModes).toEqual([
      "free",
      "guided",
    ]);
    expect(getPublicSceneEntryById("shelf-swing")?.guidedTaskId).toBe("swing-01");
    expect(getPublicSceneEntryById("table-tilt")?.availability).toBe("available");
    expect(getPublicSceneEntryById("table-tilt")?.availableModes).toEqual([
      "free",
      "guided",
    ]);
    expect(getPublicSceneEntryById("unknown-scene")).toBeUndefined();
    expect(
      screen.queryByText("The guided Shelf Swing lesson is still being prepared."),
    ).not.toBeInTheDocument();
  });
});
