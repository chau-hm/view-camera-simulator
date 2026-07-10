import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

describe("mode redirect", () => {
  it("redirects /mode to /scenes", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/mode"] });
    render(<RouterProvider router={memoryRouter} />);

    // ensure the router actually redirected the path first (window.location is updated by the redirect)
    expect(window.location.pathname).toBe("/scenes");

    // ensure a Scenes H1 is present (may render through the redirect)
    const h1s = await screen.findAllByRole("heading", { level: 1 });
    expect(h1s.some((el) => el.textContent && el.textContent.includes("Scenes"))).toBe(true);
  });
});
