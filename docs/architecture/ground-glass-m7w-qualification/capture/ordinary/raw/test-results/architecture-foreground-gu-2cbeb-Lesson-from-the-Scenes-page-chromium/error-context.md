# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture-foreground-guided-lesson.spec.ts >> Architecture + Foreground completes its five-stage Guided Lesson from the Scenes page
- Location: src/tests/e2e/architecture-foreground-guided-lesson.spec.ts:52:1

# Error details

```
Test timeout of 360000ms exceeded.
```

```
Error: locator.focus: Test timeout of 360000ms exceeded.
Call log:
  - waiting for getByRole('slider', { name: 'Rise' })
    - locator resolved to <input min="0" max="40" step="1" value="0" id="_r_h_" type="range" aria-label="Rise" class="range-slider compact-range-row__slider"/>

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
                        - region "Guided lesson progress" [ref=e66]:
                          - generic [ref=e67]:
                            - strong [ref=e68]: Architecture + Foreground Guided Lesson
                            - generic [ref=e69]: Step 5 of 5
                          - list [ref=e70]:
                            - listitem [ref=e71]:
                              - generic [ref=e72]: "1"
                              - generic [ref=e73]: Observe
                            - listitem [ref=e74]:
                              - generic [ref=e75]: "2"
                              - generic [ref=e76]: Compose
                            - listitem [ref=e77]:
                              - generic [ref=e78]: "3"
                              - generic [ref=e79]: Align Focus
                            - listitem [ref=e80]:
                              - generic [ref=e81]: "4"
                              - generic [ref=e82]: Depth of Field
                            - listitem [ref=e83]:
                              - generic [ref=e84]: "5"
                              - generic [ref=e85]: Final Challenge
                          - navigation "Guided Lesson" [ref=e86]:
                            - link "Previous" [ref=e87] [cursor=pointer]:
                              - /url: /simulator/guided/architecture-foreground/architecture-foreground-dof-01?lesson=1
                            - generic [ref=e88]: Complete the final challenge to finish the lesson.
                            - link "Back to Scenes" [ref=e89] [cursor=pointer]:
                              - /url: /scenes
                        - region "Task" [ref=e90]:
                          - generic [ref=e91]:
                            - generic [ref=e93]: Guided task
                            - heading "Complete the Photograph" [level=3] [ref=e94]
                            - paragraph [ref=e95]: Correct the framing, align and place the focus plane, then use Aperture to produce an acceptably sharp architectural photograph from foreground to building while preserving parallel verticals.
                            - generic [ref=e96]:
                              - strong [ref=e97]: "Allowed controls:"
                              - text: Front RiseFront TiltFocusAperture2D Geometry
                            - group [ref=e98]:
                              - generic "View requirements" [ref=e99] [cursor=pointer]
            - generic "GroundGlassColumn" [ref=e100]:
              - generic [ref=e101]:
                - generic [ref=e103]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e104]
              - generic [ref=e105]:
                - generic [ref=e107]:
                  - group "Preview" [ref=e108]:
                    - generic [ref=e109]: Preview
                    - generic [ref=e111]:
                      - generic [ref=e112]:
                        - radio "Raw Ground Glass" [checked] [ref=e113]
                        - generic [ref=e114]: Raw Ground Glass
                      - generic [ref=e115]:
                        - radio "Upright Assist" [ref=e116]
                        - generic [ref=e117]: Upright Assist
                  - group "View Options" [ref=e118]:
                    - generic [ref=e119]: View Options
                    - region "View Options" [ref=e121]:
                      - generic [ref=e123]:
                        - checkbox "Grid" [checked] [disabled] [ref=e124]
                        - generic [ref=e125]: Grid
                        - generic [ref=e126]: Disabled for this guided task
                - generic "GroundGlassViewport" [ref=e127]:
                  - generic [ref=e129]:
                    - generic [ref=e130]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e131]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 9490.0 mm focus / CoC 0.223 mm (0%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e135] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e136]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e137] [cursor=pointer]:
                    - generic [ref=e138]: open_in_new
            - generic [ref=e140]:
              - generic [ref=e141]:
                - heading "2D Geometry" [level=2] [ref=e142]
                - generic [ref=e143]:
                  - group "Geometry view" [ref=e144]:
                    - button "Side" [pressed] [ref=e145] [cursor=pointer]
                    - button "Top" [ref=e146] [cursor=pointer]
                  - group "Geometry framing" [ref=e147]:
                    - button "Fit Scene" [pressed] [ref=e148] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e149] [cursor=pointer]:
                    - generic [ref=e150]: open_in_new
              - paragraph [ref=e151]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e153]:
                - generic [ref=e154]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e155]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e156]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e157]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e158]
                  - generic [ref=e160]: Optical axis
                  - generic [ref=e162]: Foreground ground
                  - generic [ref=e164]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e165]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e171]: Near foreground
                  - generic [ref=e175]: Middle foreground
                  - generic [ref=e179]: Building base
                  - generic [ref=e183]: Building middle
                - generic [ref=e185]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e186]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e187]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e188]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e189]
                  - generic [ref=e191]: Optical axis
                  - generic [ref=e193]: Foreground ground
                  - generic [ref=e195]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e196]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e202]: Near foreground
                  - generic [ref=e206]: Middle foreground
                  - generic [ref=e210]: Building base
                  - generic [ref=e214]: Building middle
                - generic [ref=e216]:
                  - generic [ref=e218]: Current
                  - generic [ref=e219]: Original
              - generic "Optical depth order" [ref=e220]:
                - generic [ref=e223]: Film 0 mm
                - generic [ref=e226]: Lens 152 mm
                - generic [ref=e229]: DOF limit 6.7 m
                - generic [ref=e232]: Focus 9.6 m
                - generic [ref=e235]: Far DOF > 12.8 m
            - region "Focus distribution · Focus" [ref=e237]:
              - generic [ref=e238]:
                - heading "Focus distribution" [level=4] [ref=e239]
                - 'generic "Ground Glass orientation: Raw" [ref=e240]': Raw
              - table "Focus distribution" [ref=e241]:
                - caption [ref=e242]: Focus distribution
                - rowgroup [ref=e243]:
                  - 'row "Upper centre Upper centre · Near foreground: 0% · Soft Upper centre · Middle foreground: 18% · Soft" [ref=e244]':
                    - cell [ref=e245]
                    - 'cell "Upper centre Upper centre · Near foreground: 0% · Soft Upper centre · Middle foreground: 18% · Soft" [ref=e246]':
                      - generic "Upper centre" [ref=e247]
                      - generic [ref=e248]:
                        - 'group "Upper centre · Near foreground: 0% · Soft" [ref=e249]':
                          - generic "Near foreground" [ref=e251]
                          - generic [ref=e252]:
                            - text: 0%
                            - generic [ref=e253]: —
                        - 'group "Upper centre · Middle foreground: 18% · Soft" [ref=e254]':
                          - generic "Middle foreground" [ref=e256]
                          - generic [ref=e257]:
                            - text: 18%
                            - generic [ref=e258]: —
                    - cell [ref=e259]
                  - 'row "Centre Centre · Building base: 100% · Sharp Centre · Building middle: 100% · Sharp" [ref=e260]':
                    - cell [ref=e261]
                    - 'cell "Centre Centre · Building base: 100% · Sharp Centre · Building middle: 100% · Sharp" [ref=e262]':
                      - generic "Centre" [ref=e263]
                      - generic [ref=e264]:
                        - 'group "Centre · Building base: 100% · Sharp" [ref=e265]':
                          - generic "Building base" [ref=e267]
                          - generic [ref=e268]:
                            - text: 100%
                            - generic [ref=e269]: ✓
                        - 'group "Centre · Building middle: 100% · Sharp" [ref=e270]':
                          - generic "Building middle" [ref=e272]
                          - generic [ref=e273]:
                            - text: 100%
                            - generic [ref=e274]: ✓
                    - cell [ref=e275]
                  - row [ref=e276]:
                    - cell [ref=e277]
                    - cell [ref=e278]
                    - cell [ref=e279]
          - group [ref=e282]:
            - generic "Optical Debug architecture-foreground · parallel" [ref=e283] [cursor=pointer]:
              - generic [ref=e284]: Optical Debug
              - generic [ref=e285]: architecture-foreground · parallel
        - complementary [ref=e286]:
          - generic [ref=e287]:
            - region "Camera Controls" [ref=e288]:
              - heading "Camera Controls" [level=3] [ref=e290]
              - paragraph [ref=e291]:
                - generic [ref=e292]: 🔒
                - generic [ref=e293]: Disabled for this guided task
              - generic [ref=e294]:
                - region "Movement" [ref=e296]:
                  - generic [ref=e297]:
                    - heading "Front standard" [level=4] [ref=e298]
                    - button "Help" [ref=e299] [cursor=pointer]:
                      - generic [ref=e300]: "?"
                  - generic [ref=e301]:
                    - generic [ref=e302]:
                      - generic [ref=e303]: Rise
                      - slider "Rise" [ref=e304]: "0"
                      - generic [ref=e305]: 0.0 mm
                    - generic [ref=e306]:
                      - generic [ref=e307]: Tilt
                      - slider "Tilt" [ref=e308]: "0"
                      - generic [ref=e309]: 0.0°
                    - generic [ref=e310]:
                      - generic [ref=e311]: Swing
                      - slider "Swing" [disabled] [ref=e312]: "0"
                      - generic [ref=e313]: 0.0°
                - region "Focus" [ref=e315]:
                  - heading "Focus" [level=3] [ref=e316]
                  - generic [ref=e317]:
                    - generic [ref=e318]: Focus distance
                    - slider "Focus distance" [ref=e319]: "9490"
                    - generic [ref=e320]: 9490.0 mm
                - region "Aperture" [ref=e322]:
                  - heading "Aperture" [level=3] [ref=e323]
                  - radiogroup "Aperture" [ref=e324]:
                    - generic [ref=e325] [cursor=pointer]:
                      - radio "f/5.6" [ref=e326]
                      - generic [ref=e327]: f/5.6
                    - generic [ref=e328] [cursor=pointer]:
                      - radio "f/8" [ref=e329]
                      - generic [ref=e330]: f/8
                    - generic [ref=e331] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e332]
                      - generic [ref=e333]: f/11
                    - generic [ref=e334] [cursor=pointer]:
                      - radio "f/16" [ref=e335]
                      - generic [ref=e336]: f/16
                    - generic [ref=e337] [cursor=pointer]:
                      - radio "f/22" [ref=e338]
                      - generic [ref=e339]: f/22
                    - generic [ref=e340] [cursor=pointer]:
                      - radio "f/32" [ref=e341]
                      - generic [ref=e342]: f/32
                - generic [ref=e343]:
                  - generic [ref=e344]: Reset
                  - region "Reset" [ref=e345]:
                    - generic [ref=e346]:
                      - button "Reset movements" [ref=e347] [cursor=pointer]
                      - button "Restart task" [active] [ref=e348] [cursor=pointer]
            - region "Developer Tools" [ref=e349]:
              - heading "Developer Tools" [level=3] [ref=e350]
              - generic [ref=e352]:
                - checkbox "Raw RTT — bypass DOF" [ref=e353]
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
> 41 |   await slider.focus();
     |                ^ Error: locator.focus: Test timeout of 360000ms exceeded.
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
  57 |   await expect.poll(async () => Number(await slider.inputValue())).toBeCloseTo(target, 8);
  58 | };
  59 |
```