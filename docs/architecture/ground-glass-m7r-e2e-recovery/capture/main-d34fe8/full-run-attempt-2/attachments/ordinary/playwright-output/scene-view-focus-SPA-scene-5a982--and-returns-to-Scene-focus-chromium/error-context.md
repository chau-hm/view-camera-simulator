# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scene-view-focus.spec.ts >> SPA scene switching discards the previous Camera target and returns to Scene focus
- Location: src/tests/e2e/scene-view-focus.spec.ts:396:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'All Scenes' })
    - locator resolved to <a href="/scenes" data-discover="true" class="btn btn--ghost">All Scenes</a>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

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
          - generic [ref=e13]: Free Exploration
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
                        - button "Scene" [ref=e35] [cursor=pointer]
                        - button "Camera" [active] [pressed] [ref=e36] [cursor=pointer]
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
                        - checkbox "Grid" [checked] [ref=e80]
                        - generic [ref=e81]: Grid
                - generic "GroundGlassViewport" [ref=e82]:
                  - generic [ref=e84]:
                    - generic [ref=e85]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e86]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 8890.0 mm focus / CoC 0.000 mm (100%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e90] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e91]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e92] [cursor=pointer]:
                    - generic [ref=e93]: open_in_new
            - generic [ref=e95]:
              - generic [ref=e96]:
                - heading "2D Geometry" [level=2] [ref=e97]
                - generic [ref=e98]:
                  - group "Geometry view" [ref=e99]:
                    - button "Side" [pressed] [ref=e100] [cursor=pointer]
                    - button "Top" [ref=e101] [cursor=pointer]
                  - group "Geometry framing" [ref=e102]:
                    - button "Fit Scene" [pressed] [ref=e103] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e104] [cursor=pointer]:
                    - generic [ref=e105]: open_in_new
              - paragraph [ref=e106]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e108]:
                - generic [ref=e109]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e110]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e111]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e112]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e113]
                  - generic [ref=e115]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e116]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e122]: Building mid facade
              - generic "Optical depth order" [ref=e124]:
                - generic [ref=e127]: Film 0 mm
                - generic [ref=e130]: Lens 153 mm
                - generic [ref=e133]: DOF limit 6.4 m
                - generic [ref=e136]: Focus 9.0 m
                - generic [ref=e139]: Far DOF > 13.3 m
            - region "Focus distribution · Focus" [ref=e141]:
              - generic [ref=e142]:
                - heading "Focus distribution" [level=4] [ref=e143]
                - 'generic "Ground Glass orientation: Raw" [ref=e144]': Raw
              - table "Focus distribution" [ref=e145]:
                - caption [ref=e146]: Focus distribution
                - rowgroup [ref=e147]:
                  - row [ref=e148]:
                    - cell [ref=e149]
                    - cell [ref=e150]
                    - cell [ref=e151]
                  - 'row "Centre Centre · Building mid facade: 100% · Sharp" [ref=e152]':
                    - cell [ref=e153]
                    - 'cell "Centre Centre · Building mid facade: 100% · Sharp" [ref=e154]':
                      - generic "Centre" [ref=e155]
                      - 'group "Centre · Building mid facade: 100% · Sharp" [ref=e157]':
                        - generic "Building mid facade" [ref=e159]
                        - generic [ref=e160]:
                          - text: 100%
                          - generic [ref=e161]: ✓
                    - cell [ref=e162]
                  - row [ref=e163]:
                    - cell [ref=e164]
                    - cell [ref=e165]
                    - cell [ref=e166]
          - group [ref=e169]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e170] [cursor=pointer]:
              - generic [ref=e171]: Optical Debug
              - generic [ref=e172]: architecture-rise · parallel
        - complementary [ref=e173]:
          - generic [ref=e174]:
            - region "Camera Controls" [ref=e175]:
              - heading "Camera Controls" [level=3] [ref=e177]
              - generic [ref=e178]:
                - region "Movement" [ref=e180]:
                  - generic [ref=e181]:
                    - heading "Front standard" [level=4] [ref=e182]
                    - button "Help" [ref=e183] [cursor=pointer]:
                      - generic [ref=e184]: "?"
                  - generic [ref=e185]:
                    - generic [ref=e186]:
                      - generic [ref=e187]: Rise
                      - slider "Rise" [ref=e188]: "0"
                      - generic [ref=e189]: 0.0 mm
                    - generic [ref=e190]:
                      - generic [ref=e191]: Tilt
                      - slider "Tilt" [ref=e192]: "0"
                      - generic [ref=e193]: 0.0°
                    - generic [ref=e194]:
                      - generic [ref=e195]: Swing
                      - slider "Swing" [ref=e196]: "0"
                      - generic [ref=e197]: 0.0°
                - region "Focus" [ref=e199]:
                  - heading "Focus" [level=3] [ref=e200]
                  - generic [ref=e201]:
                    - generic [ref=e202]: Focus distance
                    - slider "Focus distance" [ref=e203]: "8890"
                    - generic [ref=e204]: 8890.0 mm
                    - button "Infinity Reset" [ref=e206] [cursor=pointer]: ∞
                - region "Aperture" [ref=e208]:
                  - heading "Aperture" [level=3] [ref=e209]
                  - radiogroup "Aperture" [ref=e210]:
                    - generic [ref=e211] [cursor=pointer]:
                      - radio "f/5.6" [ref=e212]
                      - generic [ref=e213]: f/5.6
                    - generic [ref=e214] [cursor=pointer]:
                      - radio "f/8" [ref=e215]
                      - generic [ref=e216]: f/8
                    - generic [ref=e217] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e218]
                      - generic [ref=e219]: f/11
                    - generic [ref=e220] [cursor=pointer]:
                      - radio "f/16" [ref=e221]
                      - generic [ref=e222]: f/16
                    - generic [ref=e223] [cursor=pointer]:
                      - radio "f/22" [ref=e224]
                      - generic [ref=e225]: f/22
                    - generic [ref=e226] [cursor=pointer]:
                      - radio "f/32" [ref=e227]
                      - generic [ref=e228]: f/32
                - generic [ref=e229]:
                  - generic [ref=e230]: Reset
                  - region "Reset" [ref=e231]:
                    - button "Reset movements" [ref=e233] [cursor=pointer]
            - region "Developer Tools" [ref=e234]:
              - heading "Developer Tools" [level=3] [ref=e235]
              - generic [ref=e237]:
                - checkbox "Raw RTT — bypass DOF" [ref=e238]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
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
  393 |   await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
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
> 410 |   await page.getByRole("link", { name: "All Scenes" }).click();
      |                                                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
  411 |   await openScene("Table Tilt");
  412 |   const tableCanvas = page.getByTestId("scene-canvas");
  413 |   await expect(page.getByRole("button", { name: "Scene", exact: true })).toHaveAttribute("aria-pressed", "true");
  414 |   await expect(tableCanvas).toHaveAttribute("data-view-focus", "scene");
  415 |   await expect(tableCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
  416 |   expect((await readStableViewState(tableCanvas)).target).not.toEqual(architectureCameraTarget);
  417 | });
  418 | 
```