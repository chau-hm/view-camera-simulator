import { expect, test } from "@playwright/test";

test("Mirror Shift top-view geometry follows canonical A/B/C state relationships", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/mirror-shift?rttDiagnostics=1");

  const rtt = page.getByTestId("ground-glass-rtt").first();
  const position = page.getByRole("slider", { name: "Camera Position" });
  const frontShift = page.getByRole("slider", { name: "Front Shift" });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });

  await page.getByRole("button", { name: "Open 2D Geometry" }).click();
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

  await page.getByRole("button", { name: "Close 2D Geometry" }).click();
  await page.getByRole("button", { name: "Reset movements" }).click();
  await expect(position).toHaveValue("0");
  await expect(frontShift).toHaveValue("0");
});
