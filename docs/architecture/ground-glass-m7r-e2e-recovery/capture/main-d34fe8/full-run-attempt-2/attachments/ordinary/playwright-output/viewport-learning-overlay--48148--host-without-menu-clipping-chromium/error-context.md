# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: viewport-learning-overlay.spec.ts >> constrained desktop Scenes move overlay controls below the host without menu clipping
- Location: src/tests/e2e/viewport-learning-overlay.spec.ts:329:1

# Error details

```
Error: expect(locator).toHaveCSS(expected) failed

Locator:  locator('.scene-overlay-controls-wrap')
Expected: "static"
Received: "absolute"
Timeout:  5000ms

Call log:
  - Expect "toHaveCSS" with timeout 5000ms
  - waiting for locator('.scene-overlay-controls-wrap')
    2 × locator resolved to <div class="scene-overlay-controls-wrap">…</div>
      - unexpected value "absolute"

```

```yaml
- button "View overlays"
```

# Test source

```ts
  243 |   const feedbackButton = drawer.getByRole("button", { name: "Feedback", exact: true });
  244 |   await taskButton.focus();
  245 |   await expect(taskButton).toBeFocused();
  246 |   await page.keyboard.press("Tab");
  247 |   await expect(feedbackButton).toBeFocused();
  248 | 
  249 |   const feedback = await openLearningFeedback(page);
  250 |   await expect(feedback).toContainText("Live observation");
  251 |   await expect(learning).toHaveAttribute("data-drawer-state", "flow");
  252 |   await expect(rail).toHaveCSS("display", "none");
  253 |   expect(await rail.boundingBox()).toBeNull();
  254 |   const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  255 |   expect(hasHorizontalOverflow).toBe(false);
  256 | });
  257 | 
  258 | test("desktop learning rail and Scene overlay controls keep separate visual anchors", async ({ page }) => {
  259 |   test.setTimeout(120_000);
  260 |   await page.setViewportSize({ width: 1024, height: 900 });
  261 |   await page.goto("/simulator/free/architecture-rise");
  262 |   await page.getByRole("combobox", { name: "Language" }).selectOption("zh-HK");
  263 | 
  264 |   const rail = getLearningRail(page);
  265 |   const railLabel = rail.locator(".learning-overlay-panel__rail-label");
  266 |   const trigger = page.getByRole("button", { name: "檢視疊加層", exact: true });
  267 |   const stage = page.locator(".scene-viewport-stage");
  268 |   await expect(rail).toBeVisible();
  269 |   await expect(rail).toHaveAccessibleName("開啟任務及回饋");
  270 |   await expect(railLabel).toHaveText("任務及回饋");
  271 |   await expect(railLabel).toHaveCSS("writing-mode", "vertical-rl");
  272 |   await expect(railLabel).toHaveCSS("text-orientation", "mixed");
  273 |   await expect(railLabel).toHaveCSS("transform", "none");
  274 |   await expect(trigger).toBeVisible();
  275 | 
  276 |   const railBounds = await requireBounds(rail, "Learning rail");
  277 |   const triggerBounds = await requireBounds(trigger, "View overlays trigger");
  278 |   expect(railBounds.width).toBeGreaterThan(36);
  279 |   expect(railBounds.height).toBeGreaterThan(112);
  280 |   await expect(railLabel).toHaveCSS("font-size", "12px");
  281 |   await expect(railLabel).toHaveCSS("font-weight", "800");
  282 |   const railSurface = await rail.evaluate((element) => {
  283 |     const style = getComputedStyle(element);
  284 |     return {
  285 |       borderColor: style.borderTopColor,
  286 |       backgroundImage: style.backgroundImage,
  287 |       boxShadow: style.boxShadow,
  288 |     };
  289 |   });
  290 |   expect(railSurface.borderColor).toContain("143, 234, 255");
  291 |   expect(railSurface.backgroundImage).toContain("linear-gradient");
  292 |   expect(railSurface.boxShadow).toContain("53, 200, 237");
  293 |   expect(triggerBounds.x).toBeGreaterThan(railBounds.x + railBounds.width);
  294 | 
  295 |   await trigger.click();
  296 |   await expect(trigger).toHaveAttribute("aria-expanded", "true");
  297 |   const menu = page.locator(".scene-overlay-menu__panel");
  298 |   await expect(menu).toBeVisible();
  299 |   const menuBounds = await requireBounds(menu, "View overlays menu");
  300 |   const menuContentMetrics = await menu.locator(".scene-overlay-controls").evaluate((element) => ({
  301 |     clientWidth: element.clientWidth,
  302 |     scrollWidth: element.scrollWidth,
  303 |   }));
  304 |   expect(menuContentMetrics.scrollWidth).toBeLessThanOrEqual(menuContentMetrics.clientWidth + 1);
  305 |   expect(Math.abs(menuBounds.x - triggerBounds.x)).toBeLessThanOrEqual(1);
  306 |   expect(menuBounds.y).toBeGreaterThanOrEqual(triggerBounds.y + triggerBounds.height);
  307 |   expect(menuBounds.y).toBeLessThan(triggerBounds.y + triggerBounds.height + 16);
  308 | 
  309 |   const triggerIsTopmost = await page.evaluate(({ x, y }) => {
  310 |     const triggerElement = document.querySelector<HTMLButtonElement>(".scene-overlay-menu__trigger");
  311 |     const topmostElement = document.elementFromPoint(x, y);
  312 |     return Boolean(
  313 |       triggerElement &&
  314 |         topmostElement &&
  315 |         (topmostElement === triggerElement || triggerElement.contains(topmostElement)),
  316 |     );
  317 |   }, {
  318 |     x: triggerBounds.x + triggerBounds.width / 2,
  319 |     y: triggerBounds.y + triggerBounds.height / 2,
  320 |   });
  321 |   expect(triggerIsTopmost).toBe(true);
  322 |   await page.keyboard.press("Escape");
  323 |   await expect(trigger).toHaveAttribute("aria-expanded", "false");
  324 | 
  325 |   const stageBounds = await requireBounds(stage, "Scene stage");
  326 |   expect(triggerBounds.x + triggerBounds.width).toBeLessThanOrEqual(stageBounds.x + stageBounds.width);
  327 | });
  328 | 
  329 | test("constrained desktop Scenes move overlay controls below the host without menu clipping", async ({ page }) => {
  330 |   test.setTimeout(120_000);
  331 |   await page.setViewportSize({ width: 920, height: 900 });
  332 |   await page.goto("/simulator/free/architecture-rise");
  333 | 
  334 |   const stage = page.locator(".scene-viewport-stage");
  335 |   const host = page.locator(".scene-viewport-host");
  336 |   const controlsWrap = page.locator(".scene-overlay-controls-wrap");
  337 |   const rail = getLearningRail(page);
  338 |   const trigger = page.getByRole("button", { name: "View overlays", exact: true });
  339 |   const expand = host.locator(".btn--viewport-action");
  340 |   await expect(rail).toBeVisible();
  341 |   await expect(trigger).toBeVisible();
  342 |   await expect(expand).toBeVisible();
> 343 |   await expect(controlsWrap).toHaveCSS("position", "static");
      |                              ^ Error: expect(locator).toHaveCSS(expected) failed
  344 | 
  345 |   const [railBounds, triggerBounds, expandBounds, hostBounds] = await Promise.all([
  346 |     requireBounds(rail, "Learning rail"),
  347 |     requireBounds(trigger, "View overlays trigger"),
  348 |     requireBounds(expand, "Scene expand button"),
  349 |     requireBounds(host, "Scene host"),
  350 |   ]);
  351 |   expect(triggerBounds.y).toBeGreaterThanOrEqual(bottom(hostBounds));
  352 |   expect(triggerBounds.x).toBeGreaterThanOrEqual(hostBounds.x);
  353 |   expect(right(triggerBounds)).toBeLessThanOrEqual(right(hostBounds));
  354 | 
  355 |   const rectanglesIntersect = (first: Bounds, second: Bounds) =>
  356 |     !(
  357 |       right(first) <= second.x ||
  358 |       right(second) <= first.x ||
  359 |       bottom(first) <= second.y ||
  360 |       bottom(second) <= first.y
  361 |     );
  362 |   expect(rectanglesIntersect(railBounds, triggerBounds)).toBe(false);
  363 |   expect(rectanglesIntersect(triggerBounds, expandBounds)).toBe(false);
  364 | 
  365 |   const triggerIsTopmost = await page.evaluate(({ x, y }) => {
  366 |     const triggerElement = document.querySelector<HTMLButtonElement>(".scene-overlay-menu__trigger");
  367 |     const topmostElement = document.elementFromPoint(x, y);
  368 |     return Boolean(
  369 |       triggerElement &&
  370 |         topmostElement &&
  371 |         (topmostElement === triggerElement || triggerElement.contains(topmostElement)),
  372 |     );
  373 |   }, {
  374 |     x: triggerBounds.x + triggerBounds.width / 2,
  375 |     y: triggerBounds.y + triggerBounds.height / 2,
  376 |   });
  377 |   expect(triggerIsTopmost).toBe(true);
  378 | 
  379 |   await trigger.click();
  380 |   const menu = page.locator(".scene-overlay-menu__panel");
  381 |   await expect(menu).toBeVisible();
  382 |   await expect(menu).toHaveCSS("position", "static");
  383 |   const [menuBounds, openStageBounds] = await Promise.all([
  384 |     requireBounds(menu, "Constrained View overlays menu"),
  385 |     requireBounds(stage, "Expanded Scene stage"),
  386 |   ]);
  387 |   expect(menuBounds.x).toBeGreaterThanOrEqual(openStageBounds.x - 1);
  388 |   expect(right(menuBounds)).toBeLessThanOrEqual(right(openStageBounds) + 1);
  389 |   expect(menuBounds.y).toBeGreaterThanOrEqual(bottom(triggerBounds));
  390 |   expect(menuBounds.y).toBeLessThan(bottom(triggerBounds) + 16);
  391 |   expect(rectanglesIntersect(menuBounds, expandBounds)).toBe(false);
  392 | 
  393 |   const menuContentMetrics = await menu.locator(".scene-overlay-controls").evaluate((element) => ({
  394 |     clientWidth: element.clientWidth,
  395 |     scrollWidth: element.scrollWidth,
  396 |   }));
  397 |   expect(menuContentMetrics.scrollWidth).toBeLessThanOrEqual(menuContentMetrics.clientWidth + 1);
  398 |   const menuTriggerIsTopmost = await page.evaluate(({ x, y }) => {
  399 |     const triggerElement = document.querySelector<HTMLButtonElement>(".scene-overlay-menu__trigger");
  400 |     const topmostElement = document.elementFromPoint(x, y);
  401 |     return Boolean(
  402 |       triggerElement &&
  403 |         topmostElement &&
  404 |         (topmostElement === triggerElement || triggerElement.contains(topmostElement)),
  405 |     );
  406 |   }, {
  407 |     x: triggerBounds.x + triggerBounds.width / 2,
  408 |     y: triggerBounds.y + triggerBounds.height / 2,
  409 |   });
  410 |   expect(menuTriggerIsTopmost).toBe(true);
  411 |   const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  412 |   expect(hasHorizontalOverflow).toBe(false);
  413 | });
  414 | 
  415 | test("Ground Glass expansion keeps one bounded learning rail and drawer", async ({ page }) => {
  416 |   test.setTimeout(120_000);
  417 |   await page.setViewportSize({ width: 1440, height: 1000 });
  418 |   await page.goto("/simulator/guided/architecture-rise/rise-01");
  419 | 
  420 |   const learning = getLearningOverlay(page);
  421 |   const rail = getLearningRail(page);
  422 |   const drawer = getLearningDrawer(page);
  423 |   const sceneHeading = page.getByRole("heading", { name: "3D Scene", exact: true });
  424 |   const frame = page.getByLabel("GroundGlassViewport");
  425 |   const expand = page.getByRole("button", { name: "Expand Ground Glass" });
  426 | 
  427 |   await expect(sceneHeading).toBeVisible();
  428 |   await expect(rail).toBeVisible();
  429 |   await expect(page.getByTestId("learning-overlay-panel")).toHaveCount(1);
  430 |   await expand.click();
  431 | 
  432 |   const restore = page.getByRole("button", { name: "Restore Ground Glass" });
  433 |   await expect(restore).toBeFocused();
  434 |   await expect(sceneHeading).toHaveCount(0);
  435 |   await expect(frame).toBeVisible();
  436 |   await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  437 |   await expect(rail).toBeVisible();
  438 |   await expect(page.getByTestId("learning-overlay-panel")).toHaveCount(1);
  439 | 
  440 |   const [frameBounds, railBounds, restoreBounds] = await Promise.all([
  441 |     requireBounds(frame, "Expanded Ground Glass frame"),
  442 |     requireBounds(rail, "Expanded Ground Glass learning rail"),
  443 |     requireBounds(restore, "Ground Glass restore button"),
```