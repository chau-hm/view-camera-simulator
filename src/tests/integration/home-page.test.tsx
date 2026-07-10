import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

describe("home page", () => {
  it("renders hero heading and CTAs", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={memoryRouter} />);

    expect(await screen.findByText("See how a view camera changes the image before the shutter is pressed.")).toBeInTheDocument();

    expect(await screen.findByText("Explore the Simulator")).toBeInTheDocument();
    expect(await screen.findByText("Open Focus Fundamentals")).toBeInTheDocument();
  });
});
