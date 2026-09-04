import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

describe("home page", () => {
  it("renders the approved Hero heading and catalog CTA", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={memoryRouter} />);

    // landing should have exactly one H1 and it should be the hero heading
    const h1s = await screen.findAllByRole('heading', { level: 1 });
    expect(h1s.length).toBe(1);
    expect(h1s[0]).toHaveTextContent("Shape Perspective. Place Focus.");

    // The Hero has one catalog CTA.
    const explore = await screen.findByText("Start Exploring");
    expect(explore).toBeInTheDocument();
    expect(explore.closest('a')).toHaveAttribute('href', '/scenes');

    // approved hero artwork wrapper present (decorative, aria-hidden)
    const heroWrap = document.querySelector('.landing-hero__artwork');
    expect(heroWrap).toBeTruthy();

    // hero artwork should render the supplied production asset
    const heroImg = document.querySelector('.landing-hero__artwork img') as HTMLImageElement | null;
    expect(heroImg).toBeTruthy();
    const heroSrc = heroImg?.getAttribute('src') ?? '';
    expect(heroSrc).toContain('assets/landing/hero.png');

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
      'What can a view camera control before exposure?',
      'Why do camera movements matter?',
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
    expect(screen.getByText(/A view camera separates decisions that are often bundled together: where the camera observes from, how the subject is framed, how the image geometry is controlled, and where the plane of sharp focus lies\./)).toBeTruthy();
    expect(screen.getByText(/Rise and shift can change framing without moving the viewpoint\. Tilt and swing can rotate the plane of sharp focus\./)).toBeTruthy();
    expect(screen.getByText(/A view camera slows the process down. The upside-down image on the ground glass encourages careful looking, and every movement becomes a deliberate choice\./)).toBeTruthy();
    expect(screen.queryByTestId("faq-section")).not.toBeInTheDocument();
    expect(screen.queryByText("Who is View Camera Simulator for?")).not.toBeInTheDocument();
  });
});
