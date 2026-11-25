# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: viewport-learning-overlay.spec.ts >> Scene-local learning drawer leaves the paired workspace layout intact
- Location: src/tests/e2e/viewport-learning-overlay.spec.ts:28:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('learning-overlay-panel')
Expected: "peek"
Received: "transient"
Timeout:  2000ms

Call log:
  - Expect "toHaveAttribute" with timeout 2000ms
  - waiting for getByTestId('learning-overlay-panel')

```

```yaml
- region "Task and Feedback":
  - button "Open Task and Feedback" [expanded]: Task and Feedback
  - group "Task and Feedback views"
  - button "Keep Task and Feedback open"
  - button "Close Task and Feedback"
  - region "Task"
```

# Test source

```ts
  1   | import { expect, test, type Locator } from "@playwright/test";
  2   | import {
  3   |   expectLearningFeedbackCompleted,
  4   |   getLearningDrawer,
  5   |   getLearningOverlay,
  6   |   getLearningRail,
  7   |   openLearningDrawer,
  8   |   openLearningFeedback,
  9   | } from "./helpers/learningOverlay";
  10  | import { setStepRangeInput } from "./helpers/stepRangeInput";
  11  |
  12  | type Bounds = {
  13  |   x: number;
  14  |   y: number;
  15  |   width: number;
  16  |   height: number;
  17  | };
  18  |
  19  | const requireBounds = async (locator: Locator, label: string): Promise<Bounds> => {
  20  |   const bounds = await locator.boundingBox();
  21  |   if (!bounds) throw new Error(`${label} bounds unavailable`);
  22  |   return bounds;
  23  | };
  24  |
  25  | const right = (bounds: Bounds) => bounds.x + bounds.width;
  26  | const bottom = (bounds: Bounds) => bounds.y + bounds.height;
  27  |
  28  | test("Scene-local learning drawer leaves the paired workspace layout intact", async ({ page }) => {
  29  |   test.setTimeout(120_000);
  30  |   await page.setViewportSize({ width: 1440, height: 1000 });
  31  |   await page.goto("/simulator/guided/table-tilt/tilt-01");
  32  |
  33  |   const learning = getLearningOverlay(page);
  34  |   const rail = getLearningRail(page);
  35  |   const drawer = getLearningDrawer(page);
  36  |   const sceneCard = page
  37  |     .locator(".simulator-card")
  38  |     .filter({ has: page.getByRole("heading", { name: "3D Scene", exact: true }) });
  39  |   const stage = page.locator(".scene-viewport-stage");
  40  |   const groundGlass = page.getByLabel("GroundGlassColumn");
  41  |   const focusDistribution = page.getByTestId("focus-distribution-panel");
  42  |
  43  |   await expect(page.getByRole("heading", { name: "3D Scene", exact: true })).toBeVisible();
  44  |   await expect(focusDistribution).toBeVisible();
  45  |   await expect(page.getByTestId("current-settings-readout")).toHaveCount(0);
  46  |   await expect(page.getByText("Current Settings", { exact: true })).toHaveCount(0);
  47  |   await expect(page.locator(".simulator-primary-info-grid")).toHaveCount(0);
  48  |   await expect(rail).toBeVisible();
  49  |   await expect(drawer).not.toBeVisible();
  50  |
  51  |   const sceneBefore = await requireBounds(sceneCard, "Scene card");
  52  |   const groundGlassBefore = await requireBounds(groundGlass, "Ground Glass card");
  53  |   await rail.click();
  54  |   await expect(drawer).toBeVisible();
  55  |   await expect(drawer).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  56  |
  57  |   const stageBounds = await requireBounds(stage, "Scene stage");
  58  |   const drawerBounds = await requireBounds(drawer, "Learning drawer");
  59  |   expect(drawerBounds.x).toBeGreaterThanOrEqual(stageBounds.x - 1);
  60  |   expect(drawerBounds.y).toBeGreaterThanOrEqual(stageBounds.y - 1);
  61  |   expect(drawerBounds.x + drawerBounds.width).toBeLessThanOrEqual(stageBounds.x + stageBounds.width + 1);
  62  |   expect(drawerBounds.y + drawerBounds.height).toBeLessThanOrEqual(stageBounds.y + stageBounds.height + 1);
  63  |
  64  |   const pinButton = page.getByRole("button", { name: "Keep Task and Feedback open", exact: true });
  65  |   const closeButton = page.getByRole("button", { name: "Close Task and Feedback", exact: true });
  66  |   await expect(pinButton).toHaveAttribute("title", "Keep Task and Feedback open");
  67  |   await expect(pinButton.locator(".material-symbols-outlined")).toHaveText("push_pin");
  68  |   await expect(pinButton.locator("span:not(.material-symbols-outlined)")).toHaveCount(0);
  69  |   await expect(closeButton).toHaveAttribute("title", "Close Task and Feedback");
  70  |   await expect(closeButton.locator(".material-symbols-outlined")).toHaveText("close");
  71  |   await expect(closeButton.locator("span:not(.material-symbols-outlined)")).toHaveCount(0);
  72  |
  73  |   const sceneAfter = await requireBounds(sceneCard, "Scene card after opening drawer");
  74  |   const groundGlassAfter = await requireBounds(groundGlass, "Ground Glass card after opening drawer");
  75  |   expect(sceneAfter.x).toBeCloseTo(sceneBefore.x, 5);
  76  |   expect(sceneAfter.y).toBeCloseTo(sceneBefore.y, 5);
  77  |   expect(sceneAfter.width).toBeCloseTo(sceneBefore.width, 5);
  78  |   expect(sceneAfter.height).toBeCloseTo(sceneBefore.height, 5);
  79  |   expect(groundGlassAfter.x).toBeCloseTo(groundGlassBefore.x, 5);
  80  |   expect(groundGlassAfter.y).toBeCloseTo(groundGlassBefore.y, 5);
  81  |   expect(groundGlassAfter.width).toBeCloseTo(groundGlassBefore.width, 5);
  82  |   expect(groundGlassAfter.height).toBeCloseTo(groundGlassBefore.height, 5);
  83  |
  84  |   const outsidePoint = {
  85  |     x: Math.min(stageBounds.x + stageBounds.width - 2, drawerBounds.x + drawerBounds.width + 8),
  86  |     y: stageBounds.y + stageBounds.height * 0.55,
  87  |   };
  88  |   await page.getByRole("button", { name: "Scene", exact: true }).focus();
  89  |   await page.mouse.move(outsidePoint.x, outsidePoint.y);
> 90  |   await expect(learning).toHaveAttribute("data-drawer-state", "peek", { timeout: 2_000 });
      |                          ^ Error: expect(locator).toHaveAttribute(expected) failed
  91  |   await expect(drawer).not.toBeVisible({ timeout: 2_000 });
  92  |
  93  |   await rail.click();
  94  |   await expect(drawer).toBeVisible();
  95  |   await page.waitForTimeout(220);
  96  |   const reopenedDrawerBounds = await requireBounds(drawer, "Reopened learning drawer");
  97  |   await page.mouse.move(reopenedDrawerBounds.x + reopenedDrawerBounds.width / 2, reopenedDrawerBounds.y + 24);
  98  |   await page.getByRole("button", { name: "Keep Task and Feedback open" }).click();
  99  |   await page.mouse.move(groundGlassAfter.x + groundGlassAfter.width / 2, groundGlassAfter.y + 24);
  100 |   await expect(drawer).toBeVisible();
  101 |
  102 |   await page.getByRole("button", { name: "Allow Task and Feedback to auto-hide" }).click();
  103 |   await page.getByRole("button", { name: "Close Task and Feedback" }).click();
  104 |   await expect(drawer).not.toBeVisible({ timeout: 2_000 });
  105 |   await expect(rail).toHaveAttribute("aria-expanded", "false");
  106 |   await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  107 | });
  108 |
  109 | test("learning drawer supports keyboard focus and internal scrolling without changing Task/Feedback content", async ({ page }) => {
  110 |   test.setTimeout(120_000);
  111 |   await page.setViewportSize({ width: 1024, height: 900 });
  112 |   await page.goto("/simulator/guided/oblique-architecture/oblique-rise-01?lesson=1");
  113 |
  114 |   const drawer = getLearningDrawer(page);
  115 |   const rail = getLearningRail(page);
  116 |   await openLearningDrawer(page);
  117 |   await page.waitForTimeout(220);
  118 |
  119 |   const content = drawer.locator(".learning-overlay-panel__content");
  120 |   const contentMetrics = await content.evaluate((element) => ({
  121 |     clientHeight: element.clientHeight,
  122 |     scrollHeight: element.scrollHeight,
  123 |   }));
  124 |   expect(contentMetrics.scrollHeight).toBeGreaterThan(contentMetrics.clientHeight);
  125 |   const initialScrollTop = await content.evaluate((element) => element.scrollTop);
  126 |   await content.hover();
  127 |   await page.mouse.wheel(0, 800);
  128 |   await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(initialScrollTop);
  129 |
  130 |   const feedback = drawer.getByRole("button", { name: "Feedback", exact: true });
  131 |   await feedback.focus();
  132 |   await page.keyboard.press("Enter");
  133 |   await expect(drawer.getByTestId("learning-overlay-feedback-view")).toBeVisible();
  134 |   await page.keyboard.press("Escape");
  135 |   await expect(drawer).not.toBeVisible({ timeout: 2_000 });
  136 |   await expect(rail).toBeFocused();
  137 |
  138 |   await rail.click();
  139 |   await expect(drawer).toBeVisible();
  140 |   await drawer.getByRole("button", { name: "Task", exact: true }).focus();
  141 |   await expect(drawer).toBeVisible();
  142 | });
  143 |
  144 | test("keyboard focus remains visible on the rail while the drawer opens transiently", async ({ page }) => {
  145 |   test.setTimeout(120_000);
  146 |   await page.setViewportSize({ width: 1440, height: 1000 });
  147 |   await page.goto("/simulator/guided/table-tilt/tilt-01");
  148 |
  149 |   const learning = getLearningOverlay(page);
  150 |   const rail = getLearningRail(page);
  151 |   const drawer = getLearningDrawer(page);
  152 |   const stage = page.locator(".scene-viewport-stage");
  153 |
  154 |   await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  155 |   await expect(drawer).not.toBeVisible();
  156 |
  157 |   await page.evaluate(() => {
  158 |     if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  159 |   });
  160 |   for (let tabCount = 0; tabCount < 80; tabCount += 1) {
  161 |     if (await rail.evaluate((element) => element === document.activeElement)) break;
  162 |     await page.keyboard.press("Tab");
  163 |   }
  164 |   await expect(learning).toHaveAttribute("data-drawer-state", "transient");
  165 |   await expect(rail).toBeFocused();
  166 |   await expect(rail).toHaveCSS("opacity", "1");
  167 |   await expect(drawer).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  168 |   const railBounds = await requireBounds(rail, "Focused learning rail");
  169 |   expect(railBounds.width).toBeGreaterThan(0);
  170 |   expect(railBounds.height).toBeGreaterThan(0);
  171 |   const focusedRailIsTopmost = await page.evaluate(({ x, y }) => {
  172 |     const railElement = document.querySelector<HTMLElement>(".learning-overlay-panel__rail");
  173 |     const topmostElement = document.elementFromPoint(x, y);
  174 |     return Boolean(railElement && topmostElement && (topmostElement === railElement || railElement.contains(topmostElement)));
  175 |   }, {
  176 |     x: railBounds.x + railBounds.width / 2,
  177 |     y: railBounds.y + railBounds.height / 2,
  178 |   });
  179 |   expect(focusedRailIsTopmost).toBe(true);
  180 |
  181 |   const stageBounds = await requireBounds(stage, "Scene stage");
  182 |   const drawerBounds = await requireBounds(drawer, "Learning drawer");
  183 |   const outsidePoint = {
  184 |     x: stageBounds.x + stageBounds.width - 12,
  185 |     y: stageBounds.y + stageBounds.height / 2,
  186 |   };
  187 |   expect(outsidePoint.x).toBeGreaterThan(drawerBounds.x + drawerBounds.width);
  188 |   await page.mouse.move(outsidePoint.x, outsidePoint.y);
  189 |   await page.waitForTimeout(500);
  190 |   await expect(learning).toHaveAttribute("data-drawer-state", "transient");
```