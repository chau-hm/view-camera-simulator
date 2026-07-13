import { test, expect, type Locator } from '@playwright/test';

// helper to read the computed transform of the transformed stage element
const readStageTransform = async (locator: Locator) => {
  return locator.evaluate(async (element: Element) => {
    // wait up to ~2s for the computed transform to become available (helps under load)
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const style = getComputedStyle(element as Element);
      const transform = style.transform;
      if (transform && transform !== 'none') {
        const m = new DOMMatrixReadOnly(transform);
        return { translateX: m.m41, translateY: m.m42, scaleX: m.a, scaleY: m.d };
      }
      // small sleep
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }
    // fallback to identity
    return { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1 };
  });
};

test.describe('Ground Glass interaction', () => {
  test('Architecture Rise: off-center anchor, drag pan, zoom-out centering, and immediate re-zoom', async ({ page }) => {
    await page.goto('/simulator/free/architecture-rise');

    const viewport = page.getByLabel('GroundGlassViewport');
    await expect(viewport).toBeVisible();

    const stage = viewport.getByRole('button');
    await expect(stage).toBeVisible();

    const transformedLayer = viewport.locator('.groundglass-stage');
    await expect(transformedLayer).toBeVisible();

    // obtain bounding box and click at 25% left, 25% top
    const box = await stage.boundingBox();
    if (!box) throw new Error('Ground Glass stage bounding box not found');
    const clickX = Math.round(box.width * 0.25);
    const clickY = Math.round(box.height * 0.25);

    // perform real click with offset coordinates relative to stage
    await stage.click({ position: { x: clickX, y: clickY } });

    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom out Ground Glass');

    await transformedLayer.waitFor({ state: 'attached', timeout: 5000 });
    const t1 = await readStageTransform(transformedLayer);
    // scale should be approximately ZOOM_SCALE (1.9)
    expect(t1.scaleX).toBeCloseTo(1.9, 1);
    // clicking left/top should produce positive translateX and translateY (image moves right/down)
    expect(t1.translateX).toBeGreaterThan(1);
    expect(t1.translateY).toBeGreaterThan(1);

    // store pre-drag transform
    const preDrag = t1;

    // drag from center by +60, +40
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 60, centerY + 40, { steps: 6 });
    await page.mouse.up();

    // should remain zoomed and aria label unchanged
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom out Ground Glass');

    await transformedLayer.waitFor({ state: 'attached', timeout: 5000 });
    const postDrag = await readStageTransform(transformedLayer);
    expect(postDrag.scaleX).toBeCloseTo(1.9, 1);
    // at least one of the translate axes should change (pan applied)
    const dx = Math.abs(postDrag.translateX - preDrag.translateX);
    const dy = Math.abs(postDrag.translateY - preDrag.translateY);
    expect(dx > 0 || dy > 0).toBeTruthy();

    // click to zoom out (ordinary click at center)
    await page.mouse.click(centerX, centerY);

    await expect(stage).toHaveAttribute('data-zoomed', 'false');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom in Ground Glass');

    await transformedLayer.waitFor({ state: 'attached', timeout: 5000 });
    const outTransform = await readStageTransform(transformedLayer);
    // scale returns to 1 and translation near zero
    expect(outTransform.scaleX).toBeCloseTo(1, 2);
    expect(Math.abs(outTransform.translateX)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(outTransform.translateY)).toBeLessThanOrEqual(0.5);

    // immediate re-zoom: click at 70% left, 65% top
    const reX = Math.round(box.width * 0.7);
    const reY = Math.round(box.height * 0.65);
    await stage.click({ position: { x: reX, y: reY } });

    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Zoom out Ground Glass');

    await transformedLayer.waitFor({ state: 'attached', timeout: 5000 });
    const reTransform = await readStageTransform(transformedLayer);
    expect(reTransform.scaleX).toBeCloseTo(1.9, 1);
    // clicking right/bottom should produce negative translateX/Y (image moves left/up)
    expect(reTransform.translateX).toBeLessThan(-1);
    expect(reTransform.translateY).toBeLessThan(-1);

    // repeat cycle a couple times quickly
    for (let i = 0; i < 3; i++) {
      // zoom out
      await page.mouse.click(centerX, centerY);
      await expect(stage).toHaveAttribute('data-zoomed', 'false');
      await transformedLayer.waitFor({ state: 'attached', timeout: 5000 });
      const outT = await readStageTransform(transformedLayer);
      expect(outT.scaleX).toBeCloseTo(1, 2);
      expect(Math.abs(outT.translateX)).toBeLessThanOrEqual(0.5);

      // zoom in centered
      await page.mouse.click(centerX, centerY);
      await expect(stage).toHaveAttribute('data-zoomed', 'true');
      await transformedLayer.waitFor({ state: 'attached', timeout: 5000 });
      const inT = await readStageTransform(transformedLayer);
      expect(inT.scaleX).toBeCloseTo(1.9, 1);
    }
  });

  test('Focus Fundamentals: three-click smoke test', async ({ page }) => {
    await page.goto('/simulator/free/focus-fundamentals-two-targets');
    const viewport = page.getByLabel('GroundGlassViewport');
    await expect(viewport).toBeVisible();
    const stage = viewport.getByRole('button');
    await expect(stage).toBeVisible();
    const transformedLayer = viewport.locator('.groundglass-stage');
    await expect(transformedLayer).toBeVisible();

    const box = await stage.boundingBox();
    if (!box) throw new Error('Ground Glass stage bounding box not found');
    const cx = Math.round(box.width / 2);
    const cy = Math.round(box.height / 2);

    // initial
    await expect(stage).toHaveAttribute('data-zoomed', 'false');

    // click 1
    await stage.click({ position: { x: cx, y: cy } });
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await transformedLayer.waitFor({ state: 'attached', timeout: 5000 });
    const t1 = await readStageTransform(transformedLayer);
    expect(t1.scaleX).toBeCloseTo(1.9, 1);

    // click 2 -> zoom out
    await stage.click({ position: { x: cx, y: cy } });
    await expect(stage).toHaveAttribute('data-zoomed', 'false');
    const t2 = await readStageTransform(transformedLayer);
    expect(t2.scaleX).toBeCloseTo(1, 2);
    expect(Math.abs(t2.translateX)).toBeLessThanOrEqual(0.5);

    // click 3 -> zoom in
    await stage.click({ position: { x: cx, y: cy } });
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    const t3 = await readStageTransform(transformedLayer);
    expect(t3.scaleX).toBeCloseTo(1.9, 1);
  });
});
