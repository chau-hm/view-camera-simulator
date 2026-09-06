import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

afterEach(cleanup);

describe("home page", () => {
  it("renders the approved Hero heading and catalog CTA", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={memoryRouter} />);

    // landing should have exactly one H1 and it should be the hero heading
    const h1s = await screen.findAllByRole('heading', { level: 1 });
    expect(h1s.length).toBe(1);
    expect(h1s[0]).toHaveTextContent("Shape Perspective. Place Focus.");

    // The Hero has one catalog CTA.
    const explore = await screen.findByTestId("landing-hero-cta");
    expect(explore).toHaveTextContent("Start Exploring");
    expect(explore).toHaveAttribute("href", "/scenes");

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

    expect(screen.queryByTestId("faq-section")).not.toBeInTheDocument();
    expect(screen.queryByText("Who is View Camera Simulator for?")).not.toBeInTheDocument();
  });

  it("exposes responsive Hero image candidates with a PNG fallback", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={memoryRouter} />);

    const artwork = document.querySelector(".landing-hero__artwork");
    expect(artwork).toBeTruthy();
    const source = artwork?.querySelector('source[type="image/webp"]');
    expect(source).toBeTruthy();

    const candidates = (source?.getAttribute("srcset") ?? "")
      .split(",")
      .map((candidate) => candidate.trim());
    expect(candidates).toHaveLength(3);
    expect(candidates.join(" ")).toMatch(/hero-640\.webp 640w/);
    expect(candidates.join(" ")).toMatch(/hero-1024\.webp 1024w/);
    expect(candidates.join(" ")).toMatch(/hero-1672\.webp 1672w/);
    expect(source).toHaveAttribute("sizes", "100vw");

    const fallback = document.querySelector(".landing-hero__artwork img");
    expect(fallback).toHaveAttribute("src", expect.stringContaining("assets/landing/hero.png"));
    expect(fallback).toHaveAttribute("srcset", expect.stringContaining("hero.png 1672w"));
    expect(fallback).toHaveAttribute("decoding", "async");
    expect(fallback).toHaveAttribute("fetchpriority", "high");
  });

  it("renders the static Fundamentals and Three Ways conceptual learning sections", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={memoryRouter} />);

    const fundamentals = await screen.findByTestId("landing-fundamentals-section");
    const visualization = await screen.findByTestId("landing-visualization-section");
    const why = await screen.findByTestId("landing-why-section");
    const finalCta = await screen.findByTestId("landing-final-cta-section");

    expect(screen.getByRole("heading", { name: "Learn the Fundamentals", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Three Ways to Visualize", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("WHY IT MATTERS")).toBeInTheDocument();
    expect(why.querySelectorAll(".landing-why-section__title-line")).toHaveLength(2);
    expect(within(why).getByRole("heading", { level: 2 })).toHaveTextContent("More control before the shot.");
    expect(within(why).getByRole("heading", { level: 2 })).toHaveTextContent("A deeper way to see.");
    expect(fundamentals.querySelectorAll(".landing-concept-card")).toHaveLength(4);
    expect(visualization.querySelectorAll(".landing-concept-card")).toHaveLength(3);
    expect(why.querySelectorAll(".landing-why-card")).toHaveLength(3);
    expect(within(finalCta).getByRole("heading", { name: "Step into the simulator.", level: 2 })).toBeInTheDocument();
    expect(
      within(finalCta).getByText("Put these ideas into practice through guided large-format camera scenes."),
    ).toBeInTheDocument();
    expect(within(finalCta).getByRole("link", { name: "Start Exploring" })).toHaveAttribute("href", "/scenes");
    expect(finalCta.querySelectorAll("a")).toHaveLength(1);
    expect(finalCta.querySelector("img")).toHaveAttribute("src", expect.stringContaining("assets/landing/final-cta.webp"));

    const assetPaths = [
      "fundamentals-perspective-control.webp",
      "fundamentals-focus-plane.webp",
      "fundamentals-ground-glass.webp",
      "fundamentals-optical-geometry.webp",
      "visualize-3d-scene.webp",
      "visualize-ground-glass.webp",
      "visualize-geometry.webp",
    ];
    const referencedAssets = Array.from(document.querySelectorAll(".landing-concept-card img"));
    expect(referencedAssets).toHaveLength(7);
    for (const assetPath of assetPaths) {
      expect(referencedAssets.some((image) => image.getAttribute("src")?.includes(assetPath))).toBe(true);
    }

    const whyAssetPaths = [
      "why-control-before-shot.webp",
      "why-camera-movements.webp",
      "why-large-format-learning.webp",
    ];
    const whyImages = Array.from(why.querySelectorAll(".landing-why-card img"));
    expect(whyImages).toHaveLength(3);
    for (const assetPath of whyAssetPaths) {
      expect(whyImages.some((image) => image.getAttribute("src")?.includes(assetPath))).toBe(true);
    }

    expect(within(why).getByRole("heading", { name: "What can you control before exposure?", level: 3 })).toBeInTheDocument();
    expect(within(why).getByRole("heading", { name: "Why do camera movements matter?", level: 3 })).toBeInTheDocument();
    expect(within(why).getByRole("heading", { name: "Why is large-format camera still worth learning?", level: 3 })).toBeInTheDocument();
    expect(
      within(why).getByText(
        "Camera position, composition, image geometry, and the plane of sharp focus are separate decisions. A view camera makes those relationships explicit before exposure.",
      ),
    ).toBeInTheDocument();
    expect(
      within(why).getByText(
        "Rise and shift can recompose while the whole-camera viewpoint stays fixed. Tilt and swing change the orientation of the plane of sharp focus. Move the whole camera, and viewpoint, perspective, and parallax change.",
      ),
    ).toBeInTheDocument();
    expect(
      within(why).getByText(
        "The slower process turns each adjustment into a deliberate decision. An inverted Ground Glass encourages you to inspect edges, planes, focus, and spatial relationships before exposure.",
      ),
    ).toBeInTheDocument();

    expect(fundamentals.querySelectorAll("input, button, select, textarea")).toHaveLength(0);
    expect(visualization.querySelectorAll("input, button, select, textarea")).toHaveLength(0);
    expect(why.querySelectorAll("input, button, select, textarea")).toHaveLength(0);
    expect(screen.queryByText("Scene Gallery")).not.toBeInTheDocument();
    expect(screen.queryByText("Learn Through Scenes")).not.toBeInTheDocument();
    expect(screen.queryByText("Why do artists still use view cameras?")).not.toBeInTheDocument();
    expect(document.querySelector(".landing-home__legacy")).toBeNull();
    expect(document.querySelector(".site-shell--landing-home .desktop-experience-notice")).toBeNull();
    expect(document.querySelector(".landing-info-section")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId("landing-hero-cta")).toHaveAttribute("href", "/scenes");

    expect(
      visualization.compareDocumentPosition(why) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(why.compareDocumentPosition(finalCta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector(".site-shell--landing-home .marketing-container")?.lastElementChild).toBe(finalCta);
  });
});
