import { expect, test } from "@playwright/test";

test("home can navigate to guided mode", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("guided-entry").click();
  await expect(page).toHaveURL(/\/simulator\/guided\//);
});
