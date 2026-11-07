# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: physical-image-circle.spec.ts >> 3D Image Circle consumes the Ground Glass finite coverage state
- Location: src/tests/e2e/physical-image-circle.spec.ts:34:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('ground-glass-rtt')
Expected: "true"
Received: ""

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('ground-glass-rtt')

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
                  - generic [ref=e42]:
                    - generic [ref=e43]:
                      - generic: Focus plane (green)
                      - generic: DOF limit (blue)
                      - generic: FOV rays (amber)
                      - generic: Lens plane (slate)
                      - generic: Optical axis
                      - generic: Image circle (rose)
                      - generic: Film plane (blue)
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
                            - generic:
                              - generic: ∞ focus
                              - generic: "Last finite focus: 8890.0 mm"
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
              - paragraph [ref=e106]: "Side view | Rise: 40.0 mm | Tilt: 0.0° | Swing: 0.0°"
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
                    - generic "nearDof plane"
                  - generic "Simplified bellows connector" [ref=e117]
                  - generic "chief ray from film centre through lens centre" [ref=e120]
                  - generic [ref=e124]: Building mid facade
              - generic "Optical depth order" [ref=e125]:
                - generic [ref=e128]: Film 0 mm
                - generic [ref=e131]: Lens 150 mm
                - generic [ref=e134]: DOF limit 10.5 m
                - generic [ref=e137]: Focus ∞
                - generic [ref=e140]: Far DOF ∞
          - group [ref=e143]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e144] [cursor=pointer]:
              - generic [ref=e145]: Optical Debug
              - generic [ref=e146]: architecture-rise · parallel
        - complementary [ref=e147]:
          - generic [ref=e148]:
            - region "Camera Controls" [ref=e149]:
              - heading "Camera Controls" [level=3] [ref=e151]
              - generic [ref=e152]:
                - region "Movement" [ref=e154]:
                  - generic [ref=e155]:
                    - heading "Front standard" [level=4] [ref=e156]
                    - button "Help" [ref=e157] [cursor=pointer]:
                      - generic [ref=e158]: "?"
                  - generic [ref=e159]:
                    - generic [ref=e160]:
                      - generic [ref=e161]: Rise
                      - slider "Rise" [ref=e162]: "40"
                      - generic [ref=e163]: 40.0 mm
                    - generic [ref=e164]:
                      - generic [ref=e165]: Tilt
                      - slider "Tilt" [ref=e166]: "0"
                      - generic [ref=e167]: 0.0°
                    - generic [ref=e168]:
                      - generic [ref=e169]: Swing
                      - slider "Swing" [ref=e170]: "0"
                      - generic [ref=e171]: 0.0°
                - region "Focus" [ref=e173]:
                  - heading "Focus" [level=3] [ref=e174]
                  - generic [ref=e175]:
                    - generic [ref=e176]: Focus distance
                    - slider "Focus distance" [ref=e177]: "8890"
                    - generic [ref=e178]: "Focus: ∞"
                    - button "Infinity Reset" [ref=e180] [cursor=pointer]: ∞
                  - generic [ref=e181]:
                    - generic [ref=e182]: "Last finite focus: 8890.0 mm"
                    - generic [ref=e183]: Last finite focus — drag to exit ∞
                - region "Aperture" [ref=e185]:
                  - heading "Aperture" [level=3] [ref=e186]
                  - radiogroup "Aperture" [ref=e187]:
                    - generic [ref=e188] [cursor=pointer]:
                      - radio "f/5.6" [ref=e189]
                      - generic [ref=e190]: f/5.6
                    - generic [ref=e191] [cursor=pointer]:
                      - radio "f/8" [ref=e192]
                      - generic [ref=e193]: f/8
                    - generic [ref=e194] [cursor=pointer]:
                      - radio "f/11" [ref=e195]
                      - generic [ref=e196]: f/11
                    - generic [ref=e197] [cursor=pointer]:
                      - radio "f/16" [ref=e198]
                      - generic [ref=e199]: f/16
                    - generic [ref=e200] [cursor=pointer]:
                      - radio "f/22" [checked] [active] [ref=e201]
                      - generic [ref=e202]: f/22
                    - generic [ref=e203] [cursor=pointer]:
                      - radio "f/32" [ref=e204]
                      - generic [ref=e205]: f/32
                - generic [ref=e206]:
                  - generic [ref=e207]: Reset
                  - region "Reset" [ref=e208]:
                    - button "Reset movements" [ref=e210] [cursor=pointer]
            - region "Developer Tools" [ref=e211]:
              - heading "Developer Tools" [level=3] [ref=e212]
              - generic [ref=e214]:
                - checkbox "Raw RTT — bypass DOF" [ref=e215]
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
> 15  |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
      |                     ^ Error: expect(locator).toHaveAttribute(expected) failed
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
  40  |   await expect(scene.locator("canvas")).toHaveCount(1);
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
```