import { expect, test } from "@playwright/test";

const revealSelector = "[data-landing-reveal]";

test.describe("Landing motion progressive enhancement", () => {
  test("reveals once, keeps revealed content visible, and updates the header scroll state", async ({ page }) => {
    await page.setViewportSize({ width: 1288, height: 904 });
    await page.goto("/");

    const root = page.locator(".site-shell--landing-home");
    const header = page.locator(".site-header");
    const firstCard = page.locator(".landing-concept-grid--fundamentals [data-landing-reveal=card]").first();

    await expect(root).toHaveAttribute("data-landing-motion", "enabled");
    await expect(page.locator(".landing-hero__title")).toBeVisible();
    await expect(header).not.toHaveClass(/site-header--scrolled/);

    await page.evaluate(() => window.scrollTo(0, 140));
    await expect(header).toHaveClass(/site-header--scrolled/);

    await firstCard.scrollIntoViewIfNeeded();
    await expect(firstCard).toHaveAttribute("data-landing-revealed", "true");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(firstCard).toHaveAttribute("data-landing-revealed", "true");
    await expect(header).not.toHaveClass(/site-header--scrolled/);

    await page.locator(".landing-final-cta-section__cta").focus();
    await expect(page.locator(".landing-final-cta-section__cta")).toBeFocused();
    await expect(page.locator(".landing-final-cta-section__cta")).toHaveCSS("outline-style", "solid");
  });

  test("keeps all landing content visible when IntersectionObserver is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "IntersectionObserver", {
        configurable: true,
        value: undefined,
      });
    });
    await page.goto("/");

    await expect(page.locator(".site-shell--landing-home")).not.toHaveAttribute("data-landing-motion", "enabled");
    const state = await page.locator(revealSelector).evaluateAll((targets) =>
      targets.map((target) => {
        const styles = getComputedStyle(target);
        return { opacity: styles.opacity, transform: styles.transform };
      }),
    );

    expect(state.every(({ opacity, transform }) => opacity === "1" && transform === "none")).toBe(true);
  });

  test("shows the static landing immediately and disables motion under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.locator(".site-shell--landing-home")).not.toHaveAttribute("data-landing-motion", "enabled");
    await expect(page.getByRole("heading", { name: "Shape Perspective. Place Focus.", level: 1 })).toBeVisible();
    await expect(page.getByTestId("landing-final-cta-section").getByRole("link", { name: "Start Exploring" })).toHaveAttribute(
      "href",
      "/scenes",
    );

    const state = await page.locator("[data-landing-hero-copy]").evaluateAll((targets) =>
      targets.map((target) => {
        const styles = getComputedStyle(target);
        return { opacity: styles.opacity, transform: styles.transform, animation: styles.animationName };
      }),
    );
    expect(state.every(({ opacity, transform, animation }) => opacity === "1" && transform === "none" && animation === "none")).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  });

  test("initializes correctly after direct navigation and browser back", async ({ page }) => {
    await page.goto("/scenes");
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".site-shell--landing-home")).toHaveAttribute("data-landing-motion", "enabled");

    await page.goBack();
    await expect(page).toHaveURL(/\/scenes$/);
    await expect(page.getByRole("heading", { name: "Scenes", level: 1 })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".site-shell--landing-home")).toHaveAttribute("data-landing-motion", "enabled");
  });
});
