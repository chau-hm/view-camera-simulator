# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ground-glass-dof-stability.spec.ts >> Architecture + Foreground DOF remains finite through a transition sequence
- Location: src/tests/e2e/ground-glass-dof-stability.spec.ts:92:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByLabel('Focus distance')
    - locator resolved to visible <input step="10" min="3500" id="_r_l_" max="12500" type="range" value="6830" aria-valuetext="6830.0 mm" aria-label="Focus distance" class="range-slider compact-range-row__slider"/>

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
                            - generic: 6830.0 mm focus / CoC 0.159 mm (0%)
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
              - paragraph [ref=e106]: "Side view | Rise: 20.0 mm | Tilt: 6.6° | Swing: 0.0°"
              - img [ref=e108]:
                - generic [ref=e109]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e110]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e111]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e112]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e113]
                  - generic [ref=e115]: Optical axis
                  - generic [ref=e117]: Foreground ground
                  - generic [ref=e119]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e120]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e126]: Near foreground
                  - generic [ref=e130]: Middle foreground
                  - generic [ref=e134]: Building base
                  - generic [ref=e138]: Building middle
                - generic [ref=e140]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e141]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e142]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e143]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e144]
                  - generic [ref=e147]: Optical axis
                  - generic [ref=e149]: Foreground ground
                  - generic [ref=e151]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic "lens plane" [ref=e154]
                  - generic "focus plane" [ref=e156]
                  - generic "nearDof plane" [ref=e158]
                  - generic "farDof plane" [ref=e160]
                  - generic "Simplified bellows connector" [ref=e162]
                  - generic "chief ray from film centre through lens centre" [ref=e166]
                  - generic [ref=e170]: Near foreground
                  - generic [ref=e174]: Middle foreground
                  - generic [ref=e178]: Building base
                  - generic [ref=e182]: Building middle
                - generic [ref=e184]:
                  - generic [ref=e186]: Current
                  - generic [ref=e187]: Original
              - generic "Optical depth order" [ref=e188]:
                - generic [ref=e191]: Film 0 mm
                - generic [ref=e194]: Scheimpflug intersection 0 mm
                - generic [ref=e197]: Lens 152 mm
                - generic [ref=e200]: DOF limit 5.3 m
                - generic [ref=e203]: Focus 6.9 m
                - generic [ref=e206]: Far DOF 10.2 m
            - region "Focus distribution · Focus" [ref=e208]:
              - generic [ref=e209]:
                - heading "Focus distribution" [level=4] [ref=e210]
                - 'generic "Ground Glass orientation: Raw" [ref=e211]': Raw
              - table "Focus distribution" [ref=e212]:
                - caption [ref=e213]: Focus distribution
                - rowgroup [ref=e214]:
                  - 'row "Upper centre Upper centre · Building base: 46% · Soft" [ref=e215]':
                    - cell [ref=e216]
                    - 'cell "Upper centre Upper centre · Building base: 46% · Soft" [ref=e217]':
                      - generic "Upper centre" [ref=e218]
                      - 'group "Upper centre · Building base: 46% · Soft" [ref=e220]':
                        - generic "Building base" [ref=e222]
                        - generic [ref=e223]:
                          - text: 46%
                          - generic [ref=e224]: —
                    - cell [ref=e225]
                  - 'row "Centre Centre · Building middle: 0% · Soft" [ref=e226]':
                    - cell [ref=e227]
                    - 'cell "Centre Centre · Building middle: 0% · Soft" [ref=e228]':
                      - generic "Centre" [ref=e229]
                      - 'group "Centre · Building middle: 0% · Soft" [ref=e231]':
                        - generic "Building middle" [ref=e233]
                        - generic [ref=e234]:
                          - text: 0%
                          - generic [ref=e235]: —
                    - cell [ref=e236]
                  - row [ref=e237]:
                    - cell [ref=e238]
                    - cell [ref=e239]
                    - cell [ref=e240]
              - generic "Focus targets outside current Ground Glass view" [ref=e241]:
                - generic [ref=e242]: Outside current Ground Glass view
                - generic [ref=e243]:
                  - 'group "Outside current Ground Glass view · Near foreground: 0% · Soft" [ref=e244]':
                    - generic [ref=e245]: Near foreground
                    - strong [ref=e246]: 0%
                    - generic [ref=e247]: —
                  - 'group "Outside current Ground Glass view · Middle foreground: 0% · Soft" [ref=e248]':
                    - generic [ref=e249]: Middle foreground
                    - strong [ref=e250]: 0%
                    - generic [ref=e251]: —
          - group [ref=e254]:
            - generic "Optical Debug architecture-foreground · scheimpflug" [ref=e255] [cursor=pointer]:
              - generic [ref=e256]: Optical Debug
              - generic [ref=e257]: architecture-foreground · scheimpflug
        - complementary [ref=e258]:
          - generic [ref=e259]:
            - region "Camera Controls" [ref=e260]:
              - heading "Camera Controls" [level=3] [ref=e262]
              - paragraph [ref=e263]:
                - generic [ref=e264]: 🔒
                - generic [ref=e265]: Disabled for this guided task
              - generic [ref=e266]:
                - region "Movement" [ref=e268]:
                  - generic [ref=e269]:
                    - heading "Front standard" [level=4] [ref=e270]
                    - button "Help" [ref=e271] [cursor=pointer]:
                      - generic [ref=e272]: "?"
                  - generic [ref=e273]:
                    - generic [ref=e274]:
                      - generic [ref=e275]: Rise
                      - slider "Rise" [ref=e276]: "20"
                      - generic [ref=e277]: 20.0 mm
                    - generic [ref=e278]:
                      - generic [ref=e279]: Tilt
                      - slider "Tilt" [active] [ref=e280]: "6.6"
                      - generic [ref=e281]: 6.6°
                    - generic [ref=e282]:
                      - generic [ref=e283]: Swing
                      - slider "Swing" [disabled] [ref=e284]: "0"
                      - generic [ref=e285]: 0.0°
                - region "Focus" [ref=e287]:
                  - heading "Focus" [level=3] [ref=e288]
                  - generic [ref=e289]:
                    - generic [ref=e290]: Focus distance
                    - slider "Focus distance" [ref=e291]: "6830"
                    - generic [ref=e292]: 6830.0 mm
                - region "Aperture" [ref=e294]:
                  - heading "Aperture" [level=3] [ref=e295]
                  - radiogroup "Aperture" [ref=e296]:
                    - generic [ref=e297] [cursor=pointer]:
                      - radio "f/5.6" [ref=e298]
                      - generic [ref=e299]: f/5.6
                    - generic [ref=e300] [cursor=pointer]:
                      - radio "f/8" [ref=e301]
                      - generic [ref=e302]: f/8
                    - generic [ref=e303] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e304]
                      - generic [ref=e305]: f/11
                    - generic [ref=e306] [cursor=pointer]:
                      - radio "f/16" [ref=e307]
                      - generic [ref=e308]: f/16
                    - generic [ref=e309] [cursor=pointer]:
                      - radio "f/22" [ref=e310]
                      - generic [ref=e311]: f/22
                    - generic [ref=e312] [cursor=pointer]:
                      - radio "f/32" [ref=e313]
                      - generic [ref=e314]: f/32
                - generic [ref=e315]:
                  - generic [ref=e316]: Reset
                  - region "Reset" [ref=e317]:
                    - button "Reset movements" [ref=e319] [cursor=pointer]
            - region "Developer Tools" [ref=e320]:
              - heading "Developer Tools" [level=3] [ref=e321]
              - generic [ref=e323]:
                - checkbox "Raw RTT — bypass DOF" [ref=e324]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1  | import type { Page } from "@playwright/test";
  2  | 
  3  | export const setRangeDirect = async (page: Page, label: string, target: number) => {
> 4  |   await page.getByLabel(label).evaluate((element, value) => {
     |                                ^ Error: locator.evaluate: Test timeout of 120000ms exceeded.
  5  |     const input = element as HTMLInputElement;
  6  |     const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  7  |     if (!setter) throw new Error("Range input value setter unavailable");
  8  |     setter.call(input, String(value));
  9  |     input.dispatchEvent(new Event("input", { bubbles: true }));
  10 |   }, target);
  11 | };
  12 | 
```