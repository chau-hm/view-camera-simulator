# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mirror-shift-teaching-geometry.spec.ts >> Mirror Shift top-view geometry follows canonical A/B/C state relationships
- Location: src/tests/e2e/mirror-shift-teaching-geometry.spec.ts:5:1

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.click: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Reset movements' })

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
          - generic [ref=e12]: Mirror Shift
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
                            - generic: 6000.0 mm focus
                      - button "Focus loupe · 4× Ground Glass view" [ref=e90] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e91]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e92] [cursor=pointer]:
                    - generic [ref=e93]: open_in_new
            - generic [ref=e95]:
              - generic [ref=e96]:
                - heading "2D Geometry" [level=2] [ref=e97]
                - generic [ref=e98]:
                  - group "Geometry view" [ref=e99]:
                    - button "Top" [pressed] [ref=e100] [cursor=pointer]
                  - group "Geometry framing" [ref=e101]:
                    - button "Fit Scene" [pressed] [ref=e102] [cursor=pointer]
                  - button "Expand 2D Geometry" [active] [ref=e103] [cursor=pointer]:
                    - generic [ref=e104]: open_in_new
              - paragraph [ref=e105]: "Top view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - generic [ref=e107]:
                - img "Mirror Shift top-view teaching geometry" [ref=e108]:
                  - generic [ref=e110]: Mirror aperture
                  - generic [ref=e111]:
                    - generic [ref=e112]: Neutral film
                    - generic [ref=e113]: Neutral lens
                  - generic [ref=e114]:
                    - generic [ref=e115]: Current film
                    - generic [ref=e116]: Current lens
                  - generic [ref=e119]: Camera Position
                  - generic [ref=e122]: Front Shift
                  - generic [ref=e128]: Mirror-centre chief ray
                  - generic [ref=e134]: Top view · X lateral · Z optical depth
                - generic [ref=e135]:
                  - generic [ref=e136]: Neutral reference
                  - generic [ref=e138]: Current camera
                  - generic [ref=e140]: Mirror-centre chief ray
              - generic "Optical depth order" [ref=e142]:
                - generic [ref=e145]: Film 0 mm
                - generic [ref=e148]: Lens 122 mm
                - generic [ref=e151]: DOF limit 4.3 m
                - generic [ref=e154]: Focus 6.1 m
                - generic [ref=e157]: Far DOF > 9.3 m
          - group [ref=e160]:
            - generic "Optical Debug mirror-shift · parallel" [ref=e161] [cursor=pointer]:
              - generic [ref=e162]: Optical Debug
              - generic [ref=e163]: mirror-shift · parallel
        - complementary [ref=e164]:
          - generic [ref=e165]:
            - region "Camera Controls" [ref=e166]:
              - heading "Camera Controls" [level=3] [ref=e168]
              - generic [ref=e169]:
                - region "Camera Position" [ref=e171]:
                  - generic [ref=e172]: Camera Position
                  - generic [ref=e173]:
                    - generic [ref=e174]: 2000.0 mm
                    - slider "Camera Position" [ref=e175]: "2000"
                  - group "Camera Position direction" [ref=e176]:
                    - generic [ref=e177]: Left
                    - generic [ref=e178]: Right
                - region "Front Shift" [ref=e180]:
                  - generic [ref=e181]: Front Shift
                  - generic [ref=e182]:
                    - generic [ref=e183]: "-55.0 mm"
                    - slider "Front Shift" [ref=e184]: "-55"
                  - group "Front Shift direction" [ref=e185]:
                    - generic [ref=e186]: Left
                    - generic [ref=e187]: Right
                - region "Focus" [ref=e189]:
                  - heading "Focus" [level=3] [ref=e190]
                  - generic [ref=e191]:
                    - generic [ref=e192]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e193]: "6000"
                    - generic [ref=e194]: 6000.0 mm
                  - generic [ref=e195]: Focus is fixed for this lesson
                - region "Aperture" [ref=e197]:
                  - heading "Aperture" [level=3] [ref=e198]
                  - radiogroup "Aperture" [disabled] [ref=e199]:
                    - generic [ref=e200]:
                      - radio "f/5.6" [disabled] [ref=e201]
                      - generic [ref=e202]: f/5.6
                    - generic [ref=e203]:
                      - radio "f/8" [disabled] [ref=e204]
                      - generic [ref=e205]: f/8
                    - generic [ref=e206]:
                      - radio "f/11" [checked] [disabled] [ref=e207]
                      - generic [ref=e208]: f/11
                    - generic [ref=e209]:
                      - radio "f/16" [disabled] [ref=e210]
                      - generic [ref=e211]: f/16
                    - generic [ref=e212]:
                      - radio "f/22" [disabled] [ref=e213]
                      - generic [ref=e214]: f/22
                    - generic [ref=e215]:
                      - radio "f/32" [disabled] [ref=e216]
                      - generic [ref=e217]: f/32
                  - generic [ref=e218]: Aperture is fixed for this lesson
                - generic [ref=e219]:
                  - generic [ref=e220]: Reset
                  - region "Reset" [ref=e221]:
                    - button "Reset movements" [ref=e223] [cursor=pointer]
            - region "Developer Tools" [ref=e224]:
              - heading "Developer Tools" [level=3] [ref=e225]
              - generic [ref=e227]:
                - checkbox "Raw RTT — bypass DOF" [ref=e228]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1   | import { writeFile } from "node:fs/promises";
  2   | import { expect, test } from "@playwright/test";
  3   | import { expectGroundGlassPhysicalScale } from "./helpers/groundGlass";
  4   |
  5   | test("Mirror Shift top-view geometry follows canonical A/B/C state relationships", async ({ page }, testInfo) => {
  6   |   test.setTimeout(90_000);
  7   |   await page.goto("/simulator/free/mirror-shift?rttDiagnostics=1");
  8   |
  9   |   const rtt = page.getByTestId("ground-glass-rtt").first();
  10  |   const position = page.getByRole("slider", { name: "Camera Position" });
  11  |   const frontShift = page.getByRole("slider", { name: "Front Shift" });
  12  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  13  |   const scene = page.getByTestId("scene-canvas");
  14  |   await expect(scene).toHaveAttribute("data-optical-geometry-visible", "true");
  15  |   await expect(scene).toHaveAttribute("data-lens-coverage-capability", "angular");
  16  |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  17  |   await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  18  |   await expect(scene).toHaveAttribute(
  19  |     "data-camera-lens-center-world",
  20  |     "0.000000,0.000000,0.000000",
  21  |   );
  22  |   await expect(scene).toHaveAttribute(
  23  |     "data-camera-film-center-world",
  24  |     "0.000000,0.000000,-122.448980",
  25  |   );
  26  |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
  27  |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  28  |   const physicalScale = await expectGroundGlassPhysicalScale(rtt);
  29  |   await testInfo.attach("mirror-shift-120mm-physical-blur-scale", {
  30  |     body: JSON.stringify(physicalScale),
  31  |     contentType: "application/json",
  32  |   });
  33  |   await writeFile(
  34  |     testInfo.outputPath("mirror-shift-120mm-physical-blur-scale.json"),
  35  |     JSON.stringify(physicalScale, null, 2),
  36  |   );
  37  |   await page.getByTestId("scene-canvas").locator("canvas").screenshot({
  38  |     path: testInfo.outputPath("mirror-shift-120mm-image-circle.png"),
  39  |   });
  40  |   await rtt.locator("canvas").screenshot({
  41  |     path: testInfo.outputPath("mirror-shift-120mm-ground-glass-coverage.png"),
  42  |   });
  43  |
  44  |   await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  45  |   const geometry = page.getByTestId("mirror-shift-teaching-svg");
  46  |   await expect(geometry).toBeVisible();
  47  |   await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "top");
  48  |   await expect(geometry).toHaveAttribute("data-rig-lateral-mm", "0");
  49  |   await expect(geometry).toHaveAttribute("data-front-shift-mm", "0");
  50  |   await expect(geometry).toHaveAttribute("data-current-film-x-mm", "0");
  51  |   await expect(geometry).toHaveAttribute("data-current-lens-x-mm", "0");
  52  |
  53  |   await position.fill("2000");
  54  |   await expect(geometry).toHaveAttribute("data-rig-lateral-mm", "2000");
  55  |   await expect(geometry).toHaveAttribute("data-front-shift-mm", "0");
  56  |   await expect(geometry).toHaveAttribute("data-current-film-x-mm", "2000");
  57  |   await expect(geometry).toHaveAttribute("data-current-lens-x-mm", "2000");
  58  |
  59  |   await frontShift.fill("-55");
  60  |   await expect(geometry).toHaveAttribute("data-rig-lateral-mm", "2000");
  61  |   await expect(geometry).toHaveAttribute("data-front-shift-mm", "-55");
  62  |   await expect(geometry).toHaveAttribute("data-current-film-x-mm", "2000");
  63  |   await expect(geometry).toHaveAttribute("data-current-lens-x-mm", "1945");
  64  |   // Expanded Geometry unmounts the other viewports. Restore via the public
  65  |   // control before verifying that Ground Glass renders the changed state.
  66  |   await page.getByRole("button", { name: "Restore 2D Geometry" }).click();
  67  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  68  |   await expect(scene).toHaveAttribute(
  69  |     "data-camera-lens-center-world",
  70  |     "1945.000000,0.000000,0.000000",
  71  |   );
  72  |   await expect(scene).toHaveAttribute(
  73  |     "data-camera-film-center-world",
  74  |     "2000.000000,0.000000,-122.448980",
  75  |   );
  76  |   await scene.locator("canvas").screenshot({
  77  |     path: testInfo.outputPath("mirror-shift-nonneutral-viewport.png"),
  78  |   });
  79  |   await rtt.locator("canvas").screenshot({
  80  |     path: testInfo.outputPath("mirror-shift-nonneutral-ground-glass.png"),
  81  |   });
> 82  |   await page.getByRole("button", { name: "Reset movements" }).click();
      |                                                               ^ Error: locator.click: Test timeout of 90000ms exceeded.
  83  |   await expect(position).toHaveValue("0");
  84  |   await expect(frontShift).toHaveValue("0");
  85  | });
  86  |
  87  | test("Mirror Shift presents Top without leaking Geometry View into Architecture Rise", async ({ page }) => {
  88  |   await page.goto("/simulator/free/architecture-rise");
  89  |   await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  90  |   await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "side");
  91  |   await page.getByRole("button", { name: "Restore 2D Geometry" }).click();
  92  |
  93  |   await page.getByRole("link", { name: "All Scenes" }).click();
  94  |   const mirrorShiftCard = page
  95  |     .getByRole("article")
  96  |     .filter({ has: page.getByRole("heading", { name: "Mirror Shift" }) });
  97  |   await mirrorShiftCard.getByRole("link", { name: "Open Scene" }).click();
  98  |   await expect(page).toHaveURL(/\/simulator\/free\/mirror-shift$/);
  99  |   await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  100 |   await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "top");
  101 |   await expect(page.getByRole("button", { name: "Side" })).toHaveCount(0);
  102 |   await page.getByRole("button", { name: "Restore 2D Geometry" }).click();
  103 |
  104 |   await page.getByRole("link", { name: "All Scenes" }).click();
  105 |   const architectureCard = page
  106 |     .getByRole("article")
  107 |     .filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) });
  108 |   await architectureCard.getByRole("link", { name: "Open Scene" }).click();
  109 |   await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  110 |   await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  111 |   await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "side");
  112 | });
  113 |
```