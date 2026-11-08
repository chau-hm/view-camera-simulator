# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture-foreground-compound.spec.ts >> Architecture + Foreground compound task solves the photograph from neutral
- Location: src/tests/e2e/architecture-foreground-compound.spec.ts:15:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.inputValue: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('slider', { name: 'Rise' })

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
                            - heading "Complete the Photograph" [level=3] [ref=e70]
                            - paragraph [ref=e71]: Correct the framing, align and place the focus plane, then use Aperture to produce an acceptably sharp architectural photograph from foreground to building while preserving parallel verticals.
                            - generic [ref=e72]:
                              - strong [ref=e73]: "Allowed controls:"
                              - text: Front RiseFront TiltFocusAperture2D Geometry
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
                            - generic: 9490.0 mm focus / CoC 0.223 mm (0%)
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
              - paragraph [ref=e127]: "Side view | Rise: 20.0 mm | Tilt: 0.0° | Swing: 0.0°"
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
                  - generic [ref=e167]: Optical axis
                  - generic [ref=e169]: Foreground ground
                  - generic [ref=e171]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic "Simplified bellows connector" [ref=e173]
                  - generic "chief ray from film centre through lens centre" [ref=e176]
                  - generic [ref=e180]: Near foreground
                  - generic [ref=e184]: Middle foreground
                  - generic [ref=e188]: Building base
                  - generic [ref=e192]: Building middle
                - generic [ref=e194]:
                  - generic [ref=e196]: Current
                  - generic [ref=e197]: Original
              - generic "Optical depth order" [ref=e198]:
                - generic [ref=e201]: Film 0 mm
                - generic [ref=e204]: Lens 152 mm
                - generic [ref=e207]: DOF limit 6.7 m
                - generic [ref=e210]: Focus 9.6 m
                - generic [ref=e213]: Far DOF > 12.8 m
            - region "Focus distribution · Focus" [ref=e215]:
              - generic [ref=e216]:
                - heading "Focus distribution" [level=4] [ref=e217]
                - 'generic "Ground Glass orientation: Raw" [ref=e218]': Raw
              - table "Focus distribution" [ref=e219]:
                - caption [ref=e220]: Focus distribution
                - rowgroup [ref=e221]:
                  - 'row "Upper centre Upper centre · Building base: 100% · Sharp" [ref=e222]':
                    - cell [ref=e223]
                    - 'cell "Upper centre Upper centre · Building base: 100% · Sharp" [ref=e224]':
                      - generic "Upper centre" [ref=e225]
                      - 'group "Upper centre · Building base: 100% · Sharp" [ref=e227]':
                        - generic "Building base" [ref=e229]
                        - generic [ref=e230]:
                          - text: 100%
                          - generic [ref=e231]: ✓
                    - cell [ref=e232]
                  - 'row "Centre Centre · Building middle: 100% · Sharp" [ref=e233]':
                    - cell [ref=e234]
                    - 'cell "Centre Centre · Building middle: 100% · Sharp" [ref=e235]':
                      - generic "Centre" [ref=e236]
                      - 'group "Centre · Building middle: 100% · Sharp" [ref=e238]':
                        - generic "Building middle" [ref=e240]
                        - generic [ref=e241]:
                          - text: 100%
                          - generic [ref=e242]: ✓
                    - cell [ref=e243]
                  - row [ref=e244]:
                    - cell [ref=e245]
                    - cell [ref=e246]
                    - cell [ref=e247]
              - generic "Focus targets outside current Ground Glass view" [ref=e248]:
                - generic [ref=e249]: Outside current Ground Glass view
                - generic [ref=e250]:
                  - 'group "Outside current Ground Glass view · Near foreground: 0% · Soft" [ref=e251]':
                    - generic [ref=e252]: Near foreground
                    - strong [ref=e253]: 0%
                    - generic [ref=e254]: —
                  - 'group "Outside current Ground Glass view · Middle foreground: 18% · Soft" [ref=e255]':
                    - generic [ref=e256]: Middle foreground
                    - strong [ref=e257]: 18%
                    - generic [ref=e258]: —
          - group [ref=e261]:
            - generic "Optical Debug architecture-foreground · parallel" [ref=e262] [cursor=pointer]:
              - generic [ref=e263]: Optical Debug
              - generic [ref=e264]: architecture-foreground · parallel
        - complementary [ref=e265]:
          - generic [ref=e266]:
            - region "Camera Controls" [ref=e267]:
              - heading "Camera Controls" [level=3] [ref=e269]
              - paragraph [ref=e270]:
                - generic [ref=e271]: 🔒
                - generic [ref=e272]: Disabled for this guided task
              - generic [ref=e273]:
                - region "Movement" [ref=e275]:
                  - generic [ref=e276]:
                    - heading "Front standard" [level=4] [ref=e277]
                    - button "Help" [ref=e278] [cursor=pointer]:
                      - generic [ref=e279]: "?"
                  - generic [ref=e280]:
                    - generic [ref=e281]:
                      - generic [ref=e282]: Rise
                      - slider "Rise" [active] [ref=e283]: "20"
                      - generic [ref=e284]: 20.0 mm
                    - generic [ref=e285]:
                      - generic [ref=e286]: Tilt
                      - slider "Tilt" [ref=e287]: "0"
                      - generic [ref=e288]: 0.0°
                    - generic [ref=e289]:
                      - generic [ref=e290]: Swing
                      - slider "Swing" [disabled] [ref=e291]: "0"
                      - generic [ref=e292]: 0.0°
                - region "Focus" [ref=e294]:
                  - heading "Focus" [level=3] [ref=e295]
                  - generic [ref=e296]:
                    - generic [ref=e297]: Focus distance
                    - slider "Focus distance" [ref=e298]: "9490"
                    - generic [ref=e299]: 9490.0 mm
                - region "Aperture" [ref=e301]:
                  - heading "Aperture" [level=3] [ref=e302]
                  - radiogroup "Aperture" [ref=e303]:
                    - generic [ref=e304] [cursor=pointer]:
                      - radio "f/5.6" [ref=e305]
                      - generic [ref=e306]: f/5.6
                    - generic [ref=e307] [cursor=pointer]:
                      - radio "f/8" [ref=e308]
                      - generic [ref=e309]: f/8
                    - generic [ref=e310] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e311]
                      - generic [ref=e312]: f/11
                    - generic [ref=e313] [cursor=pointer]:
                      - radio "f/16" [ref=e314]
                      - generic [ref=e315]: f/16
                    - generic [ref=e316] [cursor=pointer]:
                      - radio "f/22" [ref=e317]
                      - generic [ref=e318]: f/22
                    - generic [ref=e319] [cursor=pointer]:
                      - radio "f/32" [ref=e320]
                      - generic [ref=e321]: f/32
                - generic [ref=e322]:
                  - generic [ref=e323]: Reset
                  - region "Reset" [ref=e324]:
                    - generic [ref=e325]:
                      - button "Reset movements" [ref=e326] [cursor=pointer]
                      - button "Restart task" [ref=e327] [cursor=pointer]
            - region "Developer Tools" [ref=e328]:
              - heading "Developer Tools" [level=3] [ref=e329]
              - generic [ref=e331]:
                - checkbox "Raw RTT — bypass DOF" [ref=e332]
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
     |                                                     ^ Error: locator.inputValue: Test timeout of 120000ms exceeded.
  58 | };
  59 |
```