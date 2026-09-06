import { useLayoutEffect } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

const prefersReducedMotion = () => {
  if (typeof window.matchMedia !== "function") return false;

  try {
    return window.matchMedia(reducedMotionQuery).matches;
  } catch {
    return true;
  }
};

export const useLandingMotion = () => {
  useLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>(".site-shell--landing-home");

    if (
      !root ||
      prefersReducedMotion() ||
      typeof window.IntersectionObserver !== "function"
    ) {
      return undefined;
    }

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-landing-reveal]"),
    );
    let observer: IntersectionObserver | null = null;

    try {
      observer = new window.IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;

            const target = entry.target as HTMLElement;
            target.dataset.landingRevealed = "true";
            observer?.unobserve(target);
          }
        },
        { threshold: 0.18 },
      );

      root.dataset.landingMotion = "enabled";
      for (const target of targets) observer.observe(target);
    } catch {
      observer?.disconnect();
      delete root.dataset.landingMotion;
      return undefined;
    }

    return () => {
      observer?.disconnect();
      delete root.dataset.landingMotion;
      for (const target of targets) delete target.dataset.landingRevealed;
    };
  }, []);
};

export default useLandingMotion;
