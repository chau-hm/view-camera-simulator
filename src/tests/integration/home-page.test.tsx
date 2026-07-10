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

    // primary CTAs
    const explore = await screen.findByText("Explore the Simulator");
    expect(explore).toBeInTheDocument();
    expect(explore.closest('a')).toHaveAttribute('href', '/scenes');

    const learnWhy = await screen.findByText("Learn Why");
    expect(learnWhy).toBeInTheDocument();
    // Learn Why should link to #why anchor
    expect(learnWhy.closest('a')).toHaveAttribute('href', '#why');

    // Focus CTA button present and links to simulator route
    const openFocus = await screen.findByText("Open Focus Fundamentals");
    expect(openFocus).toBeInTheDocument();
    expect(openFocus.closest('a')).toHaveAttribute('href', '/simulator/free/focus-fundamentals-two-targets');

    // landing should have Understand focus first as an h2 in the CTA panel
    expect(await screen.findByRole('heading', { name: 'Understand focus first', level: 2 })).toBeInTheDocument();

    // hero illustration wrapper present (decorative, aria-hidden)
    const heroWrap = document.querySelector('.hero__illustration');
    expect(heroWrap).toBeTruthy();

    // hero illustration should render the supplied image asset
    const heroImg = document.querySelector('.hero__illustration img') as HTMLImageElement | null;
    expect(heroImg).toBeTruthy();
    const heroSrc = heroImg?.getAttribute('src') ?? '';
    expect(heroSrc).toContain('view-camera-hero-illustration.png');

    // Ensure BASE_URL is respected and no hard-coded root-relative '/assets/' is used unless BASE_URL is '/'
    const base = import.meta.env.BASE_URL ?? '/';
    if (base === '/') {
      expect(heroSrc.startsWith('/assets/')).toBe(true);
    } else {
      expect(heroSrc.startsWith('/assets/')).toBe(false);
      expect(heroSrc.startsWith(base)).toBe(true);
    }

    // info cards: headings should be h2 and present exactly once each
    const cardHeadings = [
      'Why use a view camera when Photoshop can correct perspective?',
      'When is the camera simpler than post-processing?',
      'Why do artists still use view cameras?'
    ];

    for (const h of cardHeadings) {
      const el = await screen.findByRole('heading', { name: h, level: 2 });
      expect(el).toBeInTheDocument();
    }

    // ensure short previous headings are not present
    expect(screen.queryByText('Why use a view camera?')).toBeNull();
    expect(screen.queryByText('When is the camera simpler?')).toBeNull();
    expect(screen.queryByText('Why artists still use it')).toBeNull();

    // verify full paragraphs are present
    expect(screen.getByText(/Photoshop can reshape an image after it has been captured, but it cannot replace every decision made at the camera\./)).toBeTruthy();
    expect(screen.getByText(/For architecture, interiors, still life and product photography, a carefully applied rise, tilt or swing can solve perspective and focus in one exposure\./)).toBeTruthy();
    expect(screen.getByText(/A view camera slows the process down. The upside-down image on the ground glass encourages careful looking, and every movement becomes a deliberate choice\./)).toBeTruthy();
  });
});
