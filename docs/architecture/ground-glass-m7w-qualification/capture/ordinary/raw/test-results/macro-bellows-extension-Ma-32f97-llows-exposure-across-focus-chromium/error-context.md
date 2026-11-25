# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: macro-bellows-extension.spec.ts >> Macro 1 tracks canonical Image Circle growth and bellows exposure across focus
- Location: src/tests/e2e/macro-bellows-extension.spec.ts:72:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('ground-glass-rtt')
Expected: "parallel-circle"
Received: ""
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('ground-glass-rtt')
    - locator resolved to <div data-three-revision="187" data-rtt-channel="default" data-testid="ground-glass-rtt" data-pilot-retry-status="none" data-frame-channel-id="default" data-frame-result-status="pending" data-policy-selected-backend="webgl" data-application-fallback="not-observed" data-render-host-lifecycle="initializing" data-render-cleanup-status="not-required" data-rtt-scene-id="macro-bellows-extension" data-frame-scene-id="macro-bellows-extension" data-frame-request-id="gg-mw7u036i-o740lw9jxas-default-request-5…>…</div>
    - unexpected value "null"

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
          - generic [ref=e12]: 1:1 Flat Subject
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
                            - generic: 900.0 mm focus / CoC 10.746 mm (0%)
                          - generic: "Grid: 1 cm per square"
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
                  - generic [ref=e116]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e122]: Specimen coin
              - generic "Optical depth order" [ref=e124]:
                - generic [ref=e127]: Film 0 mm
                - generic [ref=e130]: Lens 180 mm
                - generic [ref=e133]: DOF limit > 620 mm
                - generic [ref=e136]: Focus > 620 mm
                - generic [ref=e139]: Far DOF > 620 mm
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
                  - 'row "Centre Centre · Specimen coin: 0% · Soft" [ref=e152]':
                    - cell [ref=e153]
                    - 'cell "Centre Centre · Specimen coin: 0% · Soft" [ref=e154]':
                      - generic "Centre" [ref=e155]
                      - 'group "Centre · Specimen coin: 0% · Soft" [ref=e157]':
                        - generic "Specimen coin" [ref=e159]
                        - generic [ref=e160]:
                          - text: 0%
                          - generic [ref=e161]: —
                    - cell [ref=e162]
                  - row [ref=e163]:
                    - cell [ref=e164]
                    - cell [ref=e165]
                    - cell [ref=e166]
          - group [ref=e169]:
            - generic "Optical Debug macro-bellows-extension · parallel" [ref=e170] [cursor=pointer]:
              - generic [ref=e171]: Optical Debug
              - generic [ref=e172]: macro-bellows-extension · parallel
        - complementary [ref=e173]:
          - generic [ref=e174]:
            - region "Camera Controls" [ref=e175]:
              - heading "Camera Controls" [level=3] [ref=e177]
              - generic [ref=e178]:
                - region "Focus" [ref=e180]:
                  - heading "Focus" [level=3] [ref=e181]
                  - generic [ref=e182]:
                    - generic [ref=e183]: Focus distance
                    - slider "Focus distance" [ref=e184]: "900"
                    - generic [ref=e185]: 900.0 mm
                - region "Aperture" [ref=e187]:
                  - heading "Aperture" [level=3] [ref=e188]
                  - radiogroup "Aperture" [ref=e189]:
                    - generic [ref=e190] [cursor=pointer]:
                      - radio "f/5.6" [checked] [ref=e191]
                      - generic [ref=e192]: f/5.6
                    - generic [ref=e193] [cursor=pointer]:
                      - radio "f/8" [ref=e194]
                      - generic [ref=e195]: f/8
                    - generic [ref=e196] [cursor=pointer]:
                      - radio "f/11" [ref=e197]
                      - generic [ref=e198]: f/11
                    - generic [ref=e199] [cursor=pointer]:
                      - radio "f/16" [ref=e200]
                      - generic [ref=e201]: f/16
                    - generic [ref=e202] [cursor=pointer]:
                      - radio "f/22" [ref=e203]
                      - generic [ref=e204]: f/22
                    - generic [ref=e205] [cursor=pointer]:
                      - radio "f/32" [ref=e206]
                      - generic [ref=e207]: f/32
            - region "Developer Tools" [ref=e208]:
              - heading "Developer Tools" [level=3] [ref=e209]
              - generic [ref=e211]:
                - checkbox "Raw RTT — bypass DOF" [ref=e212]
                - text: Raw RTT — bypass DOF
          - region "Macro focus" [ref=e214]:
            - heading "Macro focus" [level=3] [ref=e215]
            - generic [ref=e216]:
              - generic [ref=e217]:
                - term [ref=e218]: Required bellows extension
                - definition [ref=e219]: 180.0 mm
              - generic [ref=e220]:
                - term [ref=e221]: Selected focus-plane magnification
                - definition [ref=e222]: 0.20×
              - generic [ref=e223]:
                - term [ref=e224]: Selected focus-plane ratio
                - definition [ref=e225]: 1:5
              - generic [ref=e226]:
                - term [ref=e227]: Bellows factor
                - definition [ref=e228]: 1.44×
              - generic [ref=e229]:
                - term [ref=e230]: Exposure compensation
                - definition [ref=e231]: +0.53 stops
              - generic [ref=e232]:
                - term [ref=e233]: Image circle
                - definition [ref=e234]: 261.6 mm · simulator profile
              - generic [ref=e235]:
                - term [ref=e236]: Available bellows travel
                - definition [ref=e237]: 320.0 mm
            - generic [ref=e238]: At the selected focus plane. Exposure compensation assumes a symmetric thin lens.
```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page } from "@playwright/test";
  2   | import { setStepRangeInput } from "./helpers/stepRangeInput";
  3   | import { CAMERA_CONSTANTS } from "../../utils/constants";
  4   |
  5   | const parseMmVector = (value: string | null): number[] => {
  6   |   const parsed = value?.split(",").map(Number) ?? [];
  7   |   if (parsed.length !== 3 || parsed.some((component) => !Number.isFinite(component))) {
  8   |     throw new Error(`Invalid millimetre vector: ${value}`);
  9   |   }
  10  |   return parsed;
  11  | };
  12  |
  13  | const readFiniteAttribute = async (locator: Locator, name: string) => {
  14  |   const value = Number(await locator.getAttribute(name));
  15  |   expect(Number.isFinite(value), `${name} must be finite`).toBe(true);
  16  |   return value;
  17  | };
  18  |
  19  | const collectBrowserErrors = (page: Page) => {
  20  |   const pageErrors: string[] = [];
  21  |   const consoleErrors: string[] = [];
  22  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  23  |   page.on("console", (message) => {
  24  |     if (message.type() === "error") consoleErrors.push(message.text());
  25  |   });
  26  |   return () => {
  27  |     expect(pageErrors).toEqual([]);
  28  |     expect(consoleErrors).toEqual([]);
  29  |   };
  30  | };
  31  |
  32  | const readGroundGlassGain = async (rtt: Locator) =>
  33  |   Number(await rtt.getAttribute("data-rtt-ground-glass-illuminance-gain"));
  34  |
  35  | const readGridSpacing = async (grid: Locator) => grid.evaluate((element) =>
  36  |   Number.parseFloat(getComputedStyle(element).backgroundSize.split(" ")[0]),
  37  | );
  38  |
  39  | const readGridPhase = async (grid: Locator) => grid.evaluate((element) => {
  40  |   const rect = element.getBoundingClientRect();
  41  |   const [x = "0px", y = "0px"] = getComputedStyle(element).backgroundPosition.split(" ");
  42  |   return {
  43  |     x: Number.parseFloat(x),
  44  |     y: Number.parseFloat(y),
  45  |     width: rect.width,
  46  |     height: rect.height,
  47  |   };
  48  | });
  49  |
  50  | const expectMacroCoverageState = async (
  51  |   scene: Locator,
  52  |   rtt: Locator,
  53  |   readout: Locator,
  54  |   expectedDiameterMm: number,
  55  | ) => {
  56  |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  57  |   await expect(scene).toHaveAttribute("data-image-circle-ray-count", "12");
> 58  |   await expect(rtt).toHaveAttribute("data-rtt-coverage-kind", "parallel-circle");
      |                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  59  |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  60  |   await expect(readout).toContainText(`${expectedDiameterMm.toFixed(1)} mm · simulator profile`);
  61  |   const [sceneRadiusMm, rttRadiusMm] = await Promise.all([
  62  |     readFiniteAttribute(scene, "data-image-circle-radius-mm"),
  63  |     readFiniteAttribute(rtt, "data-rtt-coverage-radius-mm"),
  64  |   ]);
  65  |   const filmCornerRadiusMm = Math.hypot(CAMERA_CONSTANTS.filmWidthMm / 2, CAMERA_CONSTANTS.filmHeightMm / 2);
  66  |   expect(sceneRadiusMm).toBeCloseTo(expectedDiameterMm / 2, 1);
  67  |   expect(sceneRadiusMm).toBeCloseTo(rttRadiusMm, 5);
  68  |   expect(sceneRadiusMm).toBeGreaterThan(filmCornerRadiusMm);
  69  |   return sceneRadiusMm;
  70  | };
  71  |
  72  | test("Macro 1 tracks canonical Image Circle growth and bellows exposure across focus", async ({ page }) => {
  73  |   test.setTimeout(100_000);
  74  |   const expectNoBrowserErrors = collectBrowserErrors(page);
  75  |
  76  |   await page.goto("/simulator/free/architecture-rise");
  77  |   await expect(page.getByRole("button", { name: "Infinity Reset" })).toBeVisible();
  78  |   await page.getByRole("button", { name: "Infinity Reset" }).click();
  79  |   await expect(page.getByText(/Focus: ∞/)).toBeVisible();
  80  |
  81  |   // Preserve the cross-scene Infinity Focus initialization regression.
  82  |   await page.getByRole("link", { name: "All Scenes" }).click();
  83  |   await expect(page).toHaveURL(/\/scenes$/);
  84  |   await page.locator('a[href="/simulator/free/macro-bellows-extension"]').click();
  85  |   await expect(page).toHaveURL(/\/simulator\/free\/macro-bellows-extension$/);
  86  |
  87  |   const sceneCanvas = page.getByTestId("scene-canvas");
  88  |   const groundGlassRtt = page.getByTestId("ground-glass-rtt");
  89  |   const readout = page.getByRole("region", { name: "Macro focus" });
  90  |   const focus = page.getByRole("slider", { name: "Focus distance" });
  91  |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  92  |
  93  |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  94  |   await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-bellows-extension");
  95  |   await expect(focus).toHaveValue("900");
  96  |   await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  97  |   await expect(aperture).toBeEnabled();
  98  |   await expect(aperture.getByRole("radio")).toHaveCount(6);
  99  |   await expect(aperture.getByRole("radio", { name: "f/11" })).toBeEnabled();
  100 |   await expect(page.getByText("Aperture is fixed for this lesson", { exact: true })).toHaveCount(0);
  101 |   await expect(readout).toContainText("180.0 mm");
  102 |   await expect(readout).toContainText("0.20×");
  103 |   const initialCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 261.56);
  104 |   const initialFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  105 |   expect(initialFilmCenter[2]).toBeCloseTo(-180, 5);
  106 |   await expect(readout).toContainText("1:5");
  107 |   await expect(readout).toContainText("320.0 mm");
  108 |   await expect(readout).toContainText("Selected focus-plane magnification");
  109 |
  110 |   const expectedInitialGain = ((11 / 5.6) ** 2) / 1.44;
  111 |   await expect.poll(() => readGroundGlassGain(groundGlassRtt)).toBeCloseTo(expectedInitialGain, 3);
  112 |   const initialGroundGlassGain = await readGroundGlassGain(groundGlassRtt);
  113 |
  114 |   await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  115 |   const taskView = page.getByTestId("learning-overlay-task-view");
  116 |   await expect(taskView).toContainText("261.6 mm");
  117 |   await expect(taskView).toContainText("current film plane");
  118 |   await expect(taskView).toContainText("separate from subject magnification");
  119 |
  120 |   await setStepRangeInput(page, "Focus distance", 450);
  121 |   await expect(focus).toHaveValue("450");
  122 |   await expect(readout).toContainText("225.0 mm");
  123 |   await expect(readout).toContainText("0.50×");
  124 |   await expect(readout).toContainText("2.25×");
  125 |   await expect(readout).toContainText("+1.17 stops");
  126 |   const middleCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 326.94);
  127 |   expect(middleCircleRadiusMm).toBeGreaterThan(initialCircleRadiusMm);
  128 |   await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  129 |   const middleFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  130 |   expect(middleFilmCenter[2]).toBeCloseTo(-225, 5);
  131 |   await expect(taskView).toContainText("326.9 mm");
  132 |   await expect(taskView).toContainText("at a fixed aperture");
  133 |   const middleGroundGlassGain = await readGroundGlassGain(groundGlassRtt);
  134 |   expect(middleGroundGlassGain).toBeLessThan(initialGroundGlassGain);
  135 |
  136 |   await setStepRangeInput(page, "Focus distance", 300);
  137 |   await expect(focus).toHaveValue("300");
  138 |   await expect(readout).toContainText("300.0 mm");
  139 |   await expect(readout).toContainText("1.00×");
  140 |   await expect(readout).toContainText("1:1");
  141 |   await expect(readout).toContainText("4.00×");
  142 |   await expect(readout).toContainText("+2.00 stops");
  143 |   await expect(readout).toContainText("Life-size reproduction reached (1:1)");
  144 |   await expect(readout).toContainText("specimen is now sharply reproduced");
  145 |   const finalCircleRadiusMm = await expectMacroCoverageState(sceneCanvas, groundGlassRtt, readout, 435.93);
  146 |   expect(finalCircleRadiusMm).toBeGreaterThan(middleCircleRadiusMm);
  147 |   await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  148 |   await expect(taskView).toContainText("435.9 mm");
  149 |   await expect(taskView).toContainText("rear standard moves farther from the lens");
  150 |   await expect(taskView).toContainText("carries the film plane with it");
  151 |   await expect(taskView).toContainText("4×5 film rectangle keeps the same physical dimensions");
  152 |   const finalFilmCenter = parseMmVector(await sceneCanvas.getAttribute("data-camera-film-center-world"));
  153 |   expect(finalFilmCenter[2]).toBeCloseTo(-300, 5);
  154 |   await expect.poll(() => readGroundGlassGain(groundGlassRtt)).toBeCloseTo(((11 / 5.6) ** 2) * 0.25, 3);
  155 |   expect(await readGroundGlassGain(groundGlassRtt)).toBeLessThan(initialGroundGlassGain);
  156 |
  157 |   expectNoBrowserErrors();
  158 | });
```