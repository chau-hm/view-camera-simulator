# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scene-view-focus.spec.ts >> Architecture + Foreground Camera focus uses the physical camera anchor
- Location: src/tests/e2e/scene-view-focus.spec.ts:353:1

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
                            - generic: 9490.0 mm focus / CoC 0.223 mm (0%)
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
              - paragraph [ref=e106]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
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
                  - generic [ref=e146]: Optical axis
                  - generic [ref=e148]: Foreground ground
                  - generic [ref=e150]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e151]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e157]: Near foreground
                  - generic [ref=e161]: Middle foreground
                  - generic [ref=e165]: Building base
                  - generic [ref=e169]: Building middle
                - generic [ref=e171]:
                  - generic [ref=e173]: Current
                  - generic [ref=e174]: Original
              - generic "Optical depth order" [ref=e175]:
                - generic [ref=e178]: Film 0 mm
                - generic [ref=e181]: Lens 152 mm
                - generic [ref=e184]: DOF limit 6.7 m
                - generic [ref=e187]: Focus 9.6 m
                - generic [ref=e190]: Far DOF > 12.8 m
            - region "Focus distribution · Focus" [ref=e192]:
              - generic [ref=e193]:
                - heading "Focus distribution" [level=4] [ref=e194]
                - 'generic "Ground Glass orientation: Raw" [ref=e195]': Raw
              - table "Focus distribution" [ref=e196]:
                - caption [ref=e197]: Focus distribution
                - rowgroup [ref=e198]:
                  - 'row "Upper centre Upper centre · Near foreground: 0% · Soft Upper centre · Middle foreground: 18% · Soft" [ref=e199]':
                    - cell [ref=e200]
                    - 'cell "Upper centre Upper centre · Near foreground: 0% · Soft Upper centre · Middle foreground: 18% · Soft" [ref=e201]':
                      - generic "Upper centre" [ref=e202]
                      - generic [ref=e203]:
                        - 'group "Upper centre · Near foreground: 0% · Soft" [ref=e204]':
                          - generic "Near foreground" [ref=e206]
                          - generic [ref=e207]:
                            - text: 0%
                            - generic [ref=e208]: —
                        - 'group "Upper centre · Middle foreground: 18% · Soft" [ref=e209]':
                          - generic "Middle foreground" [ref=e211]
                          - generic [ref=e212]:
                            - text: 18%
                            - generic [ref=e213]: —
                    - cell [ref=e214]
                  - 'row "Centre Centre · Building base: 100% · Sharp Centre · Building middle: 100% · Sharp" [ref=e215]':
                    - cell [ref=e216]
                    - 'cell "Centre Centre · Building base: 100% · Sharp Centre · Building middle: 100% · Sharp" [ref=e217]':
                      - generic "Centre" [ref=e218]
                      - generic [ref=e219]:
                        - 'group "Centre · Building base: 100% · Sharp" [ref=e220]':
                          - generic "Building base" [ref=e222]
                          - generic [ref=e223]:
                            - text: 100%
                            - generic [ref=e224]: ✓
                        - 'group "Centre · Building middle: 100% · Sharp" [ref=e225]':
                          - generic "Building middle" [ref=e227]
                          - generic [ref=e228]:
                            - text: 100%
                            - generic [ref=e229]: ✓
                    - cell [ref=e230]
                  - row [ref=e231]:
                    - cell [ref=e232]
                    - cell [ref=e233]
                    - cell [ref=e234]
          - group [ref=e237]:
            - generic "Optical Debug architecture-foreground · parallel" [ref=e238] [cursor=pointer]:
              - generic [ref=e239]: Optical Debug
              - generic [ref=e240]: architecture-foreground · parallel
        - complementary [ref=e241]:
          - generic [ref=e242]:
            - region "Camera Controls" [ref=e243]:
              - heading "Camera Controls" [level=3] [ref=e245]
              - paragraph [ref=e246]:
                - generic [ref=e247]: 🔒
                - generic [ref=e248]: Disabled for this guided task
              - generic [ref=e249]:
                - region "Movement" [ref=e251]:
                  - generic [ref=e252]:
                    - heading "Front standard" [level=4] [ref=e253]
                    - button "Help" [ref=e254] [cursor=pointer]:
                      - generic [ref=e255]: "?"
                  - generic [ref=e256]:
                    - generic [ref=e257]:
                      - generic [ref=e258]: Rise
                      - slider "Rise" [ref=e259]: "0"
                      - generic [ref=e260]: 0.0 mm
                    - generic [ref=e261]:
                      - generic [ref=e262]: Tilt
                      - slider "Tilt" [ref=e263]: "0"
                      - generic [ref=e264]: 0.0°
                    - generic [ref=e265]:
                      - generic [ref=e266]: Swing
                      - slider "Swing" [disabled] [ref=e267]: "0"
                      - generic [ref=e268]: 0.0°
                - region "Focus" [ref=e270]:
                  - heading "Focus" [level=3] [ref=e271]
                  - generic [ref=e272]:
                    - generic [ref=e273]: Focus distance
                    - slider "Focus distance" [ref=e274]: "9490"
                    - generic [ref=e275]: 9490.0 mm
                - region "Aperture" [ref=e277]:
                  - heading "Aperture" [level=3] [ref=e278]
                  - radiogroup "Aperture" [ref=e279]:
                    - generic [ref=e280] [cursor=pointer]:
                      - radio "f/5.6" [ref=e281]
                      - generic [ref=e282]: f/5.6
                    - generic [ref=e283] [cursor=pointer]:
                      - radio "f/8" [ref=e284]
                      - generic [ref=e285]: f/8
                    - generic [ref=e286] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e287]
                      - generic [ref=e288]: f/11
                    - generic [ref=e289] [cursor=pointer]:
                      - radio "f/16" [ref=e290]
                      - generic [ref=e291]: f/16
                    - generic [ref=e292] [cursor=pointer]:
                      - radio "f/22" [ref=e293]
                      - generic [ref=e294]: f/22
                    - generic [ref=e295] [cursor=pointer]:
                      - radio "f/32" [ref=e296]
                      - generic [ref=e297]: f/32
                - generic [ref=e298]:
                  - generic [ref=e299]: Reset
                  - region "Reset" [ref=e300]:
                    - button "Reset movements" [ref=e302] [cursor=pointer]
            - region "Developer Tools" [ref=e303]:
              - heading "Developer Tools" [level=3] [ref=e304]
              - generic [ref=e306]:
                - checkbox "Raw RTT — bypass DOF" [ref=e307]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1   | import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
  2   | import { expect, test, type Locator, type Page } from "@playwright/test";
  3   | 
  4   | type ViewState = {
  5   |   position: number[];
  6   |   target: number[];
  7   | };
  8   | 
  9   | const parseVector = (value: string | null): number[] => {
  10  |   const parsed = value?.split(",").map(Number) ?? [];
  11  |   if (parsed.length !== 3 || parsed.some((coordinate) => !Number.isFinite(coordinate))) {
  12  |     throw new Error(`Invalid observer vector: ${value}`);
  13  |   }
  14  |   return parsed;
  15  | };
  16  | 
  17  | const readViewState = async (sceneCanvas: Locator): Promise<ViewState> => ({
  18  |   position: parseVector(await sceneCanvas.getAttribute("data-observer-camera-position")),
  19  |   target: parseVector(await sceneCanvas.getAttribute("data-orbit-target")),
  20  | });
  21  | 
  22  | const readStableViewState = async (sceneCanvas: Locator): Promise<ViewState> => {
  23  |   let previous = "";
  24  |   await expect.poll(async () => {
  25  |     const current = JSON.stringify(await readViewState(sceneCanvas));
  26  |     const stable = current === previous;
  27  |     previous = current;
  28  |     return stable;
> 29  |   }).toBe(true);
      |      ^ Error: expect(received).toBe(expected) // Object.is equality
  30  |   return readViewState(sceneCanvas);
  31  | };
  32  | 
  33  | const viewDistance = (state: ViewState) =>
  34  |   Math.hypot(...state.position.map((coordinate, index) => coordinate - state.target[index]));
  35  | 
  36  | const expectCameraFocusTarget = async (sceneCanvas: Locator): Promise<ViewState> => {
  37  |   const view = await readStableViewState(sceneCanvas);
  38  |   const pivotMm = parseVector(await sceneCanvas.getAttribute("data-camera-body-pivot-world"));
  39  |   pivotMm.forEach((value, index) => {
  40  |     expect(view.target[index], `camera focus target component ${index}`).toBeCloseTo(value * 0.001, 5);
  41  |   });
  42  |   return view;
  43  | };
  44  | 
  45  | const expectTranslatedByTargetDelta = (before: ViewState, after: ViewState) => {
  46  |   for (let index = 0; index < 3; index += 1) {
  47  |     const targetDelta = after.target[index] - before.target[index];
  48  |     const positionDelta = after.position[index] - before.position[index];
  49  |     expect(positionDelta, `observer translation component ${index}`).toBeCloseTo(targetDelta, 5);
  50  |   }
  51  | };
  52  | 
  53  | const expectSameObserverOffset = (reference: ViewState, actual: ViewState) => {
  54  |   for (let index = 0; index < 3; index += 1) {
  55  |     const referenceOffset = reference.position[index] - reference.target[index];
  56  |     const actualOffset = actual.position[index] - actual.target[index];
  57  |     expect(actualOffset, `observer offset component ${index}`).toBeCloseTo(referenceOffset, 5);
  58  |   }
  59  | };
  60  | 
  61  | const getSceneInteractionPoint = async (page: Page, sceneCanvas: Locator) => {
  62  |   const canvas = sceneCanvas.locator("canvas");
  63  |   const bounds = await canvas.boundingBox();
  64  |   if (!bounds) throw new Error("3D Scene canvas bounds unavailable");
  65  | 
  66  |   const overlayBounds = await page.getByTestId("learning-overlay-drawer").boundingBox();
  67  |   const candidates = [
  68  |     { x: bounds.x + bounds.width * 0.58, y: bounds.y + bounds.height * 0.2 },
  69  |     { x: bounds.x + bounds.width * 0.8, y: bounds.y + bounds.height * 0.2 },
  70  |     { x: bounds.x + bounds.width * 0.2, y: bounds.y + bounds.height * 0.2 },
  71  |     { x: bounds.x + bounds.width * 0.58, y: bounds.y + bounds.height * 0.8 },
  72  |   ];
  73  |   const point = candidates.find(({ x, y }) =>
  74  |     !overlayBounds ||
  75  |     x < overlayBounds.x ||
  76  |     x > overlayBounds.x + overlayBounds.width ||
  77  |     y < overlayBounds.y ||
  78  |     y > overlayBounds.y + overlayBounds.height,
  79  |   );
  80  |   if (!point) throw new Error("No Scene orbit point available outside the learning overlay");
  81  | 
  82  |   return point;
  83  | };
  84  | 
  85  | const orbitScene = async (page: Page, sceneCanvas: Locator) => {
  86  |   const { x, y } = await getSceneInteractionPoint(page, sceneCanvas);
  87  |   await page.mouse.move(x, y);
  88  |   await page.mouse.down();
  89  |   await page.mouse.move(x + 72, y - 36, { steps: 6 });
  90  |   await page.mouse.up();
  91  | };
  92  | 
  93  | const openOverlayMenuIfNeeded = async (page: Page) => {
  94  |   const trigger = page.getByRole("button", { name: "View overlays" });
  95  |   if (await trigger.isVisible()) await trigger.click();
  96  | };
  97  | 
  98  | test("View Focus preserves independent Scene and Camera views and resets the active preset", {
  99  |   tag: "@m7j-renderer-contention",
  100 | }, async ({ page }) => {
  101 |   test.setTimeout(90_000);
  102 |   const pageErrors: string[] = [];
  103 |   const consoleProblems: string[] = [];
  104 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  105 |   page.on("console", (message) => {
  106 |     if (isKnownFiberClockDeprecation(message)) return;
  107 |     if (
  108 |       (message.type() === "error" || message.type() === "warning") &&
  109 |       !/GL Driver Message .*GPU stall due to ReadPixels/.test(message.text())
  110 |     ) {
  111 |       consoleProblems.push(message.text());
  112 |     }
  113 |   });
  114 | 
  115 |   await page.goto("/simulator/free/architecture-rise");
  116 |   const sceneCanvas = page.getByTestId("scene-canvas");
  117 |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1, { timeout: 15_000 });
  118 |   await expect(sceneCanvas).toHaveAttribute("data-observer-renderer-surface", "observer");
  119 |   await expect(sceneCanvas).toHaveAttribute(
  120 |     "data-observer-renderer-status",
  121 |     "active",
  122 |     { timeout: 15_000 },
  123 |   );
  124 |   await expect(sceneCanvas).toHaveAttribute("data-observer-renderer-request", "webgl");
  125 |   await expect(sceneCanvas).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  126 |   await expect(sceneCanvas).toHaveAttribute("data-observer-execution-backend", "webgl2");
  127 |   await expect(sceneCanvas).toHaveAttribute("data-observer-application-fallback", "none");
  128 |   await expect(sceneCanvas).toHaveAttribute("data-observer-webgpu-api-present", /^(true|false)$/);
  129 |   await expect(sceneCanvas).toHaveAttribute("data-observer-shadow-map-status", "active");
```