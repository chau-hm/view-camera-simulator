import { expect, test } from "@playwright/test";

test("Mirror Shift top-view geometry follows canonical A/B/C state relationships", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/mirror-shift?rttDiagnostics=1");

  const rtt = page.getByTestId("ground-glass-rtt").first();
  const position = page.getByRole("slider", { name: "Camera Position" });
  const frontShift = page.getByRole("slider", { name: "Front Shift" });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });

  await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  const geometry = page.getByTestId("mirror-shift-teaching-svg");
  await expect(geometry).toBeVisible();
  await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "top");
  await expect(geometry).toHaveAttribute("data-rig-lateral-mm", "0");
  await expect(geometry).toHaveAttribute("data-front-shift-mm", "0");
  await expect(geometry).toHaveAttribute("data-current-film-x-mm", "0");
  await expect(geometry).toHaveAttribute("data-current-lens-x-mm", "0");

  await position.fill("2000");
  await expect(geometry).toHaveAttribute("data-rig-lateral-mm", "2000");
  await expect(geometry).toHaveAttribute("data-front-shift-mm", "0");
  await expect(geometry).toHaveAttribute("data-current-film-x-mm", "2000");
  await expect(geometry).toHaveAttribute("data-current-lens-x-mm", "2000");

  await frontShift.fill("-55");
  await expect(geometry).toHaveAttribute("data-rig-lateral-mm", "2000");
  await expect(geometry).toHaveAttribute("data-front-shift-mm", "-55");
  await expect(geometry).toHaveAttribute("data-current-film-x-mm", "2000");
  await expect(geometry).toHaveAttribute("data-current-lens-x-mm", "1945");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });

  await page.getByRole("button", { name: "Restore 2D Geometry" }).click();
  await page.getByRole("button", { name: "Reset movements" }).click();
  await expect(position).toHaveValue("0");
  await expect(frontShift).toHaveValue("0");
});

test("Mirror Shift presents Top without leaking Geometry View into Architecture Rise", async ({ page }) => {
  await page.goto("/simulator/free/architecture-rise");
  await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "side");
  await page.getByRole("button", { name: "Restore 2D Geometry" }).click();

  await page.getByRole("link", { name: "All Scenes" }).click();
  const mirrorShiftCard = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Mirror Shift" }) });
  await mirrorShiftCard.getByRole("link", { name: "Open Scene" }).click();
  await expect(page).toHaveURL(/\/simulator\/free\/mirror-shift$/);
  await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "top");
  await expect(page.getByRole("button", { name: "Side" })).toHaveCount(0);
  await page.getByRole("button", { name: "Restore 2D Geometry" }).click();

  await page.getByRole("link", { name: "All Scenes" }).click();
  const architectureCard = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) });
  await architectureCard.getByRole("link", { name: "Open Scene" }).click();
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "side");
});
