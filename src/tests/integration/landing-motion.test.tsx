import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";
import { SiteHeader } from "../../components/layout/SiteHeader";
import { i18n } from "../../i18n";
import { LOCALE_STORAGE_KEY } from "../../i18n/localePreference";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

class MockIntersectionObserver {
  static latest: MockIntersectionObserver | null = null;

  readonly callback: IntersectionObserverCallback;
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.latest = this;
  }

  trigger(entries: IntersectionObserverEntry[]) {
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

const stubMatchMedia = (matches: boolean) => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === reducedMotionQuery && matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
};

const renderHome = () => {
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  return render(<RouterProvider router={router} />);
};

beforeEach(async () => {
  cleanup();
  MockIntersectionObserver.latest = null;
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  await i18n.changeLanguage("en");
  document.documentElement.lang = "en";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("landing motion progressive enhancement", () => {
  it("keeps the complete static Home visible without IntersectionObserver", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    stubMatchMedia(false);

    renderHome();

    expect(await screen.findByRole("heading", { name: "Shape Perspective. Place Focus.", level: 1 })).toBeInTheDocument();
    expect(document.querySelector(".site-shell--landing-home")).not.toHaveAttribute(
      "data-landing-motion",
      "enabled",
    );
    expect(screen.getByTestId("landing-fundamentals-section")).toBeInTheDocument();
    expect(screen.getByTestId("landing-visualization-section")).toBeInTheDocument();
    expect(screen.getByTestId("landing-why-section")).toBeInTheDocument();
    expect(screen.getByTestId("landing-final-cta-section")).toBeInTheDocument();
  });

  it("reveals an intersecting target once and keeps it revealed after exit", async () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    stubMatchMedia(false);

    renderHome();

    const root = document.querySelector(".site-shell--landing-home");
    await waitFor(() => expect(root).toHaveAttribute("data-landing-motion", "enabled"));

    const target = document.querySelector<HTMLElement>(
      '[data-testid="landing-fundamentals-section"] [data-landing-reveal="header"]',
    );
    if (!target) throw new Error("Fundamentals reveal target is missing");
    expect(target).not.toHaveAttribute("data-landing-revealed");
    expect(MockIntersectionObserver.latest).not.toBeNull();

    MockIntersectionObserver.latest?.trigger([
      { target, isIntersecting: true, intersectionRatio: 1 } as unknown as IntersectionObserverEntry,
    ]);

    await waitFor(() => expect(target).toHaveAttribute("data-landing-revealed", "true"));
    expect(MockIntersectionObserver.latest?.unobserve).toHaveBeenCalledWith(target);

    MockIntersectionObserver.latest?.trigger([
      { target, isIntersecting: false, intersectionRatio: 0 } as unknown as IntersectionObserverEntry,
    ]);

    expect(target).toHaveAttribute("data-landing-revealed", "true");
  });

  it("leaves content immediately visible when reduced motion is requested", async () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    stubMatchMedia(true);

    renderHome();

    expect(await screen.findByRole("heading", { name: "Shape Perspective. Place Focus.", level: 1 })).toBeInTheDocument();
    expect(document.querySelector(".site-shell--landing-home")).not.toHaveAttribute(
      "data-landing-motion",
      "enabled",
    );
    expect(MockIntersectionObserver.latest).toBeNull();
    expect(document.querySelectorAll("[data-landing-revealed]")).toHaveLength(0);
  });
});

describe("landing navigation scroll state", () => {
  it("adds and removes the scrolled state without changing the compact menu contract", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SiteHeader />
      </MemoryRouter>,
    );

    const header = screen.getByRole("banner");
    expect(header).not.toHaveClass("site-header--scrolled");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 128 });
    fireEvent.scroll(window);
    await waitFor(() => expect(header).toHaveClass("site-header--scrolled"));

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    fireEvent.scroll(window);
    await waitFor(() => expect(header).not.toHaveClass("site-header--scrolled"));

    expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
  });
});
