# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: simulator-header.spec.ts >> wraps the lesson context before it becomes unusably narrow
- Location: src/tests/e2e/simulator-header.spec.ts:42:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.simulator-header').locator('.app-brand')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.simulator-header').locator('.app-brand')

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  |
  3  | const horizontalOverflow = () =>
  4  |   document.documentElement.scrollWidth - document.documentElement.clientWidth;
  5  |
  6  | test("keeps the active lesson context between the brand and desktop actions", async ({ page }) => {
  7  |   await page.setViewportSize({ width: 1280, height: 900 });
  8  |   await page.goto("/simulator/free/understanding-camera-movements");
  9  |
  10 |   const header = page.locator(".simulator-header");
  11 |   const context = header.locator(".simulator-header__context");
  12 |   const actions = header.locator(".sim-header-actions");
  13 |
  14 |   await expect(context.locator(".simulator-header__lesson-title")).toHaveText("Understanding Camera Movements");
  15 |   await expect(context.locator(".simulator-header__lesson-context")).toHaveText("Free Exploration");
  16 |   await expect(header.getByRole("link", { name: "All Scenes", exact: true })).toBeVisible();
  17 |   await expect(header.getByRole("combobox", { name: "Language", exact: true })).toBeVisible();
  18 |
  19 |   const contextBounds = await context.boundingBox();
  20 |   const actionsBounds = await actions.boundingBox();
  21 |   expect(contextBounds).not.toBeNull();
  22 |   expect(actionsBounds).not.toBeNull();
  23 |   expect(contextBounds!.x + contextBounds!.width).toBeLessThanOrEqual(actionsBounds!.x + 1);
  24 |   await expect.poll(() => page.evaluate(horizontalOverflow)).toBeLessThanOrEqual(1);
  25 | });
  26 |
  27 | test("keeps the lesson context and global actions reachable in the narrow header", async ({ page }) => {
  28 |   await page.setViewportSize({ width: 480, height: 900 });
  29 |   await page.goto("/simulator/free/understanding-camera-movements");
  30 |
  31 |   const header = page.locator(".simulator-header");
  32 |   const context = header.locator(".simulator-header__context");
  33 |
  34 |   await expect(context.locator(".simulator-header__lesson-title")).toBeVisible();
  35 |   await expect(context.locator(".simulator-header__lesson-title")).toHaveText("Understanding Camera Movements");
  36 |   await expect(context.locator(".simulator-header__lesson-context")).toHaveText("Free Exploration");
  37 |   await expect(header.getByRole("link", { name: "All Scenes", exact: true })).toBeVisible();
  38 |   await expect(header.getByRole("combobox", { name: "Language", exact: true })).toBeVisible();
  39 |   await expect.poll(() => page.evaluate(horizontalOverflow)).toBeLessThanOrEqual(1);
  40 | });
  41 |
  42 | test("wraps the lesson context before it becomes unusably narrow", async ({ page }) => {
  43 |   await page.setViewportSize({ width: 560, height: 900 });
  44 |   await page.goto("/simulator/free/understanding-camera-movements");
  45 |
  46 |   const header = page.locator(".simulator-header");
  47 |   const brand = header.locator(".app-brand");
  48 |   const context = header.locator(".simulator-header__context");
  49 |   const title = context.locator(".simulator-header__lesson-title");
  50 |   const actions = header.locator(".sim-header-actions");
  51 |
> 52 |   await expect(brand).toBeVisible();
     |                       ^ Error: expect(locator).toBeVisible() failed
  53 |   await expect(title).toBeVisible();
  54 |   await expect(context.locator(".simulator-header__lesson-context")).toHaveText("Free Exploration");
  55 |   await expect(header.getByRole("link", { name: "All Scenes", exact: true })).toBeVisible();
  56 |   await expect(header.getByRole("combobox", { name: "Language", exact: true })).toBeVisible();
  57 |
  58 |   const contextBounds = await context.boundingBox();
  59 |   const titleBounds = await title.boundingBox();
  60 |   const brandBounds = await brand.boundingBox();
  61 |   const actionsBounds = await actions.boundingBox();
  62 |   const headerBounds = await header.boundingBox();
  63 |   expect(contextBounds).not.toBeNull();
  64 |   expect(titleBounds).not.toBeNull();
  65 |   expect(brandBounds).not.toBeNull();
  66 |   expect(actionsBounds).not.toBeNull();
  67 |   expect(headerBounds).not.toBeNull();
  68 |
  69 |   expect(contextBounds!.width).toBeGreaterThan(140);
  70 |   expect(titleBounds!.width).toBeGreaterThan(140);
  71 |   const firstRowBottom = Math.max(
  72 |     brandBounds!.y + brandBounds!.height,
  73 |     actionsBounds!.y + actionsBounds!.height,
  74 |   );
  75 |   expect(contextBounds!.y).toBeGreaterThanOrEqual(firstRowBottom - 1);
  76 |   expect(contextBounds!.x).toBeGreaterThanOrEqual(headerBounds!.x);
  77 |   expect(contextBounds!.x + contextBounds!.width).toBeLessThanOrEqual(headerBounds!.x + headerBounds!.width);
  78 |   await expect.poll(() => page.evaluate(horizontalOverflow)).toBeLessThanOrEqual(1);
  79 | });
  80 |
```