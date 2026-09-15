import { expect, test } from "@playwright/test";

test("compact common camera controls stay usable at desktop and narrow widths", async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/simulator/free/architecture-foreground");

    const controls = page.getByRole("region", { name: "Camera Controls" });
    await controls.scrollIntoViewIfNeeded();
    await expect(controls.getByRole("heading", { name: "Front standard" })).toBeVisible();

    const movement = controls.getByRole("region", { name: "Movement" });
    await expect(movement.getByRole("slider")).toHaveCount(3);
    await expect(movement.getByRole("slider", { name: /rear/i })).toHaveCount(0);

    const tilt = movement.getByRole("slider", { name: "Tilt" });
    await tilt.fill("3.2");
    await expect(tilt).toHaveValue("3.2");
    await expect(movement.locator(".compact-range-row").nth(1).locator("output")).toHaveText("3.2°");

    const aperture = controls.getByRole("radiogroup", { name: "Aperture" });
    await expect(aperture.getByRole("radio")).toHaveCount(6);
    await expect(aperture.getByRole("radio", { name: "f/16" })).toBeVisible();

    const rects = await controls.locator(".compact-range-row, .aperture-control__option").evaluateAll(
      (elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }),
    );
    expect(rects.every(({ left, right }) => left >= -1 && right <= viewport.width + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
});
