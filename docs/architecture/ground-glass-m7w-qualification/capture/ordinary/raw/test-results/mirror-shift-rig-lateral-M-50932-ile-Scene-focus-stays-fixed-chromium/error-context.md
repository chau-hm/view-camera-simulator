# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mirror-shift-rig-lateral.spec.ts >> Mirror Shift Camera focus follows the rig while Scene focus stays fixed
- Location: src/tests/e2e/mirror-shift-rig-lateral.spec.ts:137:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
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
                        - button "Scene" [ref=e35] [cursor=pointer]
                        - button "Camera" [active] [pressed] [ref=e36] [cursor=pointer]
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
                            - generic: 6000.0 mm focus
                      - button "Focus loupe · 4× Ground Glass view" [ref=e90] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e91]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e92] [cursor=pointer]:
                    - generic [ref=e93]: open_in_new
            - generic [ref=e95]:
              - generic [ref=e96]:
                - heading "2D Geometry" [level=2] [ref=e97]
                - generic [ref=e98]:
                  - group "Geometry view" [ref=e99]:
                    - button "Top" [pressed] [ref=e100] [cursor=pointer]
                  - group "Geometry framing" [ref=e101]:
                    - button "Fit Scene" [pressed] [ref=e102] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e103] [cursor=pointer]:
                    - generic [ref=e104]: open_in_new
              - paragraph [ref=e105]: "Top view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - generic [ref=e107]:
                - img "Mirror Shift top-view teaching geometry" [ref=e108]:
                  - generic [ref=e110]: Mirror aperture
                  - generic [ref=e111]:
                    - generic [ref=e112]: Neutral film
                    - generic [ref=e113]: Neutral lens
                  - generic [ref=e114]:
                    - generic [ref=e115]: Current film
                    - generic [ref=e116]: Current lens
                  - generic [ref=e121]: Mirror-centre chief ray
                  - generic [ref=e126]: Top view · X lateral · Z optical depth
                - generic [ref=e127]:
                  - generic [ref=e128]: Neutral reference
                  - generic [ref=e130]: Current camera
                  - generic [ref=e132]: Mirror-centre chief ray
              - generic "Optical depth order" [ref=e134]:
                - generic [ref=e137]: Film 0 mm
                - generic [ref=e140]: Lens 122 mm
                - generic [ref=e143]: DOF limit 4.3 m
                - generic [ref=e146]: Focus 6.1 m
                - generic [ref=e149]: Far DOF > 9.3 m
          - group [ref=e152]:
            - generic "Optical Debug mirror-shift · parallel" [ref=e153] [cursor=pointer]:
              - generic [ref=e154]: Optical Debug
              - generic [ref=e155]: mirror-shift · parallel
        - complementary [ref=e156]:
          - generic [ref=e157]:
            - region "Camera Controls" [ref=e158]:
              - heading "Camera Controls" [level=3] [ref=e160]
              - generic [ref=e161]:
                - region "Camera Position" [ref=e163]:
                  - generic [ref=e164]: Camera Position
                  - generic [ref=e165]:
                    - generic [ref=e166]: 0.0 mm
                    - slider "Camera Position" [ref=e167]: "0"
                  - group "Camera Position direction" [ref=e168]:
                    - generic [ref=e169]: Left
                    - generic [ref=e170]: Right
                - region "Front Shift" [ref=e172]:
                  - generic [ref=e173]: Front Shift
                  - generic [ref=e174]:
                    - generic [ref=e175]: 0.0 mm
                    - slider "Front Shift" [ref=e176]: "0"
                  - group "Front Shift direction" [ref=e177]:
                    - generic [ref=e178]: Left
                    - generic [ref=e179]: Right
                - region "Focus" [ref=e181]:
                  - heading "Focus" [level=3] [ref=e182]
                  - generic [ref=e183]:
                    - generic [ref=e184]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e185]: "6000"
                    - generic [ref=e186]: 6000.0 mm
                  - generic [ref=e187]: Focus is fixed for this lesson
                - region "Aperture" [ref=e189]:
                  - heading "Aperture" [level=3] [ref=e190]
                  - radiogroup "Aperture" [disabled] [ref=e191]:
                    - generic [ref=e192]:
                      - radio "f/5.6" [disabled] [ref=e193]
                      - generic [ref=e194]: f/5.6
                    - generic [ref=e195]:
                      - radio "f/8" [disabled] [ref=e196]
                      - generic [ref=e197]: f/8
                    - generic [ref=e198]:
                      - radio "f/11" [checked] [disabled] [ref=e199]
                      - generic [ref=e200]: f/11
                    - generic [ref=e201]:
                      - radio "f/16" [disabled] [ref=e202]
                      - generic [ref=e203]: f/16
                    - generic [ref=e204]:
                      - radio "f/22" [disabled] [ref=e205]
                      - generic [ref=e206]: f/22
                    - generic [ref=e207]:
                      - radio "f/32" [disabled] [ref=e208]
                      - generic [ref=e209]: f/32
                  - generic [ref=e210]: Aperture is fixed for this lesson
                - generic [ref=e211]:
                  - generic [ref=e212]: Reset
                  - region "Reset" [ref=e213]:
                    - button "Reset movements" [ref=e215] [cursor=pointer]
            - region "Developer Tools" [ref=e216]:
              - heading "Developer Tools" [level=3] [ref=e217]
              - generic [ref=e219]:
                - checkbox "Raw RTT — bypass DOF" [ref=e220]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page } from "@playwright/test";
  2   |
  3   | type ViewState = {
  4   |   position: number[];
  5   |   target: number[];
  6   | };
  7   |
  8   | const parseVector = (value: string | null): number[] => {
  9   |   const parsed = value?.split(",").map(Number) ?? [];
  10  |   if (parsed.length !== 3 || parsed.some((coordinate) => !Number.isFinite(coordinate))) {
  11  |     throw new Error(`Invalid observer vector: ${value}`);
  12  |   }
  13  |   return parsed;
  14  | };
  15  |
  16  | const readViewState = async (scene: Locator): Promise<ViewState> => ({
  17  |   position: parseVector(await scene.getAttribute("data-observer-camera-position")),
  18  |   target: parseVector(await scene.getAttribute("data-orbit-target")),
  19  | });
  20  |
  21  | const readStableViewState = async (scene: Locator): Promise<ViewState> => {
  22  |   let previous = "";
  23  |   await expect.poll(async () => {
  24  |     const current = JSON.stringify(await readViewState(scene));
  25  |     const stable = current === previous;
  26  |     previous = current;
  27  |     return stable;
> 28  |   }).toBe(true);
      |      ^ Error: expect(received).toBe(expected) // Object.is equality
  29  |   return readViewState(scene);
  30  | };
  31  |
  32  | const viewDistance = (view: ViewState) =>
  33  |   Math.hypot(...view.position.map((coordinate, index) => coordinate - view.target[index]));
  34  |
  35  | const expectSameObserverOffset = (reference: ViewState, actual: ViewState) => {
  36  |   for (let index = 0; index < 3; index += 1) {
  37  |     expect(actual.position[index] - actual.target[index]).toBeCloseTo(
  38  |       reference.position[index] - reference.target[index],
  39  |       5,
  40  |     );
  41  |   }
  42  | };
  43  |
  44  | const orbitScene = async (page: Page, scene: Locator) => {
  45  |   const canvas = scene.locator("canvas");
  46  |   const bounds = await canvas.boundingBox();
  47  |   if (!bounds) throw new Error("3D Scene canvas bounds unavailable");
  48  |
  49  |   const overlayBounds = await page.getByTestId("learning-overlay-drawer").boundingBox();
  50  |   const candidates = [
  51  |     { x: bounds.x + bounds.width * 0.58, y: bounds.y + bounds.height * 0.2 },
  52  |     { x: bounds.x + bounds.width * 0.8, y: bounds.y + bounds.height * 0.2 },
  53  |     { x: bounds.x + bounds.width * 0.2, y: bounds.y + bounds.height * 0.2 },
  54  |     { x: bounds.x + bounds.width * 0.58, y: bounds.y + bounds.height * 0.8 },
  55  |   ];
  56  |   const point = candidates.find(({ x, y }) =>
  57  |     !overlayBounds ||
  58  |     x < overlayBounds.x ||
  59  |     x > overlayBounds.x + overlayBounds.width ||
  60  |     y < overlayBounds.y ||
  61  |     y > overlayBounds.y + overlayBounds.height,
  62  |   );
  63  |   if (!point) throw new Error("No Scene orbit point available outside the learning overlay");
  64  |
  65  |   const { x, y } = point;
  66  |   await page.mouse.move(x, y);
  67  |   await page.mouse.down();
  68  |   await page.mouse.move(x + 72, y - 36, { steps: 6 });
  69  |   await page.mouse.up();
  70  | };
  71  |
  72  | test("Mirror Shift moves the canonical rig while keeping its RTT mounted", async ({ page }) => {
  73  |   test.setTimeout(150_000);
  74  |   await page.goto("/simulator/free/mirror-shift?rttDiagnostics=1");
  75  |
  76  |   const scene = page.locator('[data-testid="scene-canvas"]');
  77  |   const rtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  78  |   const position = page.getByRole("slider", { name: "Camera Position" });
  79  |   const frontShift = page.getByRole("slider", { name: "Front Shift" });
  80  |
  81  |   await expect(position).toHaveValue("0");
  82  |   await expect(frontShift).toHaveValue("0");
  83  |   await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  84  |   await expect(page.getByRole("slider", { name: "Tilt" })).toHaveCount(0);
  85  |   await expect(page.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  86  |   await expect(scene).toHaveAttribute(
  87  |     "data-camera-rig-origin",
  88  |     "0.000000,0.000000,0.000000",
  89  |   );
  90  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  91  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  92  |
  93  |   const sceneElement = await scene.elementHandle();
  94  |   const rttElement = await rtt.elementHandle();
  95  |   const resourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  96  |   expect(resourceGeneration).toBeTruthy();
  97  |
  98  |   await position.fill("1800");
  99  |   await expect(position).toHaveValue("1800");
  100 |   await expect(scene).toHaveAttribute(
  101 |     "data-camera-rig-origin",
  102 |     "1800.000000,0.000000,0.000000",
  103 |   );
  104 |   await expect(scene).toHaveAttribute("data-camera-lens-center-world", "1800.000000,0.000000,0.000000");
  105 |   const movedFilmCenter = await scene.getAttribute("data-camera-film-center-world");
  106 |   expect(movedFilmCenter?.split(",")[0]).toBe("1800.000000");
  107 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  108 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  109 |   await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  110 |   await expect.poll(() => page.evaluate((node) => node?.isConnected, sceneElement)).toBe(true);
  111 |   await expect.poll(() => page.evaluate((node) => node?.isConnected, rttElement)).toBe(true);
  112 |
  113 |   await frontShift.fill("-50");
  114 |   await expect(frontShift).toHaveValue("-50");
  115 |   await expect(scene).toHaveAttribute(
  116 |     "data-camera-rig-origin",
  117 |     "1800.000000,0.000000,0.000000",
  118 |   );
  119 |   await expect(scene).toHaveAttribute("data-camera-lens-center-world", "1750.000000,0.000000,0.000000");
  120 |   const movedFilmCenterAfterShift = await scene.getAttribute("data-camera-film-center-world");
  121 |   expect(movedFilmCenterAfterShift?.split(",")[0]).toBe("1800.000000");
  122 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  123 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  124 |   await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  125 |   await expect.poll(() => page.evaluate((node) => node?.isConnected, sceneElement)).toBe(true);
  126 |   await expect.poll(() => page.evaluate((node) => node?.isConnected, rttElement)).toBe(true);
  127 |
  128 |   await page.getByRole("button", { name: "Reset movements" }).click();
```