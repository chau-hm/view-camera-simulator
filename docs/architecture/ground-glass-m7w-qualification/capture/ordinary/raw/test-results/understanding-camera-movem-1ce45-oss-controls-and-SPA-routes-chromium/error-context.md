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
Error: expect(locator).not.toHaveAttribute(expected) failed

Locator: locator('[data-testid="ground-glass-rtt"]')
Expected pattern: not /.+/
Received string: ""

Call log:
  - Expect "not toHaveAttribute" with timeout 5000ms
  - waiting for locator('[data-testid="ground-glass-rtt"]')

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
  299 |   await page.getByRole("link", { name: "All Scenes" }).click();
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
> 320 |   await expect(legacyRtt).not.toHaveAttribute("data-rtt-lattice-edge-count", /.+/);
      |                               ^ Error: expect(locator).not.toHaveAttribute(expected) failed
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