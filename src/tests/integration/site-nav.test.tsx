import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

describe("site navigation", () => {
  it("shows Home, Scenes and GitHub links in header", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={memoryRouter} />);

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Scenes")).toBeInTheDocument();
    const gh = screen.getAllByText("GitHub");
    expect(gh.length).toBeGreaterThanOrEqual(1);
  });
});
