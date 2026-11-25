# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-tilt.spec.ts >> Table Tilt zero-tilt point focus moves from near to middle to far
- Location: src/tests/e2e/table-tilt.spec.ts:250:1

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.getAttribute: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByTestId('focus-distribution-panel').locator('[data-focus-target-id="near-cup"]')

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
          - generic [ref=e12]: Table Tilt
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
                            - paragraph [ref=e70]: Use Front Tilt and Focus to align the plane of sharp focus with the three coplanar focus cards above the tabletop.
                            - list [ref=e71]:
                              - listitem [ref=e72]: At 0° Front Tilt, move Focus from the near card through the middle notebook to the far chart.
                              - listitem [ref=e73]: Apply positive Front Tilt and watch the plane of sharp focus rotate through the focus-card surfaces.
                              - listitem [ref=e74]: Refine Focus until all three patches—not only their centre points—are covered.
                              - listitem [ref=e75]: Compare f/11 and f/22, but do not rely on f/32 to solve the exercise.
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
                        - checkbox "Grid" [checked] [ref=e100]
                        - generic [ref=e101]: Grid
                - generic "GroundGlassViewport" [ref=e102]:
                  - generic [ref=e104]:
                    - generic [ref=e105]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e106]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 5900.0 mm focus / CoC 0.311 mm (0%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e110] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e111]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e112] [cursor=pointer]:
                    - generic [ref=e113]: open_in_new
            - generic [ref=e115]:
              - generic [ref=e116]:
                - heading "2D Geometry" [level=2] [ref=e117]
                - generic [ref=e118]:
                  - group "Geometry view" [ref=e119]:
                    - button "Side" [pressed] [ref=e120] [cursor=pointer]
                    - button "Top" [ref=e121] [cursor=pointer]
                    - button "Scheimpflug Section" [ref=e122] [cursor=pointer]
                  - group "Geometry framing" [ref=e123]:
                    - button "Fit Scene" [pressed] [ref=e124] [cursor=pointer]
                    - button "Fit Construction" [disabled] [ref=e125]
                  - button "Expand 2D Geometry" [ref=e126] [cursor=pointer]:
                    - generic [ref=e127]: open_in_new
              - paragraph [ref=e128]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e130]:
                - generic [ref=e131]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e132]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e133]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e134]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e135]
                  - generic [ref=e137]: Optical axis
                  - generic [ref=e139]: Tabletop
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e140]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e143]: Focus plane
                  - generic [ref=e147]: Near card
                  - generic [ref=e151]: Middle notebook
                  - generic [ref=e155]: Far chart
              - generic "Optical depth order" [ref=e157]:
                - generic [ref=e160]: Film 0 mm
                - generic [ref=e163]: Lens 154 mm
                - generic [ref=e166]: DOF limit 4.8 m
                - generic [ref=e169]: Focus 6.1 m
                - generic [ref=e172]: Far DOF > 6.8 m
            - region "Focus distribution · Point focus" [ref=e174]:
              - generic [ref=e175]:
                - heading "Focus distribution" [level=4] [ref=e176]
                - 'generic "Ground Glass orientation: Raw" [ref=e177]': Raw
              - table "Focus distribution" [ref=e178]:
                - caption [ref=e179]: Focus distribution
                - rowgroup [ref=e180]:
                  - 'row "Upper centre Upper centre · Near card: 0% · Soft Upper centre · Middle notebook: 0% · Soft Upper centre · Far chart: 100% · Sharp · Closest point" [ref=e181]':
                    - cell [ref=e182]
                    - 'cell "Upper centre Upper centre · Near card: 0% · Soft Upper centre · Middle notebook: 0% · Soft Upper centre · Far chart: 100% · Sharp · Closest point" [ref=e183]':
                      - generic "Upper centre" [ref=e184]
                      - generic [ref=e185]:
                        - 'group "Upper centre · Near card: 0% · Soft" [ref=e186]':
                          - generic "Near card" [ref=e188]
                          - generic [ref=e189]:
                            - text: 0%
                            - generic [ref=e190]: —
                        - 'group "Upper centre · Middle notebook: 0% · Soft" [ref=e191]':
                          - generic "Middle notebook" [ref=e193]
                          - generic [ref=e194]:
                            - text: 0%
                            - generic [ref=e195]: —
                        - 'group "Upper centre · Far chart: 100% · Sharp · Closest point" [ref=e196]':
                          - generic "Far chart" [ref=e198]
                          - generic [ref=e199]:
                            - text: 100%
                            - generic [ref=e200]: ✓
                    - cell [ref=e201]
                  - row [ref=e202]:
                    - cell [ref=e203]
                    - cell [ref=e204]
                    - cell [ref=e205]
                  - row [ref=e206]:
                    - cell [ref=e207]
                    - cell [ref=e208]
                    - cell [ref=e209]
          - group [ref=e212]:
            - generic "Optical Debug table-tilt · parallel" [ref=e213] [cursor=pointer]:
              - generic [ref=e214]: Optical Debug
              - generic [ref=e215]: table-tilt · parallel
        - complementary [ref=e216]:
          - generic [ref=e217]:
            - region "Camera Controls" [ref=e218]:
              - heading "Camera Controls" [level=3] [ref=e220]
              - generic [ref=e221]:
                - region "Movement" [ref=e223]:
                  - generic [ref=e224]:
                    - heading "Front standard" [level=4] [ref=e225]
                    - button "Help" [ref=e226] [cursor=pointer]:
                      - generic [ref=e227]: "?"
                  - generic [ref=e228]:
                    - generic [ref=e229]:
                      - generic [ref=e230]: Rise
                      - slider "Rise" [ref=e231]: "0"
                      - generic [ref=e232]: 0.0 mm
                    - generic [ref=e233]:
                      - generic [ref=e234]: Tilt
                      - slider "Tilt" [ref=e235]: "0"
                      - generic [ref=e236]: 0.0°
                    - generic [ref=e237]:
                      - generic [ref=e238]: Swing
                      - slider "Swing" [ref=e239]: "0"
                      - generic [ref=e240]: 0.0°
                - region "Focus" [ref=e242]:
                  - heading "Focus" [level=3] [ref=e243]
                  - generic [ref=e244]:
                    - generic [ref=e245]: Focus distance
                    - slider "Focus distance" [ref=e246]: "5900"
                    - generic [ref=e247]: 5900.0 mm
                    - button "Infinity Reset" [ref=e249] [cursor=pointer]: ∞
                - region "Aperture" [ref=e251]:
                  - heading "Aperture" [level=3] [ref=e252]
                  - radiogroup "Aperture" [ref=e253]:
                    - generic [ref=e254] [cursor=pointer]:
                      - radio "f/5.6" [ref=e255]
                      - generic [ref=e256]: f/5.6
                    - generic [ref=e257] [cursor=pointer]:
                      - radio "f/8" [ref=e258]
                      - generic [ref=e259]: f/8
                    - generic [ref=e260] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e261]
                      - generic [ref=e262]: f/11
                    - generic [ref=e263] [cursor=pointer]:
                      - radio "f/16" [ref=e264]
                      - generic [ref=e265]: f/16
                    - generic [ref=e266] [cursor=pointer]:
                      - radio "f/22" [ref=e267]
                      - generic [ref=e268]: f/22
                    - generic [ref=e269] [cursor=pointer]:
                      - radio "f/32" [ref=e270]
                      - generic [ref=e271]: f/32
                - generic [ref=e272]:
                  - generic [ref=e273]: Reset
                  - region "Reset" [ref=e274]:
                    - button "Reset movements" [ref=e276] [cursor=pointer]
            - region "Developer Tools" [ref=e277]:
              - heading "Developer Tools" [level=3] [ref=e278]
              - generic [ref=e280]:
                - checkbox "Raw RTT — bypass DOF" [ref=e281]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1  | import { expect, type Locator, type Page } from "@playwright/test";
  2  |
  3  | const focusDistributionPanel = (page: Page) =>
  4  |   page.getByTestId("focus-distribution-panel");
  5  |
  6  | type FocusDistributionTargetQuery = {
  7  |   targetId: string;
  8  | };
  9  |
  10 | const focusDistributionTarget = (page: Page, targetId: string): Locator =>
  11 |   focusDistributionPanel(page).locator(`[data-focus-target-id="${targetId}"]`);
  12 |
  13 | export const readFocusDistributionPercent = async (
  14 |   page: Page,
  15 |   { targetId }: FocusDistributionTargetQuery,
  16 | ): Promise<number> => {
  17 |   const target = focusDistributionTarget(page, targetId);
  18 |   await expect(target).toHaveCount(1);
  19 |   await expect(target).toBeVisible();
> 20 |   const label = await target.getAttribute("aria-label");
     |                              ^ Error: locator.getAttribute: Test timeout of 90000ms exceeded.
  21 |   const match = label?.match(/(\d+)%/);
  22 |   if (!match) throw new Error(`Focus distribution cell has no percentage: ${label ?? "(missing label)"}`);
  23 |   return Number(match[1]);
  24 | };
  25 |
  26 | export const readFocusDistributionScores = async (
  27 |   page: Page,
  28 |   targetIds: readonly string[],
  29 | ): Promise<Record<string, number>> =>
  30 |   Object.fromEntries(
  31 |     await Promise.all(
  32 |       targetIds.map(async (targetId) => [
  33 |         targetId,
  34 |         await readFocusDistributionPercent(page, { targetId }),
  35 |       ] as const),
  36 |     ),
  37 |   );
  38 |
```