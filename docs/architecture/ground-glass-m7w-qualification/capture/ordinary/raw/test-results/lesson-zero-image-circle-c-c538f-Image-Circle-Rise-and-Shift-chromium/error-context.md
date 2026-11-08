# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lesson-zero-image-circle-coverage.spec.ts >> Lesson 0 shows the same film-relative coverage model for Image Circle, Rise, and Shift
- Location: src/tests/e2e/lesson-zero-image-circle-coverage.spec.ts:3:1

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('scene-canvas')
Expected: "true"
Received: ""

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('scene-canvas')

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
  1  | import { expect, test } from "@playwright/test";
  2  |
  3  | test("Lesson 0 shows the same film-relative coverage model for Image Circle, Rise, and Shift", async ({ page }, testInfo) => {
  4  |   test.setTimeout(90_000);
  5  |   await page.goto("/simulator/free/view-camera-anatomy");
  6  |
  7  |   const panel = page.locator(".anatomy-lesson-panel");
  8  |   const heading = panel.getByRole("heading", { level: 3 });
  9  |   const next = panel.getByRole("button", { name: "Next", exact: true });
  10 |   const scene = page.getByTestId("scene-canvas");
  11 |   const rtt = page.getByTestId("ground-glass-rtt");
  12 |   await expect(panel).toBeVisible();
  13 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  14 |
  15 |   const stepsBeforeImageCircle = [
  16 |     "Front Standard",
  17 |     "Lens and Lens Board",
  18 |     "Aperture",
  19 |     "Bellows",
  20 |     "Rear Standard",
  21 |     "Ground Glass",
  22 |     "Film Holder",
  23 |     "Camera Support",
  24 |     "Recap",
  25 |     "Now try the controls",
  26 |   ];
  27 |   for (const title of stepsBeforeImageCircle) {
  28 |     await next.click();
  29 |     await expect(heading).toHaveText(title);
  30 |   }
  31 |
  32 |   await next.click();
  33 |   await expect(heading).toHaveText("Understanding the Image Circle");
> 34 |   await expect(scene).toHaveAttribute("data-conceptual-image-circle-visible", "true");
     |                       ^ Error: expect(locator).toHaveAttribute(expected) failed
  35 |   await expect(scene).toHaveAttribute("data-lens-coverage-visible", "false");
  36 |   await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  37 |   await page.screenshot({ path: testInfo.outputPath("lesson-zero-step12-image-circle.png") });
  38 |
  39 |   await next.click();
  40 |   await expect(heading).toHaveText("Front Rise");
  41 |   await expect(scene).toHaveAttribute("data-conceptual-image-circle-visible", "false");
  42 |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  43 |   await expect(scene).toHaveAttribute("data-lens-coverage-kind", "parallel-circle");
  44 |   await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  45 |   await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  46 |   await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  47 |   await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
  48 |
  49 |   const frontRise = page.getByRole("slider", { name: "Front Rise", exact: true });
  50 |   await frontRise.fill("40");
  51 |   await expect(next).toBeEnabled();
  52 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  53 |   await expect.poll(async () => {
  54 |     const sceneOffset = Number(await scene.getAttribute("data-image-circle-offset-y-mm"));
  55 |     const rawOffset = Number(await rtt.getAttribute("data-rtt-coverage-offset-y-mm"));
  56 |     return Number.isFinite(sceneOffset) && Math.abs(sceneOffset) > 1e-5 &&
  57 |       Number.isFinite(rawOffset) && Math.abs(sceneOffset - rawOffset) < 1e-5;
  58 |   }).toBe(true);
  59 |   await page.screenshot({ path: testInfo.outputPath("lesson-zero-step13-front-rise-coverage.png") });
  60 |
  61 |   await next.click();
  62 |   await expect(heading).toHaveText("Front Shift");
  63 |   await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  64 |   await expect(scene).toHaveAttribute("data-lens-coverage-kind", "parallel-circle");
  65 |   await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  66 |   await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  67 |   await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  68 |   await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
  69 |
  70 |   const frontShift = page.getByRole("slider", { name: "Front Shift", exact: true });
  71 |   await frontShift.fill("60");
  72 |   await expect(next).toBeEnabled();
  73 |   await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  74 |   await expect.poll(async () => {
  75 |     const sceneOffset = Number(await scene.getAttribute("data-image-circle-offset-x-mm"));
  76 |     const rawOffset = Number(await rtt.getAttribute("data-rtt-coverage-offset-x-mm"));
  77 |     return Number.isFinite(sceneOffset) && Math.abs(sceneOffset) > 1e-5 &&
  78 |       Number.isFinite(rawOffset) && Math.abs(sceneOffset - rawOffset) < 1e-5;
  79 |   }).toBe(true);
  80 |   await expect.poll(async () => {
  81 |     const sceneRadius = Number(await scene.getAttribute("data-image-circle-radius-mm"));
  82 |     const glassRadius = Number(await rtt.getAttribute("data-rtt-coverage-radius-mm"));
  83 |     const sceneOffset = Number(await scene.getAttribute("data-image-circle-offset-x-mm"));
  84 |     const glassOffset = Number(await rtt.getAttribute("data-rtt-coverage-offset-x-mm"));
  85 |     return Number.isFinite(sceneRadius) && Number.isFinite(glassRadius) &&
  86 |       Math.abs(sceneRadius - glassRadius) < 1e-5 && Math.abs(sceneOffset - glassOffset) < 1e-5;
  87 |   }).toBe(true);
  88 |   await page.screenshot({ path: testInfo.outputPath("lesson-zero-step14-front-shift-coverage.png") });
  89 | });
  90 |
```