import { test, expect } from '@playwright/test';

test.describe('Marketing responsive', () => {
  test('Desktop Home and Scenes (1280x800) show no warning', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Home: warning absent, CTA visible
    await expect(page.locator('role=link[name="Open Focus Fundamentals"]')).toBeVisible();
    await expect(page.locator('role=note')).toHaveCount(0);

    // Scenes
    await page.goto('/scenes');
    await expect(page.locator('role=note')).toHaveCount(0);
    await expect(page.locator('text=Focus Fundamentals')).toBeVisible();
    await expect(page.locator('text=Architecture Rise')).toBeVisible();
    // ensure at least one Open Scene button exists
    const openSceneCount = await page.locator('role=link[name="Open Scene"]').count();
    expect(openSceneCount).toBeGreaterThan(0);
  });

  test('Narrow Home (390x844) shows warning and retains CTA without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.locator('role=note')).toBeVisible();
    await expect(page.locator('role=link[name="Open Focus Fundamentals"]')).toBeVisible();

    // ensure CTA button bounding box width > 0
    const cta = await page.locator('role=link[name="Open Focus Fundamentals"]').first();
    const box = await cta.boundingBox();
    expect(box && box.width).toBeGreaterThan(0);

    // check no horizontal overflow (allow small rounding noise)
    const overflowWidth = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    // allow up to 2px of rounding/scrollbar noise in CI environments
    expect(overflowWidth).toBeLessThanOrEqual(2);
  });

  test('Narrow Scenes (390x844) shows warning and scene cards without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/scenes');

    await expect(page.locator('role=note')).toBeVisible();
    await expect(page.locator('text=Focus Fundamentals')).toBeVisible();
    await expect(page.locator('text=Architecture Rise')).toBeVisible();
    // ensure at least one Open Scene button exists
    const openSceneCount2 = await page.locator('role=link[name="Open Scene"]').count();
    expect(openSceneCount2).toBeGreaterThan(0);

    // check no horizontal overflow (allow small rounding noise)
    const overflowWidth = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    // allow up to 2px of rounding/scrollbar noise in CI environments
    expect(overflowWidth).toBeLessThanOrEqual(2);
  });
});
