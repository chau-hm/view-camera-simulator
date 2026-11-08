# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: camera-movement-public-controls.spec.ts >> 3D Scene layout stays stable across continuous movement sliders
- Location: src/tests/e2e/camera-movement-public-controls.spec.ts:149:1

# Error details

```
Error: Timeout 5000ms exceeded while waiting on the predicate
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
              - paragraph [ref=e106]: Side view | Lower viewpoint · 12% toward lower viewpoint
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
                  - generic "film plane" [ref=e130]
                  - generic "lens plane" [ref=e132]
                  - generic "focus plane" [ref=e134]
                  - generic "nearDof plane" [ref=e136]
                  - generic [ref=e137]:
                    - generic "Camera body rail" [ref=e138]
                    - generic "Simplified bellows connector" [ref=e139]
                - generic [ref=e145]:
                  - generic [ref=e147]: Current
                  - generic [ref=e148]: Original
              - generic "Optical depth order" [ref=e149]:
                - generic [ref=e152]: Film 0 mm
                - generic [ref=e155]: Lens 94 mm
                - generic [ref=e158]: DOF limit 1.7 m
                - generic [ref=e161]: Focus 2.1 m
                - generic [ref=e164]: Far DOF > 2.7 m
          - group [ref=e167]:
            - generic "Optical Debug understanding-camera-movements · parallel" [ref=e168] [cursor=pointer]:
              - generic [ref=e169]: Optical Debug
              - generic [ref=e170]: understanding-camera-movements · parallel
        - complementary [ref=e171]:
          - generic [ref=e172]:
            - region "Camera Controls" [ref=e173]:
              - heading "Camera Controls" [level=3] [ref=e175]
              - generic [ref=e176]:
                - group "Lens / Angle of View" [ref=e178]:
                  - generic [ref=e179]: Lens / Angle of View
                  - paragraph [ref=e180]: "At the same camera position, focal length changes angle of view and framing, not perspective. Lens coverage is separate from focal length: lenses with the same focal length can cover different areas. Rise and Shift use spare coverage; they do not create more."
                  - radiogroup "Lens options" [ref=e181]:
                    - generic [ref=e182] [cursor=pointer]:
                      - 'radio "90 mm — Wide — Lens coverage: 100.9° simulator coverage (teaching profile)" [checked] [ref=e183]'
                      - generic [ref=e184]:
                        - generic [ref=e185]: Wide
                        - generic [ref=e186]: ·
                        - generic [ref=e187]: 90 mm
                      - generic [ref=e188]: "Lens coverage: 100.9° simulator coverage (teaching profile)"
                    - generic [ref=e189] [cursor=pointer]:
                      - 'radio "105 mm — — Lens coverage: 92.1° simulator coverage (teaching profile)" [ref=e190]'
                      - generic [ref=e192]: 105 mm
                      - generic [ref=e193]: "Lens coverage: 92.1° simulator coverage (teaching profile)"
                    - generic [ref=e194] [cursor=pointer]:
                      - 'radio "120 mm — — Lens coverage: 84.5° simulator coverage (teaching profile)" [ref=e195]'
                      - generic [ref=e197]: 120 mm
                      - generic [ref=e198]: "Lens coverage: 84.5° simulator coverage (teaching profile)"
                    - generic [ref=e199] [cursor=pointer]:
                      - 'radio "150 mm — Standard — Lens coverage: 72° simulator coverage (teaching profile)" [ref=e200]'
                      - generic [ref=e201]:
                        - generic [ref=e202]: Standard
                        - generic [ref=e203]: ·
                        - generic [ref=e204]: 150 mm
                      - generic [ref=e205]: "Lens coverage: 72° simulator coverage (teaching profile)"
                  - generic [ref=e206]:
                    - generic [ref=e207]: Selected lens
                    - generic [ref=e208]: Wide · 90 mm
                    - generic [ref=e209]:
                      - generic [ref=e210]: Lens coverage
                      - generic [ref=e211]: 100.9° simulator coverage (teaching profile)
                    - generic [ref=e212]:
                      - generic [ref=e213]: Image circle
                      - generic [ref=e214]: 228.2 mm at current focus
                - region "Camera Movement" [ref=e216]:
                  - heading "Camera Movement" [level=3] [ref=e217]
                  - paragraph [ref=e218]: Explore viewpoint and standard movements continuously.
                  - region "Viewpoint" [ref=e219]:
                    - heading "Viewpoint" [level=4] [ref=e220]
                    - paragraph [ref=e221]: Move the whole camera lower or higher while keeping the standards neutral.
                    - generic [ref=e222]:
                      - generic [ref=e223]: Viewpoint
                      - generic [ref=e224]: 12% toward lower viewpoint
                    - slider "Viewpoint" [active] [ref=e225]: "-0.12"
                    - group "Viewpoint positions" [ref=e226]:
                      - generic [ref=e227]: Lower
                      - generic [ref=e228]: Neutral
                      - generic [ref=e229]: Higher
                  - region "Tilt" [ref=e230]:
                    - heading "Tilt" [level=4] [ref=e231]
                    - paragraph [ref=e232]: Tilt the front or rear standard while the camera remains at the neutral viewpoint.
                    - group "Tilt standard" [ref=e233]:
                      - generic [ref=e234]: Standard
                      - generic [ref=e235]:
                        - radio "Front standard" [checked] [ref=e236]
                        - generic [ref=e237]: Front standard
                      - generic [ref=e238]:
                        - radio "Rear standard" [ref=e239]
                        - generic [ref=e240]: Rear standard
                    - generic [ref=e241]:
                      - generic [ref=e242]: Tilt
                      - generic [ref=e243]: 0.0°
                    - slider "Tilt" [ref=e244]: "0"
                    - group "Tilt positions" [ref=e245]:
                      - generic [ref=e246]: Negative -5.0°
                      - generic [ref=e247]: Zero
                      - generic [ref=e248]: Positive +5.0°
                  - region "Vertical Framing" [ref=e249]:
                    - heading "Vertical Framing" [level=4] [ref=e250]
                    - paragraph [ref=e251]: Move the front or rear standard vertically to frame a lower or higher part of the subject.
                    - group "Vertical framing standard" [ref=e252]:
                      - generic [ref=e253]: Standard
                      - generic [ref=e254]:
                        - radio "Front standard" [checked] [ref=e255]
                        - generic [ref=e256]: Front standard
                      - generic [ref=e257]:
                        - radio "Rear standard" [ref=e258]
                        - generic [ref=e259]: Rear standard
                    - generic [ref=e260]:
                      - generic [ref=e261]: Vertical framing
                      - generic [ref=e262]: Front standard, middle framing
                    - slider "Vertical framing" [ref=e263]: "0"
                    - group "Vertical framing positions" [ref=e264]:
                      - generic [ref=e265]: Lower
                      - generic [ref=e266]: Middle
                      - generic [ref=e267]: Upper
                  - status [ref=e268]: Lower viewpoint · 12% toward lower viewpoint
                - region "Focus" [ref=e270]:
                  - heading "Focus" [level=3] [ref=e271]
                  - generic [ref=e272]:
                    - generic [ref=e273]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e274]: "2000"
                    - generic [ref=e275]: 2000.0 mm
                  - generic [ref=e276]: Focus is fixed for this lesson
                - region "Aperture" [ref=e278]:
                  - heading "Aperture" [level=3] [ref=e279]
                  - radiogroup "Aperture" [disabled] [ref=e280]:
                    - generic [ref=e281]:
                      - radio "f/5.6" [disabled] [ref=e282]
                      - generic [ref=e283]: f/5.6
                    - generic [ref=e284]:
                      - radio "f/8" [disabled] [ref=e285]
                      - generic [ref=e286]: f/8
                    - generic [ref=e287]:
                      - radio "f/11" [checked] [disabled] [ref=e288]
                      - generic [ref=e289]: f/11
                    - generic [ref=e290]:
                      - radio "f/16" [disabled] [ref=e291]
                      - generic [ref=e292]: f/16
                    - generic [ref=e293]:
                      - radio "f/22" [disabled] [ref=e294]
                      - generic [ref=e295]: f/22
                    - generic [ref=e296]:
                      - radio "f/32" [disabled] [ref=e297]
                      - generic [ref=e298]: f/32
                  - generic [ref=e299]: Aperture is fixed for this lesson
                - generic [ref=e300]:
                  - generic [ref=e301]: Reset
                  - region "Reset" [ref=e302]:
                    - button "Reset movements" [ref=e304] [cursor=pointer]
            - region "Developer Tools" [ref=e305]:
              - heading "Developer Tools" [level=3] [ref=e306]
              - generic [ref=e308]:
                - checkbox "Raw RTT — bypass DOF" [ref=e309]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  85  |
  86  |   // 6. Move to the lower viewpoint endpoint: lower target, negative body pitch.
  87  |   await viewpoint.fill("-1");
  88  |   await expect(viewpoint).toHaveValue("-1");
  89  |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "low");
  90  |   await expect(scene).toHaveAttribute("data-lattice-target-region", "lower");
  91  |   await expect(scene).toHaveAttribute("data-camera-body-pitch-deg", "-34.000000");
  92  |   await expectGroundGlassValid(page);
  93  |
  94  |   // 7. Select the continuous lower framing endpoint and confirm negative fall.
  95  |   await framingStandards.getByRole("radio", { name: "Front standard" }).click();
  96  |   await framing.fill("-1");
  97  |   await expect(framing).toHaveValue("-1");
  98  |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  99  |   await expect(page.locator(".camera-movement-controls__status")).toContainText("Lower framing");
  100 |   await expectGroundGlassValid(page);
  101 |
  102 |   // 8. Reset Movements returns to the neutral Viewpoint state.
  103 |   await page.getByRole("button", { name: "Reset Movements" }).click();
  104 |   await expect(viewpoint).toHaveValue("0");
  105 |   await expect(tilt).toHaveValue("0");
  106 |   await expect(framing).toHaveValue("0");
  107 |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  108 |   await expect(scene).toHaveAttribute("data-lattice-target-region", "middle");
  109 |
  110 |   // 9. Orbit/zoom then Reset View restores the observer preset and preserves the case.
  111 |   await framing.fill("1");
  112 |   await expect(framing).toHaveValue("1");
  113 |   const sceneCanvas = scene.locator("canvas");
  114 |   const bounds = await sceneCanvas.boundingBox();
  115 |   if (bounds) {
  116 |     const x = bounds.x + bounds.width * 0.58;
  117 |     const y = bounds.y + bounds.height * 0.52;
  118 |     await page.mouse.move(x, y);
  119 |     await page.mouse.down();
  120 |     await page.mouse.move(x + 72, y - 36, { steps: 6 });
  121 |     await page.mouse.up();
  122 |   }
  123 |   await page.getByRole("button", { name: "Reset 3D view" }).click();
  124 |   await expect(framing).toHaveValue("1");
  125 |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  126 |   await expectGroundGlassValid(page);
  127 |
  128 |   // 10. Navigate away and return; neutral Viewpoint is restored.
  129 |   await page.getByRole("link", { name: "All Scenes" }).click();
  130 |   await page
  131 |     .getByRole("article")
  132 |     .filter({ has: page.getByRole("heading", { name: "Understanding Camera Movements" }) })
  133 |     .getByRole("link", { name: "Open Scene" })
  134 |     .click();
  135 |   await page.evaluate(() => {
  136 |     const url = new URL(window.location.href);
  137 |     url.searchParams.set("rttDiagnostics", "1");
  138 |     window.history.replaceState(window.history.state, "", url);
  139 |   });
  140 |   await expect(page.getByRole("slider", { name: "Viewpoint" })).toHaveValue("0", { timeout: 15000 });
  141 |   await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  142 |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  143 |   await expectGroundGlassValid(page);
  144 |
  145 |   expect(pageErrors).toEqual([]);
  146 |   expect(unexpectedGraphicsMessages).toEqual([]);
  147 | });
  148 |
  149 | test("3D Scene layout stays stable across continuous movement sliders", async ({ page }) => {
  150 |   test.setTimeout(90_000);
  151 |   await page.setViewportSize({ width: 1680, height: 900 });
  152 |   await page.goto("/simulator/free/understanding-camera-movements");
  153 |
  154 |   const viewportHost = page.locator(".scene-viewport-host");
  155 |   await expect(viewportHost).toBeVisible({ timeout: 15_000 });
  156 |   const initialBounds = await viewportHost.boundingBox();
  157 |   if (!initialBounds) throw new Error("3D Scene viewport bounds unavailable");
  158 |   const scenePanel = page.locator(".scene-panel");
  159 |
  160 |   const viewpoint = page.getByRole("slider", { name: "Viewpoint" });
  161 |   const framing = page.getByRole("slider", { name: "Vertical framing" });
  162 |   for (const [slider, value] of [
  163 |     [viewpoint, "0"],
  164 |     [viewpoint, "-0.12"],
  165 |     [viewpoint, "-1"],
  166 |     [viewpoint, "0.5"],
  167 |     [viewpoint, "1"],
  168 |     [framing, "0"],
  169 |     [framing, "-0.12"],
  170 |     [framing, "-1"],
  171 |     [framing, "0.5"],
  172 |     [framing, "1"],
  173 |   ] as const) {
  174 |     await slider.fill(value);
  175 |     await expect(slider).toHaveValue(value);
  176 |     await expect
  177 |       .poll(async () => {
  178 |         const bounds = await viewportHost.boundingBox();
  179 |         return Boolean(
  180 |           bounds &&
  181 |             Math.abs(bounds.y - initialBounds.y) <= 1 &&
  182 |             Math.abs(bounds.height - initialBounds.height) <= 1,
  183 |         );
  184 |       })
> 185 |       .toBe(true);
      |        ^ Error: Timeout 5000ms exceeded while waiting on the predicate
  186 |     await expect(scenePanel).not.toContainText("Front standard Y:");
  187 |     await expect(scenePanel).not.toContainText("Loaded assets:");
  188 |   }
  189 | });
  190 |
  191 | test("calibration route preserves workbench and hides public controls", async ({ page }) => {
  192 |   test.setTimeout(90_000);
  193 |   await page.goto("/simulator/free/understanding-camera-movements?cameraCalibration=1&rttDiagnostics=1");
  194 |   await expect(page.getByText("Camera Movement Calibration")).toBeVisible({ timeout: 15000 });
  195 |   await expect(page.getByRole("radio", { name: "A — Front tilt" })).toHaveCount(0);
  196 |
  197 |   // Make one valid calibration edit (change focal length from 90 to 120.5)
  198 |   const focalLength = page.getByLabel("Focal length (mm)");
  199 |   await focalLength.fill("120.5");
  200 |   await focalLength.press("Enter");
  201 |   await expect(page.getByLabel("Focal length (mm)")).toHaveValue("120.5");
  202 |
  203 |   // Public teaching controls remain absent after a workbench edit.
  204 |   await expect(page.getByRole("radio", { name: "A — Front tilt" })).toHaveCount(0);
  205 | });
  206 |
  207 | test("teaching controls stay usable and non-overflowing at 1024px and narrow widths", async ({ page }) => {
  208 |   test.setTimeout(90_000);
  209 |   for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  210 |     await page.setViewportSize(viewport);
  211 |     await page.goto("/simulator/free/understanding-camera-movements");
  212 |     const aside = page.locator(".simulator-aside");
  213 |     await expect(aside).toBeVisible({ timeout: 15000 });
  214 |     await expect(page.getByRole("slider", { name: "Viewpoint" })).toBeVisible();
  215 |     await expect(page.getByRole("slider", { name: "Tilt" })).toBeVisible();
  216 |     await expect(page.getByRole("slider", { name: "Vertical framing" })).toBeVisible();
  217 |     await expect(page.getByRole("heading", { name: "Original", exact: true })).toHaveCount(0);
  218 |     await expect(page.getByRole("heading", { name: "Current", exact: true })).toHaveCount(0);
  219 |     await expect(page.getByRole("button", { name: "Focus loupe · 4× Ground Glass preview view", exact: true })).toHaveCount(1);
  220 |     await expect(page.locator(".groundglass-comparison")).toHaveCount(0);
  221 |
  222 |     const overflow = await page.evaluate(() => {
  223 |       const aside = document.querySelector<HTMLElement>(".simulator-aside");
  224 |       const body = document.body;
  225 |       return {
  226 |         asideOverflow: aside ? aside.scrollWidth - aside.clientWidth : 0,
  227 |         bodyOverflow: body ? body.scrollWidth - body.clientWidth : 0,
  228 |       };
  229 |     });
  230 |     expect(overflow.asideOverflow).toBeLessThanOrEqual(2);
  231 |     expect(overflow.bodyOverflow).toBeLessThanOrEqual(2);
  232 |
  233 |     await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]')).toHaveCount(1);
  234 |
  235 |     // All three public studies are continuous; legacy case radios remain
  236 |     // internal compatibility adapters only.
  237 |     for (const label of [
  238 |       "C1 — Front rise",
  239 |       "C2 — Rear rise",
  240 |       "D1 — Front fall",
  241 |       "D2 — Rear fall",
  242 |     ]) {
  243 |       await expect(page.getByRole("radio", { name: label })).toHaveCount(0);
  244 |     }
  245 |     await expect(page.getByRole("radio", { name: "Neutral" })).toHaveCount(0);
  246 |     await expect(page.getByRole("radio", { name: "A — Front tilt" })).toHaveCount(0);
  247 |     await expect(page.getByRole("radio", { name: "C3 — Higher viewpoint" })).toHaveCount(0);
  248 |     await expect(page.getByRole("radio", { name: "D3 — Lower viewpoint" })).toHaveCount(0);
  249 |   }
  250 | });
  251 |
```