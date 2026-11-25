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
Error: expect(locator).toHaveCSS(expected) failed

Locator: getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')
Expected pattern: /^matrix\(1, 0, 0, 1, 0, 0\)$/
Received string:  ""

Call log:
  - Expect "toHaveCSS" with timeout 5000ms
  - waiting for getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')

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
                    - button "Task and Feedback — Task completed" [expanded]:
                      - generic: Task and Feedback
                      - generic: ✓
                    - generic [ref=e54]:
                      - generic [ref=e55]:
                        - group "Task and Feedback views" [ref=e56]:
                          - button "Task" [pressed] [ref=e57] [cursor=pointer]
                          - button "Feedback — Task completed" [ref=e58] [cursor=pointer]:
                            - text: Feedback
                            - generic [ref=e59]: ✓
                        - generic [ref=e60]:
                          - button "Keep Task and Feedback open" [ref=e61] [cursor=pointer]:
                            - generic [ref=e62]: push_pin
                          - button "Close Task and Feedback" [ref=e63] [cursor=pointer]:
                            - generic [ref=e64]: close
                      - generic "Task" [ref=e66]:
                        - region "Task" [ref=e67]:
                          - generic [ref=e68]:
                            - generic [ref=e70]: Guided task
                            - heading "Frame the building with Front Rise" [level=3] [ref=e71]
                            - paragraph [ref=e72]: Keep the camera level and use Front Rise to include the building top without changing the whole-camera viewpoint.
                            - generic [ref=e73]:
                              - strong [ref=e74]: "Allowed controls:"
                              - text: Front RiseFocusAperture2D Geometry
                            - group [ref=e75]:
                              - generic "View requirements" [ref=e76] [cursor=pointer]
            - generic "GroundGlassColumn" [ref=e77]:
              - generic [ref=e78]:
                - generic [ref=e80]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e81]
              - generic [ref=e82]:
                - generic [ref=e84]:
                  - group "Preview" [ref=e85]:
                    - generic [ref=e86]: Preview
                    - generic [ref=e88]:
                      - generic [ref=e89]:
                        - radio "Raw Ground Glass" [checked] [ref=e90]
                        - generic [ref=e91]: Raw Ground Glass
                      - generic [ref=e92]:
                        - radio "Upright Assist" [ref=e93]
                        - generic [ref=e94]: Upright Assist
                  - group "View Options" [ref=e95]:
                    - generic [ref=e96]: View Options
                    - region "View Options" [ref=e98]:
                      - generic [ref=e100]:
                        - checkbox "Grid" [checked] [disabled] [ref=e101]
                        - generic [ref=e102]: Grid
                        - generic [ref=e103]: Disabled for this guided task
                - generic "GroundGlassViewport" [ref=e104]:
                  - generic [ref=e106]:
                    - generic [ref=e107]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e108]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 8890.0 mm focus / CoC 0.000 mm (100%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e112] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e113]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e114] [cursor=pointer]:
                    - generic [ref=e115]: open_in_new
            - generic [ref=e117]:
              - generic [ref=e118]:
                - heading "2D Geometry" [level=2] [ref=e119]
                - generic [ref=e120]:
                  - group "Geometry view" [ref=e121]:
                    - button "Side" [pressed] [ref=e122] [cursor=pointer]
                    - button "Top" [ref=e123] [cursor=pointer]
                  - group "Geometry framing" [ref=e124]:
                    - button "Fit Scene" [pressed] [ref=e125] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e126] [cursor=pointer]:
                    - generic [ref=e127]: open_in_new
              - paragraph [ref=e128]: "Side view | Rise: 12.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e130]:
                - generic [ref=e131]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e132]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e133]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e134]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e135]
                  - generic [ref=e137]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic "Simplified bellows connector" [ref=e139]
                  - generic "chief ray from film centre through lens centre" [ref=e142]
                  - generic [ref=e146]: Building mid facade
              - generic "Optical depth order" [ref=e148]:
                - generic [ref=e151]: Film 0 mm
                - generic [ref=e154]: Lens 153 mm
                - generic [ref=e157]: DOF limit 6.4 m
                - generic [ref=e160]: Focus 9.0 m
                - generic [ref=e163]: Far DOF > 13.3 m
            - region "Focus distribution · Focus" [ref=e165]:
              - generic [ref=e166]:
                - heading "Focus distribution" [level=4] [ref=e167]
                - 'generic "Ground Glass orientation: Raw" [ref=e168]': Raw
              - table "Focus distribution" [ref=e169]:
                - caption [ref=e170]: Focus distribution
                - rowgroup [ref=e171]:
                  - row [ref=e172]:
                    - cell [ref=e173]
                    - cell [ref=e174]
                    - cell [ref=e175]
                  - 'row "Centre Centre · Building mid facade: 100% · Sharp" [ref=e176]':
                    - cell [ref=e177]
                    - 'cell "Centre Centre · Building mid facade: 100% · Sharp" [ref=e178]':
                      - generic "Centre" [ref=e179]
                      - 'group "Centre · Building mid facade: 100% · Sharp" [ref=e181]':
                        - generic "Building mid facade" [ref=e183]
                        - generic [ref=e184]:
                          - text: 100%
                          - generic [ref=e185]: ✓
                    - cell [ref=e186]
                  - row [ref=e187]:
                    - cell [ref=e188]
                    - cell [ref=e189]
                    - cell [ref=e190]
          - group [ref=e193]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e194] [cursor=pointer]:
              - generic [ref=e195]: Optical Debug
              - generic [ref=e196]: architecture-rise · parallel
        - complementary [ref=e197]:
          - generic [ref=e198]:
            - region "Camera Controls" [ref=e199]:
              - heading "Camera Controls" [level=3] [ref=e201]
              - paragraph [ref=e202]:
                - generic [ref=e203]: 🔒
                - generic [ref=e204]: Disabled for this guided task
              - generic [ref=e205]:
                - region "Movement" [ref=e207]:
                  - generic [ref=e208]:
                    - heading "Front standard" [level=4] [ref=e209]
                    - button "Help" [ref=e210] [cursor=pointer]:
                      - generic [ref=e211]: "?"
                  - generic [ref=e212]:
                    - generic [ref=e213]:
                      - generic [ref=e214]: Rise
                      - slider "Rise" [active] [ref=e215]: "12"
                      - generic [ref=e216]: 12.0 mm
                    - generic [ref=e217]:
                      - generic [ref=e218]: Tilt
                      - slider "Tilt" [disabled] [ref=e219]: "0"
                      - generic [ref=e220]: 0.0°
                    - generic [ref=e221]:
                      - generic [ref=e222]: Swing
                      - slider "Swing" [disabled] [ref=e223]: "0"
                      - generic [ref=e224]: 0.0°
                - region "Focus" [ref=e226]:
                  - heading "Focus" [level=3] [ref=e227]
                  - generic [ref=e228]:
                    - generic [ref=e229]: Focus distance
                    - slider "Focus distance" [ref=e230]: "8890"
                    - generic [ref=e231]: 8890.0 mm
                    - button "Infinity Reset" [ref=e233] [cursor=pointer]: ∞
                - region "Aperture" [ref=e235]:
                  - heading "Aperture" [level=3] [ref=e236]
                  - radiogroup "Aperture" [ref=e237]:
                    - generic [ref=e238] [cursor=pointer]:
                      - radio "f/5.6" [ref=e239]
                      - generic [ref=e240]: f/5.6
                    - generic [ref=e241] [cursor=pointer]:
                      - radio "f/8" [ref=e242]
                      - generic [ref=e243]: f/8
                    - generic [ref=e244] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e245]
                      - generic [ref=e246]: f/11
                    - generic [ref=e247] [cursor=pointer]:
                      - radio "f/16" [ref=e248]
                      - generic [ref=e249]: f/16
                    - generic [ref=e250] [cursor=pointer]:
                      - radio "f/22" [ref=e251]
                      - generic [ref=e252]: f/22
                    - generic [ref=e253] [cursor=pointer]:
                      - radio "f/32" [ref=e254]
                      - generic [ref=e255]: f/32
                - generic [ref=e256]:
                  - generic [ref=e257]: Reset
                  - region "Reset" [ref=e258]:
                    - generic [ref=e259]:
                      - button "Reset movements" [ref=e260] [cursor=pointer]
                      - button "Restart task" [ref=e261] [cursor=pointer]
            - region "Developer Tools" [ref=e262]:
              - heading "Developer Tools" [level=3] [ref=e263]
              - generic [ref=e265]:
                - checkbox "Raw RTT — bypass DOF" [ref=e266]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1  | import { expect, type Locator, type Page } from "@playwright/test";
  2  |
  3  | export const getLearningOverlay = (page: Page): Locator =>
  4  |   page.getByTestId("learning-overlay-panel");
  5  |
  6  | export const getLearningRail = (page: Page): Locator =>
  7  |   getLearningOverlay(page).locator(".learning-overlay-panel__rail");
  8  |
  9  | export const getLearningDrawer = (page: Page): Locator =>
  10 |   getLearningOverlay(page).getByTestId("learning-overlay-drawer");
  11 |
  12 | export const openLearningDrawer = async (page: Page): Promise<Locator> => {
  13 |   const overlay = getLearningOverlay(page);
  14 |   const drawer = getLearningDrawer(page);
  15 |   if (!(await drawer.isVisible())) {
  16 |     await getLearningRail(page).hover();
  17 |   }
  18 |   await expect(drawer).toBeVisible();
  19 |   if (await overlay.getAttribute("data-drawer-state") === "transient") {
> 20 |     await expect(drawer).toHaveCSS("transform", /^matrix\(1, 0, 0, 1, 0, 0\)$/);
     |                          ^ Error: expect(locator).toHaveCSS(expected) failed
  21 |   }
  22 |   return drawer;
  23 | };
  24 |
  25 | export const openPinnedLearningDrawer = async (page: Page): Promise<Locator> => {
  26 |   const overlay = getLearningOverlay(page);
  27 |   const drawer = getLearningDrawer(page);
  28 |   const currentState = await overlay.getAttribute("data-drawer-state");
  29 |   if (currentState === "flow") {
  30 |     await expect(drawer).toBeVisible();
  31 |     return drawer;
  32 |   }
  33 |   if (currentState !== "pinned") {
  34 |     await getLearningRail(page).focus();
  35 |     await expect(drawer).toBeVisible();
  36 |     await expect(drawer).toHaveCSS("transform", /^matrix\(1, 0, 0, 1, 0, 0\)$/);
  37 |     await page.getByRole("button", { name: "Keep Task and Feedback open" }).click();
  38 |   }
  39 |   await expect(overlay).toHaveAttribute("data-drawer-state", "pinned");
  40 |   await expect(drawer).toBeVisible();
  41 |   return drawer;
  42 | };
  43 |
  44 | export const getLearningFeedbackButton = (page: Page): Locator =>
  45 |   getLearningDrawer(page).getByRole("button", {
  46 |     name: /^Feedback(?: — Task completed)?$/,
  47 |   });
  48 |
  49 | export const openLearningFeedback = async (page: Page): Promise<Locator> => {
  50 |   const drawer = await openLearningDrawer(page);
  51 |   await getLearningFeedbackButton(page).click();
  52 |   return drawer.getByTestId("learning-overlay-feedback-view");
  53 | };
  54 |
  55 | export const expectLearningFeedbackCompleted = async (page: Page): Promise<void> => {
  56 |   await openLearningDrawer(page);
  57 |   const button = getLearningFeedbackButton(page);
  58 |   await expect(button).toHaveAttribute("data-status", "completed");
  59 |   await expect(button).toHaveAccessibleName("Feedback — Task completed");
  60 | };
  61 |
  62 | export const expectLearningFeedbackNotCompleted = async (page: Page): Promise<void> => {
  63 |   await openLearningDrawer(page);
  64 |   const button = getLearningFeedbackButton(page);
  65 |   await expect(button).toHaveAttribute("data-status", "in-progress");
  66 |   await expect(button).toHaveAccessibleName("Feedback");
  67 | };
  68 |
```