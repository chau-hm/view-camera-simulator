import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

describe("scenes page", () => {
  it("shows public Two Targets scene and hides legacy scenes", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/scenes"] });
    render(<RouterProvider router={memoryRouter} />);

    expect(await screen.findByRole('heading', { name: 'Focus Fundamentals — Two Targets', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Open Scene/)).toBeInTheDocument();

    // verify description and topics are rendered from the public catalog
    expect(screen.getByText(/Compare two targets at different distances/)).toBeInTheDocument();
    // topics are rendered as individual pills
    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByText('Aperture')).toBeInTheDocument();
    expect(screen.getByText('Depth of field')).toBeInTheDocument();
    // badge
    expect(screen.getByText(/Recommended/)).toBeInTheDocument();

    // Legacy scenes should not be present in public listing
    expect(screen.queryByText("Architecture Rise")).toBeNull();
    expect(screen.queryByText("Table Tilt")).toBeNull();
    expect(screen.queryByText("Shelf Swing")).toBeNull();
  });
});
