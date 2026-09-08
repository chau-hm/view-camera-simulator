import { expect, test } from "@playwright/test";

test("smoke: app boots at home", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Shape Perspective. Place Focus." }),
  ).toBeVisible();
  await expect(page.getByTestId("landing-hero-cta")).toBeVisible();
});
