# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: groundglass-interaction.spec.ts >> Ground Glass interaction >> Focus Fundamentals: image zoom and explicit reset smoke test
- Location: src/tests/e2e/groundglass-interaction.spec.ts:312:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByLabel('GroundGlassViewport')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByLabel('GroundGlassViewport')

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  216 | 
  217 |     // drag from center by +60, +40 using real page.mouse
  218 |     const centerBox = await readFreshElementBounds(stage);
  219 |     const centerX = centerBox.x + centerBox.width / 2;
  220 |     const centerY = centerBox.y + centerBox.height / 2;
  221 |     await page.mouse.move(centerX, centerY);
  222 |     await page.mouse.down();
  223 |     await page.mouse.move(centerX - 60, centerY - 40, { steps: 6 });
  224 |     await page.mouse.up();
  225 | 
  226 |     // should remain zoomed and expose the pan action
  227 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  228 |     await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');
  229 | 
  230 |     const postInspectionPan = {
  231 |       x: await stage.getAttribute('data-inspection-pan-x'),
  232 |       y: await stage.getAttribute('data-inspection-pan-y'),
  233 |     };
  234 |     expect(postInspectionPan.x !== preInspectionPan.x || postInspectionPan.y !== preInspectionPan.y).toBeTruthy();
  235 |     await expect(transformedLayer()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  236 | 
  237 |     // assert fixed overlay visibility (preview label)
  238 |     const previewOverlay = viewport.getByText('Ground glass preview');
  239 |     await expect(previewOverlay).toBeVisible();
  240 |     // Ensure exactly one overlay exists before inspecting ancestry to avoid detached-element races
  241 |     await expect(previewOverlay).toHaveCount(1);
  242 |     const isInside = await previewOverlay.evaluate((el) => Boolean((el as Element).closest('.groundglass-stage')));
  243 |     expect(isInside).toBe(false);
  244 | 
  245 |     // An ordinary click on the zoomed image is a no-op and preserves the pan.
  246 |     const beforeShortClick = await readStageTransform(transformedLayer());
  247 |     await clickStageAt(page, stage, 0.5, 0.5);
  248 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  249 |     await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');
  250 |     expect(await readStageTransform(transformedLayer())).toEqual(beforeShortClick);
  251 | 
  252 |     // The explicit reset control is the only zoom-out affordance.
  253 |     await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
  254 |     await expect(stage).toHaveAttribute('data-zoomed', 'false');
  255 | 
  256 |     // A resized responsive stage maps the same relative pointer location to
  257 |     // the same normalized pan using its new client-box dimensions.
  258 |     await page.setViewportSize({ width: 900, height: 900 });
  259 |     await expect(stage).toBeVisible();
  260 |     expect(await rtt.getAttribute('data-renderer-generation')).toBe(initialHostGeneration);
  261 |     await stage.scrollIntoViewIfNeeded();
  262 |     const resizedClientBox = await readStageClientBox(stage);
  263 |     await page.mouse.click(
  264 |       resizedClientBox.left + resizedClientBox.width * 0.3,
  265 |       resizedClientBox.top + resizedClientBox.height * 0.6,
  266 |     );
  267 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  268 |     await expect.poll(async () => Number(await stage.getAttribute('data-normalized-pan-x'))).toBeCloseTo(0.4, 5);
  269 |     await expect.poll(async () => Number(await stage.getAttribute('data-normalized-pan-y'))).toBeCloseTo(-0.2, 5);
  270 |     await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
  271 |     await expect(stage).toHaveAttribute('data-zoomed', 'false');
  272 | 
  273 |     // read the presentation transform and assert identity — crop state resets separately.
  274 |     await expect.poll(async () => {
  275 |       const t = await readStageTransform(transformedLayer());
  276 |       return Math.abs(t.scaleX - 1) < 0.2 && Math.abs(t.translateX) <= 0.5 && Math.abs(t.translateY) <= 0.5;
  277 |     }, { timeout: 8000 }).toBeTruthy();
  278 | 
  279 |     // immediate re-zoom: click at 70% left, 65% top — obtain fresh geometry and use absolute page click
  280 |     const freshBox = await readFreshElementBounds(stage);
  281 |     await page.mouse.click(freshBox.x + freshBox.width * 0.7, freshBox.y + freshBox.height * 0.65);
  282 | 
  283 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  284 |     await expect(stage).toHaveAttribute('aria-label', 'Pan Ground Glass');
  285 | 
  286 |     // right-bottom click selects the corresponding physical film crop.
  287 |     await expect.poll(async () => {
  288 |       const scaleOk = Number(await stage.getAttribute('data-presentation-css-scale')) === 1;
  289 |       const uOk = Number(await stage.getAttribute('data-focus-loupe-center-u')) > 0.5;
  290 |       const vOk = Number(await stage.getAttribute('data-focus-loupe-center-v')) > 0.5;
  291 |       return scaleOk && uOk && vOk;
  292 |     }, { timeout: 8000 }).toBeTruthy();
  293 | 
  294 |     // repeated centered cycles (3x) using real Playwright clicks
  295 |     for (let i = 0; i < 3; i++) {
  296 |       // reset explicitly (a zoomed image click is intentionally inert)
  297 |       await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
  298 |       await expect(stage).toHaveAttribute('data-zoomed', 'false');
  299 |       await expect.poll(async () => {
  300 |         return Number(await stage.getAttribute('data-focus-loupe-window-width')) === 1;
  301 |       }, { timeout: 8000 }).toBeTruthy();
  302 | 
  303 |       // zoom in (center)
  304 |       await clickStageAt(page, stage, 0.5, 0.5);
  305 |       await expect(stage).toHaveAttribute('data-zoomed', 'true');
  306 |       await expect.poll(async () => {
  307 |         return Number(await stage.getAttribute('data-focus-loupe-window-width')) === 0.25;
  308 |       }, { timeout: 8000 }).toBeTruthy();
  309 |     }
  310 |   });
  311 | 
  312 |   test('Focus Fundamentals: image zoom and explicit reset smoke test', async ({ page }) => {
  313 |     test.setTimeout(90_000);
  314 |     await page.goto('/simulator/free/focus-fundamentals-two-targets');
  315 |     const viewport = page.getByLabel('GroundGlassViewport');
> 316 |     await expect(viewport).toBeVisible();
      |                            ^ Error: expect(locator).toBeVisible() failed
  317 |     const stage = viewport.locator('[data-zoomed]');
  318 |     await expect(stage).toBeVisible();
  319 | 
  320 |     const transformedLayer = transformedLayerFor(viewport);
  321 | 
  322 |     const box = await readFreshElementBounds(stage);
  323 |     const cx = Math.round(box.width / 2);
  324 |     const cy = Math.round(box.height / 2);
  325 | 
  326 |     // initial
  327 |     await expect(stage).toHaveAttribute('data-zoomed', 'false');
  328 | 
  329 |     // click 1
  330 |     await stage.click({ position: { x: cx, y: cy } });
  331 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  332 |     await expect(stage).toHaveAttribute('data-focus-loupe-scale', '4');
  333 |     await expect(stage).toHaveAttribute('data-presentation-css-scale', '1');
  334 |     await expect(stage).toHaveAttribute('data-scale', '1');
  335 |     await expect.poll(
  336 |       async () => Number(await stage.getAttribute('data-focus-loupe-window-width')),
  337 |       { timeout: 15_000 },
  338 |     ).toBeCloseTo(0.25, 2);
  339 |     await expect(transformedLayer()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  340 | 
  341 |     // A second image click does not reset a zoomed stage.
  342 |     await stage.click({ position: { x: cx, y: cy } });
  343 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  344 |     await expect(stage).toHaveAttribute('data-scale', '1');
  345 |     await expect.poll(
  346 |       async () => Number(await stage.getAttribute('data-focus-loupe-window-width')),
  347 |       { timeout: 15_000 },
  348 |     ).toBeCloseTo(0.25, 2);
  349 | 
  350 |     // The explicit Reset View control restores the identity transform.
  351 |     await viewport.getByRole('button', { name: 'Reset Ground Glass view', exact: true }).click();
  352 |     await expect(stage).toHaveAttribute('data-zoomed', 'false');
  353 |     await expect(stage).toHaveAttribute('data-scale', '1');
  354 |     await expect(stage).toHaveAttribute('data-focus-loupe-window-width', '1');
  355 | 
  356 |     // A subsequent image click can zoom in again.
  357 |     await stage.click({ position: { x: cx, y: cy } });
  358 |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  359 |     await expect(stage).toHaveAttribute('data-scale', '1');
  360 |     await expect.poll(
  361 |       async () => Number(await stage.getAttribute('data-focus-loupe-window-width')),
  362 |       { timeout: 15_000 },
  363 |     ).toBeCloseTo(0.25, 2);
  364 |   });
  365 | });
  366 | 
```