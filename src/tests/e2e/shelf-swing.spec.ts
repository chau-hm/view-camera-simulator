import { expect, test } from "@playwright/test";

for (const route of [
  "/simulator/free/shelf-swing",
  "/simulator/guided/shelf-swing/swing-01",
]) {
  test(`redirects unavailable Shelf Swing route ${route} to Scenes`, async ({ page }) => {
    await page.goto(route);

    await expect(page).toHaveURL(/\/scenes$/);
    await expect(page.getByRole("heading", { name: "Scenes", level: 1 })).toBeVisible();
    const shelfCard = page.getByRole("heading", { name: "Shelf Swing", level: 2 }).locator("../..");
    await expect(shelfCard.getByText("In development")).toBeVisible();
    await expect(shelfCard.getByRole("link", { name: "Open Scene" })).toHaveCount(0);
    await expect(shelfCard.getByRole("link", { name: "Start Guided Task" })).toHaveCount(0);
  });
}

test("keeps the available Table Tilt route open", async ({ page }) => {
  await page.goto("/simulator/free/table-tilt");

  await expect(page).toHaveURL(/\/simulator\/free\/table-tilt$/);
  await expect(page.getByRole("link", { name: /All Scenes/i })).toBeVisible();
});
