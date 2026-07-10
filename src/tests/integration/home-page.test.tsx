import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

describe("home page", () => {
  it("renders hero heading and CTAs", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={memoryRouter} />);

    // landing should have exactly one H1 and it should be the hero heading
    const h1s = await screen.findAllByRole('heading', { level: 1 });
    expect(h1s.length).toBe(1);
    expect(h1s[0]).toHaveTextContent("See how a view camera changes the image before the shutter is pressed.");

    expect(await screen.findByText("Explore the Simulator")).toBeInTheDocument();
    expect(await screen.findByText("Open Focus Fundamentals")).toBeInTheDocument();

    // landing should have Understand focus first as an h2 in the CTA panel
    expect(await screen.findByRole('heading', { name: 'Understand focus first', level: 2 })).toBeInTheDocument();

    // preview card removed from the landing hero
    expect(screen.queryByText("Focus Fundamentals — Two Targets")).toBeNull();
    expect(screen.queryByText("Depth of field")).toBeNull();
  });
});
