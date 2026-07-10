import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

describe("simulator header", () => {
  it("renders shared brand and All Scenes and removes scene selector/subtitle", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/simulator/free/focus-fundamentals-two-targets"] });
    render(<RouterProvider router={memoryRouter} />);

    // Brand link present and links to /
    const brandLink = await screen.findByRole("link", { name: /View Camera Simulator home/i });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink.getAttribute("href")).toBe("/");

    // Subtitle should not be present in simulator header
    expect(screen.queryByText("Focus, perspective and camera movements")).toBeNull();

    // All Scenes link present and points to /scenes
    const allScenes = await screen.findByRole("link", { name: /All Scenes/i });
    expect(allScenes).toBeInTheDocument();
    expect(allScenes.getAttribute("href")).toBe("/scenes");

    // Scene selector should be removed (there may be other selects on the page; ensure there's no Scene combobox)
    expect(screen.queryByLabelText(/Scene/i)).toBeNull();
  });
});
