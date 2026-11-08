# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lesson-zero-anatomy.spec.ts >> Lesson 0 presents the anatomy sequence and isolates its presentation state
- Location: src/tests/e2e/lesson-zero-anatomy.spec.ts:3:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('.anatomy-lesson-panel').getByRole('button', { name: 'Next', exact: true })
    - locator resolved to <button type="button" class="btn btn--primary">Next</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

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
          - generic [ref=e12]: Lesson 0 — Meet the View Camera
          - generic [ref=e13]: Lesson
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
                        - button "Scene" [ref=e35] [cursor=pointer]
                        - button "Camera" [pressed] [ref=e36] [cursor=pointer]
                  - generic [ref=e37]:
                    - generic [ref=e38]: Render quality
                    - combobox "Render quality" [ref=e39]:
                      - option "High" [selected]
                      - option "Standard"
                      - option "Low"
                - button "Expand 3D Scene" [ref=e47] [cursor=pointer]:
                  - generic [ref=e48]: open_in_new
            - generic "GroundGlassColumn" [ref=e49]:
              - generic [ref=e50]:
                - generic [ref=e52]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e53]
              - generic [ref=e54]:
                - generic [ref=e56]:
                  - group "Preview" [ref=e57]:
                    - generic [ref=e58]: Preview
                    - generic [ref=e60]:
                      - generic [ref=e61]:
                        - radio "Raw Ground Glass" [checked] [ref=e62]
                        - generic [ref=e63]: Raw Ground Glass
                      - generic [ref=e64]:
                        - radio "Upright Assist" [ref=e65]
                        - generic [ref=e66]: Upright Assist
                  - group "View Options" [ref=e67]:
                    - generic [ref=e68]: View Options
                    - region "View Options" [ref=e70]:
                      - generic [ref=e72]:
                        - checkbox "Grid" [checked] [ref=e73]
                        - generic [ref=e74]: Grid
                - generic "GroundGlassViewport" [ref=e75]:
                  - generic [ref=e77]:
                    - generic [ref=e78]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e79]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 2000.0 mm focus
                      - button "Focus loupe · 4× Ground Glass view" [ref=e83] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e84]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e85] [cursor=pointer]:
                    - generic [ref=e86]: open_in_new
        - complementary [ref=e87]:
          - region "Understanding the Image Circle" [ref=e89]:
            - generic [ref=e90]:
              - paragraph [ref=e91]: Lesson 0 · Meet the View Camera
              - paragraph [ref=e92]: Step 12 of 20
            - generic [ref=e93]:
              - heading "Understanding the Image Circle" [level=3] [ref=e94]
              - paragraph [ref=e95]: Conceptually, finite lens coverage forms a circular Image Circle on a plane perpendicular to the optical axis. The 4×5 film rectangle uses only part of it, leaving spare area around its edges. This is a teaching illustration, not measured coverage data for a particular lens. Front Rise and Front Shift change coverage's position relative to the film rectangle.
              - paragraph [ref=e96]: Compare the 4×5 film rectangle with the larger rose Image Circle around it. The extra area is the movement room used by Rise and Shift.
            - generic [ref=e97]:
              - button "Previous" [ref=e98] [cursor=pointer]
              - button "Next" [active] [ref=e99] [cursor=pointer]
            - generic [ref=e100]:
              - button "Restart lesson" [ref=e101] [cursor=pointer]
              - link "Back to Scenes" [ref=e102] [cursor=pointer]:
                - /url: /scenes
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   |
  3   | test("Lesson 0 presents the anatomy sequence and isolates its presentation state", async ({ page }) => {
  4   |   test.setTimeout(120_000);
  5   |
  6   |   await page.goto("/simulator/free/view-camera-anatomy");
  7   |
  8   |   const panel = page.locator(".anatomy-lesson-panel");
  9   |   const lessonHeading = panel.getByRole("heading", { level: 3 });
  10  |   const next = panel.getByRole("button", { name: "Next", exact: true });
  11  |   const rtt = page.getByTestId("ground-glass-rtt");
  12  |
  13  |   await expect(panel).toBeVisible();
  14  |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", "view-camera-anatomy");
  15  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 120_000 });
  16  |   await expect(lessonHeading).toHaveText("The complete camera");
  17  |   await expect(panel.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  18  |   await expect(page.getByRole("heading", { name: "Camera Controls", exact: true })).toHaveCount(0);
  19  |
  20  |   const steps = [
  21  |     "Front Standard",
  22  |     "Lens and Lens Board",
  23  |     "Aperture",
  24  |     "Bellows",
  25  |     "Rear Standard",
  26  |     "Ground Glass",
  27  |     "Film Holder",
  28  |     "Camera Support",
  29  |     "Recap",
  30  |   ];
  31  |
  32  |   for (const title of steps) {
  33  |     await next.click();
  34  |     await expect(lessonHeading).toHaveText(title);
  35  |
  36  |     if (title === "Aperture") {
  37  |       const apertureToggle = panel.getByRole("button", { name: "Show a smaller opening", exact: true });
  38  |       await apertureToggle.click();
  39  |       await expect(panel.getByRole("button", { name: "Show a wider opening", exact: true })).toHaveAttribute(
  40  |         "aria-pressed",
  41  |         "true",
  42  |       );
  43  |     }
  44  |   }
  45  |
  46  |   await next.click();
  47  |   await expect(lessonHeading).toHaveText("Now try the controls");
  48  |
  49  |   await next.click();
  50  |   await expect(lessonHeading).toHaveText("Understanding the Image Circle");
> 51  |   await next.click();
      |              ^ Error: locator.click: Test timeout of 120000ms exceeded.
  52  |   await expect(lessonHeading).toHaveText("Front Rise");
  53  |   const sceneCanvas = page.getByTestId("scene-canvas");
  54  |   await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");
  55  |   const frontRiseOrbitTarget = await sceneCanvas.getAttribute("data-orbit-target");
  56  |   if (!frontRiseOrbitTarget) throw new Error("Lesson 0 Front Rise view has no orbit target");
  57  |
  58  |   const frontRise = page.getByRole("slider", { name: "Front Rise", exact: true });
  59  |   await expect(frontRise).toBeEnabled();
  60  |   await expect(next).toBeDisabled();
  61  |   await expect(next).toHaveClass(/\bbtn--disabled\b/);
  62  |   await expect(panel.getByRole("status")).toHaveText("Move the control enough to make the physical change clear.");
  63  |
  64  |   await frontRise.fill("3");
  65  |   await expect(frontRise).toHaveValue("3");
  66  |   await expect(next).toBeDisabled();
  67  |   await expect(next).toHaveClass(/\bbtn--disabled\b/);
  68  |   await expect(sceneCanvas).toHaveAttribute("data-orbit-target", frontRiseOrbitTarget);
  69  |
  70  |   await frontRise.fill("12");
  71  |   await expect(next).toBeEnabled();
  72  |   await expect(next).not.toHaveClass(/\bbtn--disabled\b/);
  73  |   await expect(panel.getByRole("status")).toHaveText("Good — the physical change is now visible.");
  74  |   await expect(sceneCanvas).toHaveAttribute("data-orbit-target", frontRiseOrbitTarget);
  75  |
  76  |   await next.click();
  77  |   await expect(lessonHeading).toHaveText("Front Shift");
  78  |   const frontShift = page.getByRole("slider", { name: "Front Shift", exact: true });
  79  |   const frontShiftOrbitTarget = await sceneCanvas.getAttribute("data-orbit-target");
  80  |   if (!frontShiftOrbitTarget) throw new Error("Lesson 0 Front Shift view has no orbit target");
  81  |   await frontShift.fill("12");
  82  |   await expect(next).toBeEnabled();
  83  |   await expect(sceneCanvas).toHaveAttribute("data-orbit-target", frontShiftOrbitTarget);
  84  |
  85  |   await next.click();
  86  |   await expect(lessonHeading).toHaveText("Front Tilt");
  87  |   await page.getByRole("slider", { name: "Front Tilt", exact: true }).fill("3");
  88  |
  89  |   await next.click();
  90  |   await expect(lessonHeading).toHaveText("Front Swing");
  91  |   await page.getByRole("slider", { name: "Front Swing", exact: true }).fill("3");
  92  |
  93  |   await next.click();
  94  |   await expect(lessonHeading).toHaveText("Focus — Front Standard");
  95  |   await expect(page.getByRole("radio", { name: "Front standard", exact: true })).toBeChecked();
  96  |   await page.getByRole("slider", { name: "Focus distance", exact: true }).fill("2200");
  97  |
  98  |   await next.click();
  99  |   await expect(lessonHeading).toHaveText("Focus — Rear Standard");
  100 |   await expect(page.getByRole("radio", { name: "Rear standard", exact: true })).toBeChecked();
  101 |   await page.getByRole("slider", { name: "Focus distance", exact: true }).fill("2200");
  102 |
  103 |   await next.click();
  104 |   await expect(lessonHeading).toHaveText("Aperture control");
  105 |   await page.getByRole("radiogroup", { name: "Aperture", exact: true }).getByRole("radio", { name: "f/5.6" }).check();
  106 |
  107 |   await next.click();
  108 |   await expect(lessonHeading).toHaveText("Controls recap");
  109 |   await expect(next).toHaveCount(0);
  110 |   await expect(panel.getByRole("status")).toHaveText("Lesson complete");
  111 |
  112 |   await panel.getByRole("button", { name: "Restart lesson", exact: true }).click();
  113 |   await expect(lessonHeading).toHaveText("The complete camera");
  114 |   await expect(panel.getByRole("status")).toHaveCount(0);
  115 |
  116 |   await panel.getByRole("link", { name: "Back to Scenes", exact: true }).click();
  117 |   await expect(page).toHaveURL(/\/scenes$/);
  118 |
  119 |   const architectureCard = page
  120 |     .getByRole("article")
  121 |     .filter({ has: page.getByRole("heading", { name: "Architecture Rise", exact: true }) });
  122 |   await architectureCard.getByRole("link", { name: "Open Scene", exact: true }).click();
  123 |   await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  124 |   await expect(page.getByRole("heading", { name: "Camera Controls", exact: true })).toBeVisible();
  125 |   await expect(page.locator(".anatomy-lesson-panel")).toHaveCount(0);
  126 |
  127 |   await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  128 |   const anatomyCard = page
  129 |     .getByRole("article")
  130 |     .filter({ has: page.getByRole("heading", { name: "Lesson 0 — Meet the View Camera", exact: true }) });
  131 |   await anatomyCard.getByRole("link", { name: "Start Lesson", exact: true }).click();
  132 |   await expect(page).toHaveURL(/\/simulator\/free\/view-camera-anatomy\?lesson=1$/);
  133 |   await expect(lessonHeading).toHaveText("The complete camera");
  134 |   await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute(
  135 |     "data-rtt-scene-id",
  136 |     "view-camera-anatomy",
  137 |   );
  138 | });
  139 |
```