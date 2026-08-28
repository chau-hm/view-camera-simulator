import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

afterEach(cleanup);

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
  });

  it("renders the seven FAQ disclosures in the supplied order", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={memoryRouter} />);

    expect(screen.getByRole("heading", { name: "Frequently Asked Questions", level: 2 })).toBeInTheDocument();

    const faq = screen.getByTestId("landing-faq");
    const details = Array.from(faq.querySelectorAll("details"));
    const summaries = Array.from(faq.querySelectorAll("summary"));
    const questions = [
      "Who is View Camera Simulator for?",
      "Do I need to own a large-format camera?",
      "What can I learn with View Camera Simulator?",
      "Is the simulator based on a specific type of view camera, camera, or lens?",
      "Will every movement shown be available on my camera?",
      "How realistic is the simulator?",
      "Is it a replacement for learning with a real view camera?",
    ];

    expect(details).toHaveLength(7);
    expect(summaries.map((summary) => summary.textContent)).toEqual(questions);
    expect(details.every((detail) => !detail.open)).toBe(true);

    const firstSummary = summaries[0];
    const firstDetails = details[0];
    firstSummary.focus();
    expect(document.activeElement).toBe(firstSummary);
    fireEvent.click(firstSummary);
    expect(firstDetails.open).toBe(true);
    fireEvent.click(firstSummary);
    expect(firstDetails.open).toBe(false);

    expect(screen.getByText(/View Camera Simulator is for anyone who wants to understand camera movements and photographic geometry more clearly\./)).toBeInTheDocument();
    expect(screen.getByText(/The simulator allows you to explore camera geometry and movement concepts separately from these practical considerations\./)).toBeInTheDocument();
  });
});
