import { expect, test } from "@playwright/test";

test("smoke: app boots at home", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Shape Perspective. Place Focus." }),
  ).toBeVisible();
  await expect(page.getByTestId("landing-hero-cta")).toBeVisible();
});

test("smoke: Architecture Rise navigates to contentful WebGL Ground Glass controls", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByTestId("landing-hero-cta").click();
  await expect(page).toHaveURL(/\/scenes$/);

  const architectureRise = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) });
  await architectureRise.getByRole("link", { name: "Open Scene" }).click();
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("rttDiagnostics", "1");
    window.history.replaceState(window.history.state, "", url);
  });

  const observer = page.getByTestId("scene-canvas");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");

  const viewport = page.getByLabel("GroundGlassViewport");
  const rtt = viewport.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect(rtt.locator("canvas")).toBeVisible();
  await expect(viewport.getByRole("radio", { name: "Raw Ground Glass" })).toBeChecked();

  const stage = viewport.locator("[data-focus-loupe-active]");
  await viewport.getByRole("button", { name: "Focus loupe · 4× Ground Glass view", exact: true }).click();
  await expect(stage).toHaveAttribute("data-focus-loupe-active", "true");
  await expect(stage).toHaveAttribute("data-focus-loupe-scale", "4");

  await viewport.getByRole("radio", { name: "Upright Assist" }).check();
  await expect(viewport.getByRole("radio", { name: "Upright Assist" })).toBeChecked();
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true");
  await viewport.getByRole("button", { name: "Reset Ground Glass view" }).click();
  await expect(stage).toHaveAttribute("data-focus-loupe-active", "false");
});
