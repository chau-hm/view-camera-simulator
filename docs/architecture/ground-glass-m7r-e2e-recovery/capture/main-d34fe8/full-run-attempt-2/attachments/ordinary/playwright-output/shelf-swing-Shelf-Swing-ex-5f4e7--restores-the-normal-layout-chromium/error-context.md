# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shelf-swing.spec.ts >> Shelf Swing expanded Geometry keeps controls interactive and restores the normal layout
- Location: src/tests/e2e/shelf-swing.spec.ts:436:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('section.geometry-viewport')
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('section.geometry-viewport')
    5 × locator resolved to 1 element
      - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - status
  - main [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - link "View Camera Simulator home" [ref=e8] [cursor=pointer]:
          - /url: /
          - img [ref=e9]
          - generic [ref=e10]: View Camera Simulator
        - generic [ref=e11]:
          - generic [ref=e12]: Shelf Swing
          - generic [ref=e13]: Guided Lesson
        - generic [ref=e14]:
          - link "All Scenes" [ref=e15] [cursor=pointer]:
            - /url: /scenes
          - generic [ref=e16]:
            - text: Language
            - combobox "Language" [ref=e17]:
              - option "English" [selected]
              - option "繁體中文"
      - region "Simulator body" [ref=e18]:
        - main [ref=e19]:
          - generic [ref=e21]:
            - generic [ref=e22]:
              - generic [ref=e23]:
                - generic [ref=e25]: view_in_ar
                - heading "3D Scene" [level=2] [ref=e26]
              - generic [ref=e27]:
                - generic [ref=e29]:
                  - generic [ref=e30]:
                    - button "Reset 3D view" [ref=e31] [cursor=pointer]
                    - group "View Focus" [ref=e32]:
                      - generic [ref=e33]: View Focus
                      - generic [ref=e34]:
                        - button "Scene" [pressed] [ref=e35] [cursor=pointer]
                        - button "Camera" [ref=e36] [cursor=pointer]
                  - generic [ref=e37]:
                    - generic [ref=e38]: Render quality
                    - combobox "Render quality" [ref=e39]:
                      - option "High" [selected]
                      - option "Standard"
                      - option "Low"
                - generic [ref=e41]:
                  - button "Expand 3D Scene" [ref=e47] [cursor=pointer]:
                    - generic [ref=e48]: open_in_new
                  - button "View overlays" [ref=e50] [cursor=pointer]:
                    - generic [ref=e51]: layers
                    - generic [ref=e52]: View overlays
                    - generic [ref=e53]: ▾
                  - region "Task and Feedback":
                    - button "Open Task and Feedback" [ref=e54] [cursor=pointer]:
                      - generic [ref=e55]: Task and Feedback
            - generic "GroundGlassColumn" [ref=e56]:
              - generic [ref=e57]:
                - generic [ref=e59]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e60]
              - generic [ref=e61]:
                - generic [ref=e63]:
                  - group "Preview" [ref=e64]:
                    - generic [ref=e65]: Preview
                    - generic [ref=e67]:
                      - generic [ref=e68]:
                        - radio "Raw Ground Glass" [checked] [ref=e69]
                        - generic [ref=e70]: Raw Ground Glass
                      - generic [ref=e71]:
                        - radio "Upright Assist" [ref=e72]
                        - generic [ref=e73]: Upright Assist
                  - group "View Options" [ref=e74]:
                    - generic [ref=e75]: View Options
                    - region "View Options" [ref=e77]:
                      - generic [ref=e79]:
                        - checkbox "Grid" [checked] [disabled] [ref=e80]
                        - generic [ref=e81]: Grid
                        - generic [ref=e82]: Disabled for this guided task
                - generic "GroundGlassViewport" [ref=e83]:
                  - generic [ref=e85]:
                    - generic [ref=e86]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e87]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 3800.0 mm focus / CoC 0.386 mm (0%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e91] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e92]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e93] [cursor=pointer]:
                    - generic [ref=e94]: open_in_new
            - generic [ref=e96]:
              - generic [ref=e97]:
                - heading "2D Geometry" [level=2] [ref=e98]
                - generic [ref=e99]:
                  - group "Geometry view" [ref=e100]:
                    - button "Side" [ref=e101] [cursor=pointer]
                    - button "Top" [pressed] [ref=e102] [cursor=pointer]
                    - button "Scheimpflug Section" [ref=e103] [cursor=pointer]
                  - group "Geometry framing" [ref=e104]:
                    - button "Fit Scene" [pressed] [ref=e105] [cursor=pointer]
                    - button "Fit Construction" [disabled] [ref=e106]
                  - button "Expand 2D Geometry" [active] [ref=e107] [cursor=pointer]:
                    - generic [ref=e108]: open_in_new
              - paragraph [ref=e109]: "Top view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.1°"
              - img [ref=e111]:
                - generic [ref=e112]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e113]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e114]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e115]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e116]
                  - generic [ref=e119]: Optical axis
                  - generic [ref=e122]: Diagonal subject plane
                  - generic:
                    - generic "film plane"
                  - generic "lens plane" [ref=e125]
                  - generic:
                    - generic "focus plane"
                  - generic "nearDof plane" [ref=e127]
                  - generic "farDof plane" [ref=e129]
                  - generic [ref=e130]:
                    - generic "Simplified bellows connector"
                  - generic "chief ray from film centre through lens centre"
                  - generic [ref=e136]: Front chart
                  - generic [ref=e139]: Middle chart
                  - generic [ref=e142]: Back chart
              - generic "Optical depth order" [ref=e144]:
                - generic [ref=e147]: Film 0 mm
                - generic [ref=e150]: Lens 156 mm
                - generic [ref=e153]: DOF limit 3.4 m
                - generic [ref=e156]: Focus 4.0 m
                - generic [ref=e159]: Far DOF 4.8 m
            - region "Focus distribution · Focus" [ref=e161]:
              - generic [ref=e162]:
                - heading "Focus distribution" [level=4] [ref=e163]
                - 'generic "Ground Glass orientation: Raw" [ref=e164]': Raw
              - table "Focus distribution" [ref=e165]:
                - caption [ref=e166]: Focus distribution
                - rowgroup [ref=e167]:
                  - row [ref=e168]:
                    - cell [ref=e169]
                    - cell [ref=e170]
                    - cell [ref=e171]
                  - 'row "Middle left Middle left · Front chart: 0% · Soft Centre Centre · Middle chart: 80% · Acceptable Middle right Middle right · Back chart: 0% · Soft" [ref=e172]':
                    - 'cell "Middle left Middle left · Front chart: 0% · Soft" [ref=e173]':
                      - generic "Middle left" [ref=e174]
                      - 'group "Middle left · Front chart: 0% · Soft" [ref=e176]':
                        - generic "Front chart" [ref=e177]
                        - generic [ref=e178]:
                          - text: 0%
                          - generic [ref=e179]: —
                    - 'cell "Centre Centre · Middle chart: 80% · Acceptable" [ref=e180]':
                      - generic "Centre" [ref=e181]
                      - 'group "Centre · Middle chart: 80% · Acceptable" [ref=e183]':
                        - generic "Middle chart" [ref=e184]
                        - generic [ref=e185]:
                          - text: 80%
                          - generic [ref=e186]: ~
                    - 'cell "Middle right Middle right · Back chart: 0% · Soft" [ref=e187]':
                      - generic "Middle right" [ref=e188]
                      - 'group "Middle right · Back chart: 0% · Soft" [ref=e190]':
                        - generic "Back chart" [ref=e191]
                        - generic [ref=e192]:
                          - text: 0%
                          - generic [ref=e193]: —
                  - row [ref=e194]:
                    - cell [ref=e195]
                    - cell [ref=e196]
                    - cell [ref=e197]
          - group [ref=e200]:
            - generic "Optical Debug shelf-swing · parallel" [ref=e201] [cursor=pointer]:
              - generic [ref=e202]: Optical Debug
              - generic [ref=e203]: shelf-swing · parallel
        - complementary [ref=e204]:
          - generic [ref=e205]:
            - region "Camera Controls" [ref=e206]:
              - heading "Camera Controls" [level=3] [ref=e208]
              - paragraph [ref=e209]:
                - generic [ref=e210]: 🔒
                - generic [ref=e211]: Disabled for this guided task
              - generic [ref=e212]:
                - region "Movement" [ref=e214]:
                  - generic [ref=e215]:
                    - heading "Front standard" [level=4] [ref=e216]
                    - button "Help" [ref=e217] [cursor=pointer]:
                      - generic [ref=e218]: "?"
                  - generic [ref=e219]:
                    - generic [ref=e220]:
                      - generic [ref=e221]: Rise
                      - slider "Rise" [disabled] [ref=e222]: "0"
                      - generic [ref=e223]: 0.0 mm
                    - generic [ref=e224]:
                      - generic [ref=e225]: Tilt
                      - slider "Tilt" [disabled] [ref=e226]: "0"
                      - generic [ref=e227]: 0.0°
                    - generic [ref=e228]:
                      - generic [ref=e229]: Swing
                      - slider "Swing" [ref=e230]: "0.1"
                      - generic [ref=e231]: 0.1°
                - region "Focus" [ref=e233]:
                  - heading "Focus" [level=3] [ref=e234]
                  - generic [ref=e235]:
                    - generic [ref=e236]: Focus distance
                    - slider "Focus distance" [ref=e237]: "3800"
                    - generic [ref=e238]: 3800.0 mm
                    - button "Infinity Reset" [ref=e240] [cursor=pointer]: ∞
                - region "Aperture" [ref=e242]:
                  - heading "Aperture" [level=3] [ref=e243]
                  - radiogroup "Aperture" [ref=e244]:
                    - generic [ref=e245] [cursor=pointer]:
                      - radio "f/5.6" [ref=e246]
                      - generic [ref=e247]: f/5.6
                    - generic [ref=e248] [cursor=pointer]:
                      - radio "f/8" [ref=e249]
                      - generic [ref=e250]: f/8
                    - generic [ref=e251] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e252]
                      - generic [ref=e253]: f/11
                    - generic [ref=e254] [cursor=pointer]:
                      - radio "f/16" [ref=e255]
                      - generic [ref=e256]: f/16
                    - generic [ref=e257] [cursor=pointer]:
                      - radio "f/22" [ref=e258]
                      - generic [ref=e259]: f/22
                    - generic [ref=e260] [cursor=pointer]:
                      - radio "f/32" [ref=e261]
                      - generic [ref=e262]: f/32
                - generic [ref=e263]:
                  - generic [ref=e264]: Reset
                  - region "Reset" [ref=e265]:
                    - generic [ref=e266]:
                      - button "Reset movements" [ref=e267] [cursor=pointer]
                      - button "Restart task" [ref=e268] [cursor=pointer]
            - region "Developer Tools" [ref=e269]:
              - heading "Developer Tools" [level=3] [ref=e270]
              - generic [ref=e272]:
                - checkbox "Raw RTT — bypass DOF" [ref=e273]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
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
  442 |     await expect(page.getByRole("heading", { name: "3D Scene", level: 2 })).toBeVisible();
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
> 513 |     await expect(geometry).toHaveCount(0);
      |                            ^ Error: expect(locator).toHaveCount(expected) failed
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