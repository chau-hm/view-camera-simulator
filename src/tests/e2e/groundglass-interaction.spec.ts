import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
import { test, expect, type Locator } from '@playwright/test';
import { clickStageAt, readFreshElementBounds, readStageTransform } from './helpers/groundGlass';

// convenience factory for dynamic transformed-layer locator
const transformedLayerFor = (viewport: Locator) => () => viewport.locator('.groundglass-stage');

test.describe('Ground Glass interaction', () => {
  test('Architecture Rise: Reset view preserves the contentful RTT resource graph', async ({ page }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    const rendererWarnings: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (isKnownFiberClockDeprecation(message)) return;
      const text = message.text();
      if (/GL Driver Message .*GPU stall due to ReadPixels/.test(text)) return;
      if (
        message.type() === 'error' ||
        (message.type() === 'warning' && /React|Three(?:\.js)?|WebGL|render target|disposed|context lost/i.test(text))
      ) {
        rendererWarnings.push(text);
      }
    });

    await page.goto('/simulator/free/architecture-rise?rttDiagnostics=1');
    const viewport = page.getByLabel('GroundGlassViewport');
    const stage = viewport.locator('[data-zoomed]');
    const rtt = viewport.getByTestId('ground-glass-rtt');
    const canvas = rtt.locator('canvas');
    const transformedLayer = viewport.locator('.groundglass-stage');
    const expectContentfulRtt = async () => {
      await expect(rtt).toHaveAttribute('data-rtt-raw-contentful', 'true', { timeout: 120_000 });
      await expect(rtt).toHaveAttribute('data-rtt-final-contentful', 'true', { timeout: 120_000 });
      expect(await rtt.getAttribute('data-rtt-sanity-error')).toBeNull();
    };
    const expectSameCanvas = async (canvasHandle: NonNullable<Awaited<ReturnType<typeof canvas.elementHandle>>>) => {
      await expect
        .poll(() =>
          page.evaluate(
            (node) =>
              node.isConnected &&
              document.querySelector('[data-testid="ground-glass-rtt"] canvas') === node,
            canvasHandle,
          ),
        )
        .toBe(true);
    };

    await expect(viewport).toBeVisible();
    await expect(canvas).toHaveCount(1);
    await expectContentfulRtt();
    const canvasHandle = await canvas.elementHandle();
    if (!canvasHandle) throw new Error('Ground Glass Canvas element was not mounted');
    const initialGeneration = await rtt.getAttribute('data-rtt-resource-generation');
    const initialSanityState = await rtt.getAttribute('data-rtt-sanity-state');
    expect(initialGeneration).toBeTruthy();
    expect(initialSanityState).toBeTruthy();

    await viewport
      .getByRole('button', { name: 'Focus loupe · 4× Ground Glass view', exact: true })
      .click();
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('data-focus-loupe-scale', '4');
    await expect(stage).toHaveAttribute('data-presentation-css-scale', '1');
    await expect(stage).toHaveAttribute('data-scale', '1');
    await expect(stage).toHaveAttribute('data-focus-loupe-window-width', '0.25');
    await expect(stage).toHaveAttribute('data-focus-loupe-window-height', '0.25');
    await expect.poll(() => rtt.getAttribute('data-rtt-sampled-film-width-mm'), { timeout: 120_000 }).toBe('31.75');
    await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).not.toBe(initialSanityState);
    await expectContentfulRtt();
    const stableLoupeSanityState = await rtt.getAttribute('data-rtt-sanity-state');
    expect(stableLoupeSanityState).not.toBe(initialSanityState);

    const box = await readFreshElementBounds(stage);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 60, centerY + 40, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => {
      const panX = Number(await stage.getAttribute('data-inspection-pan-x'));
      const panY = Number(await stage.getAttribute('data-inspection-pan-y'));
      return Math.abs(panX) > 0 || Math.abs(panY) > 0;
    }).toBe(true);

    await viewport
      .getByRole('button', { name: 'Reset Ground Glass view', exact: true })
      .click();
    await expect(stage).toHaveAttribute('data-zoomed', 'false');
    await expect(stage).toHaveAttribute('data-scale', '1');
    await expect(stage).toHaveAttribute('data-focus-loupe-window-width', '1');
    await expect(stage).toHaveAttribute('data-focus-loupe-window-height', '1');
    await expect(stage).toHaveAttribute('data-pan-x', '0');
    await expect(stage).toHaveAttribute('data-pan-y', '0');
    await expect(stage).toHaveAttribute('data-dragging', 'false');
    await expect(stage).toHaveAttribute('data-pointer-active', 'false');
    await expect(stage).toHaveAttribute('data-pointer-captured', 'false');
    await expect(transformedLayer).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).toBe(initialSanityState);
    expect(await rtt.getAttribute('data-rtt-resource-generation')).toBe(initialGeneration);
    await expectSameCanvas(canvasHandle);
    await expectContentfulRtt();

    for (let cycle = 0; cycle < 5; cycle += 1) {
      await viewport
        .getByRole('button', { name: 'Focus loupe · 4× Ground Glass view', exact: true })
        .click();
      await expect(stage).toHaveAttribute('data-zoomed', 'true');
      await expect(stage).toHaveAttribute('data-scale', '1');
      await expect(stage).toHaveAttribute('data-focus-loupe-scale', '4');
      await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).toBe(stableLoupeSanityState);
      await expectContentfulRtt();

      await viewport
        .getByRole('button', { name: 'Reset Ground Glass view', exact: true })
        .click();
      await expect(stage).toHaveAttribute('data-zoomed', 'false');
      await expect(stage).toHaveAttribute('data-scale', '1');
      await expect(stage).toHaveAttribute('data-pan-x', '0');
      await expect(stage).toHaveAttribute('data-pan-y', '0');
      await expect(transformedLayer).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
      await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).toBe(initialSanityState);
      expect(await rtt.getAttribute('data-rtt-resource-generation')).toBe(initialGeneration);
      await expectSameCanvas(canvasHandle);
      await expectContentfulRtt();
    }

    expect(pageErrors, `Uncaught page errors: ${pageErrors.join('\n')}`).toEqual([]);
    expect(rendererWarnings, `React/Three.js/WebGL warnings: ${rendererWarnings.join('\n')}`).toEqual([]);
  });

  test('Architecture Rise: off-center anchor, drag pan, short-click preservation, and immediate re-zoom', async ({ page }) => {
    // allow a longer timeout for this interaction-heavy test to tolerate renderer scheduling in CI/local
    test.setTimeout(120_000);
    await page.goto('/simulator/free/architecture-rise');

    const viewport = page.getByLabel('GroundGlassViewport');
    await expect(viewport).toBeVisible();

    const stage = viewport.locator('[data-zoomed]');
    await expect(stage).toBeVisible();
    await expect(stage).toHaveAttribute('role', 'button');

    const transformedLayer = transformedLayerFor(viewport);

    // obtain bounding box and click at 25% left, 25% top
    const box = await readFreshElementBounds(stage);
    const clickX = Math.round(box.width * 0.25);
    const clickY = Math.round(box.height * 0.25);

    // perform real click with offset coordinates relative to stage
    await stage.click({ position: { x: clickX, y: clickY } });

    // state change
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');
    await expect(stage).toHaveAttribute('role', 'region');
    await expect(viewport.getByRole('region', { name: 'Pan Ground Glass', exact: true })).toHaveCount(1);
    await expect(viewport.getByRole('button', { name: 'Pan Ground Glass', exact: true })).toHaveCount(0);

    // RTT loupe keeps the CSS image at identity; the physical crop is exposed
    // through the inspection-window diagnostics instead.
    await expect.poll(async () => {
      const cssScale = Number(await stage.getAttribute('data-presentation-css-scale'));
      const centerU = Number(await stage.getAttribute('data-focus-loupe-center-u'));
      const centerV = Number(await stage.getAttribute('data-focus-loupe-center-v'));
      return cssScale === 1 && centerU < 0.5 && centerV < 0.5;
    }, { timeout: 8000 }).toBeTruthy();

    // store pre-drag transform
    const preInspectionPan = {
      x: await stage.getAttribute('data-inspection-pan-x'),
      y: await stage.getAttribute('data-inspection-pan-y'),
    };

    // drag from center by +60, +40 using real page.mouse
    const centerBox = await readFreshElementBounds(stage);
    const centerX = centerBox.x + centerBox.width / 2;
    const centerY = centerBox.y + centerBox.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 60, centerY - 40, { steps: 6 });
    await page.mouse.up();

    // should remain zoomed and expose the pan action
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');

    const postInspectionPan = {
      x: await stage.getAttribute('data-inspection-pan-x'),
      y: await stage.getAttribute('data-inspection-pan-y'),
    };
    expect(postInspectionPan.x !== preInspectionPan.x || postInspectionPan.y !== preInspectionPan.y).toBeTruthy();
    await expect(transformedLayer()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

    // assert fixed overlay visibility (preview label)
    const previewOverlay = viewport.getByText('Ground glass preview');
    await expect(previewOverlay).toBeVisible();
    // Ensure exactly one overlay exists before inspecting ancestry to avoid detached-element races
    await expect(previewOverlay).toHaveCount(1);
    const isInside = await previewOverlay.evaluate((el) => Boolean((el as Element).closest('.groundglass-stage')));
    expect(isInside).toBe(false);

    // An ordinary click on the zoomed image is a no-op and preserves the pan.
    const beforeShortClick = await readStageTransform(transformedLayer());
    await clickStageAt(page, stage, 0.5, 0.5);
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');
    expect(await readStageTransform(transformedLayer())).toEqual(beforeShortClick);

    // The explicit reset control is the only zoom-out affordance.
    await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
    await expect(stage).toHaveAttribute('data-zoomed', 'false');

    // read the presentation transform and assert identity — crop state resets separately.
    await expect.poll(async () => {
      const t = await readStageTransform(transformedLayer());
      return Math.abs(t.scaleX - 1) < 0.2 && Math.abs(t.translateX) <= 0.5 && Math.abs(t.translateY) <= 0.5;
    }, { timeout: 8000 }).toBeTruthy();

    // immediate re-zoom: click at 70% left, 65% top — obtain fresh geometry and use absolute page click
    const freshBox = await readFreshElementBounds(stage);
    await page.mouse.click(freshBox.x + freshBox.width * 0.7, freshBox.y + freshBox.height * 0.65);

    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');

    // right-bottom click selects the corresponding physical film crop.
    await expect.poll(async () => {
      const scaleOk = Number(await stage.getAttribute('data-presentation-css-scale')) === 1;
      const uOk = Number(await stage.getAttribute('data-focus-loupe-center-u')) > 0.5;
      const vOk = Number(await stage.getAttribute('data-focus-loupe-center-v')) > 0.5;
      return scaleOk && uOk && vOk;
    }, { timeout: 8000 }).toBeTruthy();

    // repeated centered cycles (3x) using real Playwright clicks
    for (let i = 0; i < 3; i++) {
      // reset explicitly (a zoomed image click is intentionally inert)
      await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
      await expect(stage).toHaveAttribute('data-zoomed', 'false');
      await expect.poll(async () => {
        return Number(await stage.getAttribute('data-focus-loupe-window-width')) === 1;
      }, { timeout: 8000 }).toBeTruthy();

      // zoom in (center)
      await clickStageAt(page, stage, 0.5, 0.5);
      await expect(stage).toHaveAttribute('data-zoomed', 'true');
      await expect.poll(async () => {
        return Number(await stage.getAttribute('data-focus-loupe-window-width')) === 0.25;
      }, { timeout: 8000 }).toBeTruthy();
    }
  });

  test('Focus Fundamentals: image zoom and explicit reset smoke test', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/simulator/free/focus-fundamentals-two-targets');
    const viewport = page.getByLabel('GroundGlassViewport');
    await expect(viewport).toBeVisible();
    const stage = viewport.locator('[data-zoomed]');
    await expect(stage).toBeVisible();

    const transformedLayer = transformedLayerFor(viewport);

    const box = await readFreshElementBounds(stage);
    const cx = Math.round(box.width / 2);
    const cy = Math.round(box.height / 2);

    // initial
    await expect(stage).toHaveAttribute('data-zoomed', 'false');

    // click 1
    await stage.click({ position: { x: cx, y: cy } });
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('data-focus-loupe-scale', '4');
    await expect(stage).toHaveAttribute('data-presentation-css-scale', '1');
    await expect(stage).toHaveAttribute('data-scale', '1');
    await expect.poll(
      async () => Number(await stage.getAttribute('data-focus-loupe-window-width')),
      { timeout: 15_000 },
    ).toBeCloseTo(0.25, 2);
    await expect(transformedLayer()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

    // A second image click does not reset a zoomed stage.
    await stage.click({ position: { x: cx, y: cy } });
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('data-scale', '1');
    await expect.poll(
      async () => Number(await stage.getAttribute('data-focus-loupe-window-width')),
      { timeout: 15_000 },
    ).toBeCloseTo(0.25, 2);

    // The explicit Reset View control restores the identity transform.
    await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
    await expect(stage).toHaveAttribute('data-zoomed', 'false');
    await expect(stage).toHaveAttribute('data-scale', '1');
    await expect(stage).toHaveAttribute('data-focus-loupe-window-width', '1');

    // A subsequent image click can zoom in again.
    await stage.click({ position: { x: cx, y: cy } });
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await expect(stage).toHaveAttribute('data-scale', '1');
    await expect.poll(
      async () => Number(await stage.getAttribute('data-focus-loupe-window-width')),
      { timeout: 15_000 },
    ).toBeCloseTo(0.25, 2);
  });
});
