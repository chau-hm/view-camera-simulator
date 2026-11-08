# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: oblique-architecture.spec.ts >> Oblique Architecture compound task solves Rise, Swing, and Focus from neutral
- Location: src/tests/e2e/oblique-architecture.spec.ts:232:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.press: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('slider', { name: 'Swing' })

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
          - generic [ref=e12]: Oblique Architecture
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
                            - paragraph [ref=e71]: Use Front Rise, Front Swing, and Focus to frame the building, keep its verticals parallel, and make the receding façade sharp from near to far.
                            - generic [ref=e72]:
                              - strong [ref=e73]: "Allowed controls:"
                              - text: Front RiseFront SwingFocus2D Geometry
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
                            - generic: 13200.0 mm focus / CoC 0.197 mm (0%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e111] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e112]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e113] [cursor=pointer]:
                    - generic [ref=e114]: open_in_new
            - generic [ref=e116]:
              - generic [ref=e117]:
                - heading "2D Geometry" [level=2] [ref=e118]
                - generic [ref=e119]:
                  - group "Geometry view" [ref=e120]:
                    - button "Side" [ref=e121] [cursor=pointer]
                    - button "Top" [pressed] [ref=e122] [cursor=pointer]
                  - group "Geometry framing" [ref=e123]:
                    - button "Fit Scene" [pressed] [ref=e124] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e125] [cursor=pointer]:
                    - generic [ref=e126]: open_in_new
              - paragraph [ref=e127]: "Top view | Rise: 20.0 mm | Tilt: 0.0° | Swing: 9.0°"
              - img [ref=e129]:
                - generic [ref=e130]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e131]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e132]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e133]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e134]
                  - generic [ref=e136]: Optical axis
                  - generic [ref=e138]: Target façade depth
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e139]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e144]: Near façade
                  - generic [ref=e147]: Middle façade
                  - generic [ref=e150]: Far façade
                - generic [ref=e152]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e153]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e154]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e155]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e156]
                  - generic [ref=e159]: Optical axis
                  - generic [ref=e161]: Target façade depth
                  - generic:
                    - generic "film plane"
                  - generic "lens plane" [ref=e164]
                  - generic "focus plane" [ref=e166]
                  - generic "nearDof plane" [ref=e168]
                  - generic "farDof plane" [ref=e170]
                  - generic [ref=e171]:
                    - generic "Simplified bellows connector"
                  - generic "chief ray from film centre through lens centre"
                  - generic [ref=e177]: Near façade
                  - generic [ref=e180]: Middle façade
                  - generic [ref=e183]: Far façade
                - generic [ref=e185]:
                  - generic [ref=e187]: Current
                  - generic [ref=e188]: Original
              - generic "Optical depth order" [ref=e189]:
                - generic [ref=e192]: Film 0 mm
                - generic [ref=e195]: Scheimpflug intersection 0 mm
                - generic [ref=e198]: Lens 150 mm
                - generic [ref=e201]: DOF limit 8.1 m
                - generic [ref=e204]: Focus 13.2 m
                - generic [ref=e207]: Far DOF > 19.3 m
            - region "Focus distribution · Focus" [ref=e209]:
              - generic [ref=e210]:
                - heading "Focus distribution" [level=4] [ref=e211]
                - 'generic "Ground Glass orientation: Raw" [ref=e212]': Raw
              - table "Focus distribution" [ref=e213]:
                - caption [ref=e214]: Focus distribution
                - rowgroup [ref=e215]:
                  - row [ref=e216]:
                    - cell [ref=e217]
                    - cell [ref=e218]
                    - cell [ref=e219]
                  - 'row "Centre Centre · Far façade: 0% · Soft Centre · Middle façade: 0% · Soft Centre · Near façade: 0% · Soft" [ref=e220]':
                    - cell [ref=e221]
                    - 'cell "Centre Centre · Far façade: 0% · Soft Centre · Middle façade: 0% · Soft Centre · Near façade: 0% · Soft" [ref=e222]':
                      - generic "Centre" [ref=e223]
                      - generic [ref=e224]:
                        - 'group "Centre · Far façade: 0% · Soft" [ref=e225]':
                          - generic "Far façade" [ref=e227]
                          - generic [ref=e228]:
                            - text: 0%
                            - generic [ref=e229]: —
                        - 'group "Centre · Middle façade: 0% · Soft" [ref=e230]':
                          - generic "Middle façade" [ref=e232]
                          - generic [ref=e233]:
                            - text: 0%
                            - generic [ref=e234]: —
                        - 'group "Centre · Near façade: 0% · Soft" [ref=e235]':
                          - generic "Near façade" [ref=e237]
                          - generic [ref=e238]:
                            - text: 0%
                            - generic [ref=e239]: —
                    - cell [ref=e240]
                  - row [ref=e241]:
                    - cell [ref=e242]
                    - cell [ref=e243]
                    - cell [ref=e244]
          - group [ref=e247]:
            - generic "Optical Debug oblique-architecture · scheimpflug" [ref=e248] [cursor=pointer]:
              - generic [ref=e249]: Optical Debug
              - generic [ref=e250]: oblique-architecture · scheimpflug
        - complementary [ref=e251]:
          - generic [ref=e252]:
            - region "Camera Controls" [ref=e253]:
              - heading "Camera Controls" [level=3] [ref=e255]
              - paragraph [ref=e256]:
                - generic [ref=e257]: 🔒
                - generic [ref=e258]: Disabled for this guided task
              - generic [ref=e259]:
                - region "Movement" [ref=e261]:
                  - generic [ref=e262]:
                    - heading "Front standard" [level=4] [ref=e263]
                    - button "Help" [ref=e264] [cursor=pointer]:
                      - generic [ref=e265]: "?"
                  - generic [ref=e266]:
                    - generic [ref=e267]:
                      - generic [ref=e268]: Rise
                      - slider "Rise" [ref=e269]: "20"
                      - generic [ref=e270]: 20.0 mm
                    - generic [ref=e271]:
                      - generic [ref=e272]: Tilt
                      - slider "Tilt" [disabled] [ref=e273]: "0"
                      - generic [ref=e274]: 0.0°
                    - generic [ref=e275]:
                      - generic [ref=e276]: Swing
                      - slider "Swing" [active] [ref=e277]: "9"
                      - generic [ref=e278]: 9.0°
                - region "Focus" [ref=e280]:
                  - heading "Focus" [level=3] [ref=e281]
                  - generic [ref=e282]:
                    - generic [ref=e283]: Focus distance
                    - slider "Focus distance" [ref=e284]: "13200"
                    - generic [ref=e285]: 13200.0 mm
                - region "Aperture" [ref=e287]:
                  - heading "Aperture" [level=3] [ref=e288]
                  - radiogroup "Aperture" [disabled] [ref=e289]:
                    - generic [ref=e290]:
                      - radio "f/5.6" [disabled] [ref=e291]
                      - generic [ref=e292]: f/5.6
                    - generic [ref=e293]:
                      - radio "f/8" [disabled] [ref=e294]
                      - generic [ref=e295]: f/8
                    - generic [ref=e296]:
                      - radio "f/11" [checked] [disabled] [ref=e297]
                      - generic [ref=e298]: f/11
                    - generic [ref=e299]:
                      - radio "f/16" [disabled] [ref=e300]
                      - generic [ref=e301]: f/16
                    - generic [ref=e302]:
                      - radio "f/22" [disabled] [ref=e303]
                      - generic [ref=e304]: f/22
                    - generic [ref=e305]:
                      - radio "f/32" [disabled] [ref=e306]
                      - generic [ref=e307]: f/32
                  - generic [ref=e308]: Aperture is fixed for this lesson
                - generic [ref=e309]:
                  - generic [ref=e310]: Reset
                  - region "Reset" [ref=e311]:
                    - generic [ref=e312]:
                      - button "Reset movements" [ref=e313] [cursor=pointer]
                      - button "Restart task" [ref=e314] [cursor=pointer]
            - region "Developer Tools" [ref=e315]:
              - heading "Developer Tools" [level=3] [ref=e316]
              - generic [ref=e318]:
                - checkbox "Raw RTT — bypass DOF" [ref=e319]
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
     |                  ^ Error: locator.press: Test timeout of 120000ms exceeded.
  56 |   }
  57 |   await expect.poll(async () => Number(await slider.inputValue())).toBeCloseTo(target, 8);
  58 | };
  59 |
```