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

    // App brand should render the new svg/png icon and still link to /
    const brandLink = document.querySelector('.app-brand__link') as HTMLAnchorElement;
    expect(brandLink).toBeTruthy();
    expect(brandLink.getAttribute('href')).toBe('/');
    const brandImg = document.querySelector('.app-brand__icon') as HTMLImageElement | null;
    expect(brandImg).toBeTruthy();
    expect(brandImg?.getAttribute('src')).toContain('view-camera-app-icon');
    // ensure old material-symbol text is no longer inside the brand link
    expect(brandLink.querySelector('.material-symbols-outlined')).toBeNull();
  });
});
