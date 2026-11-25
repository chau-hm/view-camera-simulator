# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lens-catalog-ui.spec.ts >> lens catalog selection keeps finite coverage across published simulator profiles
- Location: src/tests/e2e/lens-catalog-ui.spec.ts:20:1

# Error details

```
Test timeout of 120000ms exceeded.
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
                  - generic:
                    - generic "farDof plane"
                  - generic [ref=e129]:
                    - generic "Camera body rail"
                    - generic "Simplified bellows connector"
                - generic [ref=e133]:
                  - generic [ref=e135]: Current
                  - generic [ref=e136]: Original
              - generic "Optical depth order" [ref=e137]:
                - generic [ref=e140]: Film 0 mm
                - generic [ref=e143]: Lens 162 mm
                - generic [ref=e146]: DOF limit 2.0 m
                - generic [ref=e149]: Focus 2.2 m
                - generic [ref=e152]: Far DOF 2.4 m
          - group [ref=e155]:
            - generic "Optical Debug understanding-camera-movements · parallel" [ref=e156] [cursor=pointer]:
              - generic [ref=e157]: Optical Debug
              - generic [ref=e158]: understanding-camera-movements · parallel
        - complementary [ref=e159]:
          - generic [ref=e160]:
            - region "Camera Controls" [ref=e161]:
              - heading "Camera Controls" [level=3] [ref=e163]
              - generic [ref=e164]:
                - group "Lens / Angle of View" [ref=e166]:
                  - generic [ref=e167]: Lens / Angle of View
                  - paragraph [ref=e168]: "At the same camera position, focal length changes angle of view and framing, not perspective. Lens coverage is separate from focal length: lenses with the same focal length can cover different areas. Rise and Shift use spare coverage; they do not create more."
                  - radiogroup "Lens options" [ref=e169]:
                    - generic [ref=e170] [cursor=pointer]:
                      - 'radio "90 mm — Wide — Lens coverage: 100.9° simulator coverage (teaching profile)" [ref=e171]'
                      - generic [ref=e172]:
                        - generic [ref=e173]: Wide
                        - generic [ref=e174]: ·
                        - generic [ref=e175]: 90 mm
                      - generic [ref=e176]: "Lens coverage: 100.9° simulator coverage (teaching profile)"
                    - generic [ref=e177] [cursor=pointer]:
                      - 'radio "105 mm — — Lens coverage: 92.1° simulator coverage (teaching profile)" [ref=e178]'
                      - generic [ref=e180]: 105 mm
                      - generic [ref=e181]: "Lens coverage: 92.1° simulator coverage (teaching profile)"
                    - generic [ref=e182] [cursor=pointer]:
                      - 'radio "120 mm — — Lens coverage: 84.5° simulator coverage (teaching profile)" [ref=e183]'
                      - generic [ref=e185]: 120 mm
                      - generic [ref=e186]: "Lens coverage: 84.5° simulator coverage (teaching profile)"
                    - generic [ref=e187] [cursor=pointer]:
                      - 'radio "150 mm — Standard — Lens coverage: 72° simulator coverage (teaching profile)" [checked] [active] [ref=e188]'
                      - generic [ref=e189]:
                        - generic [ref=e190]: Standard
                        - generic [ref=e191]: ·
                        - generic [ref=e192]: 150 mm
                      - generic [ref=e193]: "Lens coverage: 72° simulator coverage (teaching profile)"
                  - generic [ref=e194]:
                    - generic [ref=e195]: Selected lens
                    - generic [ref=e196]: Standard · 150 mm
                    - generic [ref=e197]:
                      - generic [ref=e198]: Lens coverage
                      - generic [ref=e199]: 72° simulator coverage (teaching profile)
                    - generic [ref=e200]:
                      - generic [ref=e201]: Image circle
                      - generic [ref=e202]: 235.6 mm at current focus
                - region "Camera Movement" [ref=e204]:
                  - heading "Camera Movement" [level=3] [ref=e205]
                  - paragraph [ref=e206]: Explore viewpoint and standard movements continuously.
                  - region "Viewpoint" [ref=e207]:
                    - heading "Viewpoint" [level=4] [ref=e208]
                    - paragraph [ref=e209]: Move the whole camera lower or higher while keeping the standards neutral.
                    - generic [ref=e210]:
                      - generic [ref=e211]: Viewpoint
                      - generic [ref=e212]: Neutral viewpoint
                    - slider "Viewpoint" [ref=e213]: "0"
                    - group "Viewpoint positions" [ref=e214]:
                      - generic [ref=e215]: Lower
                      - generic [ref=e216]: Neutral
                      - generic [ref=e217]: Higher
                  - region "Tilt" [ref=e218]:
                    - heading "Tilt" [level=4] [ref=e219]
                    - paragraph [ref=e220]: Tilt the front or rear standard while the camera remains at the neutral viewpoint.
                    - group "Tilt standard" [ref=e221]:
                      - generic [ref=e222]: Standard
                      - generic [ref=e223]:
                        - radio "Front standard" [checked] [ref=e224]
                        - generic [ref=e225]: Front standard
                      - generic [ref=e226]:
                        - radio "Rear standard" [ref=e227]
                        - generic [ref=e228]: Rear standard
                    - generic [ref=e229]:
                      - generic [ref=e230]: Tilt
                      - generic [ref=e231]: 0.0°
                    - slider "Tilt" [ref=e232]: "0"
                    - group "Tilt positions" [ref=e233]:
                      - generic [ref=e234]: Negative -5.0°
                      - generic [ref=e235]: Zero
                      - generic [ref=e236]: Positive +5.0°
                  - region "Vertical Framing" [ref=e237]:
                    - heading "Vertical Framing" [level=4] [ref=e238]
                    - paragraph [ref=e239]: Move the front or rear standard vertically to frame a lower or higher part of the subject.
                    - group "Vertical framing standard" [ref=e240]:
                      - generic [ref=e241]: Standard
                      - generic [ref=e242]:
                        - radio "Front standard" [checked] [ref=e243]
                        - generic [ref=e244]: Front standard
                      - generic [ref=e245]:
                        - radio "Rear standard" [ref=e246]
                        - generic [ref=e247]: Rear standard
                    - generic [ref=e248]:
                      - generic [ref=e249]: Vertical framing
                      - generic [ref=e250]: Front standard, middle framing
                    - slider "Vertical framing" [ref=e251]: "0"
                    - group "Vertical framing positions" [ref=e252]:
                      - generic [ref=e253]: Lower
                      - generic [ref=e254]: Middle
                      - generic [ref=e255]: Upper
                  - status [ref=e256]: Neutral viewpoint
                - region "Focus" [ref=e258]:
                  - heading "Focus" [level=3] [ref=e259]
                  - generic [ref=e260]:
                    - generic [ref=e261]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e262]: "2000"
                    - generic [ref=e263]: 2000.0 mm
                  - generic [ref=e264]: Focus is fixed for this lesson
                - region "Aperture" [ref=e266]:
                  - heading "Aperture" [level=3] [ref=e267]
                  - radiogroup "Aperture" [disabled] [ref=e268]:
                    - generic [ref=e269]:
                      - radio "f/5.6" [disabled] [ref=e270]
                      - generic [ref=e271]: f/5.6
                    - generic [ref=e272]:
                      - radio "f/8" [disabled] [ref=e273]
                      - generic [ref=e274]: f/8
                    - generic [ref=e275]:
                      - radio "f/11" [checked] [disabled] [ref=e276]
                      - generic [ref=e277]: f/11
                    - generic [ref=e278]:
                      - radio "f/16" [disabled] [ref=e279]
                      - generic [ref=e280]: f/16
                    - generic [ref=e281]:
                      - radio "f/22" [disabled] [ref=e282]
                      - generic [ref=e283]: f/22
                    - generic [ref=e284]:
                      - radio "f/32" [disabled] [ref=e285]
                      - generic [ref=e286]: f/32
                  - generic [ref=e287]: Aperture is fixed for this lesson
                - generic [ref=e288]:
                  - generic [ref=e289]: Reset
                  - region "Reset" [ref=e290]:
                    - button "Reset movements" [ref=e292] [cursor=pointer]
            - region "Developer Tools" [ref=e293]:
              - heading "Developer Tools" [level=3] [ref=e294]
              - generic [ref=e296]:
                - checkbox "Raw RTT — bypass DOF" [ref=e297]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1   | import { writeFile } from "node:fs/promises";
  2   | import { expect, test, type Page } from "@playwright/test";
  3   | import { expectGroundGlassPhysicalScale } from "./helpers/groundGlass";
  4   | import { setStepRangeInput } from "./helpers/stepRangeInput";
  5   |
  6   | const openLensCatalogScene = async (page: Page) => {
  7   |   await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  8   |   await expect(page.getByTestId("lens-control")).toBeVisible();
  9   |   await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute(
  10  |     "data-rtt-final-contentful",
  11  |     "true",
  12  |     { timeout: 60_000 },
  13  |   );
  14  |   await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
  15  |     "data-optical-geometry-visible",
  16  |     "true",
  17  |   );
  18  | };
  19  |
  20  | test("lens catalog selection keeps finite coverage across published simulator profiles", async ({ page }, testInfo) => {
  21  |   test.setTimeout(120_000);
  22  |   await openLensCatalogScene(page);
  23  |
  24  |   const lensControl = page.getByTestId("lens-control");
  25  |   const rtt = page.getByTestId("ground-glass-rtt");
  26  |   const scene = page.getByTestId("scene-canvas");
  27  |   const wide = lensControl.getByRole("radio", {
  28  |     name: /90 mm.*Wide.*Lens coverage: 100\.9° simulator coverage \(teaching profile\)/,
  29  |   });
  30  |   const standard = lensControl.getByRole("radio", {
  31  |     name: /150 mm.*Standard.*Lens coverage: 72° simulator coverage \(teaching profile\)/,
  32  |   });
  33  |
  34  |   await expect(wide).toBeChecked();
  35  |   const publishedProfiles = [
  36  |     { focalLengthMm: 90, angle: "100.9" },
  37  |     { focalLengthMm: 105, angle: "92.1" },
  38  |     { focalLengthMm: 120, angle: "84.5" },
  39  |     { focalLengthMm: 150, angle: "72" },
  40  |   ];
  41  |   for (const { focalLengthMm, angle } of publishedProfiles) {
  42  |     const option = lensControl.getByRole("radio", {
  43  |       name: new RegExp(
  44  |         `${focalLengthMm} mm.*Lens coverage: ${angle.replace(".", "\\.")}° simulator coverage \\(teaching profile\\)`,
  45  |       ),
  46  |     });
  47  |     await option.check();
  48  |     await expect(lensControl).toHaveAttribute(
  49  |       "data-selected-lens-id",
  50  |       `simulator-parametric-${focalLengthMm}mm`,
  51  |     );
  52  |     await expect(lensControl).toHaveAttribute("data-selected-lens-coverage-kind", "angular");
  53  |     await expect(lensControl).toHaveAttribute(
  54  |       "data-selected-lens-image-circle-diameter-mm",
  55  |       /\d+\.\d{6}/,
  56  |     );
  57  |     await expect(lensControl.getByTestId("lens-control-coverage-value")).toHaveText(
  58  |       `${angle}° simulator coverage (teaching profile)`,
  59  |     );
  60  |     await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  61  |     await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
> 62  |     await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
      |                         ^ Error: expect(locator).toHaveAttribute(expected) failed
  63  |     await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  64  |     const physicalScale = await expectGroundGlassPhysicalScale(rtt);
  65  |     if (focalLengthMm === 90 || focalLengthMm === 150) {
  66  |       await page.getByTestId("scene-canvas").locator("canvas").screenshot({
  67  |         path: testInfo.outputPath(`understanding-camera-movements-${focalLengthMm}mm.png`),
  68  |       });
  69  |       const calibrationFile = `understanding-camera-movements-${focalLengthMm}mm-physical-blur-scale.json`;
  70  |       const calibrationRecord = { ...physicalScale, focalLengthMm };
  71  |       await testInfo.attach(calibrationFile, {
  72  |         body: JSON.stringify(calibrationRecord),
  73  |         contentType: "application/json",
  74  |       });
  75  |       await writeFile(
  76  |         testInfo.outputPath(calibrationFile),
  77  |         JSON.stringify(calibrationRecord, null, 2),
  78  |       );
  79  |     }
  80  |   }
  81  |
  82  |   await standard.check();
  83  |   await expect(standard).toBeChecked();
  84  |   await expect(lensControl).toHaveAttribute(
  85  |     "data-selected-lens-id",
  86  |     "simulator-parametric-150mm",
  87  |   );
  88  |   await expect(lensControl).toHaveAttribute("data-selected-lens-coverage-kind", "angular");
  89  |   await expect(lensControl).toHaveAttribute(
  90  |     "data-selected-lens-image-circle-diameter-mm",
  91  |     /\d+\.\d{6}/,
  92  |   );
  93  |   await expect(lensControl.getByTestId("lens-control-coverage-value")).toHaveText(
  94  |     "72° simulator coverage (teaching profile)",
  95  |   );
  96  |   await expect(lensControl.getByTestId("lens-control-image-circle-label")).toHaveText(
  97  |     "Image circle",
  98  |   );
  99  |   await expect(lensControl.getByTestId("lens-control-image-circle-value")).toHaveText(/mm/);
  100 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  101 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  102 |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  103 |   await expect(scene).toHaveAttribute("data-image-circle-radius-mm", /\d+\.\d+/);
  104 |
  105 |   await setStepRangeInput(page, "Tilt", 0.5);
  106 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  107 |   await expect(rtt).toHaveAttribute("data-rtt-natural-illumination-kind", "neutral");
  108 |   await expect(scene).toHaveAttribute("data-lens-coverage-kind", "nonparallel-conic");
  109 |   await expect(scene).not.toHaveAttribute("data-image-circle-radius-mm", /.+/);
  110 |   await expect(lensControl.getByTestId("lens-control-image-circle-label")).toHaveText(
  111 |     "Reference image circle",
  112 |   );
  113 |   await expect(lensControl.getByTestId("lens-control-image-circle-reference-note")).toContainText(
  114 |     "Coverage Footprint",
  115 |   );
  116 |   await expect(lensControl.getByTestId("lens-control-image-circle-value")).toHaveText(/mm/);
  117 |   await expect(lensControl).toHaveAttribute(
  118 |     "data-selected-lens-image-circle-diameter-mm",
  119 |     /\d+\.\d{6}/,
  120 |   );
  121 |
  122 |   await setStepRangeInput(page, "Tilt", 0);
  123 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  124 |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  125 |   await expect(lensControl.getByTestId("lens-control-image-circle-label")).toHaveText(
  126 |     "Image circle",
  127 |   );
  128 |   await expect(lensControl.getByTestId("lens-control-image-circle-reference-note")).toHaveCount(0);
  129 |
  130 |   await wide.check();
  131 |   await expect(wide).toBeChecked();
  132 |   await expect(lensControl).toHaveAttribute("data-selected-lens-id", "simulator-parametric-90mm");
  133 |   await expect(lensControl).toHaveAttribute("data-selected-lens-coverage-kind", "angular");
  134 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  135 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  136 |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  137 |   await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  138 | });
  139 |
  140 | test("lens catalog presentation stays readable and localized at desktop and tablet widths", async ({ page }) => {
  141 |   for (const viewport of [
  142 |     { width: 1280, height: 800 },
  143 |     { width: 1024, height: 768 },
  144 |   ]) {
  145 |     await page.setViewportSize(viewport);
  146 |     await page.goto("/simulator/free/understanding-camera-movements");
  147 |     const lensControl = page.getByTestId("lens-control");
  148 |     await expect(lensControl).toBeVisible();
  149 |     await expect(lensControl.getByRole("radio", { name: /90 mm.*Wide/ })).toBeVisible();
  150 |     await expect(lensControl.getByRole("radio", { name: /150 mm.*Standard/ })).toBeVisible();
  151 |     const bounds = await lensControl.boundingBox();
  152 |     expect(bounds).not.toBeNull();
  153 |     expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  154 |   }
  155 |
  156 |   await page.getByRole("combobox", { name: "Language" }).selectOption("zh-HK");
  157 |   const localizedLensControl = page.getByTestId("lens-control");
  158 |   await expect(localizedLensControl).toBeVisible();
  159 |   await expect(page.getByRole("combobox", { name: "語言" })).toHaveValue("zh-HK");
  160 |   await expect(localizedLensControl.getByRole("radiogroup", { name: "鏡頭選項" })).toBeVisible();
  161 |   await expect(
  162 |     localizedLensControl.getByRole("radio", {
```