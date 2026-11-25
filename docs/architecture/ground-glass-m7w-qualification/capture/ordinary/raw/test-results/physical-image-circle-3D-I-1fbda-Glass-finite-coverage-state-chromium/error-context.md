# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: physical-image-circle.spec.ts >> 3D Image Circle consumes the Ground Glass finite coverage state
- Location: src/tests/e2e/physical-image-circle.spec.ts:34:1

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
  1   | import { expect, test, type Locator } from "@playwright/test";
  2   | import { setStepRangeInput } from "./helpers/stepRangeInput";
  3   |
  4   | const readFiniteAttribute = async (locator: Locator, name: string): Promise<number> => {
  5   |   const value = Number(await locator.getAttribute(name));
  6   |   expect(Number.isFinite(value), `${name} must be finite`).toBe(true);
  7   |   return value;
  8   | };
  9   |
  10  | const expectGroundGlassAndSceneCoverageAgreement = async (
  11  |   scene: Locator,
  12  |   rtt: Locator,
  13  | ) => {
  14  |   expect(await scene.getAttribute("data-image-circle-visible")).toBe("true");
  15  |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  16  |   expect(await scene.getAttribute("data-image-circle-ray-count")).toBe("12");
  17  |
  18  |   const [sceneRadius, rttRadius, sceneOffsetX, rttOffsetX, sceneOffsetY, rttOffsetY] =
  19  |     await Promise.all([
  20  |       readFiniteAttribute(scene, "data-image-circle-radius-mm"),
  21  |       readFiniteAttribute(rtt, "data-rtt-coverage-radius-mm"),
  22  |       readFiniteAttribute(scene, "data-image-circle-offset-x-mm"),
  23  |       readFiniteAttribute(rtt, "data-rtt-coverage-offset-x-mm"),
  24  |       readFiniteAttribute(scene, "data-image-circle-offset-y-mm"),
  25  |       readFiniteAttribute(rtt, "data-rtt-coverage-offset-y-mm"),
  26  |     ]);
  27  |
  28  |   expect(sceneRadius).toBeCloseTo(rttRadius, 5);
  29  |   expect(sceneOffsetX).toBeCloseTo(rttOffsetX, 5);
  30  |   expect(sceneOffsetY).toBeCloseTo(rttOffsetY, 5);
  31  |   return { sceneRadius, sceneOffsetX, sceneOffsetY };
  32  | };
  33  |
  34  | test("3D Image Circle consumes the Ground Glass finite coverage state", async ({ page }) => {
  35  |   test.setTimeout(120_000);
  36  |   await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  37  |
  38  |   const scene = page.getByTestId("scene-canvas");
  39  |   const rtt = page.getByTestId("ground-glass-rtt");
> 40  |   await expect(scene.locator("canvas")).toHaveCount(1);
      |                                         ^ Error: expect(locator).toHaveCount(expected) failed
  41  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  42  |
  43  |   await page.getByRole("button", { name: "Infinity Reset" }).click();
  44  |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  45  |   const neutral = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  46  |   expect(neutral.sceneOffsetX).toBeCloseTo(0, 5);
  47  |   expect(neutral.sceneOffsetY).toBeCloseTo(0, 5);
  48  |
  49  |   const overlayTrigger = page.getByRole("button", { name: "View overlays" });
  50  |   if (await overlayTrigger.isVisible()) await overlayTrigger.click();
  51  |   await page.getByRole("button", { name: "Show Legends" }).click();
  52  |   await expect(page.getByText("Image circle (rose)", { exact: true })).toBeVisible();
  53  |
  54  |   await setStepRangeInput(page, "Rise", 20);
  55  |   const risen = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  56  |   expect(risen.sceneOffsetY).toBeCloseTo(20, 5);
  57  |   expect(risen.sceneRadius).toBeCloseTo(neutral.sceneRadius, 5);
  58  |
  59  |   await setStepRangeInput(page, "Rise", 40);
  60  |   const threshold = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  61  |   expect(threshold.sceneOffsetY).toBeCloseTo(40, 5);
  62  |   expect(threshold.sceneRadius).toBeCloseTo(neutral.sceneRadius, 5);
  63  |
  64  |   for (const previewLabel of ["Upright Assist", "Raw Ground Glass"]) {
  65  |     await page.getByRole("radio", { name: previewLabel }).check();
  66  |     const previewState = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  67  |     expect(previewState.sceneRadius).toBeCloseTo(threshold.sceneRadius, 5);
  68  |     expect(previewState.sceneOffsetX).toBeCloseTo(threshold.sceneOffsetX, 5);
  69  |     expect(previewState.sceneOffsetY).toBeCloseTo(threshold.sceneOffsetY, 5);
  70  |   }
  71  |
  72  |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  73  |   await aperture.getByRole("radio", { name: "f/5.6" }).check();
  74  |   const wideApertureState = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  75  |   await aperture.getByRole("radio", { name: "f/22" }).check();
  76  |   const stoppedDownState = await expectGroundGlassAndSceneCoverageAgreement(scene, rtt);
  77  |   expect(stoppedDownState.sceneRadius).toBeCloseTo(wideApertureState.sceneRadius, 5);
  78  |   expect(stoppedDownState.sceneOffsetX).toBeCloseTo(wideApertureState.sceneOffsetX, 5);
  79  |   expect(stoppedDownState.sceneOffsetY).toBeCloseTo(wideApertureState.sceneOffsetY, 5);
  80  |
  81  |   if (await overlayTrigger.isVisible()) await overlayTrigger.click();
  82  |   await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  83  |   await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  84  |   await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
  85  |   await expect(scene).toHaveAttribute("data-lens-coverage-visible", "false");
  86  |   await expect(scene).not.toHaveAttribute("data-lens-coverage-kind", /.+/);
  87  |   await expect(scene).not.toHaveAttribute("data-image-circle-radius-mm", /.+/);
  88  |   await expect(page.getByText("Image circle (rose)", { exact: true })).not.toBeVisible();
  89  |   await expect(page.getByText("Coverage footprint (rose)", { exact: true })).not.toBeVisible();
  90  |
  91  |   await page.getByRole("button", { name: "Show Optical geometry" }).click();
  92  |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  93  |   await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  94  |   await expect(scene).toHaveAttribute("data-lens-coverage-kind", "parallel-circle");
  95  |   await expect(page.getByText("Image circle (rose)", { exact: true })).toBeVisible();
  96  |
  97  |   await setStepRangeInput(page, "Tilt", 5);
  98  |   await expect(scene).toHaveAttribute("data-image-circle-visible", "false");
  99  |   await expect(scene).not.toHaveAttribute("data-image-circle-radius-mm", /.+/);
  100 |   await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  101 |   await expect(scene).toHaveAttribute("data-lens-coverage-kind", "nonparallel-conic");
  102 |   await expect(scene).toHaveAttribute("data-lens-coverage-perimeter-count", "72");
  103 |   await expect(scene).toHaveAttribute("data-lens-coverage-ray-count", "12");
  104 |   await expect(scene).toHaveAttribute("data-lens-coverage-semi-axis-1-mm", /\d/);
  105 |   await expect(scene).toHaveAttribute("data-lens-coverage-semi-axis-2-mm", /\d/);
  106 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "nonparallel-conic");
  107 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  108 |   await expect(page.getByText("Image circle (rose)", { exact: true })).not.toBeVisible();
  109 |   await expect(page.getByText("Coverage footprint (rose)", { exact: true })).toBeVisible();
  110 |
  111 |   const conicAttributeNames = [
  112 |     "data-lens-coverage-center-world",
  113 |     "data-lens-coverage-center-x-mm",
  114 |     "data-lens-coverage-center-y-mm",
  115 |     "data-lens-coverage-semi-axis-1-mm",
  116 |     "data-lens-coverage-semi-axis-2-mm",
  117 |     "data-lens-coverage-orientation-rad",
  118 |     "data-lens-coverage-perimeter-count",
  119 |     "data-lens-coverage-ray-count",
  120 |   ];
  121 |   const conicAttributes = await Promise.all(
  122 |     conicAttributeNames.map((name) => scene.getAttribute(name)),
  123 |   );
  124 |   for (const previewLabel of ["Upright Assist", "Raw Ground Glass"]) {
  125 |     await page.getByRole("radio", { name: previewLabel }).check();
  126 |     expect(await Promise.all(conicAttributeNames.map((name) => scene.getAttribute(name))))
  127 |       .toEqual(conicAttributes);
  128 |   }
  129 |   await aperture.getByRole("radio", { name: "f/5.6" }).check();
  130 |   const wideOpenConicAttributes = await Promise.all(
  131 |     conicAttributeNames.map((name) => scene.getAttribute(name)),
  132 |   );
  133 |   await aperture.getByRole("radio", { name: "f/22" }).check();
  134 |   expect(await Promise.all(conicAttributeNames.map((name) => scene.getAttribute(name))))
  135 |     .toEqual(wideOpenConicAttributes);
  136 |
  137 |   if (await overlayTrigger.isVisible()) await overlayTrigger.click();
  138 |   await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  139 |   await expect(scene).toHaveAttribute("data-lens-coverage-visible", "false");
  140 |   await expect(scene).not.toHaveAttribute("data-lens-coverage-kind", /.+/);
```