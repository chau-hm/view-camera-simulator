# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scene-view-focus.spec.ts >> Understanding Camera Movements Camera focus follows continuous viewpoint changes
- Location: src/tests/e2e/scene-view-focus.spec.ts:210:1

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.fill: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByRole('slider', { name: 'Viewpoint' })

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
          - generic [ref=e12]: Understanding Camera Movements
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
                        - button "Camera" [pressed] [ref=e36] [cursor=pointer]
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
                      - button "Focus loupe · 4× Ground Glass preview" [ref=e86]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 2000.0 mm focus
                      - button "Focus loupe · 4× Ground Glass preview view" [ref=e90] [cursor=pointer]: Focus loupe · 4×
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
              - paragraph [ref=e106]: Side view | Higher viewpoint
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
                  - generic:
                    - generic "farDof plane"
                  - generic [ref=e117]:
                    - generic "Camera body rail"
                    - generic "Simplified bellows connector"
                - generic [ref=e121]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e122]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e123]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e124]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e125]
                  - generic [ref=e128]: Optical axis
                  - generic "film plane" [ref=e131]
                  - generic "lens plane" [ref=e133]
                  - generic "focus plane" [ref=e135]
                  - generic "nearDof plane" [ref=e137]
                  - generic "farDof plane" [ref=e139]
                  - generic [ref=e140]:
                    - generic "Camera body rail" [ref=e141]
                    - generic "Simplified bellows connector" [ref=e142]
                - generic [ref=e148]:
                  - generic [ref=e150]: Current
                  - generic [ref=e151]: Original
              - generic "Optical depth order" [ref=e152]:
                - generic [ref=e155]: Film 0 mm
                - generic [ref=e158]: Lens 78 mm
                - generic [ref=e161]: DOF limit 1.4 m
                - generic [ref=e164]: Focus 1.7 m
                - generic [ref=e167]: Far DOF 2.3 m
          - group [ref=e170]:
            - generic "Optical Debug understanding-camera-movements · parallel" [ref=e171] [cursor=pointer]:
              - generic [ref=e172]: Optical Debug
              - generic [ref=e173]: understanding-camera-movements · parallel
        - complementary [ref=e174]:
          - generic [ref=e175]:
            - region "Camera Controls" [ref=e176]:
              - heading "Camera Controls" [level=3] [ref=e178]
              - generic [ref=e179]:
                - group "Lens / Angle of View" [ref=e181]:
                  - generic [ref=e182]: Lens / Angle of View
                  - paragraph [ref=e183]: "At the same camera position, focal length changes angle of view and framing, not perspective. Lens coverage is separate from focal length: lenses with the same focal length can cover different areas. Rise and Shift use spare coverage; they do not create more."
                  - radiogroup "Lens options" [ref=e184]:
                    - generic [ref=e185] [cursor=pointer]:
                      - 'radio "90 mm — Wide — Lens coverage: 100.9° simulator coverage (teaching profile)" [checked] [ref=e186]'
                      - generic [ref=e187]:
                        - generic [ref=e188]: Wide
                        - generic [ref=e189]: ·
                        - generic [ref=e190]: 90 mm
                      - generic [ref=e191]: "Lens coverage: 100.9° simulator coverage (teaching profile)"
                    - generic [ref=e192] [cursor=pointer]:
                      - 'radio "105 mm — — Lens coverage: 92.1° simulator coverage (teaching profile)" [ref=e193]'
                      - generic [ref=e195]: 105 mm
                      - generic [ref=e196]: "Lens coverage: 92.1° simulator coverage (teaching profile)"
                    - generic [ref=e197] [cursor=pointer]:
                      - 'radio "120 mm — — Lens coverage: 84.5° simulator coverage (teaching profile)" [ref=e198]'
                      - generic [ref=e200]: 120 mm
                      - generic [ref=e201]: "Lens coverage: 84.5° simulator coverage (teaching profile)"
                    - generic [ref=e202] [cursor=pointer]:
                      - 'radio "150 mm — Standard — Lens coverage: 72° simulator coverage (teaching profile)" [ref=e203]'
                      - generic [ref=e204]:
                        - generic [ref=e205]: Standard
                        - generic [ref=e206]: ·
                        - generic [ref=e207]: 150 mm
                      - generic [ref=e208]: "Lens coverage: 72° simulator coverage (teaching profile)"
                  - generic [ref=e209]:
                    - generic [ref=e210]: Selected lens
                    - generic [ref=e211]: Wide · 90 mm
                    - generic [ref=e212]:
                      - generic [ref=e213]: Lens coverage
                      - generic [ref=e214]: 100.9° simulator coverage (teaching profile)
                    - generic [ref=e215]:
                      - generic [ref=e216]: Image circle
                      - generic [ref=e217]: 228.2 mm at current focus
                - region "Camera Movement" [ref=e219]:
                  - heading "Camera Movement" [level=3] [ref=e220]
                  - paragraph [ref=e221]: Explore viewpoint and standard movements continuously.
                  - region "Viewpoint" [ref=e222]:
                    - heading "Viewpoint" [level=4] [ref=e223]
                    - paragraph [ref=e224]: Move the whole camera lower or higher while keeping the standards neutral.
                    - generic [ref=e225]:
                      - generic [ref=e226]: Viewpoint
                      - generic [ref=e227]: Higher viewpoint
                    - slider "Viewpoint" [active] [ref=e228]: "1"
                    - group "Viewpoint positions" [ref=e229]:
                      - generic [ref=e230]: Lower
                      - generic [ref=e231]: Neutral
                      - generic [ref=e232]: Higher
                  - region "Tilt" [ref=e233]:
                    - heading "Tilt" [level=4] [ref=e234]
                    - paragraph [ref=e235]: Tilt the front or rear standard while the camera remains at the neutral viewpoint.
                    - group "Tilt standard" [ref=e236]:
                      - generic [ref=e237]: Standard
                      - generic [ref=e238]:
                        - radio "Front standard" [ref=e239]
                        - generic [ref=e240]: Front standard
                      - generic [ref=e241]:
                        - radio "Rear standard" [checked] [ref=e242]
                        - generic [ref=e243]: Rear standard
                    - generic [ref=e244]:
                      - generic [ref=e245]: Tilt
                      - generic [ref=e246]: 0.0°
                    - slider "Tilt" [ref=e247]: "0"
                    - group "Tilt positions" [ref=e248]:
                      - generic [ref=e249]: Negative -5.0°
                      - generic [ref=e250]: Zero
                      - generic [ref=e251]: Positive +5.0°
                  - region "Vertical Framing" [ref=e252]:
                    - heading "Vertical Framing" [level=4] [ref=e253]
                    - paragraph [ref=e254]: Move the front or rear standard vertically to frame a lower or higher part of the subject.
                    - group "Vertical framing standard" [ref=e255]:
                      - generic [ref=e256]: Standard
                      - generic [ref=e257]:
                        - radio "Front standard" [ref=e258]
                        - generic [ref=e259]: Front standard
                      - generic [ref=e260]:
                        - radio "Rear standard" [checked] [ref=e261]
                        - generic [ref=e262]: Rear standard
                    - generic [ref=e263]:
                      - generic [ref=e264]: Vertical framing
                      - generic [ref=e265]: Rear standard, middle framing
                    - slider "Vertical framing" [ref=e266]: "0"
                    - group "Vertical framing positions" [ref=e267]:
                      - generic [ref=e268]: Lower
                      - generic [ref=e269]: Middle
                      - generic [ref=e270]: Upper
                  - status [ref=e271]: Higher viewpoint
                - region "Focus" [ref=e273]:
                  - heading "Focus" [level=3] [ref=e274]
                  - generic [ref=e275]:
                    - generic [ref=e276]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e277]: "2000"
                    - generic [ref=e278]: 2000.0 mm
                  - generic [ref=e279]: Focus is fixed for this lesson
                - region "Aperture" [ref=e281]:
                  - heading "Aperture" [level=3] [ref=e282]
                  - radiogroup "Aperture" [disabled] [ref=e283]:
                    - generic [ref=e284]:
                      - radio "f/5.6" [disabled] [ref=e285]
                      - generic [ref=e286]: f/5.6
                    - generic [ref=e287]:
                      - radio "f/8" [disabled] [ref=e288]
                      - generic [ref=e289]: f/8
                    - generic [ref=e290]:
                      - radio "f/11" [checked] [disabled] [ref=e291]
                      - generic [ref=e292]: f/11
                    - generic [ref=e293]:
                      - radio "f/16" [disabled] [ref=e294]
                      - generic [ref=e295]: f/16
                    - generic [ref=e296]:
                      - radio "f/22" [disabled] [ref=e297]
                      - generic [ref=e298]: f/22
                    - generic [ref=e299]:
                      - radio "f/32" [disabled] [ref=e300]
                      - generic [ref=e301]: f/32
                  - generic [ref=e302]: Aperture is fixed for this lesson
                - generic [ref=e303]:
                  - generic [ref=e304]: Reset
                  - region "Reset" [ref=e305]:
                    - button "Reset movements" [ref=e307] [cursor=pointer]
            - region "Developer Tools" [ref=e308]:
              - heading "Developer Tools" [level=3] [ref=e309]
              - generic [ref=e311]:
                - checkbox "Raw RTT — bypass DOF" [ref=e312]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  198 |   await openOverlayMenuIfNeeded(page);
  199 |   await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  200 |   await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "false");
  201 | 
  202 |   // Reset Movements in free mode does NOT restore Optical Geometry visibility
  203 |   await page.getByRole("button", { name: "Reset Movements" }).click();
  204 |   // Optical Geometry visibility is user-controlled in free mode, not task-managed
  205 | 
  206 |   expect(pageErrors).toEqual([]);
  207 |   expect(consoleProblems).toEqual([]);
  208 | });
  209 | 
  210 | test("Understanding Camera Movements Camera focus follows continuous viewpoint changes", async ({ page }) => {
  211 |   test.setTimeout(90_000);
  212 |   await page.goto("/simulator/free/understanding-camera-movements");
  213 | 
  214 |   const sceneCanvas = page.getByTestId("scene-canvas");
  215 |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  216 |   await expect(sceneCanvas).toHaveAttribute("data-mounted-lattice", "true", { timeout: 15_000 });
  217 |   const geometryId = await sceneCanvas.getAttribute("data-mounted-lattice-geometry-id");
  218 |   const generation = await sceneCanvas.getAttribute("data-mounted-lattice-generation");
  219 |   expect(geometryId).toBeTruthy();
  220 |   expect(generation).toBeTruthy();
  221 | 
  222 |   const cameraButton = page.getByRole("button", { name: "Camera", exact: true });
  223 |   const sceneButton = page.getByRole("button", { name: "Scene", exact: true });
  224 |   const viewpoint = page.getByRole("slider", { name: "Viewpoint" });
  225 |   const framing = page.getByRole("slider", { name: "Vertical framing" });
  226 |   const framingStandards = page.getByRole("group", { name: "Vertical framing standard" });
  227 |   await cameraButton.click();
  228 |   await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");
  229 | 
  230 |   const neutralView = await expectCameraFocusTarget(sceneCanvas);
  231 |   const inspectionDistance = viewDistance(neutralView);
  232 |   const currentRtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  233 |   await expect(currentRtt).toHaveCount(1);
  234 |   const rttHandle = await currentRtt.elementHandle();
  235 |   const rttResourceGeneration = await currentRtt.getAttribute("data-rtt-resource-generation");
  236 |   const rttSubjectGeneration = await currentRtt.getAttribute("data-rtt-lattice-subject-generation");
  237 |   const rttGeometryId = await currentRtt.getAttribute("data-rtt-lattice-geometry-id");
  238 |   if (!rttHandle || !rttResourceGeneration || !rttSubjectGeneration || !rttGeometryId) {
  239 |     throw new Error("Current Ground Glass identities unavailable");
  240 |   }
  241 | 
  242 |   const expectRendererIdentitiesStable = async () => {
  243 |     await expect(sceneCanvas).toHaveAttribute("data-mounted-lattice-geometry-id", geometryId!);
  244 |     await expect(sceneCanvas).toHaveAttribute("data-mounted-lattice-generation", generation!);
  245 |     await expect(currentRtt).toHaveCount(1);
  246 |     await expect(currentRtt).toHaveAttribute("data-rtt-resource-generation", rttResourceGeneration);
  247 |     await expect(currentRtt).toHaveAttribute("data-rtt-lattice-subject-generation", rttSubjectGeneration);
  248 |     await expect(currentRtt).toHaveAttribute("data-rtt-lattice-geometry-id", rttGeometryId);
  249 |     expect(
  250 |       await page.evaluate(
  251 |         (node) => node === document.querySelector('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]'),
  252 |         rttHandle,
  253 |       ),
  254 |     ).toBe(true);
  255 |   };
  256 | 
  257 |   // Standard vertical framing changes the image movement while the complete
  258 |   // camera remains at the neutral inspection pivot.
  259 |   await framing.fill("0.5");
  260 |   await expect(framing).toHaveValue("0.5");
  261 |   const frontFramingView = await expectCameraFocusTarget(sceneCanvas);
  262 |   expect(frontFramingView.target).toEqual(neutralView.target);
  263 |   expectTranslatedByTargetDelta(neutralView, frontFramingView);
  264 |   expectSameObserverOffset(neutralView, frontFramingView);
  265 |   expect(viewDistance(frontFramingView)).toBeCloseTo(inspectionDistance, 5);
  266 |   await expectRendererIdentitiesStable();
  267 | 
  268 |   await framingStandards.getByRole("radio", { name: "Rear standard" }).click();
  269 |   const rearFramingView = await expectCameraFocusTarget(sceneCanvas);
  270 |   expect(rearFramingView.target).toEqual(neutralView.target);
  271 |   expectTranslatedByTargetDelta(frontFramingView, rearFramingView);
  272 |   expectSameObserverOffset(frontFramingView, rearFramingView);
  273 |   expect(viewDistance(rearFramingView)).toBeCloseTo(inspectionDistance, 5);
  274 |   await expectRendererIdentitiesStable();
  275 | 
  276 |   await viewpoint.fill("0.5");
  277 |   await expect(viewpoint).toHaveValue("0.5");
  278 |   const intermediateView = await expectCameraFocusTarget(sceneCanvas);
  279 |   expect(intermediateView.target).not.toEqual(neutralView.target);
  280 |   expectTranslatedByTargetDelta(neutralView, intermediateView);
  281 |   expectSameObserverOffset(neutralView, intermediateView);
  282 |   expect(viewDistance(intermediateView)).toBeCloseTo(inspectionDistance, 5);
  283 |   await expectRendererIdentitiesStable();
  284 | 
  285 |   await viewpoint.fill("1");
  286 |   await expect(viewpoint).toHaveValue("1");
  287 |   await expect(sceneCanvas).toHaveAttribute("data-camera-rig-anchor", "high");
  288 |   const c3View = await expectCameraFocusTarget(sceneCanvas);
  289 |   expect(c3View.target).not.toEqual(neutralView.target);
  290 |   expect(c3View.target).not.toEqual(intermediateView.target);
  291 |   expect(intermediateView.target).not.toEqual(c3View.target);
  292 |   expectTranslatedByTargetDelta(neutralView, c3View);
  293 |   expectTranslatedByTargetDelta(intermediateView, c3View);
  294 |   expectSameObserverOffset(intermediateView, c3View);
  295 |   expect(viewDistance(c3View)).toBeCloseTo(inspectionDistance, 5);
  296 |   await expectRendererIdentitiesStable();
  297 | 
> 298 |   await viewpoint.fill("-1");
      |                   ^ Error: locator.fill: Test timeout of 90000ms exceeded.
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
  393 |   await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
  394 | });
  395 | 
  396 | test("SPA scene switching discards the previous Camera target and returns to Scene focus", async ({ page }) => {
  397 |   await page.goto("/scenes");
  398 |   const openScene = async (heading: string) => {
```