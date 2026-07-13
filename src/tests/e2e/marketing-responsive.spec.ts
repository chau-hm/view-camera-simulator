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
    await expect(page.getByRole('heading', { name: 'Table Tilt' })).toBeVisible();
    // ensure at least one Open Scene button exists
    const openSceneCount = await page.locator('role=link[name="Open Scene"]').count();
    expect(openSceneCount).toBeGreaterThan(0);
  });

  test('Narrow Home (390x844) shows warning and retains CTA without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.locator('role=note')).toBeVisible();
    await expect(page.locator('role=link[name="Open Focus Fundamentals"]')).toBeVisible();

    // ensure CTA button bounding box width > 0 and fits within viewport
    const cta = await page.locator('role=link[name="Open Focus Fundamentals"]').first();
    const box = await cta.boundingBox();
    expect(box && box.width).toBeGreaterThan(0);
    expect(box).not.toBeNull();
    // allow 1px rounding tolerance
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);

    // Ensure the Focus CTA panel itself fits within the viewport
    const focusCta = page.locator('.focus-cta');
    const focusCtaBox = await focusCta.boundingBox();
    expect(focusCtaBox).not.toBeNull();
    expect(focusCtaBox!.x + focusCtaBox!.width).toBeLessThanOrEqual(391);

    // Ensure the desktop experience notice stays within the viewport
    const notice = page.locator('.desktop-experience-notice');
    const noticeBox = await notice.boundingBox();
    expect(noticeBox).not.toBeNull();
    expect(noticeBox!.x + noticeBox!.width).toBeLessThanOrEqual(391);

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
    await expect(page.getByRole('heading', { name: 'Table Tilt' })).toBeVisible();
    // ensure at least one Open Scene button exists
    const openSceneCount2 = await page.locator('role=link[name="Open Scene"]').count();
    expect(openSceneCount2).toBeGreaterThan(0);

    // Bounding-box checks for Focus Fundamentals card
    const focusCard = page
      .getByRole('article')
      .filter({
        has: page.getByRole('heading', { name: 'Focus Fundamentals — Two Targets' }),
      });

    const thumbnail = focusCard.locator('.scene-thumb');
    const thumbnailBox = await thumbnail.boundingBox();
    expect(thumbnailBox).not.toBeNull();
    expect(thumbnailBox!.x).toBeGreaterThanOrEqual(0);
    // allow 1px rounding tolerance
    expect(thumbnailBox!.x + thumbnailBox!.width).toBeLessThanOrEqual(391);

    const cardBox = await focusCard.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(391);

    // Bounding-box checks for Architecture Rise card
    const archCard = page
      .getByRole('article')
      .filter({
        has: page.getByRole('heading', { name: 'Architecture Rise' }),
      });

    const archThumb = archCard.locator('.scene-thumb');
    const archThumbBox = await archThumb.boundingBox();
    expect(archThumbBox).not.toBeNull();
    expect(archThumbBox!.x).toBeGreaterThanOrEqual(0);
    expect(archThumbBox!.x + archThumbBox!.width).toBeLessThanOrEqual(391);

    const archCardBox = await archCard.boundingBox();
    expect(archCardBox).not.toBeNull();
    expect(archCardBox!.x + archCardBox!.width).toBeLessThanOrEqual(391);

    const tableCard = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Table Tilt' }) });
    await expect(tableCard.getByRole('link', { name: 'Open Scene' })).toBeVisible();
    await expect(tableCard.getByRole('link', { name: 'Start Guided Task' })).toBeVisible();
    const tableCardBox = await tableCard.boundingBox();
    expect(tableCardBox).not.toBeNull();
    expect(tableCardBox!.x + tableCardBox!.width).toBeLessThanOrEqual(391);

    // check no horizontal overflow (allow small rounding noise)
    const overflowWidth = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    // allow up to 2px of rounding/scrollbar noise in CI environments
    expect(overflowWidth).toBeLessThanOrEqual(2);
  });
});
