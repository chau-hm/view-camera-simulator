# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase13-guided-tasks.spec.ts >> TST-E2E-005: restart resets Architecture Rise guided task
- Location: src/tests/e2e/phase13-guided-tasks.spec.ts:40:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.press: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('slider', { name: 'Rise' })
    - locator resolved to <input min="0" max="40" step="1" id="_r_h_" value="11" type="range" aria-label="Rise" class="range-slider compact-range-row__slider"/>
  - elementHandle.press("ArrowRight")

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
          - generic [ref=e13]: Guided Lesson
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
                        - checkbox "Grid" [checked] [disabled] [ref=e80]
                        - generic [ref=e81]: Grid
                        - generic [ref=e82]: Disabled for this guided task
                - generic "GroundGlassViewport" [ref=e83]:
                  - generic [ref=e85]:
                    - generic [ref=e86]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e87]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 8890.0 mm focus / CoC 0.000 mm (100%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e91] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e92]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e93] [cursor=pointer]:
                    - generic [ref=e94]: open_in_new
            - generic [ref=e96]:
              - generic [ref=e97]:
                - heading "2D Geometry" [level=2] [ref=e98]
                - generic [ref=e99]:
                  - group "Geometry view" [ref=e100]:
                    - button "Side" [pressed] [ref=e101] [cursor=pointer]
                    - button "Top" [ref=e102] [cursor=pointer]
                  - group "Geometry framing" [ref=e103]:
                    - button "Fit Scene" [pressed] [ref=e104] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e105] [cursor=pointer]:
                    - generic [ref=e106]: open_in_new
              - paragraph [ref=e107]: "Side view | Rise: 11.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e109]:
                - generic [ref=e110]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e111]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e112]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e113]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e114]
                  - generic [ref=e116]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic "Simplified bellows connector" [ref=e118]
                  - generic "chief ray from film centre through lens centre" [ref=e121]
                  - generic [ref=e125]: Building mid facade
              - generic "Optical depth order" [ref=e127]:
                - generic [ref=e130]: Film 0 mm
                - generic [ref=e133]: Lens 153 mm
                - generic [ref=e136]: DOF limit 6.4 m
                - generic [ref=e139]: Focus 9.0 m
                - generic [ref=e142]: Far DOF > 13.3 m
            - region "Focus distribution · Focus" [ref=e144]:
              - generic [ref=e145]:
                - heading "Focus distribution" [level=4] [ref=e146]
                - 'generic "Ground Glass orientation: Raw" [ref=e147]': Raw
              - table "Focus distribution" [ref=e148]:
                - caption [ref=e149]: Focus distribution
                - rowgroup [ref=e150]:
                  - row [ref=e151]:
                    - cell [ref=e152]
                    - cell [ref=e153]
                    - cell [ref=e154]
                  - 'row "Centre Centre · Building mid facade: 100% · Sharp" [ref=e155]':
                    - cell [ref=e156]
                    - 'cell "Centre Centre · Building mid facade: 100% · Sharp" [ref=e157]':
                      - generic "Centre" [ref=e158]
                      - 'group "Centre · Building mid facade: 100% · Sharp" [ref=e160]':
                        - generic "Building mid facade" [ref=e162]
                        - generic [ref=e163]:
                          - text: 100%
                          - generic [ref=e164]: ✓
                    - cell [ref=e165]
                  - row [ref=e166]:
                    - cell [ref=e167]
                    - cell [ref=e168]
                    - cell [ref=e169]
          - group [ref=e172]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e173] [cursor=pointer]:
              - generic [ref=e174]: Optical Debug
              - generic [ref=e175]: architecture-rise · parallel
        - complementary [ref=e176]:
          - generic [ref=e177]:
            - region "Camera Controls" [ref=e178]:
              - heading "Camera Controls" [level=3] [ref=e180]
              - paragraph [ref=e181]:
                - generic [ref=e182]: 🔒
                - generic [ref=e183]: Disabled for this guided task
              - generic [ref=e184]:
                - region "Movement" [ref=e186]:
                  - generic [ref=e187]:
                    - heading "Front standard" [level=4] [ref=e188]
                    - button "Help" [ref=e189] [cursor=pointer]:
                      - generic [ref=e190]: "?"
                  - generic [ref=e191]:
                    - generic [ref=e192]:
                      - generic [ref=e193]: Rise
                      - slider "Rise" [active] [ref=e194]: "11"
                      - generic [ref=e195]: 11.0 mm
                    - generic [ref=e196]:
                      - generic [ref=e197]: Tilt
                      - slider "Tilt" [disabled] [ref=e198]: "0"
                      - generic [ref=e199]: 0.0°
                    - generic [ref=e200]:
                      - generic [ref=e201]: Swing
                      - slider "Swing" [disabled] [ref=e202]: "0"
                      - generic [ref=e203]: 0.0°
                - region "Focus" [ref=e205]:
                  - heading "Focus" [level=3] [ref=e206]
                  - generic [ref=e207]:
                    - generic [ref=e208]: Focus distance
                    - slider "Focus distance" [ref=e209]: "8890"
                    - generic [ref=e210]: 8890.0 mm
                    - button "Infinity Reset" [ref=e212] [cursor=pointer]: ∞
                - region "Aperture" [ref=e214]:
                  - heading "Aperture" [level=3] [ref=e215]
                  - radiogroup "Aperture" [ref=e216]:
                    - generic [ref=e217] [cursor=pointer]:
                      - radio "f/5.6" [ref=e218]
                      - generic [ref=e219]: f/5.6
                    - generic [ref=e220] [cursor=pointer]:
                      - radio "f/8" [ref=e221]
                      - generic [ref=e222]: f/8
                    - generic [ref=e223] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e224]
                      - generic [ref=e225]: f/11
                    - generic [ref=e226] [cursor=pointer]:
                      - radio "f/16" [ref=e227]
                      - generic [ref=e228]: f/16
                    - generic [ref=e229] [cursor=pointer]:
                      - radio "f/22" [ref=e230]
                      - generic [ref=e231]: f/22
                    - generic [ref=e232] [cursor=pointer]:
                      - radio "f/32" [ref=e233]
                      - generic [ref=e234]: f/32
                - generic [ref=e235]:
                  - generic [ref=e236]: Reset
                  - region "Reset" [ref=e237]:
                    - generic [ref=e238]:
                      - button "Reset movements" [ref=e239] [cursor=pointer]
                      - button "Restart task" [ref=e240] [cursor=pointer]
            - region "Developer Tools" [ref=e241]:
              - heading "Developer Tools" [level=3] [ref=e242]
              - generic [ref=e244]:
                - checkbox "Raw RTT — bypass DOF" [ref=e245]
                - text: Raw RTT — bypass DOF
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
  52 |     await slider.press(`Shift+${key}`);
  53 |   }
  54 |   for (let index = 0; index < finePresses; index += 1) {
> 55 |     await slider.press(key);
     |                  ^ Error: locator.press: Test timeout of 30000ms exceeded.
  56 |   }
  57 |   await expect.poll(async () => Number(await slider.inputValue())).toBeCloseTo(target, 8);
  58 | };
  59 | 
```