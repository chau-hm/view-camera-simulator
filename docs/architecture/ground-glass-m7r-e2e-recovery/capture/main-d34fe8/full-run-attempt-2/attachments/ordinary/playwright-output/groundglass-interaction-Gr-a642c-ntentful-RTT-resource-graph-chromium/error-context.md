# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: groundglass-interaction.spec.ts >> Ground Glass interaction >> Architecture Rise: Reset view preserves the contentful RTT resource graph
- Location: src/tests/e2e/groundglass-interaction.spec.ts:22:3

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
  1   | import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
  2   | import { test, expect, type Locator } from '@playwright/test';
  3   | import { clickStageAt, readFreshElementBounds, readStageTransform } from './helpers/groundGlass';
  4   | 
  5   | // convenience factory for dynamic transformed-layer locator
  6   | const transformedLayerFor = (viewport: Locator) => () => viewport.locator('.groundglass-stage');
  7   | 
  8   | const readStageClientBox = (stage: Locator) => stage.evaluate((element) => {
  9   |   const panel = element as HTMLElement;
  10  |   const rect = panel.getBoundingClientRect();
  11  |   const scaleX = panel.offsetWidth > 0 ? rect.width / panel.offsetWidth : 1;
  12  |   const scaleY = panel.offsetHeight > 0 ? rect.height / panel.offsetHeight : 1;
  13  |   return {
  14  |     left: rect.left + panel.clientLeft * scaleX,
  15  |     top: rect.top + panel.clientTop * scaleY,
  16  |     width: panel.clientWidth * scaleX,
  17  |     height: panel.clientHeight * scaleY,
  18  |   };
  19  | });
  20  | 
  21  | test.describe('Ground Glass interaction', () => {
  22  |   test('Architecture Rise: Reset view preserves the contentful RTT resource graph', async ({ page }) => {
  23  |     test.setTimeout(180_000);
  24  |     const pageErrors: string[] = [];
  25  |     const rendererWarnings: string[] = [];
  26  |     page.on('pageerror', (error) => pageErrors.push(error.message));
  27  |     page.on('console', (message) => {
  28  |       if (isKnownFiberClockDeprecation(message)) return;
  29  |       const text = message.text();
  30  |       if (/GL Driver Message .*GPU stall due to ReadPixels/.test(text)) return;
  31  |       if (
  32  |         message.type() === 'error' ||
  33  |         (message.type() === 'warning' && /React|Three(?:\.js)?|WebGL|render target|disposed|context lost/i.test(text))
  34  |       ) {
  35  |         rendererWarnings.push(text);
  36  |       }
  37  |     });
  38  | 
  39  |     await page.goto('/simulator/free/architecture-rise?rttDiagnostics=1');
  40  |     const viewport = page.getByLabel('GroundGlassViewport');
  41  |     const stage = viewport.locator('[data-zoomed]');
  42  |     const rtt = viewport.getByTestId('ground-glass-rtt');
  43  |     const canvas = rtt.locator('canvas');
  44  |     const transformedLayer = viewport.locator('.groundglass-stage');
  45  |     const expectContentfulRtt = async () => {
  46  |       await expect(rtt).toHaveAttribute('data-rtt-raw-contentful', 'true', { timeout: 120_000 });
  47  |       await expect(rtt).toHaveAttribute('data-rtt-final-contentful', 'true', { timeout: 120_000 });
  48  |       expect(await rtt.getAttribute('data-rtt-sanity-error')).toBeNull();
  49  |     };
  50  |     const expectCurrentRequestPublished = async () => {
  51  |       await expect.poll(async () => {
  52  |         const requestId = await rtt.getAttribute('data-frame-request-id');
  53  |         const completedRequestId = await rtt.getAttribute('data-last-completed-request-id');
  54  |         const status = await rtt.getAttribute('data-frame-result-status');
  55  |         return Boolean(requestId && requestId === completedRequestId && status === 'completed');
  56  |       }, { timeout: 120_000 }).toBe(true);
  57  |       await expect(rtt).toHaveAttribute('data-mounted-renderer-family', 'webgl-renderer');
  58  |       await expect(rtt).toHaveAttribute('data-actual-execution-api', /^webgl2?$/);
  59  |     };
  60  |     const expectSameCanvas = async (canvasHandle: NonNullable<Awaited<ReturnType<typeof canvas.elementHandle>>>) => {
  61  |       await expect
  62  |         .poll(() =>
  63  |           page.evaluate(
  64  |             (node) =>
  65  |               node.isConnected &&
  66  |               document.querySelector('[data-testid="ground-glass-rtt"] canvas') === node,
  67  |             canvasHandle,
  68  |           ),
  69  |         )
  70  |         .toBe(true);
  71  |     };
  72  | 
> 73  |     await expect(viewport).toBeVisible();
      |                            ^ Error: expect(locator).toBeVisible() failed
  74  |     await expect(canvas).toHaveCount(1);
  75  |     await expectContentfulRtt();
  76  |     await expectCurrentRequestPublished();
  77  |     const canvasHandle = await canvas.elementHandle();
  78  |     if (!canvasHandle) throw new Error('Ground Glass Canvas element was not mounted');
  79  |     const initialGeneration = await rtt.getAttribute('data-rtt-resource-generation');
  80  |     const initialHostGeneration = await rtt.getAttribute('data-renderer-generation');
  81  |     const initialRequestId = await rtt.getAttribute('data-frame-request-id');
  82  |     const initialSanityState = await rtt.getAttribute('data-rtt-sanity-state');
  83  |     expect(initialGeneration).toBeTruthy();
  84  |     expect(initialHostGeneration).toBeTruthy();
  85  |     expect(initialRequestId).toBeTruthy();
  86  |     expect(initialSanityState).toBeTruthy();
  87  | 
  88  |     await viewport
  89  |       .getByRole('button', { name: 'Focus loupe · 4× Ground Glass view', exact: true })
  90  |       .click();
  91  |     await expect(stage).toHaveAttribute('data-zoomed', 'true');
  92  |     await expect(stage).toHaveAttribute('data-focus-loupe-scale', '4');
  93  |     await expect(stage).toHaveAttribute('data-presentation-css-scale', '1');
  94  |     await expect(stage).toHaveAttribute('data-scale', '1');
  95  |     await expect(stage).toHaveAttribute('data-focus-loupe-window-width', '0.25');
  96  |     await expect(stage).toHaveAttribute('data-focus-loupe-window-height', '0.25');
  97  |     await expect.poll(() => rtt.getAttribute('data-rtt-sampled-film-width-mm'), { timeout: 120_000 }).toBe('31.75');
  98  |     await expect.poll(() => rtt.getAttribute('data-frame-request-id'), { timeout: 120_000 }).not.toBe(initialRequestId);
  99  |     await expectCurrentRequestPublished();
  100 |     expect(await rtt.getAttribute('data-renderer-generation')).toBe(initialHostGeneration);
  101 |     await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).not.toBe(initialSanityState);
  102 |     await expectContentfulRtt();
  103 |     const stableLoupeSanityState = await rtt.getAttribute('data-rtt-sanity-state');
  104 |     expect(stableLoupeSanityState).not.toBe(initialSanityState);
  105 | 
  106 |     const box = await readFreshElementBounds(stage);
  107 |     const centerX = box.x + box.width / 2;
  108 |     const centerY = box.y + box.height / 2;
  109 |     await page.mouse.move(centerX, centerY);
  110 |     await page.mouse.down();
  111 |     await page.mouse.move(centerX + 60, centerY + 40, { steps: 6 });
  112 |     await page.mouse.up();
  113 |     await expect.poll(async () => {
  114 |       const panX = Number(await stage.getAttribute('data-inspection-pan-x'));
  115 |       const panY = Number(await stage.getAttribute('data-inspection-pan-y'));
  116 |       return Math.abs(panX) > 0 || Math.abs(panY) > 0;
  117 |     }).toBe(true);
  118 |     await expectCurrentRequestPublished();
  119 |     expect(await rtt.getAttribute('data-renderer-generation')).toBe(initialHostGeneration);
  120 | 
  121 |     await viewport
  122 |       .getByRole('button', { name: 'Reset Ground Glass view', exact: true })
  123 |       .click();
  124 |     await expect(stage).toHaveAttribute('data-zoomed', 'false');
  125 |     await expect(stage).toHaveAttribute('data-scale', '1');
  126 |     await expect(stage).toHaveAttribute('data-focus-loupe-window-width', '1');
  127 |     await expect(stage).toHaveAttribute('data-focus-loupe-window-height', '1');
  128 |     await expect(stage).toHaveAttribute('data-pan-x', '0');
  129 |     await expect(stage).toHaveAttribute('data-pan-y', '0');
  130 |     await expect(stage).toHaveAttribute('data-dragging', 'false');
  131 |     await expect(stage).toHaveAttribute('data-pointer-active', 'false');
  132 |     await expect(stage).toHaveAttribute('data-pointer-captured', 'false');
  133 |     await expect(transformedLayer).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  134 |     await expectCurrentRequestPublished();
  135 |     expect(await rtt.getAttribute('data-renderer-generation')).toBe(initialHostGeneration);
  136 |     await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).toBe(initialSanityState);
  137 |     expect(await rtt.getAttribute('data-rtt-resource-generation')).toBe(initialGeneration);
  138 |     await expectSameCanvas(canvasHandle);
  139 |     await expectContentfulRtt();
  140 | 
  141 |     for (let cycle = 0; cycle < 5; cycle += 1) {
  142 |       await viewport
  143 |         .getByRole('button', { name: 'Focus loupe · 4× Ground Glass view', exact: true })
  144 |         .click();
  145 |       await expect(stage).toHaveAttribute('data-zoomed', 'true');
  146 |       await expect(stage).toHaveAttribute('data-scale', '1');
  147 |       await expect(stage).toHaveAttribute('data-focus-loupe-scale', '4');
  148 |       await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).toBe(stableLoupeSanityState);
  149 |       await expectContentfulRtt();
  150 | 
  151 |       await viewport
  152 |         .getByRole('button', { name: 'Reset Ground Glass view', exact: true })
  153 |         .click();
  154 |       await expect(stage).toHaveAttribute('data-zoomed', 'false');
  155 |       await expect(stage).toHaveAttribute('data-scale', '1');
  156 |       await expect(stage).toHaveAttribute('data-pan-x', '0');
  157 |       await expect(stage).toHaveAttribute('data-pan-y', '0');
  158 |       await expect(transformedLayer).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  159 |       await expect.poll(() => rtt.getAttribute('data-rtt-sanity-state'), { timeout: 120_000 }).toBe(initialSanityState);
  160 |       expect(await rtt.getAttribute('data-rtt-resource-generation')).toBe(initialGeneration);
  161 |       await expectSameCanvas(canvasHandle);
  162 |       await expectContentfulRtt();
  163 |     }
  164 | 
  165 |     expect(pageErrors, `Uncaught page errors: ${pageErrors.join('\n')}`).toEqual([]);
  166 |     expect(rendererWarnings, `React/Three.js/WebGL warnings: ${rendererWarnings.join('\n')}`).toEqual([]);
  167 |   });
  168 | 
  169 |   test('Architecture Rise: off-center anchor, drag pan, short-click preservation, and immediate re-zoom', async ({ page }) => {
  170 |     // allow a longer timeout for this interaction-heavy test to tolerate renderer scheduling in CI/local
  171 |     test.setTimeout(120_000);
  172 |     await page.goto('/simulator/free/architecture-rise');
  173 | 
```