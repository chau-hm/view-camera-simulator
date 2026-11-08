# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: macro-compound-movements.spec.ts >> Macro 4 teaches compound Tilt + Swing + Focus through the public route
- Location: src/tests/e2e/macro-compound-movements.spec.ts:11:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('slider', { name: 'Tilt' })

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
          - generic [ref=e12]: Compound Macro Still Life
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
                            - region "Compound plane alignment study" [ref=e70]:
                              - heading "Compound plane alignment study" [level=3] [ref=e71]
                              - generic [ref=e72]:
                                - generic [ref=e73]:
                                  - strong [ref=e74]: Goal
                                  - paragraph [ref=e75]: Align the sharp-focus plane with all three separated critical faces using Front Tilt, Front Swing, and Focus Distance.
                                - generic [ref=e76]:
                                  - strong [ref=e77]: Try
                                  - paragraph [ref=e78]: Apply Front Tilt and Front Swing together, then refocus. Compare Ground Glass, Focus Distribution, Side, Top, and Scheimpflug Section.
                                - generic [ref=e79]:
                                  - strong [ref=e80]: Observe
                                  - paragraph [ref=e81]: Both orientation controls are active. Near-left is Soft, Centre is Soft, and Far-right is Soft; Near-left is currently strongest.
                                - generic [ref=e82]:
                                  - strong [ref=e83]: Why it matters
                                  - paragraph [ref=e84]: Front Tilt and Front Swing supply the two orientation components of the compound plane. Focus Distance then positions that plane at the subject.
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
                            - generic: 490.0 mm focus / CoC 0.072 mm (28%)
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
              - paragraph [ref=e137]: "Side view | Rise: 0.0 mm | Tilt: 2.0° | Swing: -2.0°"
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
                  - generic [ref=e154]: Near detail
                  - generic [ref=e158]: Target
                  - generic [ref=e162]: Far detail
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
                  - generic [ref=e188]: Near detail
                  - generic [ref=e192]: Target
                  - generic [ref=e196]: Far detail
                - generic [ref=e198]:
                  - generic [ref=e200]: Current
                  - generic [ref=e201]: Original
              - generic "Optical depth order" [ref=e202]:
                - generic [ref=e205]: Film 0 mm
                - generic [ref=e208]: Scheimpflug intersection 0 mm
                - generic [ref=e211]: Lens 216 mm
                - generic [ref=e214]: DOF limit 701 mm
                - generic [ref=e217]: Focus 705 mm
                - generic [ref=e220]: Far DOF 709 mm
            - region "Focus distribution · Focus" [ref=e222]:
              - generic [ref=e223]:
                - heading "Focus distribution" [level=4] [ref=e224]
                - 'generic "Ground Glass orientation: Raw" [ref=e225]': Raw
              - table "Focus distribution" [ref=e226]:
                - caption [ref=e227]: Focus distribution
                - rowgroup [ref=e228]:
                  - 'row "Upper left Upper left · Near detail: 28% · Soft" [ref=e229]':
                    - 'cell "Upper left Upper left · Near detail: 28% · Soft" [ref=e230]':
                      - generic "Upper left" [ref=e231]
                      - 'group "Upper left · Near detail: 28% · Soft" [ref=e233]':
                        - generic "Near detail" [ref=e235]
                        - generic [ref=e236]:
                          - text: 28%
                          - generic [ref=e237]: —
                    - cell [ref=e238]
                    - cell [ref=e239]
                  - 'row "Centre Centre · Target: 0% · Soft Middle right Middle right · Far detail: 0% · Soft" [ref=e240]':
                    - cell [ref=e241]
                    - 'cell "Centre Centre · Target: 0% · Soft" [ref=e242]':
                      - generic "Centre" [ref=e243]
                      - 'group "Centre · Target: 0% · Soft" [ref=e245]':
                        - generic "Target" [ref=e247]
                        - generic [ref=e248]:
                          - text: 0%
                          - generic [ref=e249]: —
                    - 'cell "Middle right Middle right · Far detail: 0% · Soft" [ref=e250]':
                      - generic "Middle right" [ref=e251]
                      - 'group "Middle right · Far detail: 0% · Soft" [ref=e253]':
                        - generic "Far detail" [ref=e255]
                        - generic [ref=e256]:
                          - text: 0%
                          - generic [ref=e257]: —
                  - row [ref=e258]:
                    - cell [ref=e259]
                    - cell [ref=e260]
                    - cell [ref=e261]
          - group [ref=e264]:
            - generic "Optical Debug macro-compound-movements · scheimpflug" [ref=e265] [cursor=pointer]:
              - generic [ref=e266]: Optical Debug
              - generic [ref=e267]: macro-compound-movements · scheimpflug
        - complementary [ref=e268]:
          - generic [ref=e269]:
            - region "Camera Controls" [ref=e270]:
              - heading "Camera Controls" [level=3] [ref=e272]
              - generic [ref=e273]:
                - region "Movement" [ref=e275]:
                  - generic [ref=e276]:
                    - heading "Front standard" [level=4] [ref=e277]
                    - button "Help" [ref=e278] [cursor=pointer]:
                      - generic [ref=e279]: "?"
                  - generic [ref=e280]:
                    - generic [ref=e281]:
                      - generic [ref=e282]: Tilt
                      - slider "Tilt" [active] [ref=e283]: "2"
                      - generic [ref=e284]: 2.0°
                    - generic [ref=e285]:
                      - generic [ref=e286]: Swing
                      - slider "Swing" [ref=e287]: "-2"
                      - generic [ref=e288]: "-2.0°"
                - region "Focus" [ref=e290]:
                  - heading "Focus" [level=3] [ref=e291]
                  - generic [ref=e292]:
                    - generic [ref=e293]: Focus distance
                    - slider "Focus distance" [ref=e294]: "490"
                    - generic [ref=e295]: 490.0 mm
                - region "Aperture" [ref=e297]:
                  - heading "Aperture" [level=3] [ref=e298]
                  - radiogroup "Aperture" [disabled] [ref=e299]:
                    - generic [ref=e300]:
                      - radio "f/5.6" [checked] [disabled] [ref=e301]
                      - generic [ref=e302]: f/5.6
                    - generic [ref=e303]:
                      - radio "f/8" [disabled] [ref=e304]
                      - generic [ref=e305]: f/8
                    - generic [ref=e306]:
                      - radio "f/11" [disabled] [ref=e307]
                      - generic [ref=e308]: f/11
                    - generic [ref=e309]:
                      - radio "f/16" [disabled] [ref=e310]
                      - generic [ref=e311]: f/16
                    - generic [ref=e312]:
                      - radio "f/22" [disabled] [ref=e313]
                      - generic [ref=e314]: f/22
                    - generic [ref=e315]:
                      - radio "f/32" [disabled] [ref=e316]
                      - generic [ref=e317]: f/32
                  - generic [ref=e318]: Aperture is fixed for this lesson
                - generic [ref=e319]:
                  - generic [ref=e320]: Reset
                  - region "Reset" [ref=e321]:
                    - button "Reset movements" [ref=e323] [cursor=pointer]
            - region "Developer Tools" [ref=e324]:
              - heading "Developer Tools" [level=3] [ref=e325]
              - generic [ref=e327]:
                - checkbox "Raw RTT — bypass DOF" [ref=e328]
                - text: Raw RTT — bypass DOF
          - region "Macro focus" [ref=e330]:
            - heading "Macro focus" [level=3] [ref=e331]
            - generic [ref=e332]:
              - generic [ref=e333]:
                - term [ref=e334]: Bellows extension (lens to film)
                - definition [ref=e335]: 216.2 mm
              - generic [ref=e336]:
                - term [ref=e337]: Magnification
                - definition [ref=e338]: 0.44×
              - generic [ref=e339]:
                - term [ref=e340]: Bellows factor
                - definition [ref=e341]: 2.08×
              - generic [ref=e342]:
                - term [ref=e343]: Exposure compensation
                - definition [ref=e344]: +1.05 stops
            - generic [ref=e345]: At the selected focus plane. Exposure compensation assumes a symmetric thin lens.
```

# Test source

```ts
  1  | import { expect, type Locator } from "@playwright/test";
  2  |
  3  | export const setPublicRangeInput = async (slider: Locator, target: number): Promise<void> => {
  4  |   const [minimumText, maximumText, stepText] = await Promise.all([
  5  |     slider.getAttribute("min"),
  6  |     slider.getAttribute("max"),
  7  |     slider.getAttribute("step"),
  8  |   ]);
  9  |   const minimum = Number(minimumText);
  10 |   const maximum = Number(maximumText);
  11 |   const step = Number(stepText);
  12 |   const stepsFromMinimum = (target - minimum) / step;
  13 |   if (
  14 |     ![minimum, maximum, step, target].every(Number.isFinite) ||
  15 |     step <= 0 ||
  16 |     target < minimum ||
  17 |     target > maximum ||
  18 |     Math.abs(stepsFromMinimum - Math.round(stepsFromMinimum)) >= 1e-8
  19 |   ) {
  20 |     throw new Error(`${target} is not a reachable public value for this range input`);
  21 |   }
  22 |   await slider.focus();
> 23 |   await slider.evaluate((element, value) => {
     |                ^ Error: locator.evaluate: Test timeout of 120000ms exceeded.
  24 |     const input = element as HTMLInputElement;
  25 |     const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  26 |     if (!setter) throw new Error("Range input value setter unavailable");
  27 |     setter.call(input, String(value));
  28 |     input.dispatchEvent(new Event("input", { bubbles: true }));
  29 |     input.dispatchEvent(new Event("change", { bubbles: true }));
  30 |   }, target);
  31 |   await expect.poll(() => slider.inputValue(), { timeout: 15_000 }).toBe(String(target));
  32 | };
  33 |
```