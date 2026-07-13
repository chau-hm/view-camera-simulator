import { test, expect } from '@playwright/test';

test.describe('Ground Glass interaction', () => {
  test('click toggles zoom exactly once and drag does not toggle', async ({ page }) => {
    await page.goto('/simulator/free/architecture-rise');

    // find the ground glass viewport and its interactive stage button
    const viewport = page.getByLabel('GroundGlassViewport');
    await expect(viewport).toBeVisible();
    const stage = viewport.getByRole('button');
    await expect(stage).toBeVisible();

    // initial attributes
    await expect(stage).toHaveAttribute('data-zoomed', 'false');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom in Ground Glass');

    // Click to zoom in
    await stage.click();
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom out Ground Glass');

    // Click to zoom out
    await stage.click();
    await expect(stage).toHaveAttribute('data-zoomed', 'false');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom in Ground Glass');
  });

  test('drag while zoomed pans and does not toggle, suppression allows next click', async ({ page }) => {
    await page.goto('/simulator/free/architecture-rise');

    const viewport = page.getByLabel('GroundGlassViewport');
    await expect(viewport).toBeVisible();
    // zoom in first via click
    const stage = viewport.getByRole('button');
    await stage.click();
    await expect(stage).toHaveAttribute('data-zoomed', 'true');

    // bounding box for mouse coordinates
    const box = await stage.boundingBox();
    if (!box) throw new Error('Ground Glass stage bounding box not found');
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // perform drag with mouse
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    // drag by 50x35 pixels in several steps
    await page.mouse.move(centerX + 50, centerY + 35, { steps: 6 });
    await page.mouse.up();

    // should remain zoomed
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom out Ground Glass');

    // now perform an ordinary click to zoom out
    await page.mouse.click(centerX, centerY);
    await expect(stage).toHaveAttribute('data-zoomed', 'false');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom in Ground Glass');
  });
});
