import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

describe("scenes page", () => {
  it("shows public scenes including Focus Fundamentals and Architecture Rise", async () => {
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

    // Legacy non-public scenes should not be present
    expect(screen.queryByText("Table Tilt")).toBeNull();
    expect(screen.queryByText("Shelf Swing")).toBeNull();
  });
});
