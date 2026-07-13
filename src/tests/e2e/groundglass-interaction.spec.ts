import { test, expect, type Locator, type Page } from '@playwright/test';

type StageTransform = {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
};

// Read the computed transform of the transformed stage element.
// Fail loudly if the locator cannot be resolved or evaluation errors.
const readStageTransform = async (locator: Locator): Promise<StageTransform> => {
  // Ensure the transformed layer exists and is visible. This will throw on failure.
  await expect(locator).toHaveCount(1);
  await expect(locator).toBeVisible();

  return locator.evaluate((element: Element) => {
    const transform = getComputedStyle(element).transform;

    if (!transform || transform === 'none') {
      return {
        translateX: 0,
        translateY: 0,
        scaleX: 1,
        scaleY: 1,
      };
    }

    const matrix = new DOMMatrixReadOnly(transform);

    return {
      translateX: matrix.m41,
      translateY: matrix.m42,
      scaleX: matrix.a,
      scaleY: matrix.d,
    };
  });
};

// Helper: click the stage at a relative x/y ratio (0..1) using fresh geometry and real Playwright input.
const clickStageAt = async (page: Page, stage: Locator, xRatio: number, yRatio: number) => {
  await expect(stage).toBeVisible();
  const box = await stage.boundingBox();
  if (!box) throw new Error('Ground Glass stage bounding box not found');
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
};

// convenience factory for dynamic transformed-layer locator
const transformedLayerFor = (viewport: Locator) => () => viewport.locator('.groundglass-stage');

test.describe('Ground Glass interaction', () => {
  test('Architecture Rise: off-center anchor, drag pan, zoom-out centering, and immediate re-zoom', async ({ page }) => {
    await page.goto('/simulator/free/architecture-rise');

    const viewport = page.getByLabel('GroundGlassViewport');
    await expect(viewport).toBeVisible();

    const stage = viewport.getByRole('button');
    await expect(stage).toBeVisible();

    const transformedLayer = transformedLayerFor(viewport);

    // obtain bounding box and click at 25% left, 25% top
    const box = await stage.boundingBox();
    if (!box) throw new Error('Ground Glass stage bounding box not found');
    const clickX = Math.round(box.width * 0.25);
    const clickY = Math.round(box.height * 0.25);

    // perform real click with offset coordinates relative to stage
    await stage.click({ position: { x: clickX, y: clickY } });

    // state change
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom out Ground Glass');

    // scale becomes ~1.9
    await expect.poll(async () => (await readStageTransform(transformedLayer())).scaleX).toBeCloseTo(1.9, 1);

    // clicking left/top should produce positive translateX and translateY (image moves right/down)
    await expect.poll(async () => (await readStageTransform(transformedLayer())).translateX).toBeGreaterThan(1);
    await expect.poll(async () => (await readStageTransform(transformedLayer())).translateY).toBeGreaterThan(1);

    // store pre-drag transform
    const preDrag = await readStageTransform(transformedLayer());

    // drag from center by +60, +40 using real page.mouse
    const centerBox = await stage.boundingBox();
    if (!centerBox) throw new Error('Ground Glass stage bounding box not found');
    const centerX = centerBox.x + centerBox.width / 2;
    const centerY = centerBox.y + centerBox.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 60, centerY + 40, { steps: 6 });
    await page.mouse.up();

    // should remain zoomed and aria label unchanged
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom out Ground Glass');

    const postDrag = await readStageTransform(transformedLayer());
    await expect(postDrag.scaleX).toBeCloseTo(1.9, 1);
    // at least one of the translate axes should change (pan applied)
    const dx = Math.abs(postDrag.translateX - preDrag.translateX);
    const dy = Math.abs(postDrag.translateY - preDrag.translateY);
    expect(dx > 0 || dy > 0).toBeTruthy();

    // assert fixed overlay visibility (preview label)
    const previewOverlay = viewport.getByText('Ground glass preview');
    await expect(previewOverlay).toBeVisible();
    // Ensure exactly one overlay exists before inspecting ancestry to avoid detached-element races
    await expect(previewOverlay).toHaveCount(1);
    const isInside = await previewOverlay.evaluate((el) => Boolean((el as Element).closest('.groundglass-stage')));
    expect(isInside).toBe(false);

    // click to zoom out (ordinary centered click)
    await clickStageAt(page, stage, 0.5, 0.5);

    // confirm unzoomed state and transformed layer exists
    await expect(stage).toHaveAttribute('data-zoomed', 'false');

    // read transform and assert identity (scale ~1, translations near zero)
    await expect.poll(async () => (await readStageTransform(transformedLayer())).scaleX).toBeCloseTo(1, 2);
    await expect.poll(async () => Math.abs((await readStageTransform(transformedLayer())).translateX)).toBeLessThanOrEqual(0.5);
    await expect.poll(async () => Math.abs((await readStageTransform(transformedLayer())).translateY)).toBeLessThanOrEqual(0.5);

    // immediate re-zoom: click at 70% left, 65% top — obtain fresh geometry and use absolute page click
    const freshBox = await stage.boundingBox();
    if (!freshBox) throw new Error('Ground Glass stage bounding box not found');
    await page.mouse.click(freshBox.x + freshBox.width * 0.7, freshBox.y + freshBox.height * 0.65);

    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom out Ground Glass');

    // scale and translate sign checks
    await expect.poll(async () => (await readStageTransform(transformedLayer())).scaleX, { timeout: 8000 }).toBeCloseTo(1.9, 1);
    await expect.poll(async () => (await readStageTransform(transformedLayer())).translateX, { timeout: 8000 }).toBeLessThan(-1);
    await expect.poll(async () => (await readStageTransform(transformedLayer())).translateY, { timeout: 8000 }).toBeLessThan(-1);

    // repeated centered cycles (3x) using real Playwright clicks
    for (let i = 0; i < 3; i++) {
      // zoom out (center)
      await clickStageAt(page, stage, 0.5, 0.5);
      await expect(stage).toHaveAttribute('data-zoomed', 'false');
      await expect.poll(async () => (await readStageTransform(transformedLayer())).scaleX).toBeCloseTo(1, 2);
      await expect.poll(async () => Math.abs((await readStageTransform(transformedLayer())).translateX)).toBeLessThanOrEqual(0.5);

      // zoom in (center)
      await clickStageAt(page, stage, 0.5, 0.5);
      await expect(stage).toHaveAttribute('data-zoomed', 'true');
      await expect.poll(async () => (await readStageTransform(transformedLayer())).scaleX).toBeCloseTo(1.9, 1);
    }
  });

  test('Focus Fundamentals: three-click smoke test', async ({ page }) => {
    await page.goto('/simulator/free/focus-fundamentals-two-targets');
    const viewport = page.getByLabel('GroundGlassViewport');
    await expect(viewport).toBeVisible();
    const stage = viewport.getByRole('button');
    await expect(stage).toBeVisible();

    const transformedLayer = transformedLayerFor(viewport);

    const box = await stage.boundingBox();
    if (!box) throw new Error('Ground Glass stage bounding box not found');
    const cx = Math.round(box.width / 2);
    const cy = Math.round(box.height / 2);

    // initial
    await expect(stage).toHaveAttribute('data-zoomed', 'false');

    // click 1
    await stage.click({ position: { x: cx, y: cy } });
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect.poll(async () => (await readStageTransform(transformedLayer())).scaleX).toBeCloseTo(1.9, 1);

    // click 2 -> zoom out
    await stage.click({ position: { x: cx, y: cy } });
    await expect(stage).toHaveAttribute('data-zoomed', 'false');
    await expect.poll(async () => (await readStageTransform(transformedLayer())).scaleX).toBeCloseTo(1, 2);
    await expect.poll(async () => Math.abs((await readStageTransform(transformedLayer())).translateX)).toBeLessThanOrEqual(0.5);

    // click 3 -> zoom in
    await stage.click({ position: { x: cx, y: cy } });
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect.poll(async () => (await readStageTransform(transformedLayer())).scaleX).toBeCloseTo(1.9, 1);
  });
});
