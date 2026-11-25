# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: understanding-camera-movements.spec.ts >> canonical lattice remains stable across controls and SPA routes
- Location: src/tests/e2e/understanding-camera-movements.spec.ts:191:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'All Scenes' })
    - locator resolved to <a href="/scenes" data-discover="true" class="btn btn--ghost">All Scenes</a>

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
                    - button "Reset movements" [active] [ref=e291] [cursor=pointer]
            - region "Developer Tools" [ref=e292]:
              - heading "Developer Tools" [level=3] [ref=e293]
              - generic [ref=e295]:
                - checkbox "Raw RTT — bypass DOF" [ref=e296]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  199 |     if (!(message.type() === "warning" || message.type() === "error") || !/(WebGL|THREE|GPU)/i.test(text)) return;
  200 |     if (/GPU stall due to ReadPixels/i.test(text)) return;
  201 |     unexpectedGraphicsMessages.push(`${message.type()}: ${text}`);
  202 |   });
  203 | 
  204 |   await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  205 |   const scene = page.locator('[data-testid="scene-canvas"]');
  206 |   const rtt = publicCurrentRtt(page);
  207 |   const sceneCanvas = scene.locator("canvas");
  208 |   await expect(sceneCanvas).toHaveCount(1);
  209 |   await expect(scene).toHaveAttribute("data-mounted-lattice", "true", { timeout: 15_000 });
  210 |   await expect(scene).toHaveAttribute("data-mounted-lattice-edge-count", "224");
  211 |   await expect(scene).toHaveAttribute("data-mounted-lattice-presentation-region", "whole");
  212 |   await expect(scene).toHaveAttribute("data-reference-camera-visible", "false");
  213 |   const initialGeometryId = await scene.getAttribute("data-mounted-lattice-geometry-id");
  214 |   const initialGenerationValue = await scene.getAttribute("data-mounted-lattice-generation");
  215 |   const initialGeneration = Number(initialGenerationValue);
  216 |   expect(initialGeometryId).toBeTruthy();
  217 |   expect(Number.isSafeInteger(initialGeneration) && initialGeneration > 0).toBe(true);
  218 |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  219 |   await expect(scene).toHaveAttribute("data-camera-rig-origin", "0.000000,0.000000,0.000000");
  220 |   await expect(scene).toHaveAttribute("data-camera-rig-base-pitch-deg", "0.000000");
  221 |   await expect(scene).toHaveAttribute("data-camera-body-pitch-deg", "0.000000");
  222 |   await expectFiniteVectorAttribute(scene, "data-camera-body-pivot-world");
  223 |   await expect(scene).toHaveAttribute(
  224 |     "data-camera-lens-center-world",
  225 |     "0.000000,0.000000,0.000000",
  226 |   );
  227 |   await expectFiniteVectorAttribute(scene, "data-camera-film-center-world");
  228 |   await expect(rtt).toHaveAttribute("data-rtt-lattice-geometry-id", initialGeometryId!);
  229 |   await expect(rtt).toHaveAttribute("data-rtt-lattice-edge-count", "224");
  230 |   await expect(rtt).toHaveAttribute("data-rtt-lattice-presentation-region", "whole");
  231 |   expect(await rtt.getAttribute("data-rtt-lattice-edge-count")).toBe(
  232 |     await scene.getAttribute("data-mounted-lattice-edge-count"),
  233 |   );
  234 |   expect(await rtt.getAttribute("data-rtt-lattice-presentation-region")).toBe(
  235 |     await scene.getAttribute("data-mounted-lattice-presentation-region"),
  236 |   );
  237 |   await disableOpticalGeometry(page, scene);
  238 |   const initialVisual = await readSceneCanvasVisualSample(sceneCanvas);
  239 |   expect(initialVisual.supported).toBe(true);
  240 |   expect(initialVisual.chromaticPixels).toBeGreaterThan(20);
  241 |   expect(initialVisual.brightNeutralPixels / Math.max(initialVisual.brightPixels, 1)).toBeLessThan(0.95);
  242 |   await expect(page.getByText("Subjects", { exact: true })).toHaveCount(0);
  243 |   await expect(scene).toHaveAttribute("data-lattice-edge-count", "224", { timeout: 15_000 });
  244 |   await expect(scene).toHaveAttribute("data-lattice-target-region", "middle", { timeout: 15_000 });
  245 |   await expect(scene).toHaveAttribute("data-reference-camera-visible", "false", { timeout: 15_000 });
  246 |   await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", "90", { timeout: 15_000 });
  247 |   await expect(rtt).toHaveAttribute("data-rtt-lattice-edge-count", "224", { timeout: 15_000 });
  248 |   await expect(rtt).toHaveAttribute("data-rtt-lattice-presentation-region", "whole", { timeout: 15_000 });
  249 |   const initialRttGeneration = await rtt.getAttribute(
  250 |     "data-rtt-resource-generation",
  251 |   );
  252 |   const initialRttCameraPosition = await rtt.getAttribute(
  253 |     "data-rtt-camera-position",
  254 |   );
  255 |   expect(initialRttGeneration).toBeTruthy();
  256 |   expect(initialRttCameraPosition).toBeTruthy();
  257 | 
  258 |   await page.getByRole("slider", { name: "Vertical framing" }).fill("1");
  259 |   await expect(page.getByRole("slider", { name: "Vertical framing" })).toHaveValue("1");
  260 |   await expect
  261 |     .poll(() => rtt.getAttribute("data-rtt-camera-position"))
  262 |     .not.toBe(initialRttCameraPosition);
  263 |   await expect(rtt).toHaveAttribute(
  264 |     "data-rtt-resource-generation",
  265 |     initialRttGeneration!,
  266 |   );
  267 |   await expect(scene).toHaveAttribute(
  268 |     "data-mounted-lattice-generation",
  269 |     initialGenerationValue!,
  270 |   );
  271 |   await expect(scene).toHaveAttribute(
  272 |     "data-mounted-lattice-geometry-id",
  273 |     initialGeometryId!,
  274 |   );
  275 |   await page.getByRole("button", { name: "Reset Movements" }).click();
  276 |   await expect(page.getByRole("slider", { name: "Viewpoint" })).toHaveValue("0");
  277 |   await expect(rtt).toHaveAttribute(
  278 |     "data-rtt-camera-position",
  279 |     initialRttCameraPosition!,
  280 |   );
  281 |   await expect(rtt).toHaveAttribute(
  282 |     "data-rtt-resource-generation",
  283 |     initialRttGeneration!,
  284 |   );
  285 |   await expect(scene).toHaveAttribute(
  286 |     "data-mounted-lattice-generation",
  287 |     initialGenerationValue!,
  288 |   );
  289 |   await expect(scene).toHaveAttribute("data-lattice-target-region", "middle");
  290 |   await expect(rtt).toHaveAttribute("data-rtt-lattice-presentation-region", "whole");
  291 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5000 });
  292 |   await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
  293 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });
  294 | 
  295 |   const initialSceneHandle = await scene.elementHandle();
  296 |   const initialRttHandle = await rtt.elementHandle();
  297 |   expect(initialSceneHandle).toBeTruthy();
  298 |   expect(initialRttHandle).toBeTruthy();
> 299 |   await page.getByRole("link", { name: "All Scenes" }).click();
      |                                                        ^ Error: locator.click: Test timeout of 120000ms exceeded.
  300 |   await expect
  301 |     .poll(() => page.evaluate((node) => !node.isConnected, initialSceneHandle!))
  302 |     .toBe(true);
  303 |   await expect
  304 |     .poll(() => page.evaluate((node) => !node.isConnected, initialRttHandle!))
  305 |     .toBe(true);
  306 |   await page
  307 |     .getByRole("article")
  308 |     .filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) })
  309 |     .getByRole("link", { name: "Open Scene" })
  310 |     .click();
  311 |   await enableRttDiagnosticsWithoutNavigation(page);
  312 |   const architectureScene = page.locator('[data-testid="scene-canvas"]');
  313 |   await expect(architectureScene).not.toHaveAttribute("data-mounted-lattice", "true");
  314 |   await expect(architectureScene).not.toHaveAttribute(
  315 |     "data-mounted-lattice-geometry-id",
  316 |     /.+/,
  317 |   );
  318 |   const legacyRtt = page.locator('[data-testid="ground-glass-rtt"]');
  319 |   await expect(legacyRtt).toHaveAttribute("data-rtt-focal-length-mm", "150", { timeout: 15_000 });
  320 |   await expect(legacyRtt).not.toHaveAttribute("data-rtt-lattice-edge-count", /.+/);
  321 |   await expect(legacyRtt).not.toHaveAttribute("data-rtt-lattice-geometry-id", /.+/);
  322 |   const architectureSceneHandle = await architectureScene.elementHandle();
  323 |   const architectureRttHandle = await legacyRtt.elementHandle();
  324 |   expect(architectureSceneHandle).toBeTruthy();
  325 |   expect(architectureRttHandle).toBeTruthy();
  326 |   await page.getByRole("link", { name: "All Scenes" }).click();
  327 |   await expect
  328 |     .poll(() =>
  329 |       page.evaluate((node) => !node.isConnected, architectureSceneHandle!),
  330 |     )
  331 |     .toBe(true);
  332 |   await expect
  333 |     .poll(() => page.evaluate((node) => !node.isConnected, architectureRttHandle!))
  334 |     .toBe(true);
  335 |   await page
  336 |     .getByRole("article")
  337 |     .filter({ has: page.getByRole("heading", { name: "Understanding Camera Movements" }) })
  338 |     .getByRole("link", { name: "Open Scene" })
  339 |     .click();
  340 |   await enableRttDiagnosticsWithoutNavigation(page);
  341 |   const returnedScene = page.locator('[data-testid="scene-canvas"]');
  342 |   const returnedRtt = publicCurrentRtt(page);
  343 |   await expect(returnedRtt).toHaveCount(1, { timeout: 15_000 });
  344 |   await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel^="camera-movement-"]')).toHaveCount(0);
  345 |   await expect(returnedScene).toHaveAttribute("data-lattice-edge-count", "224", { timeout: 15_000 });
  346 |   await expect(returnedScene).toHaveAttribute("data-mounted-lattice", "true", { timeout: 15_000 });
  347 |   await expect(returnedScene).toHaveAttribute("data-mounted-lattice-edge-count", "224");
  348 |   await expect(returnedScene).toHaveAttribute("data-mounted-lattice-presentation-region", "whole");
  349 |   await expect(returnedScene).toHaveAttribute(
  350 |     "data-camera-rig-anchor",
  351 |     "mid",
  352 |   );
  353 |   await expect(returnedScene).toHaveAttribute(
  354 |     "data-camera-rig-origin",
  355 |     "0.000000,0.000000,0.000000",
  356 |   );
  357 |   await expect(returnedScene).toHaveAttribute(
  358 |     "data-camera-rig-base-pitch-deg",
  359 |     "0.000000",
  360 |   );
  361 |   await expect(returnedScene).toHaveAttribute(
  362 |     "data-camera-body-pitch-deg",
  363 |     "0.000000",
  364 |   );
  365 |   const returnedGeometryId = await returnedScene.getAttribute("data-mounted-lattice-geometry-id");
  366 |   const returnedGeneration = Number(
  367 |     await returnedScene.getAttribute("data-mounted-lattice-generation"),
  368 |   );
  369 |   expect(returnedGeometryId).toBe(initialGeometryId);
  370 |   expect(Number.isSafeInteger(returnedGeneration) && returnedGeneration > 0).toBe(true);
  371 |   expect(returnedGeneration).not.toBe(initialGeneration);
  372 |   await expect(returnedRtt).toHaveAttribute("data-rtt-focal-length-mm", "90", { timeout: 15_000 });
  373 |   await expect(returnedRtt).toHaveAttribute("data-rtt-lattice-edge-count", "224", { timeout: 15_000 });
  374 |   await expect(returnedRtt).toHaveAttribute("data-rtt-lattice-geometry-id", returnedGeometryId!);
  375 |   await expect(returnedRtt).toHaveAttribute("data-rtt-lattice-presentation-region", "whole");
  376 |   await expect(returnedRtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15_000 });
  377 |   await expect(returnedRtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 15_000 });
  378 |   await disableOpticalGeometry(page, returnedScene);
  379 |   const returnVisual = await readSceneCanvasVisualSample(returnedScene.locator("canvas"));
  380 |   expect(returnVisual.supported).toBe(true);
  381 |   expect(returnVisual.chromaticPixels).toBeGreaterThan(20);
  382 |   expect(returnVisual.brightNeutralPixels / Math.max(returnVisual.brightPixels, 1)).toBeLessThan(0.95);
  383 | 
  384 |   expect(pageErrors).toEqual([]);
  385 |   expect(unexpectedGraphicsMessages).toEqual([]);
  386 | });
  387 | 
```