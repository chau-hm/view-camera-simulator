# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scene-viewport-expansion.spec.ts >> simulator viewports expand in main without replacing their active canvases
- Location: src/tests/e2e/scene-viewport-expansion.spec.ts:97:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('scene-canvas').locator('canvas')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByTestId('scene-canvas').locator('canvas')
    5 × locator resolved to 0 elements
      - unexpected value "0"

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
                            - generic: 8890.0 mm focus / CoC 0.000 mm (100%)
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
                  - generic [ref=e122]: Building mid facade
              - generic "Optical depth order" [ref=e124]:
                - generic [ref=e127]: Film 0 mm
                - generic [ref=e130]: Lens 153 mm
                - generic [ref=e133]: DOF limit 6.4 m
                - generic [ref=e136]: Focus 9.0 m
                - generic [ref=e139]: Far DOF > 13.3 m
            - region "Focus distribution · Focus" [ref=e141]:
              - generic [ref=e142]:
                - heading "Focus distribution" [level=4] [ref=e143]
                - 'generic "Ground Glass orientation: Raw" [ref=e144]': Raw
              - table "Focus distribution" [ref=e145]:
                - caption [ref=e146]: Focus distribution
                - rowgroup [ref=e147]:
                  - row [ref=e148]:
                    - cell [ref=e149]
                    - cell [ref=e150]
                    - cell [ref=e151]
                  - 'row "Centre Centre · Building mid facade: 100% · Sharp" [ref=e152]':
                    - cell [ref=e153]
                    - 'cell "Centre Centre · Building mid facade: 100% · Sharp" [ref=e154]':
                      - generic "Centre" [ref=e155]
                      - 'group "Centre · Building mid facade: 100% · Sharp" [ref=e157]':
                        - generic "Building mid facade" [ref=e158]
                        - generic [ref=e159]:
                          - text: 100%
                          - generic [ref=e160]: ✓
                    - cell [ref=e161]
                  - row [ref=e162]:
                    - cell [ref=e163]
                    - cell [ref=e164]
                    - cell [ref=e165]
          - group [ref=e168]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e169] [cursor=pointer]:
              - generic [ref=e170]: Optical Debug
              - generic [ref=e171]: architecture-rise · parallel
        - complementary [ref=e172]:
          - generic [ref=e173]:
            - region "Camera Controls" [ref=e174]:
              - heading "Camera Controls" [level=3] [ref=e176]
              - generic [ref=e177]:
                - region "Movement" [ref=e179]:
                  - generic [ref=e180]:
                    - heading "Front standard" [level=4] [ref=e181]
                    - button "Help" [ref=e182] [cursor=pointer]:
                      - generic [ref=e183]: "?"
                  - generic [ref=e184]:
                    - generic [ref=e185]:
                      - generic [ref=e186]: Rise
                      - slider "Rise" [ref=e187]: "0"
                      - generic [ref=e188]: 0.0 mm
                    - generic [ref=e189]:
                      - generic [ref=e190]: Tilt
                      - slider "Tilt" [ref=e191]: "0"
                      - generic [ref=e192]: 0.0°
                    - generic [ref=e193]:
                      - generic [ref=e194]: Swing
                      - slider "Swing" [ref=e195]: "0"
                      - generic [ref=e196]: 0.0°
                - region "Focus" [ref=e198]:
                  - heading "Focus" [level=3] [ref=e199]
                  - generic [ref=e200]:
                    - generic [ref=e201]: Focus distance
                    - slider "Focus distance" [ref=e202]: "8890"
                    - generic [ref=e203]: 8890.0 mm
                    - button "Infinity Reset" [ref=e205] [cursor=pointer]: ∞
                - region "Aperture" [ref=e207]:
                  - heading "Aperture" [level=3] [ref=e208]
                  - radiogroup "Aperture" [ref=e209]:
                    - generic [ref=e210] [cursor=pointer]:
                      - radio "f/5.6" [ref=e211]
                      - generic [ref=e212]: f/5.6
                    - generic [ref=e213] [cursor=pointer]:
                      - radio "f/8" [ref=e214]
                      - generic [ref=e215]: f/8
                    - generic [ref=e216] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e217]
                      - generic [ref=e218]: f/11
                    - generic [ref=e219] [cursor=pointer]:
                      - radio "f/16" [ref=e220]
                      - generic [ref=e221]: f/16
                    - generic [ref=e222] [cursor=pointer]:
                      - radio "f/22" [ref=e223]
                      - generic [ref=e224]: f/22
                    - generic [ref=e225] [cursor=pointer]:
                      - radio "f/32" [ref=e226]
                      - generic [ref=e227]: f/32
                - generic [ref=e228]:
                  - generic [ref=e229]: Reset
                  - region "Reset" [ref=e230]:
                    - button "Reset movements" [ref=e232] [cursor=pointer]
            - region "Developer Tools" [ref=e233]:
              - heading "Developer Tools" [level=3] [ref=e234]
              - generic [ref=e236]:
                - checkbox "Raw RTT — bypass DOF" [ref=e237]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  3   | 
  4   | type RttSnapshot = {
  5   |   stageWidth: number;
  6   |   stageHeight: number;
  7   |   logicalWidth: number;
  8   |   logicalHeight: number;
  9   |   internalWidth: number;
  10  |   internalHeight: number;
  11  |   colorWidth: number;
  12  |   colorHeight: number;
  13  |   depthWidth: number;
  14  |   depthHeight: number;
  15  |   blurWidth: number;
  16  |   blurHeight: number;
  17  |   gatherScale: number;
  18  |   finalWidth: number;
  19  |   finalHeight: number;
  20  |   horizontalShaderWidth: number;
  21  |   horizontalShaderHeight: number;
  22  |   verticalShaderWidth: number;
  23  |   verticalShaderHeight: number;
  24  |   generation: string | null;
  25  | };
  26  | 
  27  | // ResizeObserver reports integer CSS pixels while layout can settle on fractional bounds.
  28  | const LOGICAL_SIZE_TOLERANCE_PX = 3;
  29  | 
  30  | const readRttSnapshot = async (page: import("@playwright/test").Page): Promise<RttSnapshot> =>
  31  |   page.evaluate(() => {
  32  |     const rtt = document.querySelector<HTMLElement>('[data-testid="ground-glass-rtt"]');
  33  |     const stage = document.querySelector<HTMLElement>('.groundglass-stage');
  34  |     if (!rtt || !stage) throw new Error("Ground Glass RTT diagnostics are unavailable");
  35  |     const rect = stage.getBoundingClientRect();
  36  |     const number = (name: string) => Number(rtt.dataset[name]);
  37  |     return {
  38  |       stageWidth: rect.width,
  39  |       stageHeight: rect.height,
  40  |       logicalWidth: number("rttLogicalWidth"),
  41  |       logicalHeight: number("rttLogicalHeight"),
  42  |       internalWidth: number("rttInternalWidth"),
  43  |       internalHeight: number("rttInternalHeight"),
  44  |       colorWidth: number("rttColorTargetWidth"),
  45  |       colorHeight: number("rttColorTargetHeight"),
  46  |       depthWidth: number("rttDepthTargetWidth"),
  47  |       depthHeight: number("rttDepthTargetHeight"),
  48  |       blurWidth: number("rttBlurTargetWidth"),
  49  |       blurHeight: number("rttBlurTargetHeight"),
  50  |       gatherScale: number("rttGatherScale"),
  51  |       finalWidth: number("rttFinalTargetWidth"),
  52  |       finalHeight: number("rttFinalTargetHeight"),
  53  |       horizontalShaderWidth: number("rttHorizontalShaderWidth"),
  54  |       horizontalShaderHeight: number("rttHorizontalShaderHeight"),
  55  |       verticalShaderWidth: number("rttVerticalShaderWidth"),
  56  |       verticalShaderHeight: number("rttVerticalShaderHeight"),
  57  |       generation: rtt.getAttribute("data-rtt-resource-generation"),
  58  |     };
  59  |   });
  60  | 
  61  | type GroundGlassPresentationSnapshot = {
  62  |   canvasWidth: number;
  63  |   canvasHeight: number;
  64  |   zoomed: string | undefined;
  65  |   internalWidth: number;
  66  |   internalHeight: number;
  67  |   sampledFilmWidthMm: number;
  68  |   sampledFilmHeightMm: number;
  69  |   cssScale: number;
  70  | };
  71  | 
  72  | const readGroundGlassPresentationSnapshot = async (
  73  |   page: import("@playwright/test").Page,
  74  | ): Promise<GroundGlassPresentationSnapshot> =>
  75  |   page.evaluate(() => {
  76  |     const stage = document.querySelector<HTMLElement>(
  77  |       '[aria-label="GroundGlassViewport"] [data-zoomed]',
  78  |     );
  79  |     const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="ground-glass-rtt"] canvas');
  80  |     const rtt = document.querySelector<HTMLElement>('[data-testid="ground-glass-rtt"]');
  81  |     if (!stage || !canvas || !rtt) {
  82  |       throw new Error("Ground Glass presentation is unavailable");
  83  |     }
  84  |     const canvasRect = canvas.getBoundingClientRect();
  85  |     return {
  86  |       canvasWidth: canvasRect.width,
  87  |       canvasHeight: canvasRect.height,
  88  |       zoomed: stage.dataset.zoomed,
  89  |       internalWidth: Number(rtt.dataset.rttInternalWidth),
  90  |       internalHeight: Number(rtt.dataset.rttInternalHeight),
  91  |       sampledFilmWidthMm: Number(rtt.dataset.rttSampledFilmWidthMm),
  92  |       sampledFilmHeightMm: Number(rtt.dataset.rttSampledFilmHeightMm),
  93  |       cssScale: Number(stage.dataset.presentationCssScale),
  94  |     };
  95  |   });
  96  | 
  97  | test("simulator viewports expand in main without replacing their active canvases", async ({ page }) => {
  98  |   test.setTimeout(120_000);
  99  |   await page.setViewportSize({ width: 1024, height: 768 });
  100 |   await page.goto("/simulator/free/architecture-rise");
  101 | 
  102 |   const sceneRenderer = page.getByTestId("scene-canvas");
> 103 |   await expect(sceneRenderer.locator("canvas")).toHaveCount(1);
      |                                                 ^ Error: expect(locator).toHaveCount(expected) failed
  104 |   const originalRenderer = await sceneRenderer.elementHandle();
  105 |   expect(originalRenderer).toBeTruthy();
  106 |   const originalCameraPosition = await sceneRenderer.getAttribute("data-observer-camera-position");
  107 |   const originalOrbitTarget = await sceneRenderer.getAttribute("data-orbit-target");
  108 | 
  109 |   const readExpandedLayout = (activeViewportSelector: string) => page.evaluate((selector) => {
  110 |     const main = document.querySelector<HTMLElement>(".simulator-main");
  111 |     const aside = document.querySelector<HTMLElement>(".simulator-aside");
  112 |     const card = document.querySelector<HTMLElement>(".simulator-card--expanded");
  113 |     const renderer = document.querySelector<HTMLElement>(selector);
  114 |     if (!main || !aside || !card || !renderer) throw new Error("Expanded layout is incomplete");
  115 |     const mainRect = main.getBoundingClientRect();
  116 |     const asideRect = aside.getBoundingClientRect();
  117 |     const cardRect = card.getBoundingClientRect();
  118 |     const rendererRect = renderer.getBoundingClientRect();
  119 |     return {
  120 |       main: { left: mainRect.left, right: mainRect.right, height: mainRect.height },
  121 |       aside: { left: asideRect.left, overflowY: getComputedStyle(aside).overflowY },
  122 |       card: {
  123 |         left: cardRect.left,
  124 |         right: cardRect.right,
  125 |         height: cardRect.height,
  126 |         bottom: cardRect.bottom,
  127 |       },
  128 |       renderer: {
  129 |         width: rendererRect.width,
  130 |         height: rendererRect.height,
  131 |         bottom: rendererRect.bottom,
  132 |       },
  133 |       mainOverflowY: getComputedStyle(main).overflowY,
  134 |     };
  135 |   }, activeViewportSelector);
  136 | 
  137 |   const readRestoredLayout = () => page.evaluate(() => {
  138 |     const sceneCard = document.querySelector<HTMLElement>(".simulator-viewport-grid > .simulator-card:first-child");
  139 |     const groundGlassCard = document.querySelector<HTMLElement>('[aria-label="GroundGlassColumn"]');
  140 |     const renderer = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
  141 |     if (!sceneCard || !groundGlassCard || !renderer) throw new Error("Normal viewport layout is incomplete");
  142 |     const sceneCardRect = sceneCard.getBoundingClientRect();
  143 |     const groundGlassCardRect = groundGlassCard.getBoundingClientRect();
  144 |     const rendererRect = renderer.getBoundingClientRect();
  145 |     return {
  146 |       sceneCard: { left: sceneCardRect.left, right: sceneCardRect.right, bottom: sceneCardRect.bottom },
  147 |       groundGlassCard: { left: groundGlassCardRect.left, right: groundGlassCardRect.right },
  148 |       renderer: {
  149 |         left: rendererRect.left,
  150 |         right: rendererRect.right,
  151 |         bottom: rendererRect.bottom,
  152 |         width: rendererRect.width,
  153 |         height: rendererRect.height,
  154 |       },
  155 |     };
  156 |   });
  157 | 
  158 |   const normalLayout = await readRestoredLayout();
  159 | 
  160 |   for (let cycle = 0; cycle < 3; cycle += 1) {
  161 |     await page.getByRole("button", { name: "Expand 3D Scene" }).click();
  162 |     await expect(page.getByRole("button", { name: "Restore 3D Scene" })).toBeFocused();
  163 |     await expect(sceneRenderer).toHaveCount(1);
  164 |     await expect(sceneRenderer.locator("canvas")).toHaveCount(1);
  165 |     expect(
  166 |       await page.evaluate(
  167 |         (node) => node === document.querySelector('[data-testid="scene-canvas"]'),
  168 |         originalRenderer,
  169 |       ),
  170 |     ).toBe(true);
  171 |     await expect(sceneRenderer).toHaveAttribute(
  172 |       "data-observer-camera-position",
  173 |       originalCameraPosition ?? "",
  174 |     );
  175 |     await expect(sceneRenderer).toHaveAttribute("data-orbit-target", originalOrbitTarget ?? "");
  176 |     await expect(page.getByLabel("GroundGlassColumn")).toHaveCount(0);
  177 |     await expect(page.getByRole("dialog")).toHaveCount(0);
  178 |     await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
  179 | 
  180 |     const expandedLayout = await readExpandedLayout('[data-testid="scene-canvas"]');
  181 |     expect(expandedLayout.card.left).toBeGreaterThanOrEqual(expandedLayout.main.left - 1);
  182 |     expect(expandedLayout.card.right).toBeLessThanOrEqual(expandedLayout.main.right + 1);
  183 |     expect(expandedLayout.card.right).toBeLessThan(expandedLayout.aside.left);
  184 |     expect(expandedLayout.card.height).toBeGreaterThan(0);
  185 |     expect(expandedLayout.renderer.width).toBeGreaterThan(0);
  186 |     expect(expandedLayout.renderer.height).toBeGreaterThan(200);
  187 |     expect(expandedLayout.renderer.height).toBeGreaterThan(normalLayout.renderer.height + 80);
  188 |     expect(expandedLayout.card.bottom - expandedLayout.renderer.bottom).toBeLessThan(32);
  189 |     expect(expandedLayout.mainOverflowY).toBe("hidden");
  190 |     expect(expandedLayout.aside.overflowY).toBe("auto");
  191 | 
  192 |     if (cycle === 0) {
  193 |       await page.setViewportSize({ width: 1024, height: 900 });
  194 |       await expect
  195 |         .poll(async () => (await readExpandedLayout('[data-testid="scene-canvas"]')).renderer.height, {
  196 |           timeout: 30_000,
  197 |         })
  198 |         .toBeGreaterThan(expandedLayout.renderer.height + 80);
  199 |       const resizedExpandedLayout = await readExpandedLayout('[data-testid="scene-canvas"]');
  200 |       expect(resizedExpandedLayout.card.bottom - resizedExpandedLayout.renderer.bottom).toBeLessThan(32);
  201 | 
  202 |       await page.setViewportSize({ width: 1024, height: 768 });
  203 |       await expect
```