# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: viewport-learning-overlay.spec.ts >> Ground Glass expansion keeps one bounded learning rail and drawer
- Location: src/tests/e2e/viewport-learning-overlay.spec.ts:415:1

# Error details

```
Error: expect(locator).toHaveCSS(expected) failed

Locator:  getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')
Expected: "matrix(1, 0, 0, 1, 0, 0)"
Received: "matrix(1, 0, 0, 1, -388, 0)"
Timeout:  5000ms

Call log:
  - Expect "toHaveCSS" with timeout 5000ms
  - waiting for getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')
    - locator resolved to <div id="_r_q_-drawer" aria-hidden="false" data-testid="learning-overlay-drawer" class="learning-overlay-panel__drawer">…</div>
    - unexpected value "matrix(1, 0, 0, 1, -388, 0)"

```

```yaml
- group "Task and Feedback views":
  - button "Task" [pressed]
  - button "Feedback"
- button "Keep Task and Feedback open"
- button "Close Task and Feedback"
- region "Task":
  - text: Guided task
  - heading "Frame the building with Front Rise" [level=3]
  - paragraph: Keep the camera level and use Front Rise to include the building top without changing the whole-camera viewpoint.
  - strong: "Allowed controls:"
  - text: Front RiseFocusAperture2D Geometry
  - group: View requirements
```

# Test source

```ts
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
  444 |   ]);
  445 |   expect(railBounds.x).toBeGreaterThanOrEqual(frameBounds.x - 1);
  446 |   expect(railBounds.y).toBeGreaterThanOrEqual(frameBounds.y - 1);
  447 |   expect(right(railBounds)).toBeLessThanOrEqual(right(frameBounds) + 1);
  448 |   expect(bottom(railBounds)).toBeLessThanOrEqual(bottom(frameBounds) + 1);
  449 |   const rectanglesIntersect = (first: Bounds, second: Bounds) =>
  450 |     !(right(first) <= second.x || right(second) <= first.x || bottom(first) <= second.y || bottom(second) <= first.y);
  451 |   expect(rectanglesIntersect(railBounds, restoreBounds)).toBe(false);
  452 |   const restoreIsTopmost = await page.evaluate(({ x, y }) => {
  453 |     const restoreElement = document.querySelector<HTMLButtonElement>('[aria-label="Restore Ground Glass"]');
  454 |     const topmostElement = document.elementFromPoint(x, y);
  455 |     return Boolean(
  456 |       restoreElement &&
  457 |         topmostElement &&
  458 |         (topmostElement === restoreElement || restoreElement.contains(topmostElement)),
  459 |     );
  460 |   }, {
  461 |     x: restoreBounds.x + restoreBounds.width / 2,
  462 |     y: restoreBounds.y + restoreBounds.height / 2,
  463 |   });
  464 |   expect(restoreIsTopmost).toBe(true);
  465 | 
  466 |   await rail.click();
  467 |   await expect(learning).toHaveAttribute("data-drawer-state", "transient");
  468 |   await expect(drawer).toBeVisible();
> 469 |   await expect(drawer).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
      |                        ^ Error: expect(locator).toHaveCSS(expected) failed
  470 |   await expect(drawer.getByTestId("learning-overlay-task-view")).toBeVisible();
  471 |   await expect(sceneHeading).toHaveCount(0);
  472 |   await expect(restore).toBeVisible();
  473 | 
  474 |   const [drawerBounds, frameAfterOpenBounds, restoreAfterOpenBounds] = await Promise.all([
  475 |     requireBounds(drawer, "Expanded Ground Glass learning drawer"),
  476 |     requireBounds(frame, "Expanded Ground Glass frame after opening drawer"),
  477 |     requireBounds(restore, "Ground Glass restore button after opening drawer"),
  478 |   ]);
  479 |   expect(drawerBounds.x).toBeGreaterThanOrEqual(frameAfterOpenBounds.x - 1);
  480 |   expect(drawerBounds.y).toBeGreaterThanOrEqual(frameAfterOpenBounds.y - 1);
  481 |   expect(right(drawerBounds)).toBeLessThanOrEqual(right(frameAfterOpenBounds) + 1);
  482 |   expect(bottom(drawerBounds)).toBeLessThanOrEqual(bottom(frameAfterOpenBounds) + 1);
  483 |   expect(frameAfterOpenBounds.x).toBeCloseTo(frameBounds.x, 5);
  484 |   expect(frameAfterOpenBounds.y).toBeCloseTo(frameBounds.y, 5);
  485 |   expect(frameAfterOpenBounds.width).toBeCloseTo(frameBounds.width, 5);
  486 |   expect(frameAfterOpenBounds.height).toBeCloseTo(frameBounds.height, 5);
  487 |   expect(rectanglesIntersect(drawerBounds, restoreAfterOpenBounds)).toBe(false);
  488 | 
  489 |   await page.getByRole("button", { name: "Close Task and Feedback" }).click();
  490 |   await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  491 |   await restore.click();
  492 |   await expect(sceneHeading).toBeVisible();
  493 |   await expect(page.getByTestId("learning-overlay-panel")).toHaveCount(1);
  494 |   await expect(getLearningRail(page)).toBeVisible();
  495 |   const restoredLearning = page.getByTestId("learning-overlay-panel");
  496 |   expect(await restoredLearning.evaluate((element) => Boolean(element.closest(".scene-viewport-stage")))).toBe(true);
  497 | });
  498 | 
  499 | test("narrow Ground Glass expansion keeps the learning flow outside the clipped frame", async ({ page }) => {
  500 |   test.setTimeout(120_000);
  501 |   await page.setViewportSize({ width: 700, height: 800 });
  502 |   await page.goto("/simulator/guided/architecture-rise/rise-01");
  503 | 
  504 |   const learning = getLearningOverlay(page);
  505 |   const rail = getLearningRail(page);
  506 |   const drawer = getLearningDrawer(page);
  507 |   const sceneHeading = page.getByRole("heading", { name: "3D Scene", exact: true });
  508 |   const groundGlassCard = page.getByLabel("GroundGlassColumn");
  509 |   const frame = page.getByLabel("GroundGlassViewport");
  510 |   const expand = page.getByRole("button", { name: "Expand Ground Glass" });
  511 | 
  512 |   await expect(learning).toHaveAttribute("data-drawer-state", "flow");
  513 |   await expect(expand).toBeVisible();
  514 |   await expand.click();
  515 | 
  516 |   const restore = page.getByRole("button", { name: "Restore Ground Glass" });
  517 |   const renderer = page.getByTestId("ground-glass-rtt");
  518 |   await expect(sceneHeading).toHaveCount(0);
  519 |   await expect(learning).toHaveAttribute("data-drawer-state", "flow");
  520 |   await expect(page.getByTestId("learning-overlay-panel")).toHaveCount(1);
  521 |   await expect(frame).toBeVisible();
  522 |   await expect(renderer).toBeVisible();
  523 |   await expect(restore).toBeVisible();
  524 |   await expect(rail).toHaveCSS("display", "none");
  525 |   expect(await rail.boundingBox()).toBeNull();
  526 | 
  527 |   const placement = await learning.evaluate((element) => ({
  528 |     insideFrame: Boolean(element.closest(".groundglass-viewport-frame")),
  529 |     insideGroundGlassCard: Boolean(element.closest('[aria-label="GroundGlassColumn"]')),
  530 |   }));
  531 |   expect(placement.insideFrame).toBe(false);
  532 |   expect(placement.insideGroundGlassCard).toBe(true);
  533 | 
  534 |   const [groundGlassBounds, frameBounds, rendererBounds, learningBounds, restoreBounds] = await Promise.all([
  535 |     requireBounds(groundGlassCard, "Expanded Ground Glass card"),
  536 |     requireBounds(frame, "Narrow expanded Ground Glass frame"),
  537 |     requireBounds(renderer, "Narrow expanded Ground Glass renderer"),
  538 |     requireBounds(learning, "Narrow expanded learning surface"),
  539 |     requireBounds(restore, "Narrow Ground Glass restore button"),
  540 |   ]);
  541 |   expect(frameBounds.height).toBeGreaterThan(100);
  542 |   expect(rendererBounds.width).toBeGreaterThan(0);
  543 |   expect(rendererBounds.height).toBeGreaterThan(0);
  544 |   expect(learningBounds.height).toBeGreaterThan(0);
  545 |   expect(learningBounds.y).toBeGreaterThanOrEqual(bottom(frameBounds) - 1);
  546 |   expect(groundGlassBounds.x).toBeLessThanOrEqual(learningBounds.x + 1);
  547 |   expect(right(learningBounds)).toBeLessThanOrEqual(right(groundGlassBounds) + 1);
  548 | 
  549 |   const rectanglesIntersect = (first: Bounds, second: Bounds) =>
  550 |     !(right(first) <= second.x || right(second) <= first.x || bottom(first) <= second.y || bottom(second) <= first.y);
  551 |   expect(rectanglesIntersect(learningBounds, restoreBounds)).toBe(false);
  552 | 
  553 |   await learning.scrollIntoViewIfNeeded();
  554 |   await expect(drawer).toBeVisible();
  555 |   const panelVisibility = await learning.evaluate((element) => {
  556 |     const panelBounds = element.getBoundingClientRect();
  557 |     const card = element.closest('[aria-label="GroundGlassColumn"]');
  558 |     const cardBounds = card?.getBoundingClientRect();
  559 |     const x = panelBounds.left + Math.min(panelBounds.width / 2, 20);
  560 |     const y = Math.min(panelBounds.bottom - 2, cardBounds?.bottom ?? window.innerHeight - 2, window.innerHeight - 2);
  561 |     const topmost = document.elementFromPoint(x, y);
  562 |     return {
  563 |       bottomWithinCard: cardBounds ? panelBounds.bottom <= cardBounds.bottom + 1 : false,
  564 |       lowerPointHitTestable: Boolean(topmost && (topmost === element || element.contains(topmost))),
  565 |     };
  566 |   });
  567 |   expect(panelVisibility.bottomWithinCard).toBe(true);
  568 |   expect(panelVisibility.lowerPointHitTestable).toBe(true);
  569 | 
```