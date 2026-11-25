# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: focus-fundamentals-selectable-focus.spec.ts >> Focus Fundamentals proves front/rear viewpoint behavior without replacing RTT resources
- Location: src/tests/e2e/focus-fundamentals-selectable-focus.spec.ts:94:1

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
          - generic [ref=e12]: Focus Fundamentals — Two Targets
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
                            - generic: 1050.0 mm focus / CoC 0.000 mm (100%)
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
                  - generic [ref=e111]: Film · reference
                  - generic [ref=e113]: Film · current
                  - generic [ref=e115]: Lens · reference
                  - generic [ref=e117]: Lens · current
                - generic [ref=e118]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e119]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e120]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e121]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e122]
                  - generic [ref=e124]: Optical axis
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
                  - generic [ref=e126]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e132]: Near detail
                  - generic [ref=e136]: Far detail
              - generic "Optical depth order" [ref=e138]:
                - generic [ref=e141]: Film 0 mm
                - generic [ref=e144]: Lens 231 mm
                - generic [ref=e147]: DOF limit 1.0 m
                - generic [ref=e150]: Focus 1.1 m
                - generic [ref=e153]: Far DOF 1.1 m
            - region "Focus distribution · Focus" [ref=e155]:
              - generic [ref=e156]:
                - heading "Focus distribution" [level=4] [ref=e157]
                - 'generic "Ground Glass orientation: Raw" [ref=e158]': Raw
              - table "Focus distribution" [ref=e159]:
                - caption [ref=e160]: Focus distribution
                - rowgroup [ref=e161]:
                  - row [ref=e162]:
                    - cell [ref=e163]
                    - cell [ref=e164]
                    - cell [ref=e165]
                  - 'row "Middle left Middle left · Near detail: 100% · Sharp Middle right Middle right · Far detail: 0% · Soft" [ref=e166]':
                    - 'cell "Middle left Middle left · Near detail: 100% · Sharp" [ref=e167]':
                      - generic "Middle left" [ref=e168]
                      - 'group "Middle left · Near detail: 100% · Sharp" [ref=e170]':
                        - generic "Near detail" [ref=e172]
                        - generic [ref=e173]:
                          - text: 100%
                          - generic [ref=e174]: ✓
                    - cell [ref=e175]
                    - 'cell "Middle right Middle right · Far detail: 0% · Soft" [ref=e176]':
                      - generic "Middle right" [ref=e177]
                      - 'group "Middle right · Far detail: 0% · Soft" [ref=e179]':
                        - generic "Far detail" [ref=e181]
                        - generic [ref=e182]:
                          - text: 0%
                          - generic [ref=e183]: —
                  - row [ref=e184]:
                    - cell [ref=e185]
                    - cell [ref=e186]
                    - cell [ref=e187]
          - group [ref=e190]:
            - generic "Optical Debug focus-fundamentals-two-targets · parallel" [ref=e191] [cursor=pointer]:
              - generic [ref=e192]: Optical Debug
              - generic [ref=e193]: focus-fundamentals-two-targets · parallel
        - complementary [ref=e194]:
          - generic [ref=e195]:
            - region "Camera Controls" [ref=e196]:
              - heading "Camera Controls" [level=3] [ref=e198]
              - paragraph [ref=e199]:
                - generic [ref=e200]: 🔒
                - generic [ref=e201]: Disabled for this guided task
              - generic [ref=e202]:
                - region "Movement" [ref=e204]:
                  - generic [ref=e205]:
                    - heading "Front standard" [level=4] [ref=e206]
                    - button "Help" [ref=e207] [cursor=pointer]:
                      - generic [ref=e208]: "?"
                  - generic [ref=e209]:
                    - generic [ref=e210]:
                      - generic [ref=e211]: Rise
                      - slider "Rise" [disabled] [ref=e212]: "0"
                      - generic [ref=e213]: 0.0 mm
                    - generic [ref=e214]:
                      - generic [ref=e215]: Tilt
                      - slider "Tilt" [disabled] [ref=e216]: "0"
                      - generic [ref=e217]: 0.0°
                    - generic [ref=e218]:
                      - generic [ref=e219]: Swing
                      - slider "Swing" [disabled] [ref=e220]: "0"
                      - generic [ref=e221]: 0.0°
                - region "Focus" [ref=e223]:
                  - heading "Focus" [level=3] [ref=e224]
                  - generic [ref=e225]:
                    - generic [ref=e226]: Focus distance
                    - slider "Focus distance" [ref=e227]: "1050"
                    - generic [ref=e228]: 1050.0 mm
                    - button "Infinity Reset" [ref=e230] [cursor=pointer]: ∞
                  - group "Focus standard" [ref=e231]:
                    - generic [ref=e232]: Focus with
                    - generic [ref=e233]:
                      - generic [ref=e234]:
                        - radio "Front standard" [checked] [ref=e235]
                        - text: Front standard
                      - generic [ref=e236]:
                        - radio "Rear standard" [ref=e237]
                        - text: Rear standard
                    - generic [ref=e238]: Front focusing moves the lens/viewpoint. The film stays fixed.
                    - generic [ref=e239]:
                      - generic [ref=e240]: Watch the white frame (near gate) and far pointer.
                      - generic [ref=e241]: Front focus changes their alignment; Rear focus keeps them aligned.
                  - generic [ref=e242]:
                    - button "Focus Near Detail" [active] [ref=e243] [cursor=pointer]
                    - button "Focus Far Detail" [ref=e244] [cursor=pointer]
                - region "Aperture" [ref=e246]:
                  - heading "Aperture" [level=3] [ref=e247]
                  - radiogroup "Aperture" [disabled] [ref=e248]:
                    - generic [ref=e249]:
                      - radio "f/5.6" [disabled] [ref=e250]
                      - generic [ref=e251]: f/5.6
                    - generic [ref=e252]:
                      - radio "f/8" [disabled] [ref=e253]
                      - generic [ref=e254]: f/8
                    - generic [ref=e255]:
                      - radio "f/11" [checked] [disabled] [ref=e256]
                      - generic [ref=e257]: f/11
                    - generic [ref=e258]:
                      - radio "f/16" [disabled] [ref=e259]
                      - generic [ref=e260]: f/16
                    - generic [ref=e261]:
                      - radio "f/22" [disabled] [ref=e262]
                      - generic [ref=e263]: f/22
                    - generic [ref=e264]:
                      - radio "f/32" [disabled] [ref=e265]
                      - generic [ref=e266]: f/32
                  - generic [ref=e267]: Aperture is fixed for this lesson
                - generic [ref=e268]:
                  - generic [ref=e269]: Reset
                  - region "Reset" [ref=e270]:
                    - button "Reset movements" [ref=e272] [cursor=pointer]
            - region "Developer Tools" [ref=e273]:
              - heading "Developer Tools" [level=3] [ref=e274]
              - generic [ref=e276]:
                - checkbox "Raw RTT — bypass DOF" [ref=e277]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  103 |       !isAllowedEnvironmentConsoleMessage(message.text())
  104 |     ) {
  105 |       consoleProblems.push(message.text());
  106 |     }
  107 |   });
  108 |
  109 |   await page.goto("/simulator/free/focus-fundamentals-two-targets?rttDiagnostics=1");
  110 |   const scene = page.getByTestId("scene-canvas");
  111 |   const sceneCanvas = scene.locator("canvas").first();
  112 |   const rtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  113 |   const rttCanvas = rtt.locator("canvas");
  114 |   const slider = page.getByLabel("Focus distance");
  115 |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  116 |   const front = page.getByRole("radio", { name: "Front standard" });
  117 |   const rear = page.getByRole("radio", { name: "Rear standard" });
  118 |   const focusStandard = page.getByRole("group", { name: "Focus standard" });
  119 |   const readNearSharpness = () => readFocusDistributionPercent(page, { targetId: "focus-near-detail" });
  120 |   const readFarSharpness = () => readFocusDistributionPercent(page, { targetId: "focus-far-detail" });
  121 |   const captureBlurState = async (name: string) => {
  122 |     const physicalScale = await expectGroundGlassPhysicalScale(rtt);
  123 |     await testInfo.attach(`${name}-physicalScale`, {
  124 |       body: JSON.stringify(physicalScale),
  125 |       contentType: "application/json",
  126 |     });
  127 |     await writeFile(
  128 |       testInfo.outputPath(`${name}-physicalScale.json`),
  129 |       JSON.stringify(physicalScale, null, 2),
  130 |     );
  131 |     await rttCanvas.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  132 |   };
  133 |
  134 |   await expect(scene).toHaveAttribute("data-scene-subject-id", "focus-fundamentals-two-targets");
  135 |   await expect(page.getByRole("group", { name: "Focus standard" })).toBeVisible();
  136 |   await expect(front).toBeChecked();
  137 |   await expect(aperture).toHaveAttribute("data-selected-aperture", "11");
  138 |   await expect(aperture).toBeDisabled();
  139 |   await expect(page.getByText("Aperture is fixed for this lesson")).toBeVisible();
  140 |   await expect(focusStandard.getByText("Watch the white frame (near gate) and far pointer.")).toBeVisible();
  141 |   await expect(focusStandard.getByText("Front focus changes their alignment; Rear focus keeps them aligned.")).toBeVisible();
  142 |   await expect(slider).toHaveValue(String(focusFundamentalsReferenceFocusDepthMm));
  143 |   await expect(slider).toHaveAttribute("min", String(focusFundamentalsFocusDepthRangeMm.min));
  144 |   await expect(slider).toHaveAttribute("max", String(focusFundamentalsFocusDepthRangeMm.max));
  145 |   await expect(
  146 |     focusStandard.getByText("Front focusing moves the lens/viewpoint. The film stays fixed."),
  147 |   ).toBeVisible();
  148 |   await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "front");
  149 |   await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "false");
  150 |   expect(Number(await scene.getAttribute("data-focus-teaching-displacement-mm"))).toBeLessThan(1e-6);
  151 |   await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", String(focusFundamentalsFocalLengthMm));
  152 |   await expectContentfulRtt(rtt);
  153 |   await captureBlurState("focus-fundamentals-front-reference-1200mm");
  154 |
  155 |   await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  156 |   const geometrySvg = page.getByTestId("geometry-svg-side");
  157 |   await expect(geometrySvg).toBeVisible();
  158 |   await expect(geometrySvg.locator('[data-testid="focus-fundamentals-position-cues"]')).toBeVisible();
  159 |   await expect(geometrySvg.locator('[data-testid="focus-current-lens-position"]')).toBeVisible();
  160 |   await expect(geometrySvg.locator('[data-testid="focus-reference-lens-position"]')).toBeVisible();
  161 |   await expect(geometrySvg).toContainText("Lens · current");
  162 |   await expect(geometrySvg).toContainText("Lens · reference");
  163 |   await expect(geometrySvg).not.toContainText("Original");
  164 |   await page.getByRole("button", { name: "Restore 2D Geometry" }).click();
  165 |
  166 |   const rttHandle = await rtt.elementHandle();
  167 |   const rttCanvasHandle = await rttCanvas.elementHandle();
  168 |   const sceneCanvasHandle = await sceneCanvas.elementHandle();
  169 |   if (!rttHandle || !rttCanvasHandle || !sceneCanvasHandle) {
  170 |     throw new Error("Focus Fundamentals render resources were not mounted");
  171 |   }
  172 |   // The RTT now reports diagnostics through the connected adapter callback;
  173 |   // wait for the remounted owner to publish its initial resource record.
  174 |   await expect(rtt).toHaveAttribute("data-rtt-owner-id", /^ground-glass-rtt-owner-/, { timeout: 120_000 });
  175 |   await expect(rtt).toHaveAttribute("data-rtt-resource-generation", /^\d+$/, { timeout: 120_000 });
  176 |   const ownerId = await rtt.getAttribute("data-rtt-owner-id");
  177 |   const resourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  178 |   if (!ownerId || !resourceGeneration) throw new Error("Ground Glass RTT diagnostics were incomplete");
  179 |
  180 |   const referenceLensZ = await readZ(scene, "data-camera-lens-center-world");
  181 |   expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  182 |   expect(await scene.getAttribute("data-focus-standard-selected")).toBe("front");
  183 |   expect(await scene.getAttribute("data-focus-standard-resolved")).toBe("front");
  184 |   await expectRttCameraAtLens(scene, rtt);
  185 |   const initialSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  186 |   expect(initialSanityState).toBeTruthy();
  187 |
  188 |   await page.getByRole("button", { name: "Focus Near Detail" }).click();
  189 |   await expect(slider).toHaveValue(String(focusFundamentalsNearFocusDepthMm));
  190 |   expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  191 |   const frontNearLensZ = await readZ(scene, "data-camera-lens-center-world");
  192 |   expect(frontNearLensZ).not.toBeCloseTo(referenceLensZ, 8);
  193 |   await expect(
  194 |     focusStandard.getByText("Front focusing moves the lens/viewpoint. The film stays fixed."),
  195 |   ).toBeVisible();
  196 |   await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "front");
  197 |   await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  198 |   expect(Number(await scene.getAttribute("data-focus-teaching-displacement-mm"))).toBeGreaterThan(0.5);
  199 |   await expectRttCameraAtLens(scene, rtt);
  200 |   const frontNearRttPosition = await readVector(rtt, "data-rtt-camera-position");
  201 |   await expect
  202 |     .poll(async () => (await readNearSharpness()) - (await readFarSharpness()))
> 203 |     .toBeGreaterThan(0);
      |      ^ Error: Timeout 5000ms exceeded while waiting on the predicate
  204 |   await expect.poll(() => rtt.getAttribute("data-rtt-sanity-state"), { timeout: 120_000 }).not.toBe(initialSanityState);
  205 |   await expectContentfulRtt(rtt);
  206 |   await captureBlurState("focus-fundamentals-front-near-1050mm");
  207 |   await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);
  208 |
  209 |   await page.getByRole("button", { name: "Focus Far Detail" }).click();
  210 |   await expect(slider).toHaveValue(String(focusFundamentalsFarFocusDepthMm));
  211 |   expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  212 |   const frontFarLensZ = await readZ(scene, "data-camera-lens-center-world");
  213 |   expect(frontFarLensZ).not.toBeCloseTo(frontNearLensZ, 8);
  214 |   await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "front");
  215 |   await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  216 |   await expectRttCameraAtLens(scene, rtt);
  217 |   expect(await readZ(rtt, "data-rtt-camera-position")).not.toBeCloseTo(frontNearRttPosition[2], 6);
  218 |   await expect
  219 |     .poll(async () => (await readFarSharpness()) - (await readNearSharpness()))
  220 |     .toBeGreaterThan(0);
  221 |   await expectContentfulRtt(rtt);
  222 |   await captureBlurState("focus-fundamentals-front-far-1350mm");
  223 |   await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);
  224 |
  225 |   await rear.click();
  226 |   await expect(rear).toBeChecked();
  227 |   await expectGroundGlassPhysicalScale(rtt);
  228 |   await expect(slider).toHaveValue(String(focusFundamentalsFarFocusDepthMm));
  229 |   await expect(scene).toHaveAttribute("data-focus-standard-selected", "rear");
  230 |   await expect(scene).toHaveAttribute("data-focus-standard-resolved", "rear");
  231 |   await expect(
  232 |     focusStandard.getByText("Rear focusing moves the film while the lens/viewpoint stays fixed."),
  233 |   ).toBeVisible();
  234 |   await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "rear");
  235 |   await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  236 |   expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  237 |   const rearFarFilmZ = await readZ(scene, "data-camera-film-center-world");
  238 |   expect(rearFarFilmZ).not.toBeCloseTo(0, 8);
  239 |   await expectRttCameraAtLens(scene, rtt);
  240 |   const rearFarRttPosition = await readVector(rtt, "data-rtt-camera-position");
  241 |   await expectContentfulRtt(rtt);
  242 |   await captureBlurState("focus-fundamentals-rear-far-1350mm");
  243 |   await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);
  244 |
  245 |   await page.getByRole("button", { name: "Focus Near Detail" }).click();
  246 |   await expect(slider).toHaveValue(String(focusFundamentalsNearFocusDepthMm));
  247 |   expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  248 |   const rearNearFilmZ = await readZ(scene, "data-camera-film-center-world");
  249 |   expect(rearNearFilmZ).not.toBeCloseTo(rearFarFilmZ, 8);
  250 |   await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "rear");
  251 |   await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  252 |   await expectRttCameraAtLens(scene, rtt);
  253 |   const rearNearRttPosition = await readVector(rtt, "data-rtt-camera-position");
  254 |   expect(Math.hypot(...rearNearRttPosition.map((value, index) => value - rearFarRttPosition[index]))).toBeLessThan(1e-7);
  255 |   await expect
  256 |     .poll(async () => (await readNearSharpness()) - (await readFarSharpness()))
  257 |     .toBeGreaterThan(0);
  258 |   await expectContentfulRtt(rtt);
  259 |   await captureBlurState("focus-fundamentals-rear-near-1050mm");
  260 |   await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);
  261 |
  262 |   await page.getByRole("button", { name: "Focus Far Detail" }).click();
  263 |   await expect(slider).toHaveValue(String(focusFundamentalsFarFocusDepthMm));
  264 |   expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  265 |   expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(rearFarFilmZ, 8);
  266 |   await expectRttCameraAtLens(scene, rtt);
  267 |   await expect
  268 |     .poll(async () => (await readFarSharpness()) - (await readNearSharpness()))
  269 |     .toBeGreaterThan(0);
  270 |   await expectContentfulRtt(rtt);
  271 |   await captureBlurState("focus-fundamentals-rear-far-restored-1350mm");
  272 |   await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);
  273 |
  274 |   await front.click();
  275 |   await expect(front).toBeChecked();
  276 |   await page.getByRole("button", { name: "Infinity Reset" }).click();
  277 |   await expect(page.getByText("Focus: ∞")).toBeVisible();
  278 |   await expect(scene).toHaveAttribute("data-focus-standard-selected", "front");
  279 |   await expect(scene).toHaveAttribute("data-focus-standard-resolved", "front");
  280 |   await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "front");
  281 |   await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  282 |   const focalLengthMm = Number(await rtt.getAttribute("data-rtt-focal-length-mm"));
  283 |   expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(focalLengthMm, 8);
  284 |   expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(0, 8);
  285 |   await expectRttCameraAtLens(scene, rtt);
  286 |   await expectContentfulRtt(rtt);
  287 |   await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);
  288 |
  289 |   await rear.click();
  290 |   await expect(rear).toBeChecked();
  291 |   await expect(page.getByText("Focus: ∞")).toBeVisible();
  292 |   await expect(scene).toHaveAttribute("data-focus-standard-selected", "rear");
  293 |   await expect(scene).toHaveAttribute("data-focus-standard-resolved", "rear");
  294 |   await expect(scene).toHaveAttribute("data-focus-teaching-active-standard", "rear");
  295 |   await expect(scene).toHaveAttribute("data-focus-teaching-movement-visible", "true");
  296 |   expect(await readZ(scene, "data-camera-lens-center-world")).toBeCloseTo(referenceLensZ, 8);
  297 |   expect(await readZ(scene, "data-camera-film-center-world")).toBeCloseTo(referenceLensZ - focalLengthMm, 8);
  298 |   await expectRttCameraAtLens(scene, rtt);
  299 |   await expectContentfulRtt(rtt);
  300 |   await expectStableRttIdentity(page, rtt, rttHandle, rttCanvasHandle, sceneCanvasHandle, ownerId, resourceGeneration);
  301 |
  302 |   await page.getByRole("button", { name: "Focus Far Detail" }).click();
  303 |   await expect(slider).toHaveValue(String(focusFundamentalsFarFocusDepthMm));
```