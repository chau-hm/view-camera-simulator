import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { publicSceneCatalog, publicSceneIds } from "../../app/publicScenes";
import { routes } from "../../app/router";

describe("scenes page", () => {
  it("shows the enabled public scene cards in catalog order", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/scenes"] });
    render(<RouterProvider router={memoryRouter} />);

    // Focus Fundamentals card
    expect(await screen.findByRole('heading', { name: 'Focus Fundamentals — Two Targets', level: 2 })).toBeInTheDocument();
    const openButtons = await screen.findAllByText(/Open Scene/);
    expect(openButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Compare two targets at different distances/)).toBeInTheDocument();
    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByText('Aperture')).toBeInTheDocument();
    expect(screen.getByText('Depth of field')).toBeInTheDocument();

    // Architecture Rise card should be present with its description and topics
    expect(await screen.findByRole('heading', { name: 'Architecture Rise', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Use front rise to include the top of a building/)).toBeInTheDocument();
    expect(screen.getByText('Rise')).toBeInTheDocument();
    expect(screen.getByText('Architecture')).toBeInTheDocument();
    expect(screen.getByText('Perspective control')).toBeInTheDocument();

    // Table Tilt follows Architecture Rise and uses the standard enabled SceneCard link.
    const tableHeading = await screen.findByRole("heading", { name: "Table Tilt", level: 2 });
    const tableCard = tableHeading.closest("article");
    expect(tableCard).not.toBeNull();
    const scopedTableCard = within(tableCard!);
    expect(
      scopedTableCard.getByText(
        "Use front tilt to align the plane of focus with a tabletop extending from near to far.",
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

    expect(publicSceneIds).toEqual([
      "focus-fundamentals-two-targets",
      "architecture-rise",
      "table-tilt",
    ]);
    expect(publicSceneCatalog.map((entry) => entry.id)).toEqual(publicSceneIds);
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Focus Fundamentals — Two Targets",
      "Architecture Rise",
      "Table Tilt",
    ]);

    // Shelf Swing remains non-public.
    expect(screen.queryByText("Shelf Swing")).toBeNull();
  });
});
