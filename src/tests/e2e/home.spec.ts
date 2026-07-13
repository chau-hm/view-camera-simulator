import { expect, test } from "@playwright/test";

test("home can navigate to Scenes page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explore the Simulator" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect(page.getByRole("heading", { name: "Scenes" })).toBeVisible();

  const focusCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Focus Fundamentals — Two Targets" }) });
  const architectureCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) });

  await expect(focusCard).toBeVisible();
  await expect(architectureCard).toBeVisible();

  await expect(architectureCard.getByRole("link", { name: "Open Scene" })).toBeVisible();
});
