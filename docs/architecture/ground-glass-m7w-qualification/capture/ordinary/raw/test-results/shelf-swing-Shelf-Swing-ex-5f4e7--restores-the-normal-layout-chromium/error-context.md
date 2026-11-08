# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shelf-swing.spec.ts >> Shelf Swing expanded Geometry keeps controls interactive and restores the normal layout
- Location: src/tests/e2e/shelf-swing.spec.ts:436:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '3D Scene', level: 2 })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: '3D Scene', level: 2 })

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  342 |   await trigger.click();
  343 |   await page.getByRole("button", { name: "Side", exact: true }).click();
  344 |   const side = page.getByTestId("geometry-svg-side");
  345 |   for (const locator of [
  346 |     side.getByTestId("plane-line-focus"),
  347 |     side.locator('line[aria-label="nearDof plane"]'),
  348 |     side.locator('line[aria-label="farDof plane"]'),
  349 |     side.getByTestId("dof-region"),
  350 |   ]) {
  351 |     await expect(locator).toHaveCount(0);
  352 |   }
  353 |   for (const testId of ["physical-film-segment", "physical-lens-segment"]) {
  354 |     await expect(side.getByTestId(testId)).toHaveCount(1);
  355 |   }
  356 |   for (const testId of [
  357 |     "geometry-target-shelf-front",
  358 |     "geometry-target-shelf-middle",
  359 |     "geometry-target-shelf-back",
  360 |   ]) {
  361 |     await expect(side.getByTestId(testId)).toBeVisible();
  362 |   }
  363 |
  364 |   await page.getByRole("button", { name: "Top", exact: true }).click();
  365 |   const top = page.getByTestId("geometry-svg-top");
  366 |   for (const locator of [
  367 |     top.getByTestId("plane-line-focus"),
  368 |     top.locator('line[aria-label="nearDof plane"]'),
  369 |     top.locator('line[aria-label="farDof plane"]'),
  370 |     top.getByTestId("dof-region"),
  371 |   ]) {
  372 |     await expect(locator).toBeVisible();
  373 |   }
  374 |
  375 |   await page.getByRole("button", { name: "Restore 2D Geometry" }).click();
  376 |   await expect(page.locator("section.geometry-viewport")).toHaveCount(1);
  377 |   await expect(trigger).toBeFocused();
  378 | });
  379 |
  380 | test("Shelf Swing solved geometry and RTT remain coherent at the public solution", async ({ page }) => {
  381 |   test.setTimeout(180_000);
  382 |   await page.setViewportSize({ width: 1024, height: 900 });
  383 |   await page.goto("/simulator/guided/shelf-swing/swing-01?rttDiagnostics=1");
  384 |   await setStepRangeInput(page, "Swing", -4);
  385 |   await setStepRangeInput(page, "Focus distance", 3400);
  386 |   await expectLearningFeedbackCompleted(page);
  387 |   const feedback = await openLearningFeedback(page);
  388 |   await expect(feedback.getByRole("heading", { name: "Task completed" })).toBeVisible();
  389 |   await expectRttContent(page);
  390 |
  391 |   const sceneCanvas = page.getByTestId("scene-canvas");
  392 |   for (const attribute of [
  393 |     "data-focus-overlay-vertices",
  394 |     "data-near-dof-overlay-vertices",
  395 |     "data-far-dof-overlay-vertices",
  396 |   ]) {
  397 |     await expect.poll(async () => Number(await sceneCanvas.getAttribute(attribute))).toBeGreaterThanOrEqual(4);
  398 |   }
  399 |
  400 |   await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  401 |   const calibratedTop = page.getByTestId("geometry-svg-top");
  402 |   await expectGuideLabelClearOfMiddleTarget(calibratedTop);
  403 |   const subjectLine = calibratedTop.getByTestId("shelf-swing-subject-trace").locator("line");
  404 |   const focusLine = calibratedTop.getByTestId("plane-line-focus");
  405 |   const residual = await Promise.all([subjectLine, focusLine].map(async (line) =>
  406 |     line.evaluate((element) => ({
  407 |       x1: Number(element.getAttribute("x1")),
  408 |       y1: Number(element.getAttribute("y1")),
  409 |       x2: Number(element.getAttribute("x2")),
  410 |       y2: Number(element.getAttribute("y2")),
  411 |     })),
  412 |   )).then(([subject, focus]) => {
  413 |     const a = { x: subject.x2 - subject.x1, y: subject.y2 - subject.y1 };
  414 |     const b = { x: focus.x2 - focus.x1, y: focus.y2 - focus.y1 };
  415 |     return Math.abs(a.x * b.y - a.y * b.x) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
  416 |   });
  417 |   // The public 0.1° / 10 mm controls quantize the continuous physical
  418 |   // calibration. The CPU regression covers the exact zero-footprint state;
  419 |   // this browser assertion protects the rounded public geometry contract.
  420 |   expect(residual).toBeLessThan(0.01);
  421 |   await expect(page.getByRole("button", { name: "Fit Construction" })).toBeEnabled();
  422 |   await page.getByRole("button", { name: "Fit Construction" }).click();
  423 |   const subjectField = page.getByTestId("subject-field-region");
  424 |   await expect(subjectField.getByTestId("shelf-swing-subject-trace")).toBeVisible();
  425 |   await expectGuideLabelClearOfMiddleTarget(subjectField.getByTestId("geometry-svg-top"));
  426 |   await expect(
  427 |     page.getByTestId("camera-construction-region").getByTestId("shelf-swing-subject-trace"),
  428 |   ).toHaveCount(0);
  429 |   for (const targetId of ["shelf-front", "shelf-middle", "shelf-back"]) {
  430 |     await expect(subjectField.getByTestId(`geometry-target-${targetId}`)).toBeVisible();
  431 |   }
  432 |   await page.getByRole("button", { name: "Fit Scene" }).click();
  433 |   await expect(page.getByTestId("geometry-svg-top")).toBeVisible();
  434 | });
  435 |
  436 | test("Shelf Swing expanded Geometry keeps controls interactive and restores the normal layout", async ({ page }) => {
  437 |   test.setTimeout(120_000);
  438 |   for (const height of [768, 900]) {
  439 |     await page.setViewportSize({ width: 1024, height });
  440 |     await page.goto("/simulator/guided/shelf-swing/swing-01");
  441 |
> 442 |     await expect(page.getByRole("heading", { name: "3D Scene", level: 2 })).toBeVisible();
      |                                                                             ^ Error: expect(locator).toBeVisible() failed
  443 |     await expect(page.getByRole("heading", { name: "Ground Glass", level: 2 })).toBeVisible();
  444 |     await expect(page.getByLabel("Camera Controls")).toBeVisible();
  445 |     await expect(page.locator("[data-overlay-presentation='collapsed']").first()).toBeVisible();
  446 |     expect(
  447 |       await page.evaluate(() => ({
  448 |         main: getComputedStyle(document.querySelector(".simulator-main")!).overflowY,
  449 |         aside: getComputedStyle(document.querySelector(".simulator-aside")!).overflowY,
  450 |       })),
  451 |     ).toEqual({ main: "auto", aside: "auto" });
  452 |     expect(
  453 |       await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  454 |     ).toBe(true);
  455 |
  456 |     const overlayTrigger = page.getByRole("button", { name: "View overlays" }).first();
  457 |     await expect(page.getByTestId("scene-canvas")).toBeVisible({ timeout: 60_000 });
  458 |     await overlayTrigger.click();
  459 |     const [overlayBounds, sceneBounds] = await Promise.all([
  460 |       page.locator(".scene-overlay-menu__panel").first().boundingBox(),
  461 |       page.getByTestId("scene-canvas").boundingBox(),
  462 |     ]);
  463 |     if (!overlayBounds || !sceneBounds) throw new Error("Overlay or scene bounds were unavailable");
  464 |     expect(overlayBounds.width * overlayBounds.height).toBeLessThan(
  465 |       sceneBounds.width * sceneBounds.height,
  466 |     );
  467 |     await overlayTrigger.click();
  468 |
  469 |     const trigger = page.getByRole("button", { name: "Expand 2D Geometry" });
  470 |     await trigger.click();
  471 |     const geometry = page.locator("section.geometry-viewport");
  472 |     await expect(geometry).toBeVisible();
  473 |     await expect(page.getByRole("dialog", { name: "2D Geometry" })).toHaveCount(0);
  474 |     await expect(page.getByRole("heading", { name: "3D Scene" })).toHaveCount(0);
  475 |     await expect(page.getByRole("heading", { name: "Ground Glass" })).toHaveCount(0);
  476 |     await expect(page.getByRole("button", { name: "Restore 2D Geometry" })).toBeFocused();
  477 |     await expect(page.getByRole("button", { name: "Fit Scene" })).toBeVisible();
  478 |     await expect(page.getByRole("button", { name: "Fit Construction" })).toBeVisible();
  479 |     const geometryLayout = await page.evaluate(() => {
  480 |       const main = document.querySelector<HTMLElement>(".simulator-main");
  481 |       const aside = document.querySelector<HTMLElement>(".simulator-aside");
  482 |       const card = document.querySelector<HTMLElement>(".simulator-card--expanded");
  483 |       const diagram = document.querySelector<HTMLElement>(".geometry-diagram-container");
  484 |       if (!main || !aside || !card || !diagram) throw new Error("Expanded Geometry layout is incomplete");
  485 |       const mainRect = main.getBoundingClientRect();
  486 |       const asideRect = aside.getBoundingClientRect();
  487 |       const cardRect = card.getBoundingClientRect();
  488 |       const diagramRect = diagram.getBoundingClientRect();
  489 |       return {
  490 |         main: { left: mainRect.left, right: mainRect.right, overflowY: getComputedStyle(main).overflowY },
  491 |         aside: { left: asideRect.left, overflowY: getComputedStyle(aside).overflowY },
  492 |         card: { left: cardRect.left, right: cardRect.right, height: cardRect.height },
  493 |         diagram: { width: diagramRect.width, height: diagramRect.height },
  494 |       };
  495 |     });
  496 |     expect(geometryLayout.card.left).toBeGreaterThanOrEqual(geometryLayout.main.left - 1);
  497 |     expect(geometryLayout.card.right).toBeLessThanOrEqual(geometryLayout.main.right + 1);
  498 |     expect(geometryLayout.card.right).toBeLessThan(geometryLayout.aside.left);
  499 |     expect(geometryLayout.card.height).toBeGreaterThan(0);
  500 |     expect(geometryLayout.diagram.width).toBeGreaterThan(0);
  501 |     expect(geometryLayout.diagram.height).toBeGreaterThan(0);
  502 |     expect(geometryLayout.main.overflowY).toBe("hidden");
  503 |     expect(geometryLayout.aside.overflowY).toBe("auto");
  504 |     const swing = page.getByLabel("Swing");
  505 |     await swing.focus();
  506 |     const beforeSwing = await swing.inputValue();
  507 |     await swing.press("ArrowRight");
  508 |     await expect(swing).not.toHaveValue(beforeSwing);
  509 |     await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
  510 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  511 |
  512 |     await page.getByRole("button", { name: "Restore 2D Geometry" }).click();
  513 |     await expect(geometry).toHaveCount(0);
  514 |     await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();
  515 |     await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible();
  516 |     await expect(trigger).toBeFocused();
  517 |
  518 |     await trigger.click();
  519 |     await page.keyboard.press("Escape");
  520 |     await expect(geometry).toHaveCount(0);
  521 |     await expect(trigger).toBeFocused();
  522 |   }
  523 | });
  524 |
```