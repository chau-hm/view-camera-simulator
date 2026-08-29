import { test, expect } from '@playwright/test';

test.describe('Marketing responsive', () => {
  test('Desktop Home and Scenes (1280x800) show no warning', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Home: warning absent
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

  test('Narrow Home (390x844) shows warning without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.locator('role=note')).toBeVisible();

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

  test('Narrow FAQ (390x844) does not overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/faq');

    await page.getByRole('combobox', { name: 'Language' }).selectOption('zh-HK');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-HK');
    await expect(page.getByRole('heading', { name: '常見問題', level: 1 })).toBeVisible();
    const overflowWidth = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
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
