# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: oblique-architecture.spec.ts >> Oblique Architecture free practice exposes Rise, Swing, and Focus
- Location: src/tests/e2e/oblique-architecture.spec.ts:95:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.inputValue: Target page, context or browser has been closed
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
                            - generic: 13100.0 mm focus / CoC 0.029 mm (71%)
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
              - paragraph [ref=e106]: "Side view | Rise: 20.0 mm | Tilt: 0.0° | Swing: 1.0°"
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
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e116]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e122]: Near façade
                  - generic [ref=e126]: Middle façade
                  - generic [ref=e130]: Far façade
                - generic [ref=e132]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e133]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e134]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e135]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e136]
                  - generic [ref=e138]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic "Simplified bellows connector" [ref=e140]
                  - generic "chief ray from film centre through lens centre" [ref=e143]
                  - generic [ref=e147]: Near façade
                  - generic [ref=e151]: Middle façade
                  - generic [ref=e155]: Far façade
                - generic [ref=e157]:
                  - generic [ref=e159]: Current
                  - generic [ref=e160]: Original
              - generic "Optical depth order" [ref=e161]:
                - generic [ref=e164]: Film 0 mm
                - generic [ref=e167]: Scheimpflug intersection 0 mm
                - generic [ref=e170]: Lens 152 mm
                - generic [ref=e173]: DOF limit 8.2 m
                - generic [ref=e176]: Focus 13.2 m
                - generic [ref=e179]: Far DOF > 19.3 m
            - region "Focus distribution · Focus" [ref=e181]:
              - generic [ref=e182]:
                - heading "Focus distribution" [level=4] [ref=e183]
                - 'generic "Ground Glass orientation: Raw" [ref=e184]': Raw
              - table "Focus distribution" [ref=e185]:
                - caption [ref=e186]: Focus distribution
                - rowgroup [ref=e187]:
                  - row [ref=e188]:
                    - cell [ref=e189]
                    - cell [ref=e190]
                    - cell [ref=e191]
                  - 'row "Centre Centre · Far façade: 61% · Acceptable Centre · Middle façade: 84% · Sharp Centre · Near façade: 71% · Acceptable" [ref=e192]':
                    - cell [ref=e193]
                    - 'cell "Centre Centre · Far façade: 61% · Acceptable Centre · Middle façade: 84% · Sharp Centre · Near façade: 71% · Acceptable" [ref=e194]':
                      - generic "Centre" [ref=e195]
                      - generic [ref=e196]:
                        - 'group "Centre · Far façade: 61% · Acceptable" [ref=e197]':
                          - generic "Far façade" [ref=e199]
                          - generic [ref=e200]:
                            - text: 61%
                            - generic [ref=e201]: ~
                        - 'group "Centre · Middle façade: 84% · Sharp" [ref=e202]':
                          - generic "Middle façade" [ref=e204]
                          - generic [ref=e205]:
                            - text: 84%
                            - generic [ref=e206]: ✓
                        - 'group "Centre · Near façade: 71% · Acceptable" [ref=e207]':
                          - generic "Near façade" [ref=e209]
                          - generic [ref=e210]:
                            - text: 71%
                            - generic [ref=e211]: ~
                    - cell [ref=e212]
                  - row [ref=e213]:
                    - cell [ref=e214]
                    - cell [ref=e215]
                    - cell [ref=e216]
          - group [ref=e219]:
            - generic "Optical Debug oblique-architecture · scheimpflug" [ref=e220] [cursor=pointer]:
              - generic [ref=e221]: Optical Debug
              - generic [ref=e222]: oblique-architecture · scheimpflug
        - complementary [ref=e223]:
          - generic [ref=e224]:
            - region "Camera Controls" [ref=e225]:
              - heading "Camera Controls" [level=3] [ref=e227]
              - paragraph [ref=e228]:
                - generic [ref=e229]: 🔒
                - generic [ref=e230]: Disabled for this guided task
              - generic [ref=e231]:
                - region "Movement" [ref=e233]:
                  - generic [ref=e234]:
                    - heading "Front standard" [level=4] [ref=e235]
                    - button "Help" [ref=e236] [cursor=pointer]:
                      - generic [ref=e237]: "?"
                  - generic [ref=e238]:
                    - generic [ref=e239]:
                      - generic [ref=e240]: Rise
                      - slider "Rise" [ref=e241]: "20"
                      - generic [ref=e242]: 20.0 mm
                    - generic [ref=e243]:
                      - generic [ref=e244]: Tilt
                      - slider "Tilt" [disabled] [ref=e245]: "0"
                      - generic [ref=e246]: 0.0°
                    - generic [ref=e247]:
                      - generic [ref=e248]: Swing
                      - slider "Swing" [ref=e249]: "1"
                      - generic [ref=e250]: 1.0°
                - region "Focus" [ref=e252]:
                  - heading "Focus" [level=3] [ref=e253]
                  - generic [ref=e254]:
                    - generic [ref=e255]: Focus distance
                    - slider "Focus distance" [active] [ref=e256]: "13100"
                    - generic [ref=e257]: 13100.0 mm
                - region "Aperture" [ref=e259]:
                  - heading "Aperture" [level=3] [ref=e260]
                  - radiogroup "Aperture" [disabled] [ref=e261]:
                    - generic [ref=e262]:
                      - radio "f/5.6" [disabled] [ref=e263]
                      - generic [ref=e264]: f/5.6
                    - generic [ref=e265]:
                      - radio "f/8" [disabled] [ref=e266]
                      - generic [ref=e267]: f/8
                    - generic [ref=e268]:
                      - radio "f/11" [checked] [disabled] [ref=e269]
                      - generic [ref=e270]: f/11
                    - generic [ref=e271]:
                      - radio "f/16" [disabled] [ref=e272]
                      - generic [ref=e273]: f/16
                    - generic [ref=e274]:
                      - radio "f/22" [disabled] [ref=e275]
                      - generic [ref=e276]: f/22
                    - generic [ref=e277]:
                      - radio "f/32" [disabled] [ref=e278]
                      - generic [ref=e279]: f/32
                  - generic [ref=e280]: Aperture is fixed for this lesson
                - generic [ref=e281]:
                  - generic [ref=e282]: Reset
                  - region "Reset" [ref=e283]:
                    - button "Reset movements" [ref=e285] [cursor=pointer]
            - region "Developer Tools" [ref=e286]:
              - heading "Developer Tools" [level=3] [ref=e287]
              - generic [ref=e289]:
                - checkbox "Raw RTT — bypass DOF" [ref=e290]
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
     |                                                     ^ Error: locator.inputValue: Target page, context or browser has been closed
  58 | };
  59 |
```