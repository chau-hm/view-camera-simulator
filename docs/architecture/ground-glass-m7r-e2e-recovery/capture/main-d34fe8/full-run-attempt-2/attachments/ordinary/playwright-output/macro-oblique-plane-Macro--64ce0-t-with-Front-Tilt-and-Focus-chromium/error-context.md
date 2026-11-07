# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: macro-oblique-plane.spec.ts >> Macro 3 aligns the oblique planar subject with Front Tilt and Focus
- Location: src/tests/e2e/macro-oblique-plane.spec.ts:11:1

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
          - generic [ref=e12]: Oblique Macro Plane
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
                            - generic: 400.0 mm focus / CoC 0.552 mm (0%)
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
                    - button "Scheimpflug Section" [ref=e102] [cursor=pointer]
                  - group "Geometry framing" [ref=e103]:
                    - button "Fit Scene" [pressed] [ref=e104] [cursor=pointer]
                    - button "Fit Construction" [disabled] [ref=e105]
                  - button "Expand 2D Geometry" [ref=e106] [cursor=pointer]:
                    - generic [ref=e107]: open_in_new
              - paragraph [ref=e108]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e110]:
                - generic [ref=e111]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e112]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e113]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e114]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e115]
                  - generic [ref=e117]: Optical axis
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
                  - generic [ref=e119]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e125]: Near planar detail
                  - generic [ref=e129]: Middle planar detail
                  - generic [ref=e133]: Far planar detail
                - generic [ref=e135]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e136]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e137]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e138]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e139]
                  - generic [ref=e141]: Optical axis
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
                  - generic [ref=e143]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e149]: Near planar detail
                  - generic [ref=e153]: Middle planar detail
                  - generic [ref=e157]: Far planar detail
                - generic [ref=e159]:
                  - generic [ref=e161]: Current
                  - generic [ref=e162]: Original
              - generic "Optical depth order" [ref=e163]:
                - generic [ref=e166]: Film 0 mm
                - generic [ref=e169]: Lens 240 mm
                - generic [ref=e172]: DOF limit 638 mm
                - generic [ref=e175]: Focus 640 mm
                - generic [ref=e178]: Far DOF 642 mm
            - region "Focus distribution · Focus" [ref=e180]:
              - generic [ref=e181]:
                - heading "Focus distribution" [level=4] [ref=e182]
                - 'generic "Ground Glass orientation: Raw" [ref=e183]': Raw
              - table "Focus distribution" [ref=e184]:
                - caption [ref=e185]: Focus distribution
                - rowgroup [ref=e186]:
                  - 'row "Upper centre Upper centre · Near planar detail: 0% · Soft" [ref=e187]':
                    - cell [ref=e188]
                    - 'cell "Upper centre Upper centre · Near planar detail: 0% · Soft" [ref=e189]':
                      - generic "Upper centre" [ref=e190]
                      - 'group "Upper centre · Near planar detail: 0% · Soft" [ref=e192]':
                        - generic "Near planar detail" [ref=e194]
                        - generic [ref=e195]:
                          - text: 0%
                          - generic [ref=e196]: —
                    - cell [ref=e197]
                  - 'row "Centre Centre · Middle planar detail: 81% · Sharp" [ref=e198]':
                    - cell [ref=e199]
                    - 'cell "Centre Centre · Middle planar detail: 81% · Sharp" [ref=e200]':
                      - generic "Centre" [ref=e201]
                      - 'group "Centre · Middle planar detail: 81% · Sharp" [ref=e203]':
                        - generic "Middle planar detail" [ref=e205]
                        - generic [ref=e206]:
                          - text: 81%
                          - generic [ref=e207]: ✓
                    - cell [ref=e208]
                  - 'row "Lower centre Lower centre · Far planar detail: 0% · Soft" [ref=e209]':
                    - cell [ref=e210]
                    - 'cell "Lower centre Lower centre · Far planar detail: 0% · Soft" [ref=e211]':
                      - generic "Lower centre" [ref=e212]
                      - 'group "Lower centre · Far planar detail: 0% · Soft" [ref=e214]':
                        - generic "Far planar detail" [ref=e216]
                        - generic [ref=e217]:
                          - text: 0%
                          - generic [ref=e218]: —
                    - cell [ref=e219]
          - group [ref=e222]:
            - generic "Optical Debug macro-oblique-plane · parallel" [ref=e223] [cursor=pointer]:
              - generic [ref=e224]: Optical Debug
              - generic [ref=e225]: macro-oblique-plane · parallel
        - complementary [ref=e226]:
          - generic [ref=e227]:
            - region "Camera Controls" [ref=e228]:
              - heading "Camera Controls" [level=3] [ref=e230]
              - generic [ref=e231]:
                - group "Movement" [ref=e233]:
                  - generic [ref=e234]: Movement
                  - radiogroup "Movement" [ref=e235]:
                    - generic [ref=e236]:
                      - radio "Front Tilt" [checked] [ref=e237]
                      - text: Front Tilt
                - generic [ref=e239]:
                  - generic [ref=e240]: Front Tilt (0.0°)
                  - slider "Front Tilt" [ref=e241]: "0"
                - region "Focus" [ref=e243]:
                  - heading "Focus" [level=3] [ref=e244]
                  - generic [ref=e245]:
                    - generic [ref=e246]: Focus distance
                    - slider "Focus distance" [ref=e247]: "400"
                    - generic [ref=e248]: 400.0 mm
                - region "Aperture" [ref=e250]:
                  - heading "Aperture" [level=3] [ref=e251]
                  - radiogroup "Aperture" [disabled] [ref=e252]:
                    - generic [ref=e253]:
                      - radio "f/5.6" [checked] [disabled] [ref=e254]
                      - generic [ref=e255]: f/5.6
                    - generic [ref=e256]:
                      - radio "f/8" [disabled] [ref=e257]
                      - generic [ref=e258]: f/8
                    - generic [ref=e259]:
                      - radio "f/11" [disabled] [ref=e260]
                      - generic [ref=e261]: f/11
                    - generic [ref=e262]:
                      - radio "f/16" [disabled] [ref=e263]
                      - generic [ref=e264]: f/16
                    - generic [ref=e265]:
                      - radio "f/22" [disabled] [ref=e266]
                      - generic [ref=e267]: f/22
                    - generic [ref=e268]:
                      - radio "f/32" [disabled] [ref=e269]
                      - generic [ref=e270]: f/32
                  - generic [ref=e271]: Aperture is fixed for this lesson
                - generic [ref=e272]:
                  - generic [ref=e273]: Reset
                  - region "Reset" [ref=e274]:
                    - button "Reset movements" [ref=e276] [cursor=pointer]
            - region "Developer Tools" [ref=e277]:
              - heading "Developer Tools" [level=3] [ref=e278]
              - generic [ref=e280]:
                - checkbox "Raw RTT — bypass DOF" [ref=e281]
                - text: Raw RTT — bypass DOF
          - region "Macro focus" [ref=e283]:
            - heading "Macro focus" [level=3] [ref=e284]
            - generic [ref=e285]:
              - generic [ref=e286]:
                - term [ref=e287]: Bellows extension (lens to film)
                - definition [ref=e288]: 240.0 mm
              - generic [ref=e289]:
                - term [ref=e290]: Magnification
                - definition [ref=e291]: 0.60×
              - generic [ref=e292]:
                - term [ref=e293]: Bellows factor
                - definition [ref=e294]: 2.56×
              - generic [ref=e295]:
                - term [ref=e296]: Exposure compensation
                - definition [ref=e297]: +1.36 stops
            - generic [ref=e298]: At the selected focus plane. Exposure compensation assumes a symmetric thin lens.
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | import { readFocusDistributionScores } from "./helpers/focusDistribution";
  3   | import { setStepRangeInput } from "./helpers/stepRangeInput";
  4   | 
  5   | const TARGET_IDS = [
  6   |   "macro-oblique-near",
  7   |   "macro-oblique-middle",
  8   |   "macro-oblique-far",
  9   | ] as const;
  10  | 
  11  | test("Macro 3 aligns the oblique planar subject with Front Tilt and Focus", async ({ page }) => {
  12  |   test.setTimeout(120_000);
  13  |   const pageErrors: string[] = [];
  14  |   const consoleErrors: string[] = [];
  15  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  16  |   page.on("console", (message) => {
  17  |     if (message.type() === "error") consoleErrors.push(message.text());
  18  |   });
  19  | 
  20  |   await page.goto("/simulator/free/macro-oblique-plane");
  21  | 
  22  |   const sceneCanvas = page.getByTestId("scene-canvas");
> 23  |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
      |                                               ^ Error: expect(locator).toHaveCount(expected) failed
  24  |   await expect(page.locator(".groundglass-renderer-host canvas")).toHaveCount(1);
  25  |   await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-oblique-plane");
  26  | 
  27  |   const focus = page.getByRole("slider", { name: "Focus distance" });
  28  |   const tilt = page.getByRole("slider", { name: "Front Tilt" });
  29  |   const readout = page.getByRole("region", { name: "Macro focus" });
  30  |   const panel = page.getByTestId("focus-distribution-panel");
  31  | 
  32  |   await expect(focus).toHaveValue("400");
  33  |   await expect(tilt).toHaveValue("0");
  34  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute(
  35  |     "data-selected-aperture",
  36  |     "5.6",
  37  |   );
  38  |   await expect(tilt).toBeEnabled();
  39  |   await expect(page.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  40  |   await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  41  |   await expect(page.getByRole("slider", { name: "Shift" })).toHaveCount(0);
  42  |   await expect(page.getByRole("button", { name: "Infinity Reset" })).toHaveCount(0);
  43  |   await expect(page.getByRole("combobox", { name: /focal length/i })).toHaveCount(0);
  44  |   await expect(page.getByRole("group", { name: "Focus standard" })).toHaveCount(0);
  45  |   await expect(panel.locator("[data-focus-target-id]")).toHaveCount(3);
  46  |   for (const targetId of TARGET_IDS) {
  47  |     await expect(panel.locator(`[data-focus-target-id="${targetId}"]`)).toBeVisible();
  48  |   }
  49  |   await expect(readout).toContainText("240.0 mm");
  50  | 
  51  |   const neutralScores = await readFocusDistributionScores(page, TARGET_IDS);
  52  |   expect(neutralScores["macro-oblique-middle"]).toBeGreaterThan(
  53  |     neutralScores["macro-oblique-near"],
  54  |   );
  55  |   expect(neutralScores["macro-oblique-middle"]).toBeGreaterThan(
  56  |     neutralScores["macro-oblique-far"],
  57  |   );
  58  |   expect(
  59  |     await panel.locator('[data-focus-target-id="macro-oblique-middle"]').getAttribute("aria-label"),
  60  |   ).toMatch(/Sharp/);
  61  |   expect(
  62  |     await panel.locator('[data-focus-target-id="macro-oblique-near"]').getAttribute("aria-label"),
  63  |   ).toMatch(/Soft/);
  64  |   expect(
  65  |     await panel.locator('[data-focus-target-id="macro-oblique-far"]').getAttribute("aria-label"),
  66  |   ).toMatch(/Soft/);
  67  | 
  68  |   await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  69  |   const teaching = page.getByTestId("macro-oblique-teaching");
  70  |   await expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");
  71  |   await expect(teaching).toHaveAttribute("data-sharp-count", "1");
  72  |   await expect(teaching).toHaveAttribute("data-strongest-region", "middle");
  73  | 
  74  |   await setStepRangeInput(page, "Front Tilt", -2);
  75  |   await expect(teaching).toHaveAttribute("data-stage", "tilt-and-focus");
  76  |   await expect(teaching).not.toContainText("rotating toward the PCB");
  77  |   await expect(teaching).toContainText("changed the orientation of the sharp-focus plane");
  78  | 
  79  |   await setStepRangeInput(page, "Front Tilt", 0);
  80  |   await expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");
  81  | 
  82  |   await setStepRangeInput(page, "Focus distance", 380);
  83  |   await expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");
  84  |   await expect(teaching).toHaveAttribute("data-strongest-region", "near");
  85  | 
  86  |   await setStepRangeInput(page, "Focus distance", 420);
  87  |   await expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");
  88  |   await expect(teaching).toHaveAttribute("data-strongest-region", "far");
  89  | 
  90  |   await setStepRangeInput(page, "Front Tilt", 2);
  91  |   await expect(teaching).toHaveAttribute("data-stage", "tilt-and-focus");
  92  |   await expect(teaching).toContainText("changed the orientation of the sharp-focus plane");
  93  |   await expect(teaching).toContainText("positive direction first");
  94  | 
  95  |   await setStepRangeInput(page, "Front Tilt", 6.2);
  96  |   await setStepRangeInput(page, "Focus distance", 390);
  97  |   await expect(teaching).toHaveAttribute("data-stage", "refine-alignment");
  98  |   await expect(teaching).toHaveAttribute("data-sharp-count", "2");
  99  | 
  100 |   await setStepRangeInput(page, "Front Tilt", 6.3);
  101 |   await expect(teaching).toHaveAttribute("data-stage", "aligned");
  102 |   await expect(teaching).toHaveAttribute("data-sharp-count", "3");
  103 |   await expect(teaching).toHaveAttribute("data-all-sharp", "true");
  104 | 
  105 |   await page.getByRole("button", { name: "Feedback", exact: true }).click();
  106 |   const feedback = page.getByTestId("macro-oblique-feedback");
  107 |   await expect(feedback).toHaveAttribute("data-stage", "aligned");
  108 |   await expect(feedback).toContainText("all Sharp");
  109 |   await expect(tilt).toHaveValue("6.3");
  110 |   await expect(focus).toHaveValue("390");
  111 |   await expect(readout).toContainText("243.8 mm");
  112 | 
  113 |   const alignedScores = await readFocusDistributionScores(page, TARGET_IDS);
  114 |   TARGET_IDS.forEach((targetId) => {
  115 |     expect(alignedScores[targetId]).toBeGreaterThanOrEqual(80);
  116 |     expect(alignedScores[targetId]).toBe(100);
  117 |   });
  118 |   for (const targetId of TARGET_IDS) {
  119 |     await expect(panel.locator(`[data-focus-target-id="${targetId}"]`)).toHaveAttribute(
  120 |       "aria-label",
  121 |       /Sharp/,
  122 |     );
  123 |   }
```