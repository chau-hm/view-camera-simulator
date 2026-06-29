import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

describe("home page", () => {
  it("renders guided and free mode entry links", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={memoryRouter} />);

    expect(await screen.findByTestId("guided-entry")).toBeInTheDocument();
    expect(await screen.findByTestId("free-entry")).toBeInTheDocument();
  });
});
