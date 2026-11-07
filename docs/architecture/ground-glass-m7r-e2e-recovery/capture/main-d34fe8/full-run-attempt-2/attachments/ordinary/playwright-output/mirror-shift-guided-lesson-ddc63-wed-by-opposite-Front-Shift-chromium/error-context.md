# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mirror-shift-guided-lesson.spec.ts >> Mirror Shift guided task teaches camera movement followed by opposite Front Shift
- Location: src/tests/e2e/mirror-shift-guided-lesson.spec.ts:10:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.fill: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('slider', { name: 'Front Shift' })

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
          - generic [ref=e12]: Mirror Shift
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
                          - button "Keep Task and Feedback open" [ref=e60] [cursor=pointer]:
                            - generic [ref=e61]: push_pin
                          - button "Close Task and Feedback" [ref=e62] [cursor=pointer]:
                            - generic [ref=e63]: close
                      - generic "Task" [ref=e65]:
                        - region "Task" [ref=e66]:
                          - generic [ref=e67]:
                            - generic [ref=e69]: Guided task
                            - heading "Restore mirror framing after changing viewpoint" [level=3] [ref=e70]
                            - paragraph [ref=e71]: Move the whole camera sideways to clear its reflection, then use opposite Front Shift to restore the mirror framing while keeping the changed viewpoint.
                            - generic [ref=e72]:
                              - strong [ref=e73]: "Allowed controls:"
                              - text: Camera PositionFront Shift2D Geometry
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
                            - generic: 6000.0 mm focus
                      - button "Focus loupe · 4× Ground Glass view" [ref=e111] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e112]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e113] [cursor=pointer]:
                    - generic [ref=e114]: open_in_new
            - generic [ref=e116]:
              - generic [ref=e117]:
                - heading "2D Geometry" [level=2] [ref=e118]
                - generic [ref=e119]:
                  - group "Geometry view" [ref=e120]:
                    - button "Top" [pressed] [ref=e121] [cursor=pointer]
                  - group "Geometry framing" [ref=e122]:
                    - button "Fit Scene" [pressed] [ref=e123] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e124] [cursor=pointer]:
                    - generic [ref=e125]: open_in_new
              - paragraph [ref=e126]: "Top view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - generic [ref=e128]:
                - img "Mirror Shift top-view teaching geometry" [ref=e129]:
                  - generic [ref=e131]: Mirror aperture
                  - generic [ref=e132]:
                    - generic [ref=e133]: Neutral film
                    - generic [ref=e134]: Neutral lens
                  - generic [ref=e135]:
                    - generic [ref=e136]: Current film
                    - generic [ref=e137]: Current lens
                  - generic [ref=e140]: Camera Position
                  - generic [ref=e146]: Mirror-centre chief ray
                  - generic [ref=e152]: Top view · X lateral · Z optical depth
                - generic [ref=e153]:
                  - generic [ref=e154]: Neutral reference
                  - generic [ref=e156]: Current camera
                  - generic [ref=e158]: Mirror-centre chief ray
              - generic "Optical depth order" [ref=e160]:
                - generic [ref=e163]: Film 0 mm
                - generic [ref=e166]: Lens 122 mm
                - generic [ref=e169]: DOF limit 4.3 m
                - generic [ref=e172]: Focus 6.1 m
                - generic [ref=e175]: Far DOF > 9.3 m
          - group [ref=e178]:
            - generic "Optical Debug mirror-shift · parallel" [ref=e179] [cursor=pointer]:
              - generic [ref=e180]: Optical Debug
              - generic [ref=e181]: mirror-shift · parallel
        - complementary [ref=e182]:
          - generic [ref=e183]:
            - region "Camera Controls" [ref=e184]:
              - heading "Camera Controls" [level=3] [ref=e186]
              - generic [ref=e187]:
                - region "Camera Position" [ref=e189]:
                  - generic [ref=e190]: Camera Position
                  - generic [ref=e191]:
                    - generic [ref=e192]: "-1750.0 mm"
                    - slider "Camera Position" [active] [ref=e193]: "-1750"
                  - group "Camera Position direction" [ref=e194]:
                    - generic [ref=e195]: Left
                    - generic [ref=e196]: Right
                - region "Front Shift" [ref=e198]:
                  - generic [ref=e199]: Front Shift
                  - generic [ref=e200]:
                    - generic [ref=e201]: 0.0 mm
                    - slider "Front Shift" [ref=e202]: "0"
                  - group "Front Shift direction" [ref=e203]:
                    - generic [ref=e204]: Left
                    - generic [ref=e205]: Right
                - region "Focus" [ref=e207]:
                  - heading "Focus" [level=3] [ref=e208]
                  - generic [ref=e209]:
                    - generic [ref=e210]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e211]: "6000"
                    - generic [ref=e212]: 6000.0 mm
                  - generic [ref=e213]: Focus is fixed for this lesson
                - region "Aperture" [ref=e215]:
                  - heading "Aperture" [level=3] [ref=e216]
                  - radiogroup "Aperture" [disabled] [ref=e217]:
                    - generic [ref=e218]:
                      - radio "f/5.6" [disabled] [ref=e219]
                      - generic [ref=e220]: f/5.6
                    - generic [ref=e221]:
                      - radio "f/8" [disabled] [ref=e222]
                      - generic [ref=e223]: f/8
                    - generic [ref=e224]:
                      - radio "f/11" [checked] [disabled] [ref=e225]
                      - generic [ref=e226]: f/11
                    - generic [ref=e227]:
                      - radio "f/16" [disabled] [ref=e228]
                      - generic [ref=e229]: f/16
                    - generic [ref=e230]:
                      - radio "f/22" [disabled] [ref=e231]
                      - generic [ref=e232]: f/22
                    - generic [ref=e233]:
                      - radio "f/32" [disabled] [ref=e234]
                      - generic [ref=e235]: f/32
                  - generic [ref=e236]: Aperture is fixed for this lesson
                - generic [ref=e237]:
                  - generic [ref=e238]: Reset
                  - region "Reset" [ref=e239]:
                    - generic [ref=e240]:
                      - button "Reset movements" [ref=e241] [cursor=pointer]
                      - button "Restart task" [ref=e242] [cursor=pointer]
            - region "Developer Tools" [ref=e243]:
              - heading "Developer Tools" [level=3] [ref=e244]
              - generic [ref=e246]:
                - checkbox "Raw RTT — bypass DOF" [ref=e247]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | import {
  3   |   expectLearningFeedbackCompleted,
  4   |   expectLearningFeedbackNotCompleted,
  5   |   getLearningOverlay,
  6   |   openLearningDrawer,
  7   |   openLearningFeedback,
  8   | } from "./helpers/learningOverlay";
  9   | 
  10  | test("Mirror Shift guided task teaches camera movement followed by opposite Front Shift", async ({ page }) => {
  11  |   test.setTimeout(120_000);
  12  |   await page.goto("/simulator/guided/mirror-shift/mirror-shift-01?rttDiagnostics=1");
  13  | 
  14  |   const position = page.getByRole("slider", { name: "Camera Position" });
  15  |   const frontShift = page.getByRole("slider", { name: "Front Shift" });
  16  |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  17  |   const rtt = page.getByTestId("ground-glass-rtt").first();
  18  | 
  19  |   await expect(page).toHaveURL(/\/simulator\/guided\/mirror-shift\/mirror-shift-01/);
  20  |   const taskDrawer = await openLearningDrawer(page);
  21  |   await expect(
  22  |     taskDrawer.getByRole("heading", { name: "Restore mirror framing after changing viewpoint" }),
  23  |   ).toBeVisible();
  24  |   await expect(
  25  |     taskDrawer.getByText(
  26  |       "Move the whole camera sideways to clear its reflection, then use opposite Front Shift to restore the mirror framing while keeping the changed viewpoint.",
  27  |     ),
  28  |   ).toBeVisible();
  29  |   await expect(position).toHaveValue("0");
  30  |   await expect(frontShift).toHaveValue("0");
  31  |   await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  32  |   await expect(page.getByRole("slider", { name: "Tilt" })).toHaveCount(0);
  33  |   await expect(page.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  34  |   await expect(page.getByLabel("Focus distance")).toBeDisabled();
  35  |   await expect(aperture).toHaveAttribute("data-selected-aperture", "11");
  36  |   await expect(aperture).toBeDisabled();
  37  |   const initialFeedback = await openLearningFeedback(page);
  38  |   await expect(
  39  |     initialFeedback.getByRole("heading", {
  40  |       name: "Move the whole camera sideways until its reflection is completely outside the mirror.",
  41  |     }),
  42  |   ).toBeVisible();
  43  |   await getLearningOverlay(page).getByRole("button", { name: "Task", exact: true }).click();
  44  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  45  |   const resourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  46  |   expect(resourceGeneration).toBeTruthy();
  47  | 
  48  |   await position.fill("2000");
  49  |   await expect(position).toHaveValue("2000");
  50  |   const stageFeedback = await openLearningFeedback(page);
  51  |   await expect(
  52  |     stageFeedback.getByRole("heading", {
  53  |       name: "Good—the camera is out of the reflection. Keep it in place and apply opposite Front Shift to restore the mirror framing.",
  54  |     }),
  55  |   ).toBeVisible();
  56  |   await getLearningOverlay(page).getByRole("button", { name: "Task", exact: true }).click();
  57  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  58  |   await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  59  | 
  60  |   await frontShift.fill("-55");
  61  |   await expect(frontShift).toHaveValue("-55");
  62  |   await expectLearningFeedbackCompleted(page);
  63  |   const feedback = await openLearningFeedback(page);
  64  |   await expect(feedback.getByRole("heading", { name: "Task completed" })).toBeVisible();
  65  |   await expect(feedback).toContainText("The reflected props still differ from Neutral because the viewpoint changed.");
  66  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  67  |   await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  68  | 
  69  |   await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  70  |   const geometry = page.getByTestId("mirror-shift-teaching-svg");
  71  |   await expect(geometry).toBeVisible();
  72  |   await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "top");
  73  |   await expect(geometry).toHaveAttribute("data-current-film-x-mm", "2000");
  74  |   await expect(geometry).toHaveAttribute("data-current-lens-x-mm", "1945");
  75  |   await page.getByRole("button", { name: "Restore 2D Geometry" }).click();
  76  | 
  77  |   await page.getByRole("button", { name: "Restart task" }).click();
  78  |   await expect(position).toHaveValue("0");
  79  |   await expect(frontShift).toHaveValue("0");
  80  |   await expect(aperture).toHaveAttribute("data-selected-aperture", "11");
  81  |   await expectLearningFeedbackNotCompleted(page);
  82  |   const resetFeedback = await openLearningFeedback(page);
  83  |   await expect(resetFeedback.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  84  |   await expect(
  85  |     page.getByRole("heading", {
  86  |       name: "Move the whole camera sideways until its reflection is completely outside the mirror.",
  87  |     }),
  88  |   ).toBeVisible();
  89  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  90  |   await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  91  | 
  92  |   await getLearningOverlay(page).getByRole("button", { name: "Task", exact: true }).click();
  93  |   await position.fill("-1750");
> 94  |   await frontShift.fill("54");
      |                    ^ Error: locator.fill: Test timeout of 120000ms exceeded.
  95  |   await expect(position).toHaveValue("-1750");
  96  |   await expect(frontShift).toHaveValue("54");
  97  |   await expectLearningFeedbackNotCompleted(page);
  98  |   const visibleBoundaryFeedback = await openLearningFeedback(page);
  99  |   await expect(
  100 |     visibleBoundaryFeedback.getByRole("heading", {
  101 |       name: "Move the whole camera sideways until its reflection is completely outside the mirror.",
  102 |     }),
  103 |   ).toBeVisible();
  104 | 
  105 |   await getLearningOverlay(page).getByRole("button", { name: "Task", exact: true }).click();
  106 |   await position.fill("-1850");
  107 |   await expect(position).toHaveValue("-1850");
  108 |   await expectLearningFeedbackCompleted(page);
  109 |   const negativeSideFeedback = await openLearningFeedback(page);
  110 |   await expect(negativeSideFeedback.getByRole("heading", { name: "Task completed" })).toBeVisible();
  111 | });
  112 | 
```