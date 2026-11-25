# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: viewport-learning-overlay.spec.ts >> guided completion updates the peek rail without auto-opening or leaving Task
- Location: src/tests/e2e/viewport-learning-overlay.spec.ts:203:1

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
                    - button "Task and Feedback — Task completed" [ref=e54] [cursor=pointer]:
                      - generic [ref=e55]: Task and Feedback
                      - generic [ref=e56]: ✓
            - generic "GroundGlassColumn" [ref=e57]:
              - generic [ref=e58]:
                - generic [ref=e60]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e61]
              - generic [ref=e62]:
                - generic [ref=e64]:
                  - group "Preview" [ref=e65]:
                    - generic [ref=e66]: Preview
                    - generic [ref=e68]:
                      - generic [ref=e69]:
                        - radio "Raw Ground Glass" [checked] [ref=e70]
                        - generic [ref=e71]: Raw Ground Glass
                      - generic [ref=e72]:
                        - radio "Upright Assist" [ref=e73]
                        - generic [ref=e74]: Upright Assist
                  - group "View Options" [ref=e75]:
                    - generic [ref=e76]: View Options
                    - region "View Options" [ref=e78]:
                      - generic [ref=e80]:
                        - checkbox "Grid" [checked] [disabled] [ref=e81]
                        - generic [ref=e82]: Grid
                        - generic [ref=e83]: Disabled for this guided task
                - generic "GroundGlassViewport" [ref=e84]:
                  - generic [ref=e86]:
                    - generic [ref=e87]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e88]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 8890.0 mm focus / CoC 0.000 mm (100%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e92] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e93]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e94] [cursor=pointer]:
                    - generic [ref=e95]: open_in_new
            - generic [ref=e97]:
              - generic [ref=e98]:
                - heading "2D Geometry" [level=2] [ref=e99]
                - generic [ref=e100]:
                  - group "Geometry view" [ref=e101]:
                    - button "Side" [pressed] [ref=e102] [cursor=pointer]
                    - button "Top" [ref=e103] [cursor=pointer]
                  - group "Geometry framing" [ref=e104]:
                    - button "Fit Scene" [pressed] [ref=e105] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e106] [cursor=pointer]:
                    - generic [ref=e107]: open_in_new
              - paragraph [ref=e108]: "Side view | Rise: 12.0 mm | Tilt: 0.0° | Swing: 0.0°"
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
                  - generic "Simplified bellows connector" [ref=e119]
                  - generic "chief ray from film centre through lens centre" [ref=e122]
                  - generic [ref=e126]: Building mid facade
              - generic "Optical depth order" [ref=e128]:
                - generic [ref=e131]: Film 0 mm
                - generic [ref=e134]: Lens 153 mm
                - generic [ref=e137]: DOF limit 6.4 m
                - generic [ref=e140]: Focus 9.0 m
                - generic [ref=e143]: Far DOF > 13.3 m
            - region "Focus distribution · Focus" [ref=e145]:
              - generic [ref=e146]:
                - heading "Focus distribution" [level=4] [ref=e147]
                - 'generic "Ground Glass orientation: Raw" [ref=e148]': Raw
              - table "Focus distribution" [ref=e149]:
                - caption [ref=e150]: Focus distribution
                - rowgroup [ref=e151]:
                  - row [ref=e152]:
                    - cell [ref=e153]
                    - cell [ref=e154]
                    - cell [ref=e155]
                  - 'row "Centre Centre · Building mid facade: 100% · Sharp" [ref=e156]':
                    - cell [ref=e157]
                    - 'cell "Centre Centre · Building mid facade: 100% · Sharp" [ref=e158]':
                      - generic "Centre" [ref=e159]
                      - 'group "Centre · Building mid facade: 100% · Sharp" [ref=e161]':
                        - generic "Building mid facade" [ref=e163]
                        - generic [ref=e164]:
                          - text: 100%
                          - generic [ref=e165]: ✓
                    - cell [ref=e166]
                  - row [ref=e167]:
                    - cell [ref=e168]
                    - cell [ref=e169]
                    - cell [ref=e170]
          - group [ref=e173]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e174] [cursor=pointer]:
              - generic [ref=e175]: Optical Debug
              - generic [ref=e176]: architecture-rise · parallel
        - complementary [ref=e177]:
          - generic [ref=e178]:
            - region "Camera Controls" [ref=e179]:
              - heading "Camera Controls" [level=3] [ref=e181]
              - paragraph [ref=e182]:
                - generic [ref=e183]: 🔒
                - generic [ref=e184]: Disabled for this guided task
              - generic [ref=e185]:
                - region "Movement" [ref=e187]:
                  - generic [ref=e188]:
                    - heading "Front standard" [level=4] [ref=e189]
                    - button "Help" [ref=e190] [cursor=pointer]:
                      - generic [ref=e191]: "?"
                  - generic [ref=e192]:
                    - generic [ref=e193]:
                      - generic [ref=e194]: Rise
                      - slider "Rise" [active] [ref=e195]: "12"
                      - generic [ref=e196]: 12.0 mm
                    - generic [ref=e197]:
                      - generic [ref=e198]: Tilt
                      - slider "Tilt" [disabled] [ref=e199]: "0"
                      - generic [ref=e200]: 0.0°
                    - generic [ref=e201]:
                      - generic [ref=e202]: Swing
                      - slider "Swing" [disabled] [ref=e203]: "0"
                      - generic [ref=e204]: 0.0°
                - region "Focus" [ref=e206]:
                  - heading "Focus" [level=3] [ref=e207]
                  - generic [ref=e208]:
                    - generic [ref=e209]: Focus distance
                    - slider "Focus distance" [ref=e210]: "8890"
                    - generic [ref=e211]: 8890.0 mm
                    - button "Infinity Reset" [ref=e213] [cursor=pointer]: ∞
                - region "Aperture" [ref=e215]:
                  - heading "Aperture" [level=3] [ref=e216]
                  - radiogroup "Aperture" [ref=e217]:
                    - generic [ref=e218] [cursor=pointer]:
                      - radio "f/5.6" [ref=e219]
                      - generic [ref=e220]: f/5.6
                    - generic [ref=e221] [cursor=pointer]:
                      - radio "f/8" [ref=e222]
                      - generic [ref=e223]: f/8
                    - generic [ref=e224] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e225]
                      - generic [ref=e226]: f/11
                    - generic [ref=e227] [cursor=pointer]:
                      - radio "f/16" [ref=e228]
                      - generic [ref=e229]: f/16
                    - generic [ref=e230] [cursor=pointer]:
                      - radio "f/22" [ref=e231]
                      - generic [ref=e232]: f/22
                    - generic [ref=e233] [cursor=pointer]:
                      - radio "f/32" [ref=e234]
                      - generic [ref=e235]: f/32
                - generic [ref=e236]:
                  - generic [ref=e237]: Reset
                  - region "Reset" [ref=e238]:
                    - generic [ref=e239]:
                      - button "Reset movements" [ref=e240] [cursor=pointer]
                      - button "Restart task" [ref=e241] [cursor=pointer]
            - region "Developer Tools" [ref=e242]:
              - heading "Developer Tools" [level=3] [ref=e243]
              - generic [ref=e245]:
                - checkbox "Raw RTT — bypass DOF" [ref=e246]
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
  55 |     await slider.press(key);
  56 |   }
> 57 |   await expect.poll(async () => Number(await slider.inputValue())).toBeCloseTo(target, 8);
     |                                                                    ^ Error: Timeout 5000ms exceeded while waiting on the predicate
  58 | };
  59 |
```