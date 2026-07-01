import { expect, test } from "@playwright/test";

test("smoke: app boots at home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "View Camera Simulator" })).toBeVisible();
  await expect(page.getByTestId("guided-entry")).toBeVisible();
});
