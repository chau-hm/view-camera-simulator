# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scene-view-focus.spec.ts >> Understanding Camera Movements Camera focus follows continuous viewpoint changes
- Location: src/tests/e2e/scene-view-focus.spec.ts:210:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('scene-canvas').locator('canvas')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByTestId('scene-canvas').locator('canvas')
    5 × locator resolved to 0 elements
      - unexpected value "0"

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
              - paragraph [ref=e106]: Side view | Neutral viewpoint
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
                  - generic [ref=e127]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e128]:
                    - generic "Camera body rail"
                    - generic "Simplified bellows connector"
                - generic [ref=e132]:
                  - generic [ref=e134]: Current
                  - generic [ref=e135]: Original
              - generic "Optical depth order" [ref=e136]:
                - generic [ref=e139]: Film 0 mm
                - generic [ref=e142]: Lens 94 mm
                - generic [ref=e145]: DOF limit 1.7 m
                - generic [ref=e148]: Focus 2.1 m
                - generic [ref=e151]: Far DOF > 2.7 m
          - group [ref=e154]:
            - generic "Optical Debug understanding-camera-movements · parallel" [ref=e155] [cursor=pointer]:
              - generic [ref=e156]: Optical Debug
              - generic [ref=e157]: understanding-camera-movements · parallel
        - complementary [ref=e158]:
          - generic [ref=e159]:
            - region "Camera Controls" [ref=e160]:
              - heading "Camera Controls" [level=3] [ref=e162]
              - generic [ref=e163]:
                - group "Lens / Angle of View" [ref=e165]:
                  - generic [ref=e166]: Lens / Angle of View
                  - paragraph [ref=e167]: "At the same camera position, focal length changes angle of view and framing, not perspective. Lens coverage is separate from focal length: lenses with the same focal length can cover different areas. Rise and Shift use spare coverage; they do not create more."
                  - radiogroup "Lens options" [ref=e168]:
                    - generic [ref=e169] [cursor=pointer]:
                      - 'radio "90 mm — Wide — Lens coverage: 100.9° simulator coverage (teaching profile)" [checked] [ref=e170]'
                      - generic [ref=e171]:
                        - generic [ref=e172]: Wide
                        - generic [ref=e173]: ·
                        - generic [ref=e174]: 90 mm
                      - generic [ref=e175]: "Lens coverage: 100.9° simulator coverage (teaching profile)"
                    - generic [ref=e176] [cursor=pointer]:
                      - 'radio "105 mm — — Lens coverage: 92.1° simulator coverage (teaching profile)" [ref=e177]'
                      - generic [ref=e179]: 105 mm
                      - generic [ref=e180]: "Lens coverage: 92.1° simulator coverage (teaching profile)"
                    - generic [ref=e181] [cursor=pointer]:
                      - 'radio "120 mm — — Lens coverage: 84.5° simulator coverage (teaching profile)" [ref=e182]'
                      - generic [ref=e184]: 120 mm
                      - generic [ref=e185]: "Lens coverage: 84.5° simulator coverage (teaching profile)"
                    - generic [ref=e186] [cursor=pointer]:
                      - 'radio "150 mm — Standard — Lens coverage: 72° simulator coverage (teaching profile)" [ref=e187]'
                      - generic [ref=e188]:
                        - generic [ref=e189]: Standard
                        - generic [ref=e190]: ·
                        - generic [ref=e191]: 150 mm
                      - generic [ref=e192]: "Lens coverage: 72° simulator coverage (teaching profile)"
                  - generic [ref=e193]:
                    - generic [ref=e194]: Selected lens
                    - generic [ref=e195]: Wide · 90 mm
                    - generic [ref=e196]:
                      - generic [ref=e197]: Lens coverage
                      - generic [ref=e198]: 100.9° simulator coverage (teaching profile)
                    - generic [ref=e199]:
                      - generic [ref=e200]: Image circle
                      - generic [ref=e201]: 228.2 mm at current focus
                - region "Camera Movement" [ref=e203]:
                  - heading "Camera Movement" [level=3] [ref=e204]
                  - paragraph [ref=e205]: Explore viewpoint and standard movements continuously.
                  - region "Viewpoint" [ref=e206]:
                    - heading "Viewpoint" [level=4] [ref=e207]
                    - paragraph [ref=e208]: Move the whole camera lower or higher while keeping the standards neutral.
                    - generic [ref=e209]:
                      - generic [ref=e210]: Viewpoint
                      - generic [ref=e211]: Neutral viewpoint
                    - slider "Viewpoint" [ref=e212]: "0"
                    - group "Viewpoint positions" [ref=e213]:
                      - generic [ref=e214]: Lower
                      - generic [ref=e215]: Neutral
                      - generic [ref=e216]: Higher
                  - region "Tilt" [ref=e217]:
                    - heading "Tilt" [level=4] [ref=e218]
                    - paragraph [ref=e219]: Tilt the front or rear standard while the camera remains at the neutral viewpoint.
                    - group "Tilt standard" [ref=e220]:
                      - generic [ref=e221]: Standard
                      - generic [ref=e222]:
                        - radio "Front standard" [checked] [ref=e223]
                        - generic [ref=e224]: Front standard
                      - generic [ref=e225]:
                        - radio "Rear standard" [ref=e226]
                        - generic [ref=e227]: Rear standard
                    - generic [ref=e228]:
                      - generic [ref=e229]: Tilt
                      - generic [ref=e230]: 0.0°
                    - slider "Tilt" [ref=e231]: "0"
                    - group "Tilt positions" [ref=e232]:
                      - generic [ref=e233]: Negative -5.0°
                      - generic [ref=e234]: Zero
                      - generic [ref=e235]: Positive +5.0°
                  - region "Vertical Framing" [ref=e236]:
                    - heading "Vertical Framing" [level=4] [ref=e237]
                    - paragraph [ref=e238]: Move the front or rear standard vertically to frame a lower or higher part of the subject.
                    - group "Vertical framing standard" [ref=e239]:
                      - generic [ref=e240]: Standard
                      - generic [ref=e241]:
                        - radio "Front standard" [checked] [ref=e242]
                        - generic [ref=e243]: Front standard
                      - generic [ref=e244]:
                        - radio "Rear standard" [ref=e245]
                        - generic [ref=e246]: Rear standard
                    - generic [ref=e247]:
                      - generic [ref=e248]: Vertical framing
                      - generic [ref=e249]: Front standard, middle framing
                    - slider "Vertical framing" [ref=e250]: "0"
                    - group "Vertical framing positions" [ref=e251]:
                      - generic [ref=e252]: Lower
                      - generic [ref=e253]: Middle
                      - generic [ref=e254]: Upper
                  - status [ref=e255]: Neutral viewpoint
                - region "Focus" [ref=e257]:
                  - heading "Focus" [level=3] [ref=e258]
                  - generic [ref=e259]:
                    - generic [ref=e260]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e261]: "2000"
                    - generic [ref=e262]: 2000.0 mm
                  - generic [ref=e263]: Focus is fixed for this lesson
                - region "Aperture" [ref=e265]:
                  - heading "Aperture" [level=3] [ref=e266]
                  - radiogroup "Aperture" [disabled] [ref=e267]:
                    - generic [ref=e268]:
                      - radio "f/5.6" [disabled] [ref=e269]
                      - generic [ref=e270]: f/5.6
                    - generic [ref=e271]:
                      - radio "f/8" [disabled] [ref=e272]
                      - generic [ref=e273]: f/8
                    - generic [ref=e274]:
                      - radio "f/11" [checked] [disabled] [ref=e275]
                      - generic [ref=e276]: f/11
                    - generic [ref=e277]:
                      - radio "f/16" [disabled] [ref=e278]
                      - generic [ref=e279]: f/16
                    - generic [ref=e280]:
                      - radio "f/22" [disabled] [ref=e281]
                      - generic [ref=e282]: f/22
                    - generic [ref=e283]:
                      - radio "f/32" [disabled] [ref=e284]
                      - generic [ref=e285]: f/32
                  - generic [ref=e286]: Aperture is fixed for this lesson
                - generic [ref=e287]:
                  - generic [ref=e288]: Reset
                  - region "Reset" [ref=e289]:
                    - button "Reset movements" [ref=e291] [cursor=pointer]
            - region "Developer Tools" [ref=e292]:
              - heading "Developer Tools" [level=3] [ref=e293]
              - generic [ref=e295]:
                - checkbox "Raw RTT — bypass DOF" [ref=e296]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  115 |   await page.goto("/simulator/free/architecture-rise");
  116 |   const sceneCanvas = page.getByTestId("scene-canvas");
  117 |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1, { timeout: 15_000 });
  118 |   await expect(sceneCanvas).toHaveAttribute("data-observer-renderer-surface", "observer");
  119 |   await expect(sceneCanvas).toHaveAttribute(
  120 |     "data-observer-renderer-status",
  121 |     "active",
  122 |     { timeout: 15_000 },
  123 |   );
  124 |   await expect(sceneCanvas).toHaveAttribute("data-observer-renderer-request", "webgl");
  125 |   await expect(sceneCanvas).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  126 |   await expect(sceneCanvas).toHaveAttribute("data-observer-execution-backend", "webgl2");
  127 |   await expect(sceneCanvas).toHaveAttribute("data-observer-application-fallback", "none");
  128 |   await expect(sceneCanvas).toHaveAttribute("data-observer-webgpu-api-present", /^(true|false)$/);
  129 |   await expect(sceneCanvas).toHaveAttribute("data-observer-shadow-map-status", "active");
  130 |   await expect(sceneCanvas).toHaveAttribute("data-observer-shadow-map-type", "pcf");
  131 |   await expect(sceneCanvas).toHaveAttribute("data-observer-tone-mapping-active", /^(true|false)$/);
  132 |   await expect(sceneCanvas).toHaveAttribute("data-observer-tone-mapping", /.+/);
  133 |   await expect(sceneCanvas).toHaveAttribute("data-observer-tone-mapping-exposure", /^\d+(?:\.\d+)?$/);
  134 |   await expect(sceneCanvas).toHaveAttribute("data-observer-output-color-space", /.+/);
  135 |   await expect(sceneCanvas).toHaveAttribute("data-view-focus", "scene");
  136 |   await expect(sceneCanvas).toHaveAttribute("data-optical-geometry-visible", "true");
  137 |   const scenePreset = await readViewState(sceneCanvas);
  138 |
  139 |   await orbitScene(page, sceneCanvas);
  140 |   await expect.poll(async () => (await readViewState(sceneCanvas)).position).not.toEqual(scenePreset.position);
  141 |   const savedSceneView = await readViewState(sceneCanvas);
  142 |
  143 |   const cameraButton = page.getByRole("button", { name: "Camera" });
  144 |   await cameraButton.focus();
  145 |   await page.keyboard.press("Enter");
  146 |   await expect(cameraButton).toHaveAttribute("aria-pressed", "true");
  147 |   await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");
  148 |   const cameraPreset = await readViewState(sceneCanvas);
  149 |   expect(cameraPreset.target).not.toEqual(scenePreset.target);
  150 |   expect(viewDistance(cameraPreset)).toBeCloseTo(0.72, 4);
  151 |
  152 |   await orbitScene(page, sceneCanvas);
  153 |   await expect.poll(async () => (await readViewState(sceneCanvas)).position).not.toEqual(cameraPreset.position);
  154 |   const orbitedCameraView = await readViewState(sceneCanvas);
  155 |   const wheelPoint = await getSceneInteractionPoint(page, sceneCanvas);
  156 |   await page.mouse.move(wheelPoint.x, wheelPoint.y);
  157 |   await page.mouse.wheel(0, -360);
  158 |   await expect.poll(async () => viewDistance(await readViewState(sceneCanvas))).not.toBeCloseTo(
  159 |     viewDistance(orbitedCameraView),
  160 |     4,
  161 |   );
  162 |
  163 |   await page.getByRole("button", { name: "Reset 3D view" }).click();
  164 |   await expect.poll(async () => viewDistance(await readViewState(sceneCanvas))).toBeCloseTo(0.72, 4);
  165 |
  166 |   const beforeRise = await readStableViewState(sceneCanvas);
  167 |   const beforeRiseGeometry = await page.getByTestId("optical-debug-front-y-mm").textContent();
  168 |   await page.getByLabel("Rise").press("ArrowRight");
  169 |   await expect(page.getByTestId("optical-debug-front-y-mm")).not.toHaveText(beforeRiseGeometry ?? "");
  170 |   await expect.poll(async () => (await readViewState(sceneCanvas)).target).toEqual(beforeRise.target);
  171 |
  172 |   for (const movementControl of ["Focus distance", "Tilt", "Swing"]) {
  173 |     await page.getByLabel(movementControl).press("ArrowRight");
  174 |     await expect.poll(async () => (await readViewState(sceneCanvas)).target).toEqual(beforeRise.target);
  175 |   }
  176 |   const afterMovements = await readStableViewState(sceneCanvas);
  177 |
  178 |   const sceneButton = page.getByRole("button", { name: "Scene", exact: true });
  179 |   await sceneButton.focus();
  180 |   await page.keyboard.press("Space");
  181 |   await expect(sceneButton).toHaveAttribute("aria-pressed", "true");
  182 |   await expect.poll(() => readViewState(sceneCanvas)).toEqual(savedSceneView);
  183 |
  184 |   await page.getByRole("button", { name: "Reset 3D view" }).click();
  185 |   await expect.poll(() => readViewState(sceneCanvas)).toEqual(scenePreset);
  186 |
  187 |   await cameraButton.click();
  188 |   await expect.poll(() => readViewState(sceneCanvas)).toEqual(afterMovements);
  189 |   await page.getByRole("button", { name: "Reset 3D view" }).click();
  190 |   await expect.poll(async () => viewDistance(await readViewState(sceneCanvas))).toBeCloseTo(0.72, 4);
  191 |   await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");
  192 |
  193 |   // Free mode: Restart Task is absent, Reset Movements is present
  194 |   await expect(page.getByRole("button", { name: "Restart Task" })).toHaveCount(0);
  195 |   await expect(page.getByRole("button", { name: "Reset Movements" })).toBeVisible();
  196 |
  197 |   // Optical Geometry toggle in free mode (not tied to task restart)
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
> 215 |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
      |                                               ^ Error: expect(locator).toHaveCount(expected) failed
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
```