import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

describe("mode redirect", () => {
  it("redirects /mode to /scenes", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/mode"] });
    render(<RouterProvider router={memoryRouter} />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Scenes");
  });
});
