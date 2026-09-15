import { expect, test } from "@playwright/test";

const horizontalOverflow = () =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth;

test("keeps the active lesson context between the brand and desktop actions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/simulator/free/understanding-camera-movements");

  const header = page.locator(".simulator-header");
  const context = header.locator(".simulator-header__context");
  const actions = header.locator(".sim-header-actions");

  await expect(context.locator(".simulator-header__lesson-title")).toHaveText("Understanding Camera Movements");
  await expect(context.locator(".simulator-header__lesson-context")).toHaveText("Free Exploration");
  await expect(header.getByRole("link", { name: "All Scenes", exact: true })).toBeVisible();
  await expect(header.getByRole("combobox", { name: "Language", exact: true })).toBeVisible();

  const contextBounds = await context.boundingBox();
  const actionsBounds = await actions.boundingBox();
  expect(contextBounds).not.toBeNull();
  expect(actionsBounds).not.toBeNull();
  expect(contextBounds!.x + contextBounds!.width).toBeLessThanOrEqual(actionsBounds!.x + 1);
  await expect.poll(() => page.evaluate(horizontalOverflow)).toBeLessThanOrEqual(1);
});

test("keeps the lesson context and global actions reachable in the narrow header", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 });
  await page.goto("/simulator/free/understanding-camera-movements");

  const header = page.locator(".simulator-header");
  const context = header.locator(".simulator-header__context");

  await expect(context.locator(".simulator-header__lesson-title")).toBeVisible();
  await expect(context.locator(".simulator-header__lesson-title")).toHaveText("Understanding Camera Movements");
  await expect(context.locator(".simulator-header__lesson-context")).toHaveText("Free Exploration");
  await expect(header.getByRole("link", { name: "All Scenes", exact: true })).toBeVisible();
  await expect(header.getByRole("combobox", { name: "Language", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(horizontalOverflow)).toBeLessThanOrEqual(1);
});
