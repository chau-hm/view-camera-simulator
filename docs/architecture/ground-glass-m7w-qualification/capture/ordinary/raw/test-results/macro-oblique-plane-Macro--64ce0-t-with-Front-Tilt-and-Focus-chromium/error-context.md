# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: macro-oblique-plane.spec.ts >> Macro 3 aligns the oblique planar subject with Front Tilt and Focus
- Location: src/tests/e2e/macro-oblique-plane.spec.ts:11:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.press: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('slider', { name: 'Front Tilt' })

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
                            - region "Oblique plane alignment study" [ref=e70]:
                              - heading "Oblique plane alignment study" [level=3] [ref=e71]
                              - generic [ref=e72]:
                                - generic [ref=e73]:
                                  - strong [ref=e74]: Goal
                                  - paragraph [ref=e75]: Align the sharp-focus plane with the oblique PCB using Front Tilt and Focus Distance.
                                - generic [ref=e76]:
                                  - strong [ref=e77]: Try
                                  - paragraph [ref=e78]: Adjust Front Tilt, then refocus. For this PCB, explore the positive direction first and compare the three regions.
                                - generic [ref=e79]:
                                  - strong [ref=e80]: Observe
                                  - paragraph [ref=e81]: Near is Soft, Middle is Soft, and Far is Soft. The Far region is currently strongest; Front Tilt has changed the orientation of the sharp-focus plane. Refocus and compare the three regions to judge the alignment.
                                - generic [ref=e82]:
                                  - strong [ref=e83]: Why it matters
                                  - paragraph [ref=e84]: Front Tilt changes the orientation of the sharp-focus plane; Focus Distance positions that rotated plane. In the Scheimpflug construction, the lens plane, film plane, and sharp-focus plane meet along a common line.
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
                            - generic: 420.0 mm focus / CoC 1.206 mm (0%)
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
                    - button "Scheimpflug Section" [ref=e131] [cursor=pointer]
                  - group "Geometry framing" [ref=e132]:
                    - button "Fit Scene" [pressed] [ref=e133] [cursor=pointer]
                    - button "Fit Construction" [ref=e134] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e135] [cursor=pointer]:
                    - generic [ref=e136]: open_in_new
              - paragraph [ref=e137]: "Side view | Rise: 0.0 mm | Tilt: 1.0° | Swing: 0.0°"
              - img [ref=e139]:
                - generic [ref=e140]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e141]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e142]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e143]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e144]
                  - generic [ref=e146]: Optical axis
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
                  - generic [ref=e148]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e154]: Near planar detail
                  - generic [ref=e158]: Middle planar detail
                  - generic [ref=e162]: Far planar detail
                - generic [ref=e164]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e165]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e166]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e167]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e168]
                  - generic [ref=e171]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic "lens plane" [ref=e174]
                  - generic "focus plane" [ref=e176]
                  - generic "nearDof plane" [ref=e178]
                  - generic "farDof plane" [ref=e180]
                  - generic [ref=e181]:
                    - generic "Simplified bellows connector"
                  - generic "chief ray from film centre through lens centre"
                  - generic [ref=e188]: Near planar detail
                  - generic [ref=e192]: Middle planar detail
                  - generic [ref=e196]: Far planar detail
                - generic [ref=e198]:
                  - generic [ref=e200]: Current
                  - generic [ref=e201]: Original
              - generic "Optical depth order" [ref=e202]:
                - generic [ref=e205]: Film 0 mm
                - generic [ref=e208]: Scheimpflug intersection 0 mm
                - generic [ref=e211]: Lens 233 mm
                - generic [ref=e214]: DOF limit 650 mm
                - generic [ref=e217]: Focus 653 mm
                - generic [ref=e220]: Far DOF 656 mm
            - region "Focus distribution · Focus" [ref=e222]:
              - generic [ref=e223]:
                - heading "Focus distribution" [level=4] [ref=e224]
                - 'generic "Ground Glass orientation: Raw" [ref=e225]': Raw
              - table "Focus distribution" [ref=e226]:
                - caption [ref=e227]: Focus distribution
                - rowgroup [ref=e228]:
                  - 'row "Upper centre Upper centre · Near planar detail: 0% · Soft" [ref=e229]':
                    - cell [ref=e230]
                    - 'cell "Upper centre Upper centre · Near planar detail: 0% · Soft" [ref=e231]':
                      - generic "Upper centre" [ref=e232]
                      - 'group "Upper centre · Near planar detail: 0% · Soft" [ref=e234]':
                        - generic "Near planar detail" [ref=e236]
                        - generic [ref=e237]:
                          - text: 0%
                          - generic [ref=e238]: —
                    - cell [ref=e239]
                  - 'row "Centre Centre · Middle planar detail: 0% · Soft" [ref=e240]':
                    - cell [ref=e241]
                    - 'cell "Centre Centre · Middle planar detail: 0% · Soft" [ref=e242]':
                      - generic "Centre" [ref=e243]
                      - 'group "Centre · Middle planar detail: 0% · Soft" [ref=e245]':
                        - generic "Middle planar detail" [ref=e247]
                        - generic [ref=e248]:
                          - text: 0%
                          - generic [ref=e249]: —
                    - cell [ref=e250]
                  - 'row "Lower centre Lower centre · Far planar detail: 0% · Soft" [ref=e251]':
                    - cell [ref=e252]
                    - 'cell "Lower centre Lower centre · Far planar detail: 0% · Soft" [ref=e253]':
                      - generic "Lower centre" [ref=e254]
                      - 'group "Lower centre · Far planar detail: 0% · Soft" [ref=e256]':
                        - generic "Far planar detail" [ref=e258]
                        - generic [ref=e259]:
                          - text: 0%
                          - generic [ref=e260]: —
                    - cell [ref=e261]
          - group [ref=e264]:
            - generic "Optical Debug macro-oblique-plane · scheimpflug" [ref=e265] [cursor=pointer]:
              - generic [ref=e266]: Optical Debug
              - generic [ref=e267]: macro-oblique-plane · scheimpflug
        - complementary [ref=e268]:
          - generic [ref=e269]:
            - region "Camera Controls" [ref=e270]:
              - heading "Camera Controls" [level=3] [ref=e272]
              - generic [ref=e273]:
                - group "Movement" [ref=e275]:
                  - generic [ref=e276]: Movement
                  - radiogroup "Movement" [ref=e277]:
                    - generic [ref=e278]:
                      - radio "Front Tilt" [checked] [ref=e279]
                      - text: Front Tilt
                - generic [ref=e281]:
                  - generic [ref=e282]: Front Tilt (1.0°)
                  - slider "Front Tilt" [active] [ref=e283]: "1"
                - region "Focus" [ref=e285]:
                  - heading "Focus" [level=3] [ref=e286]
                  - generic [ref=e287]:
                    - generic [ref=e288]: Focus distance
                    - slider "Focus distance" [ref=e289]: "420"
                    - generic [ref=e290]: 420.0 mm
                - region "Aperture" [ref=e292]:
                  - heading "Aperture" [level=3] [ref=e293]
                  - radiogroup "Aperture" [disabled] [ref=e294]:
                    - generic [ref=e295]:
                      - radio "f/5.6" [checked] [disabled] [ref=e296]
                      - generic [ref=e297]: f/5.6
                    - generic [ref=e298]:
                      - radio "f/8" [disabled] [ref=e299]
                      - generic [ref=e300]: f/8
                    - generic [ref=e301]:
                      - radio "f/11" [disabled] [ref=e302]
                      - generic [ref=e303]: f/11
                    - generic [ref=e304]:
                      - radio "f/16" [disabled] [ref=e305]
                      - generic [ref=e306]: f/16
                    - generic [ref=e307]:
                      - radio "f/22" [disabled] [ref=e308]
                      - generic [ref=e309]: f/22
                    - generic [ref=e310]:
                      - radio "f/32" [disabled] [ref=e311]
                      - generic [ref=e312]: f/32
                  - generic [ref=e313]: Aperture is fixed for this lesson
                - generic [ref=e314]:
                  - generic [ref=e315]: Reset
                  - region "Reset" [ref=e316]:
                    - button "Reset movements" [ref=e318] [cursor=pointer]
            - region "Developer Tools" [ref=e319]:
              - heading "Developer Tools" [level=3] [ref=e320]
              - generic [ref=e322]:
                - checkbox "Raw RTT — bypass DOF" [ref=e323]
                - text: Raw RTT — bypass DOF
          - region "Macro focus" [ref=e325]:
            - heading "Macro focus" [level=3] [ref=e326]
            - generic [ref=e327]:
              - generic [ref=e328]:
                - term [ref=e329]: Bellows extension (lens to film)
                - definition [ref=e330]: 233.3 mm
              - generic [ref=e331]:
                - term [ref=e332]: Magnification
                - definition [ref=e333]: 0.56×
              - generic [ref=e334]:
                - term [ref=e335]: Bellows factor
                - definition [ref=e336]: 2.42×
              - generic [ref=e337]:
                - term [ref=e338]: Exposure compensation
                - definition [ref=e339]: +1.27 stops
            - generic [ref=e340]: At the selected focus plane. Exposure compensation assumes a symmetric thin lens.
```

# Test source

```ts
  1  | import { expect, type Page } from "@playwright/test";
  2  |
  3  | const isAlignedToStep = (value: number, min: number, step: number): boolean => {
  4  |   const stepsFromMinimum = (value - min) / step;
  5  |   return Math.abs(stepsFromMinimum - Math.round(stepsFromMinimum)) < 1e-8;
  6  | };
  7  |
  8  | export const setStepRangeInput = async (
  9  |   page: Page,
  10 |   label: string,
  11 |   target: number,
  12 |   maximumKeypresses = 1_000,
  13 | ): Promise<void> => {
  14 |   const slider = page.getByRole("slider", { name: label });
  15 |   const [minimumText, maximumText, stepText, currentText] = await Promise.all([
  16 |     slider.getAttribute("min"),
  17 |     slider.getAttribute("max"),
  18 |     slider.getAttribute("step"),
  19 |     slider.inputValue(),
  20 |   ]);
  21 |   const minimum = Number(minimumText);
  22 |   const maximum = Number(maximumText);
  23 |   const step = Number(stepText);
  24 |   const current = Number(currentText);
  25 |
  26 |   if (![minimum, maximum, step, current, target].every(Number.isFinite) || step <= 0) {
  27 |     throw new Error(`${label} does not expose a finite min, max, step, current value, and target`);
  28 |   }
  29 |   if (target < minimum || target > maximum) {
  30 |     throw new Error(`${label} target ${target} is outside ${minimum}–${maximum}`);
  31 |   }
  32 |   if (!isAlignedToStep(target, minimum, step)) {
  33 |     throw new Error(`${label} target ${target} is not aligned to its ${step} step`);
  34 |   }
  35 |
  36 |   const exactPresses = Math.abs(target - current) / step;
  37 |   const presses = Math.round(exactPresses);
  38 |   if (Math.abs(exactPresses - presses) >= 1e-8) {
  39 |     throw new Error(`${label} cannot reach ${target} from ${current} using its ${step} step`);
  40 |   }
  41 |   await slider.focus();
  42 |   const key = target >= current ? "ArrowRight" : "ArrowLeft";
  43 |   const coarsePresses = Math.floor(presses / 10);
  44 |   const finePresses = presses % 10;
  45 |   const totalKeypresses = coarsePresses + finePresses;
  46 |   if (totalKeypresses > maximumKeypresses) {
  47 |     throw new Error(
  48 |       `${label} requires ${totalKeypresses} keypresses, exceeding the ${maximumKeypresses} limit`,
  49 |     );
  50 |   }
  51 |   for (let index = 0; index < coarsePresses; index += 1) {
> 52 |     await slider.press(`Shift+${key}`);
     |                  ^ Error: locator.press: Test timeout of 120000ms exceeded.
  53 |   }
  54 |   for (let index = 0; index < finePresses; index += 1) {
  55 |     await slider.press(key);
  56 |   }
  57 |   await expect.poll(async () => Number(await slider.inputValue())).toBeCloseTo(target, 8);
  58 | };
  59 |
```