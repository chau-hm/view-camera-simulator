# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scene-view-focus.spec.ts >> guided task restart restores task Optical Geometry preset
- Location: src/tests/e2e/scene-view-focus.spec.ts:374:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('scene-canvas')
Expected: "true"
Received: ""

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('scene-canvas')

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
          - generic [ref=e12]: Architecture Rise
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
                            - generic: 8890.0 mm focus / CoC 0.000 mm (100%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e91] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e92]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e93] [cursor=pointer]:
                    - generic [ref=e94]: open_in_new
            - generic [ref=e96]:
              - generic [ref=e97]:
                - heading "2D Geometry" [level=2] [ref=e98]
                - generic [ref=e99]:
                  - group "Geometry view" [ref=e100]:
                    - button "Side" [pressed] [ref=e101] [cursor=pointer]
                    - button "Top" [ref=e102] [cursor=pointer]
                  - group "Geometry framing" [ref=e103]:
                    - button "Fit Scene" [pressed] [ref=e104] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e105] [cursor=pointer]:
                    - generic [ref=e106]: open_in_new
              - paragraph [ref=e107]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e109]:
                - generic [ref=e110]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e111]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e112]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e113]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e114]
                  - generic [ref=e116]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e117]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e123]: Building mid facade
              - generic "Optical depth order" [ref=e125]:
                - generic [ref=e128]: Film 0 mm
                - generic [ref=e131]: Lens 153 mm
                - generic [ref=e134]: DOF limit 6.4 m
                - generic [ref=e137]: Focus 9.0 m
                - generic [ref=e140]: Far DOF > 13.3 m
            - region "Focus distribution · Focus" [ref=e142]:
              - generic [ref=e143]:
                - heading "Focus distribution" [level=4] [ref=e144]
                - 'generic "Ground Glass orientation: Raw" [ref=e145]': Raw
              - table "Focus distribution" [ref=e146]:
                - caption [ref=e147]: Focus distribution
                - rowgroup [ref=e148]:
                  - row [ref=e149]:
                    - cell [ref=e150]
                    - cell [ref=e151]
                    - cell [ref=e152]
                  - 'row "Centre Centre · Building mid facade: 100% · Sharp" [ref=e153]':
                    - cell [ref=e154]
                    - 'cell "Centre Centre · Building mid facade: 100% · Sharp" [ref=e155]':
                      - generic "Centre" [ref=e156]
                      - 'group "Centre · Building mid facade: 100% · Sharp" [ref=e158]':
                        - generic "Building mid facade" [ref=e160]
                        - generic [ref=e161]:
                          - text: 100%
                          - generic [ref=e162]: ✓
                    - cell [ref=e163]
                  - row [ref=e164]:
                    - cell [ref=e165]
                    - cell [ref=e166]
                    - cell [ref=e167]
          - group [ref=e170]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e171] [cursor=pointer]:
              - generic [ref=e172]: Optical Debug
              - generic [ref=e173]: architecture-rise · parallel
        - complementary [ref=e174]:
          - generic [ref=e175]:
            - region "Camera Controls" [ref=e176]:
              - heading "Camera Controls" [level=3] [ref=e178]
              - paragraph [ref=e179]:
                - generic [ref=e180]: 🔒
                - generic [ref=e181]: Disabled for this guided task
              - generic [ref=e182]:
                - region "Movement" [ref=e184]:
                  - generic [ref=e185]:
                    - heading "Front standard" [level=4] [ref=e186]
                    - button "Help" [ref=e187] [cursor=pointer]:
                      - generic [ref=e188]: "?"
                  - generic [ref=e189]:
                    - generic [ref=e190]:
                      - generic [ref=e191]: Rise
                      - slider "Rise" [ref=e192]: "0"
                      - generic [ref=e193]: 0.0 mm
                    - generic [ref=e194]:
                      - generic [ref=e195]: Tilt
                      - slider "Tilt" [disabled] [ref=e196]: "0"
                      - generic [ref=e197]: 0.0°
                    - generic [ref=e198]:
                      - generic [ref=e199]: Swing
                      - slider "Swing" [disabled] [ref=e200]: "0"
                      - generic [ref=e201]: 0.0°
                - region "Focus" [ref=e203]:
                  - heading "Focus" [level=3] [ref=e204]
                  - generic [ref=e205]:
                    - generic [ref=e206]: Focus distance
                    - slider "Focus distance" [ref=e207]: "8890"
                    - generic [ref=e208]: 8890.0 mm
                    - button "Infinity Reset" [ref=e210] [cursor=pointer]: ∞
                - region "Aperture" [ref=e212]:
                  - heading "Aperture" [level=3] [ref=e213]
                  - radiogroup "Aperture" [ref=e214]:
                    - generic [ref=e215] [cursor=pointer]:
                      - radio "f/5.6" [ref=e216]
                      - generic [ref=e217]: f/5.6
                    - generic [ref=e218] [cursor=pointer]:
                      - radio "f/8" [ref=e219]
                      - generic [ref=e220]: f/8
                    - generic [ref=e221] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e222]
                      - generic [ref=e223]: f/11
                    - generic [ref=e224] [cursor=pointer]:
                      - radio "f/16" [ref=e225]
                      - generic [ref=e226]: f/16
                    - generic [ref=e227] [cursor=pointer]:
                      - radio "f/22" [ref=e228]
                      - generic [ref=e229]: f/22
                    - generic [ref=e230] [cursor=pointer]:
                      - radio "f/32" [ref=e231]
                      - generic [ref=e232]: f/32
                - generic [ref=e233]:
                  - generic [ref=e234]: Reset
                  - region "Reset" [ref=e235]:
                    - generic [ref=e236]:
                      - button "Reset movements" [ref=e237] [cursor=pointer]
                      - button "Restart task" [active] [ref=e238] [cursor=pointer]
            - region "Developer Tools" [ref=e239]:
              - heading "Developer Tools" [level=3] [ref=e240]
              - generic [ref=e242]:
                - checkbox "Raw RTT — bypass DOF" [ref=e243]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  293 |   expectTranslatedByTargetDelta(intermediateView, c3View);
  294 |   expectSameObserverOffset(intermediateView, c3View);
  295 |   expect(viewDistance(c3View)).toBeCloseTo(inspectionDistance, 5);
  296 |   await expectRendererIdentitiesStable();
  297 | 
  298 |   await viewpoint.fill("-1");
  299 |   await expect(viewpoint).toHaveValue("-1");
  300 |   await expect(sceneCanvas).toHaveAttribute("data-camera-rig-anchor", "low");
  301 |   const d3View = await expectCameraFocusTarget(sceneCanvas);
  302 |   expect(d3View.target).not.toEqual(c3View.target);
  303 |   expect(d3View.target).not.toEqual(neutralView.target);
  304 |   expectTranslatedByTargetDelta(c3View, d3View);
  305 |   expectSameObserverOffset(neutralView, d3View);
  306 |   expect(viewDistance(d3View)).toBeCloseTo(inspectionDistance, 5);
  307 | 
  308 |   await page.getByRole("button", { name: "Reset 3D view" }).click();
  309 |   const d3ResetView = await expectCameraFocusTarget(sceneCanvas);
  310 |   expect(viewDistance(d3ResetView)).toBeCloseTo(inspectionDistance, 5);
  311 | 
  312 |   await viewpoint.fill("1");
  313 |   await page.getByRole("button", { name: "Reset 3D view" }).click();
  314 |   const c3ResetView = await expectCameraFocusTarget(sceneCanvas);
  315 |   expect(viewDistance(c3ResetView)).toBeCloseTo(inspectionDistance, 5);
  316 | 
  317 |   await orbitScene(page, sceneCanvas);
  318 |   await expect.poll(async () => (await readViewState(sceneCanvas)).position).not.toEqual(
  319 |     c3ResetView.position,
  320 |   );
  321 |   const c3OrbitedView = await expectCameraFocusTarget(sceneCanvas);
  322 |   expect(c3OrbitedView.target).toEqual(c3ResetView.target);
  323 |   const orbitedInspectionDistance = viewDistance(c3OrbitedView);
  324 | 
  325 |   await viewpoint.fill("-1");
  326 |   const d3AfterOrbitView = await expectCameraFocusTarget(sceneCanvas);
  327 |   expectTranslatedByTargetDelta(c3OrbitedView, d3AfterOrbitView);
  328 |   expectSameObserverOffset(c3OrbitedView, d3AfterOrbitView);
  329 |   expect(viewDistance(d3AfterOrbitView)).toBeCloseTo(orbitedInspectionDistance, 5);
  330 | 
  331 |   await viewpoint.fill("0");
  332 |   await expect(viewpoint).toHaveValue("0");
  333 |   await page.getByRole("button", { name: "Reset 3D view" }).click();
  334 |   const neutralResetView = await expectCameraFocusTarget(sceneCanvas);
  335 |   expect(neutralResetView.target).toEqual(neutralView.target);
  336 |   expect(viewDistance(neutralResetView)).toBeCloseTo(inspectionDistance, 5);
  337 | 
  338 |   await sceneButton.click();
  339 |   await expect(sceneCanvas).toHaveAttribute("data-view-focus", "scene");
  340 |   const sceneView = await readStableViewState(sceneCanvas);
  341 |   await viewpoint.fill("1");
  342 |   const c3SceneView = await readStableViewState(sceneCanvas);
  343 |   expect(c3SceneView.target).toEqual(sceneView.target);
  344 |   await viewpoint.fill("-1");
  345 |   const d3SceneView = await readStableViewState(sceneCanvas);
  346 |   expect(d3SceneView.target).toEqual(sceneView.target);
  347 | 
  348 |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  349 |   await expect(sceneCanvas).toHaveAttribute("data-mounted-lattice-geometry-id", geometryId!);
  350 |   await expect(sceneCanvas).toHaveAttribute("data-mounted-lattice-generation", generation!);
  351 | });
  352 | 
  353 | test("Architecture + Foreground Camera focus uses the physical camera anchor", async ({ page }) => {
  354 |   test.setTimeout(60_000);
  355 |   await page.goto("/simulator/free/architecture-foreground");
  356 | 
  357 |   const sceneCanvas = page.getByTestId("scene-canvas");
  358 |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  359 |   const sceneView = await readStableViewState(sceneCanvas);
  360 | 
  361 |   await page.getByRole("button", { name: "Camera", exact: true }).click();
  362 |   await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");
  363 |   const cameraView = await readStableViewState(sceneCanvas);
  364 | 
  365 |   // Architecture + Foreground has a 150 mm focal length, so the shared
  366 |   // stable physical body-midpoint anchor is -75 mm on the optical axis.
  367 |   expect(sceneView.target).toEqual([0, 0.25, 6.9]);
  368 |   expect(cameraView.target).toEqual([0, 0, -0.075]);
  369 |   expect(viewDistance(cameraView)).toBeCloseTo(0.72, 4);
  370 |   expect(cameraView.target).not.toEqual(sceneView.target);
  371 |   expect(cameraView.target[2]).not.toBeCloseTo(6.5, 5);
  372 | });
  373 | 
  374 | test("guided task restart restores task Optical Geometry preset", async ({ page }) => {
  375 |   test.setTimeout(30_000);
  376 | 
  377 |   // Navigate to a real guided task (Architecture Rise)
  378 |   await page.goto("/simulator/guided/architecture-rise/rise-01");
  379 |   const sceneCanvas = page.getByTestId("scene-canvas");
  380 |   await expect(sceneCanvas).toBeVisible({ timeout: 10000 });
  381 |   await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
  382 | 
  383 |   // Restart Task button is visible in guided mode
  384 |   await expect(page.getByRole("button", { name: "Restart Task" })).toBeVisible();
  385 | 
  386 |   // Hide Optical Geometry
  387 |   await openOverlayMenuIfNeeded(page);
  388 |   await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  389 |   await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "false");
  390 | 
  391 |   // Restart Task restores the task preset (Optical Geometry = true)
  392 |   await page.getByRole("button", { name: "Restart Task" }).click();
> 393 |   await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
      |                             ^ Error: expect(locator).toHaveAttribute(expected) failed
  394 | });
  395 | 
  396 | test("SPA scene switching discards the previous Camera target and returns to Scene focus", async ({ page }) => {
  397 |   await page.goto("/scenes");
  398 |   const openScene = async (heading: string) => {
  399 |     const card = page
  400 |       .getByRole("article")
  401 |       .filter({ has: page.getByRole("heading", { name: heading }) });
  402 |     await card.getByRole("link", { name: "Open Scene" }).click();
  403 |   };
  404 | 
  405 |   await openScene("Architecture Rise");
  406 |   const architectureCanvas = page.getByTestId("scene-canvas");
  407 |   await page.getByRole("button", { name: "Camera" }).click();
  408 |   const architectureCameraTarget = (await readStableViewState(architectureCanvas)).target;
  409 | 
  410 |   await page.getByRole("link", { name: "All Scenes" }).click();
  411 |   await openScene("Table Tilt");
  412 |   const tableCanvas = page.getByTestId("scene-canvas");
  413 |   await expect(page.getByRole("button", { name: "Scene", exact: true })).toHaveAttribute("aria-pressed", "true");
  414 |   await expect(tableCanvas).toHaveAttribute("data-view-focus", "scene");
  415 |   await expect(tableCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
  416 |   expect((await readStableViewState(tableCanvas)).target).not.toEqual(architectureCameraTarget);
  417 | });
  418 | 
```