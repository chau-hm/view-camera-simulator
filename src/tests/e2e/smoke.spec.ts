import { expect, test } from "@playwright/test";

test("smoke: app boots at home", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "See how a view camera changes the image before the shutter is pressed." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the Simulator" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Learn Why" })).toBeVisible();
});
