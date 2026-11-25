# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: macro-depth-of-field.spec.ts >> Macro 2 teaches shallow physical depth of field across a 3D subject
- Location: src/tests/e2e/macro-depth-of-field.spec.ts:11:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
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
          - generic [ref=e12]: Three-Dimensional Macro
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
                    - button "Open Task and Feedback" [expanded]:
                      - generic: Task and Feedback
                    - generic [ref=e54]:
                      - generic [ref=e55]:
                        - group "Task and Feedback views" [ref=e56]:
                          - button "Task" [pressed] [ref=e57] [cursor=pointer]
                          - button "Feedback" [ref=e58] [cursor=pointer]
                        - generic [ref=e59]:
                          - button "Keep Task and Feedback open" [ref=e60] [cursor=pointer]:
                            - generic [ref=e61]: push_pin
                          - button "Close Task and Feedback" [ref=e62] [cursor=pointer]:
                            - generic [ref=e63]: close
                      - generic "Task" [ref=e65]:
                        - region "Task" [ref=e66]:
                          - generic [ref=e67]:
                            - generic [ref=e69]: Free practice
                            - region "Three-dimensional macro depth-of-field study" [ref=e70]:
                              - heading "Three-dimensional macro depth-of-field study" [level=3] [ref=e71]
                              - generic [ref=e72]:
                                - generic [ref=e73]:
                                  - strong [ref=e74]: Goal
                                  - paragraph [ref=e75]: Explore how difficult it is to keep a three-dimensional subject sharp at macro distance.
                                - generic [ref=e76]:
                                  - strong [ref=e77]: Try
                                  - paragraph [ref=e78]: Keep the aperture wide open at f/5.6 and move Focus Distance from the Near detail to the Middle and Far details.
                                - generic [ref=e79]:
                                  - strong [ref=e80]: Observe
                                  - paragraph [ref=e81]: The Middle detail is currently strongest. Only a narrow region is sharp; use Focus Distribution to watch the emphasis move through the subject.
                                - generic [ref=e82]:
                                  - strong [ref=e83]: Why it matters
                                  - paragraph [ref=e84]: At macro distance, depth of field is extremely shallow. Refocusing moves which depth is centered on the focus plane; it does not increase total depth of field.
            - generic "GroundGlassColumn" [ref=e85]:
              - generic [ref=e86]:
                - generic [ref=e88]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e89]
              - generic [ref=e90]:
                - generic [ref=e92]:
                  - group "Preview" [ref=e93]:
                    - generic [ref=e94]: Preview
                    - generic [ref=e96]:
                      - generic [ref=e97]:
                        - radio "Raw Ground Glass" [checked] [ref=e98]
                        - generic [ref=e99]: Raw Ground Glass
                      - generic [ref=e100]:
                        - radio "Upright Assist" [ref=e101]
                        - generic [ref=e102]: Upright Assist
                  - group "View Options" [ref=e103]:
                    - generic [ref=e104]: View Options
                    - region "View Options" [ref=e106]:
                      - generic [ref=e108]:
                        - checkbox "Grid" [checked] [ref=e109]
                        - generic [ref=e110]: Grid
                - generic "GroundGlassViewport" [ref=e111]:
                  - generic [ref=e113]:
                    - generic [ref=e114]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e115]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 400.0 mm focus / CoC 0.412 mm (0%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e119] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e120]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e121] [cursor=pointer]:
                    - generic [ref=e122]: open_in_new
            - generic [ref=e124]:
              - generic [ref=e125]:
                - heading "2D Geometry" [level=2] [ref=e126]
                - generic [ref=e127]:
                  - group "Geometry view" [ref=e128]:
                    - button "Side" [pressed] [ref=e129] [cursor=pointer]
                    - button "Top" [ref=e130] [cursor=pointer]
                  - group "Geometry framing" [ref=e131]:
                    - button "Fit Scene" [pressed] [ref=e132] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e133] [cursor=pointer]:
                    - generic [ref=e134]: open_in_new
              - paragraph [ref=e135]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e137]:
                - generic [ref=e138]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e139]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e140]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e141]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e142]
                  - generic [ref=e144]: Optical axis
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
                  - generic [ref=e146]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e152]: Near detail
                  - generic [ref=e156]: Middle detail
                  - generic [ref=e160]: Far detail
              - generic "Optical depth order" [ref=e162]:
                - generic [ref=e165]: Film 0 mm
                - generic [ref=e168]: Lens 240 mm
                - generic [ref=e171]: DOF limit 638 mm
                - generic [ref=e174]: Focus 640 mm
                - generic [ref=e177]: Far DOF 642 mm
            - region "Focus distribution · Focus" [ref=e179]:
              - generic [ref=e180]:
                - heading "Focus distribution" [level=4] [ref=e181]
                - 'generic "Ground Glass orientation: Raw" [ref=e182]': Raw
              - table "Focus distribution" [ref=e183]:
                - caption [ref=e184]: Focus distribution
                - rowgroup [ref=e185]:
                  - row [ref=e186]:
                    - cell [ref=e187]
                    - cell [ref=e188]
                    - cell [ref=e189]
                  - 'row "Middle left Middle left · Near detail: 0% · Soft Centre Centre · Middle detail: 100% · Sharp Middle right Middle right · Far detail: 0% · Soft" [ref=e190]':
                    - 'cell "Middle left Middle left · Near detail: 0% · Soft" [ref=e191]':
                      - generic "Middle left" [ref=e192]
                      - 'group "Middle left · Near detail: 0% · Soft" [ref=e194]':
                        - generic "Near detail" [ref=e196]
                        - generic [ref=e197]:
                          - text: 0%
                          - generic [ref=e198]: —
                    - 'cell "Centre Centre · Middle detail: 100% · Sharp" [ref=e199]':
                      - generic "Centre" [ref=e200]
                      - 'group "Centre · Middle detail: 100% · Sharp" [ref=e202]':
                        - generic "Middle detail" [ref=e204]
                        - generic [ref=e205]:
                          - text: 100%
                          - generic [ref=e206]: ✓
                    - 'cell "Middle right Middle right · Far detail: 0% · Soft" [ref=e207]':
                      - generic "Middle right" [ref=e208]
                      - 'group "Middle right · Far detail: 0% · Soft" [ref=e210]':
                        - generic "Far detail" [ref=e212]
                        - generic [ref=e213]:
                          - text: 0%
                          - generic [ref=e214]: —
                  - row [ref=e215]:
                    - cell [ref=e216]
                    - cell [ref=e217]
                    - cell [ref=e218]
          - group [ref=e221]:
            - generic "Optical Debug macro-depth-of-field · parallel" [ref=e222] [cursor=pointer]:
              - generic [ref=e223]: Optical Debug
              - generic [ref=e224]: macro-depth-of-field · parallel
        - complementary [ref=e225]:
          - generic [ref=e226]:
            - region "Camera Controls" [ref=e227]:
              - heading "Camera Controls" [level=3] [ref=e229]
              - generic [ref=e230]:
                - region "Focus" [ref=e232]:
                  - heading "Focus" [level=3] [ref=e233]
                  - generic [ref=e234]:
                    - generic [ref=e235]: Focus distance
                    - slider "Focus distance" [ref=e236]: "400"
                    - generic [ref=e237]: 400.0 mm
                - region "Aperture" [ref=e239]:
                  - heading "Aperture" [level=3] [ref=e240]
                  - radiogroup "Aperture" [ref=e241]:
                    - generic [ref=e242] [cursor=pointer]:
                      - radio "f/5.6" [checked] [ref=e243]
                      - generic [ref=e244]: f/5.6
                    - generic [ref=e245] [cursor=pointer]:
                      - radio "f/8" [ref=e246]
                      - generic [ref=e247]: f/8
                    - generic [ref=e248] [cursor=pointer]:
                      - radio "f/11" [ref=e249]
                      - generic [ref=e250]: f/11
                    - generic [ref=e251] [cursor=pointer]:
                      - radio "f/16" [ref=e252]
                      - generic [ref=e253]: f/16
                    - generic [ref=e254] [cursor=pointer]:
                      - radio "f/22" [ref=e255]
                      - generic [ref=e256]: f/22
                    - generic [ref=e257] [cursor=pointer]:
                      - radio "f/32" [ref=e258]
                      - generic [ref=e259]: f/32
            - region "Developer Tools" [ref=e260]:
              - heading "Developer Tools" [level=3] [ref=e261]
              - generic [ref=e263]:
                - checkbox "Raw RTT — bypass DOF" [ref=e264]
                - text: Raw RTT — bypass DOF
          - region "Macro focus" [ref=e266]:
            - heading "Macro focus" [level=3] [ref=e267]
            - generic [ref=e268]:
              - generic [ref=e269]:
                - term [ref=e270]: Bellows extension (lens to film)
                - definition [ref=e271]: 240.0 mm
              - generic [ref=e272]:
                - term [ref=e273]: Magnification
                - definition [ref=e274]: 0.60×
              - generic [ref=e275]:
                - term [ref=e276]: Bellows factor
                - definition [ref=e277]: 2.56×
              - generic [ref=e278]:
                - term [ref=e279]: Exposure compensation
                - definition [ref=e280]: +1.36 stops
            - generic [ref=e281]: At the selected focus plane. Exposure compensation assumes a symmetric thin lens.
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | import { readFocusDistributionScores } from "./helpers/focusDistribution";
  3   | import { setPublicRangeInput } from "./helpers/publicRangeInput";
  4   | 
  5   | const TARGET_IDS = [
  6   |   "macro-depth-near",
  7   |   "macro-depth-middle",
  8   |   "macro-depth-far",
  9   | ] as const;
  10  | 
  11  | test("Macro 2 teaches shallow physical depth of field across a 3D subject", async ({ page }) => {
  12  |   test.setTimeout(90_000);
  13  |   const pageErrors: string[] = [];
  14  |   const consoleErrors: string[] = [];
  15  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  16  |   page.on("console", (message) => {
  17  |     if (message.type() === "error") consoleErrors.push(message.text());
  18  |   });
  19  | 
  20  |   await page.goto("/simulator/free/architecture-rise");
  21  |   await expect(page.getByRole("button", { name: "Infinity Reset" })).toBeVisible();
  22  |   await page.getByRole("button", { name: "Infinity Reset" }).click();
  23  |   await expect(page.getByText(/Focus: ∞/)).toBeVisible();
  24  | 
  25  |   // Preserve the previous scene's Infinity state while using the public SPA
  26  |   // navigation path into the finite-only Macro scene.
  27  |   await page.getByRole("link", { name: "All Scenes" }).click();
  28  |   await expect(page).toHaveURL(/\/scenes$/);
  29  |   await page.locator('a[href="/simulator/free/macro-depth-of-field"]').click();
  30  |   await expect(page).toHaveURL(/\/simulator\/free\/macro-depth-of-field$/);
  31  | 
  32  |   const sceneCanvas = page.getByTestId("scene-canvas");
  33  |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  34  |   await expect(page.locator(".groundglass-renderer-host canvas")).toHaveCount(1);
  35  |   await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-depth-of-field");
  36  | 
  37  |   const focus = page.getByRole("slider", { name: "Focus distance" });
  38  |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  39  |   const groundGlassRtt = page.getByTestId("ground-glass-rtt");
  40  |   const readout = page.getByRole("region", { name: "Macro focus" });
  41  |   await expect(focus).toHaveValue("400");
  42  |   await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  43  |   await expect(aperture).toBeEnabled();
  44  |   await expect(readout).toContainText("240.0 mm");
  45  |   await expect(readout).toContainText("0.60×");
  46  |   await expect(page.getByText("Movement", { exact: true })).toHaveCount(0);
  47  |   await expect(page.getByRole("button", { name: "Infinity Reset" })).toHaveCount(0);
  48  |   await expect(page.getByRole("combobox", { name: /focal length/i })).toHaveCount(0);
  49  |   await expect(page.getByRole("group", { name: "Focus standard" })).toHaveCount(0);
  50  | 
  51  |   await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  52  |   const teaching = page.getByTestId("macro-depth-teaching");
  53  |   const taskView = page.getByTestId("learning-overlay-task-view");
  54  |   await expect(teaching).toHaveAttribute("data-stage", "wide-open");
  55  |   await expect(teaching).toHaveAttribute("data-focused-region", "middle");
  56  |   await expect(taskView).toContainText("three-dimensional subject");
  57  |   await expect(taskView).toContainText("Refocusing moves");
  58  |   await expect(taskView).not.toContainText("bellows travel");
  59  | 
  60  |   const readGroundGlassGain = async () =>
  61  |     Number(await groundGlassRtt.getAttribute("data-rtt-ground-glass-illuminance-gain"));
> 62  |   await expect.poll(readGroundGlassGain).toBeGreaterThan(0);
      |                                          ^ Error: expect(received).toBeGreaterThan(expected)
  63  |   const wideApertureGroundGlassGain = await readGroundGlassGain();
  64  | 
  65  |   const panel = page.getByTestId("focus-distribution-panel");
  66  |   await expect(panel.locator("[data-focus-target-id]")).toHaveCount(3);
  67  |   for (const targetId of TARGET_IDS) {
  68  |     await expect(panel.locator(`[data-focus-target-id="${targetId}"]`)).toBeVisible();
  69  |   }
  70  | 
  71  |   const wideScores = await readFocusDistributionScores(page, TARGET_IDS);
  72  |   expect(wideScores["macro-depth-middle"]).toBeGreaterThan(wideScores["macro-depth-near"]);
  73  |   expect(wideScores["macro-depth-middle"]).toBeGreaterThan(wideScores["macro-depth-far"]);
  74  |   expect(
  75  |     await panel.locator('[data-focus-target-id="macro-depth-middle"]').getAttribute("aria-label"),
  76  |   ).toMatch(/Sharp/);
  77  |   expect(
  78  |     await panel.locator('[data-focus-target-id="macro-depth-near"]').getAttribute("aria-label"),
  79  |   ).toMatch(/Soft/);
  80  |   expect(
  81  |     await panel.locator('[data-focus-target-id="macro-depth-far"]').getAttribute("aria-label"),
  82  |   ).toMatch(/Soft/);
  83  | 
  84  |   await aperture.getByRole("radio", { name: "f/32" }).check();
  85  |   await expect(aperture).toHaveAttribute("data-selected-aperture", "32");
  86  |   await expect(teaching).toHaveAttribute("data-stage", "minimum-aperture");
  87  |   await expect(taskView).toContainText("remain Soft");
  88  |   await expect(taskView).toContainText("aperture alone cannot always cover");
  89  |   await expect.poll(readGroundGlassGain).toBeLessThan(wideApertureGroundGlassGain);
  90  |   await expect.poll(async () => {
  91  |     const scores = await readFocusDistributionScores(page, ["macro-depth-near", "macro-depth-far"]);
  92  |     return scores["macro-depth-near"] + scores["macro-depth-far"];
  93  |   }).toBeGreaterThan(wideScores["macro-depth-near"] + wideScores["macro-depth-far"]);
  94  |   const stoppedDownLabels = await Promise.all(
  95  |     TARGET_IDS.map((targetId) =>
  96  |       panel.locator(`[data-focus-target-id="${targetId}"]`).getAttribute("aria-label"),
  97  |     ),
  98  |   );
  99  |   expect(stoppedDownLabels.some((label) => label?.includes("Soft"))).toBe(true);
  100 | 
  101 |   await aperture.getByRole("radio", { name: "f/5.6" }).check();
  102 |   await setPublicRangeInput(focus, 390);
  103 |   await expect(teaching).toHaveAttribute("data-stage", "wide-open");
  104 |   await expect(teaching).toHaveAttribute("data-focused-region", "near");
  105 |   const nearFocusScores = await readFocusDistributionScores(page, TARGET_IDS);
  106 |   expect(nearFocusScores["macro-depth-near"]).toBeGreaterThan(nearFocusScores["macro-depth-middle"]);
  107 |   expect(nearFocusScores["macro-depth-near"]).toBeGreaterThan(nearFocusScores["macro-depth-far"]);
  108 | 
  109 |   await setPublicRangeInput(focus, 410);
  110 |   await expect(teaching).toHaveAttribute("data-focused-region", "far");
  111 |   const farFocusScores = await readFocusDistributionScores(page, TARGET_IDS);
  112 |   expect(farFocusScores["macro-depth-far"]).toBeGreaterThan(farFocusScores["macro-depth-near"]);
  113 |   expect(farFocusScores["macro-depth-far"]).toBeGreaterThan(farFocusScores["macro-depth-middle"]);
  114 | 
  115 |   await setPublicRangeInput(focus, 360);
  116 |   await expect(teaching).toHaveAttribute("data-focused-region", "near");
  117 |   await expect(taskView).toContainText("Near detail is currently strongest");
  118 | 
  119 |   await setPublicRangeInput(focus, 440);
  120 |   await expect(teaching).toHaveAttribute("data-focused-region", "far");
  121 |   await expect(taskView).toContainText("Far detail is currently strongest");
  122 | 
  123 |   expect(pageErrors).toEqual([]);
  124 |   expect(consoleErrors).toEqual([]);
  125 | });
  126 | 
```