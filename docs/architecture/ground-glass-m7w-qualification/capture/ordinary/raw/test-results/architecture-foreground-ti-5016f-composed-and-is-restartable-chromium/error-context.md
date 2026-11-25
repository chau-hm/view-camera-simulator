# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture-foreground-tilt-focus.spec.ts >> Architecture + Foreground Tilt + Focus guided task starts composed and is restartable
- Location: src/tests/e2e/architecture-foreground-tilt-focus.spec.ts:95:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.press: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('slider', { name: 'Focus distance' })

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
          - generic [ref=e12]: Architecture + Foreground
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
                    - button "Open Task and Feedback" [expanded]:
                      - generic: Task and Feedback
                    - generic [ref=e54]:
                      - generic [ref=e55]:
                        - group "Task and Feedback views" [ref=e56]:
                          - button "Task" [pressed] [ref=e57] [cursor=pointer]
                          - button "Feedback" [ref=e58] [cursor=pointer]
                        - generic [ref=e59]:
                          - button "Allow Task and Feedback to auto-hide" [pressed] [ref=e60] [cursor=pointer]:
                            - generic [ref=e61]: keep
                          - button "Close Task and Feedback" [ref=e62] [cursor=pointer]:
                            - generic [ref=e63]: close
                      - generic "Task" [ref=e65]:
                        - region "Task" [ref=e66]:
                          - generic [ref=e67]:
                            - generic [ref=e69]: Guided task
                            - heading "Align the Focus Plane" [level=3] [ref=e70]
                            - paragraph [ref=e71]: Use Front Tilt and Focus to make the near foreground and the building usefully sharp while preserving the corrected architectural framing.
                            - generic [ref=e72]:
                              - strong [ref=e73]: "Allowed controls:"
                              - text: Front TiltFocus2D Geometry
                            - group [ref=e74]:
                              - generic "View requirements" [ref=e75] [cursor=pointer]
            - generic "GroundGlassColumn" [ref=e76]:
              - generic [ref=e77]:
                - generic [ref=e79]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e80]
              - generic [ref=e81]:
                - generic [ref=e83]:
                  - group "Preview" [ref=e84]:
                    - generic [ref=e85]: Preview
                    - generic [ref=e87]:
                      - generic [ref=e88]:
                        - radio "Raw Ground Glass" [checked] [ref=e89]
                        - generic [ref=e90]: Raw Ground Glass
                      - generic [ref=e91]:
                        - radio "Upright Assist" [ref=e92]
                        - generic [ref=e93]: Upright Assist
                  - group "View Options" [ref=e94]:
                    - generic [ref=e95]: View Options
                    - region "View Options" [ref=e97]:
                      - generic [ref=e99]:
                        - checkbox "Grid" [checked] [disabled] [ref=e100]
                        - generic [ref=e101]: Grid
                        - generic [ref=e102]: Disabled for this guided task
                - generic "GroundGlassViewport" [ref=e103]:
                  - generic [ref=e105]:
                    - generic [ref=e106]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e107]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 8490.0 mm focus / CoC 0.070 mm (30%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e111] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e112]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e113] [cursor=pointer]:
                    - generic [ref=e114]: open_in_new
            - generic [ref=e116]:
              - generic [ref=e117]:
                - heading "2D Geometry" [level=2] [ref=e118]
                - generic [ref=e119]:
                  - group "Geometry view" [ref=e120]:
                    - button "Side" [pressed] [ref=e121] [cursor=pointer]
                    - button "Top" [ref=e122] [cursor=pointer]
                  - group "Geometry framing" [ref=e123]:
                    - button "Fit Scene" [pressed] [ref=e124] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e125] [cursor=pointer]:
                    - generic [ref=e126]: open_in_new
              - paragraph [ref=e127]: "Side view | Rise: 20.0 mm | Tilt: 2.0° | Swing: 0.0°"
              - img [ref=e129]:
                - generic [ref=e130]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e131]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e132]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e133]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e134]
                  - generic [ref=e136]: Optical axis
                  - generic [ref=e138]: Foreground ground
                  - generic [ref=e140]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e141]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e147]: Near foreground
                  - generic [ref=e151]: Middle foreground
                  - generic [ref=e155]: Building base
                  - generic [ref=e159]: Building middle
                - generic [ref=e161]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e162]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e163]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e164]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e165]
                  - generic [ref=e168]: Optical axis
                  - generic [ref=e170]: Foreground ground
                  - generic [ref=e172]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic "lens plane" [ref=e175]
                  - generic "focus plane" [ref=e177]
                  - generic "nearDof plane" [ref=e179]
                  - generic "farDof plane" [ref=e181]
                  - generic "Simplified bellows connector" [ref=e183]
                  - generic "chief ray from film centre through lens centre" [ref=e187]
                  - generic [ref=e191]: Near foreground
                  - generic [ref=e195]: Middle foreground
                  - generic [ref=e199]: Building base
                  - generic [ref=e203]: Building middle
                - generic [ref=e205]:
                  - generic [ref=e207]: Current
                  - generic [ref=e208]: Original
              - generic "Optical depth order" [ref=e209]:
                - generic [ref=e212]: Film 0 mm
                - generic [ref=e215]: Scheimpflug intersection 0 mm
                - generic [ref=e218]: Lens 153 mm
                - generic [ref=e221]: DOF limit 6.2 m
                - generic [ref=e224]: Focus 8.6 m
                - generic [ref=e227]: Far DOF > 12.8 m
            - region "Focus distribution · Focus" [ref=e229]:
              - generic [ref=e230]:
                - heading "Focus distribution" [level=4] [ref=e231]
                - 'generic "Ground Glass orientation: Raw" [ref=e232]': Raw
              - table "Focus distribution" [ref=e233]:
                - caption [ref=e234]: Focus distribution
                - rowgroup [ref=e235]:
                  - 'row "Upper centre Upper centre · Building base: 45% · Soft" [ref=e236]':
                    - cell [ref=e237]
                    - 'cell "Upper centre Upper centre · Building base: 45% · Soft" [ref=e238]':
                      - generic "Upper centre" [ref=e239]
                      - 'group "Upper centre · Building base: 45% · Soft" [ref=e241]':
                        - generic "Building base" [ref=e243]
                        - generic [ref=e244]:
                          - text: 45%
                          - generic [ref=e245]: —
                    - cell [ref=e246]
                  - 'row "Centre Centre · Building middle: 57% · Acceptable" [ref=e247]':
                    - cell [ref=e248]
                    - 'cell "Centre Centre · Building middle: 57% · Acceptable" [ref=e249]':
                      - generic "Centre" [ref=e250]
                      - 'group "Centre · Building middle: 57% · Acceptable" [ref=e252]':
                        - generic "Building middle" [ref=e254]
                        - generic [ref=e255]:
                          - text: 57%
                          - generic [ref=e256]: ~
                    - cell [ref=e257]
                  - row [ref=e258]:
                    - cell [ref=e259]
                    - cell [ref=e260]
                    - cell [ref=e261]
              - generic "Focus targets outside current Ground Glass view" [ref=e262]:
                - generic [ref=e263]: Outside current Ground Glass view
                - generic [ref=e264]:
                  - 'group "Outside current Ground Glass view · Near foreground: 30% · Soft" [ref=e265]':
                    - generic [ref=e266]: Near foreground
                    - strong [ref=e267]: 30%
                    - generic [ref=e268]: —
                  - 'group "Outside current Ground Glass view · Middle foreground: 74% · Acceptable" [ref=e269]':
                    - generic [ref=e270]: Middle foreground
                    - strong [ref=e271]: 74%
                    - generic [ref=e272]: ~
          - group [ref=e275]:
            - generic "Optical Debug architecture-foreground · scheimpflug" [ref=e276] [cursor=pointer]:
              - generic [ref=e277]: Optical Debug
              - generic [ref=e278]: architecture-foreground · scheimpflug
        - complementary [ref=e279]:
          - generic [ref=e280]:
            - region "Camera Controls" [ref=e281]:
              - heading "Camera Controls" [level=3] [ref=e283]
              - paragraph [ref=e284]:
                - generic [ref=e285]: 🔒
                - generic [ref=e286]: Disabled for this guided task
              - generic [ref=e287]:
                - region "Movement" [ref=e289]:
                  - generic [ref=e290]:
                    - heading "Front standard" [level=4] [ref=e291]
                    - button "Help" [ref=e292] [cursor=pointer]:
                      - generic [ref=e293]: "?"
                  - generic [ref=e294]:
                    - generic [ref=e295]:
                      - generic [ref=e296]: Rise
                      - slider "Rise" [disabled] [ref=e297]: "20"
                      - generic [ref=e298]: 20.0 mm
                    - generic [ref=e299]:
                      - generic [ref=e300]: Tilt
                      - slider "Tilt" [ref=e301]: "2"
                      - generic [ref=e302]: 2.0°
                    - generic [ref=e303]:
                      - generic [ref=e304]: Swing
                      - slider "Swing" [disabled] [ref=e305]: "0"
                      - generic [ref=e306]: 0.0°
                - region "Focus" [ref=e308]:
                  - heading "Focus" [level=3] [ref=e309]
                  - generic [ref=e310]:
                    - generic [ref=e311]: Focus distance
                    - slider "Focus distance" [active] [ref=e312]: "8490"
                    - generic [ref=e313]: 8490.0 mm
                - region "Aperture" [ref=e315]:
                  - heading "Aperture" [level=3] [ref=e316]
                  - radiogroup "Aperture" [disabled] [ref=e317]:
                    - generic [ref=e318]:
                      - radio "f/5.6" [disabled] [ref=e319]
                      - generic [ref=e320]: f/5.6
                    - generic [ref=e321]:
                      - radio "f/8" [disabled] [ref=e322]
                      - generic [ref=e323]: f/8
                    - generic [ref=e324]:
                      - radio "f/11" [checked] [disabled] [ref=e325]
                      - generic [ref=e326]: f/11
                    - generic [ref=e327]:
                      - radio "f/16" [disabled] [ref=e328]
                      - generic [ref=e329]: f/16
                    - generic [ref=e330]:
                      - radio "f/22" [disabled] [ref=e331]
                      - generic [ref=e332]: f/22
                    - generic [ref=e333]:
                      - radio "f/32" [disabled] [ref=e334]
                      - generic [ref=e335]: f/32
                - generic [ref=e336]:
                  - generic [ref=e337]: Reset
                  - region "Reset" [ref=e338]:
                    - generic [ref=e339]:
                      - button "Reset movements" [ref=e340] [cursor=pointer]
                      - button "Restart task" [ref=e341] [cursor=pointer]
            - region "Developer Tools" [ref=e342]:
              - heading "Developer Tools" [level=3] [ref=e343]
              - generic [ref=e345]:
                - checkbox "Raw RTT — bypass DOF" [ref=e346]
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