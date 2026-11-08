# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: macro-depth-of-field-orientation.spec.ts >> Architecture Rise WebGL raster distinguishes the Raw/Upright X and Y mapping
- Location: src/tests/e2e/macro-depth-of-field-orientation.spec.ts:237:1

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByTestId('ground-glass-rtt').first().locator('canvas')

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
                        - radio "Raw Ground Glass" [ref=e69]
                        - generic [ref=e70]: Raw Ground Glass
                      - generic [ref=e71]:
                        - radio "Upright Assist" [checked] [active] [ref=e72]
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
                - 'generic "Ground Glass orientation: Upright" [ref=e144]': Upright
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
                        - generic "Building mid facade" [ref=e159]
                        - generic [ref=e160]:
                          - text: 100%
                          - generic [ref=e161]: ✓
                    - cell [ref=e162]
                  - row [ref=e163]:
                    - cell [ref=e164]
                    - cell [ref=e165]
                    - cell [ref=e166]
          - group [ref=e169]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e170] [cursor=pointer]:
              - generic [ref=e171]: Optical Debug
              - generic [ref=e172]: architecture-rise · parallel
        - complementary [ref=e173]:
          - generic [ref=e174]:
            - region "Camera Controls" [ref=e175]:
              - heading "Camera Controls" [level=3] [ref=e177]
              - generic [ref=e178]:
                - region "Movement" [ref=e180]:
                  - generic [ref=e181]:
                    - heading "Front standard" [level=4] [ref=e182]
                    - button "Help" [ref=e183] [cursor=pointer]:
                      - generic [ref=e184]: "?"
                  - generic [ref=e185]:
                    - generic [ref=e186]:
                      - generic [ref=e187]: Rise
                      - slider "Rise" [ref=e188]: "0"
                      - generic [ref=e189]: 0.0 mm
                    - generic [ref=e190]:
                      - generic [ref=e191]: Tilt
                      - slider "Tilt" [ref=e192]: "0"
                      - generic [ref=e193]: 0.0°
                    - generic [ref=e194]:
                      - generic [ref=e195]: Swing
                      - slider "Swing" [ref=e196]: "0"
                      - generic [ref=e197]: 0.0°
                - region "Focus" [ref=e199]:
                  - heading "Focus" [level=3] [ref=e200]
                  - generic [ref=e201]:
                    - generic [ref=e202]: Focus distance
                    - slider "Focus distance" [ref=e203]: "8890"
                    - generic [ref=e204]: 8890.0 mm
                    - button "Infinity Reset" [ref=e206] [cursor=pointer]: ∞
                - region "Aperture" [ref=e208]:
                  - heading "Aperture" [level=3] [ref=e209]
                  - radiogroup "Aperture" [ref=e210]:
                    - generic [ref=e211] [cursor=pointer]:
                      - radio "f/5.6" [ref=e212]
                      - generic [ref=e213]: f/5.6
                    - generic [ref=e214] [cursor=pointer]:
                      - radio "f/8" [ref=e215]
                      - generic [ref=e216]: f/8
                    - generic [ref=e217] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e218]
                      - generic [ref=e219]: f/11
                    - generic [ref=e220] [cursor=pointer]:
                      - radio "f/16" [ref=e221]
                      - generic [ref=e222]: f/16
                    - generic [ref=e223] [cursor=pointer]:
                      - radio "f/22" [ref=e224]
                      - generic [ref=e225]: f/22
                    - generic [ref=e226] [cursor=pointer]:
                      - radio "f/32" [ref=e227]
                      - generic [ref=e228]: f/32
                - generic [ref=e229]:
                  - generic [ref=e230]: Reset
                  - region "Reset" [ref=e231]:
                    - button "Reset movements" [ref=e233] [cursor=pointer]
            - region "Developer Tools" [ref=e234]:
              - heading "Developer Tools" [level=3] [ref=e235]
              - generic [ref=e237]:
                - checkbox "Raw RTT — bypass DOF" [ref=e238]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1   | import { writeFile } from "node:fs/promises";
  2   | import { expect, test, type Locator, type Page } from "@playwright/test";
  3   |
  4   | const TARGET_COLUMNS = {
  5   |   raw: {
  6   |     "macro-depth-near": 0,
  7   |     "macro-depth-middle": 1,
  8   |     "macro-depth-far": 2,
  9   |   },
  10  |   upright: {
  11  |     "macro-depth-near": 2,
  12  |     "macro-depth-middle": 1,
  13  |     "macro-depth-far": 0,
  14  |   },
  15  | } as const;
  16  |
  17  | const TARGET_IDS = [
  18  |   "macro-depth-near",
  19  |   "macro-depth-middle",
  20  |   "macro-depth-far",
  21  | ] as const;
  22  |
  23  | // The specimen is centered and vertically asymmetric (bridge above the three
  24  | // focus stations). These fixed physical-film V samples cross its interior;
  25  | // pairing Raw V with Upright 1-V tests the actual RTT raster without sampling
  26  | // antialiased silhouette edges.
  27  | const SPECIMEN_PROFILE_V = [
  28  |   0.42, 0.44, 0.46, 0.48, 0.50, 0.52, 0.54, 0.56, 0.58,
  29  | ] as const;
  30  |
  31  | // These top-origin positions were selected against the actual Architecture
  32  | // Rise Ground Glass raster. They cover its one-sided side return, open
  33  | // street-side context, facade, and separately identifiable focus chart.
  34  | const ARCHITECTURE_RASTER_POINTS = [
  35  |   { id: "left-upper-context", u: 0.29, v: 0.48 },
  36  |   { id: "left-upper-facade", u: 0.37, v: 0.32 },
  37  |   { id: "facade-focus-chart", u: 0.51, v: 0.65 },
  38  |   { id: "right-facade-window", u: 0.63, v: 0.34 },
  39  |   { id: "left-side-context", u: 0.25, v: 0.54 },
  40  |   { id: "right-side-return", u: 0.75, v: 0.54 },
  41  |   { id: "left-lower-context", u: 0.29, v: 0.67 },
  42  |   { id: "right-lower-return", u: 0.76, v: 0.69 },
  43  |   { id: "lower-facade", u: 0.51, v: 0.81 },
  44  | ] as const;
  45  |
  46  | const captureGroundGlassOutput = async (page: Page, canvas: Locator, path: string) => {
  47  |   const hiddenSiblings = await canvas.evaluate((element) => {
  48  |     const imageLayer = document.querySelector('[data-testid="ground-glass-image-layer"]');
  49  |     const captureRoot = element.closest(".groundglass-viewport-frame")
  50  |       ?? imageLayer?.parentElement?.parentElement
  51  |       ?? imageLayer;
  52  |     const changed: HTMLElement[] = [];
  53  |     let current: Element | null = element;
  54  |     while (current && current !== captureRoot) {
  55  |       const parentElement: HTMLElement | null = current.parentElement;
  56  |       if (!parentElement) break;
  57  |       for (const sibling of Array.from(parentElement.children)) {
  58  |         if (sibling === current || !(sibling instanceof HTMLElement)) continue;
  59  |         sibling.dataset.rttCapturePreviousVisibility = sibling.style.visibility;
  60  |         sibling.style.visibility = "hidden";
  61  |         changed.push(sibling);
  62  |       }
  63  |       current = parentElement;
  64  |     }
  65  |     return changed.length;
  66  |   });
  67  |   expect(hiddenSiblings).toBeGreaterThan(0);
  68  |   try {
  69  |     return await canvas.screenshot({ animations: "disabled", path });
  70  |   } finally {
  71  |     await page.locator('[data-rtt-capture-previous-visibility]').evaluateAll((elements) => {
  72  |       for (const element of elements) {
  73  |         const htmlElement = element as HTMLElement;
  74  |         htmlElement.style.visibility = htmlElement.dataset.rttCapturePreviousVisibility ?? "";
  75  |         delete htmlElement.dataset.rttCapturePreviousVisibility;
  76  |       }
  77  |     });
  78  |   }
  79  | };
  80  |
  81  | const readCanvasPatches = async (
  82  |   canvas: Locator,
  83  |   screenshotBase64: string,
  84  |   points: readonly { u: number; v: number }[],
  85  | ) => {
> 86  |   return canvas.evaluate(async (_element, input) => {
      |                 ^ Error: locator.evaluate: Test timeout of 90000ms exceeded.
  87  |     const image = new Image();
  88  |     image.src = `data:image/png;base64,${input.screenshotBase64}`;
  89  |     await image.decode();
  90  |     const sampleCanvas = document.createElement("canvas");
  91  |     sampleCanvas.width = image.width;
  92  |     sampleCanvas.height = image.height;
  93  |     const context = sampleCanvas.getContext("2d");
  94  |     if (!context) throw new Error("Unable to inspect the captured Ground Glass WebGL output");
  95  |     context.drawImage(image, 0, 0);
  96  |     const pixels = context.getImageData(0, 0, image.width, image.height).data;
  97  |     const radiusX = Math.max(2, Math.round(image.width * 0.01));
  98  |     const radiusY = Math.max(2, Math.round(image.height * 0.01));
  99  |
  100 |     return input.points.map(({ u, v }) => {
  101 |       const centerX = Math.min(image.width - 1, Math.max(0, Math.round(u * (image.width - 1))));
  102 |       const centerY = Math.min(image.height - 1, Math.max(0, Math.round(v * (image.height - 1))));
  103 |       let red = 0;
  104 |       let green = 0;
  105 |       let blue = 0;
  106 |       let count = 0;
  107 |       for (let y = Math.max(0, centerY - radiusY); y <= Math.min(image.height - 1, centerY + radiusY); y += 1) {
  108 |         for (let x = Math.max(0, centerX - radiusX); x <= Math.min(image.width - 1, centerX + radiusX); x += 1) {
  109 |           const offset = (y * image.width + x) * 4;
  110 |           red += pixels[offset] ?? 0;
  111 |           green += pixels[offset + 1] ?? 0;
  112 |           blue += pixels[offset + 2] ?? 0;
  113 |           count += 1;
  114 |         }
  115 |       }
  116 |       return { red: red / count, green: green / count, blue: blue / count };
  117 |     });
  118 |   }, { screenshotBase64, points });
  119 | };
  120 |
  121 | const readTargetCell = async (page: Page, targetId: string) =>
  122 |   page.getByTestId("focus-distribution-panel").locator(`[data-focus-target-id="${targetId}"]`)
  123 |     .evaluate((element) => {
  124 |       const cell = element.closest("td");
  125 |       const row = cell?.closest("tr");
  126 |       if (!cell || !row) throw new Error(`Target ${targetId} is not placed in the Focus Distribution grid`);
  127 |       return {
  128 |         rowIndex: Array.from(row.parentElement?.children ?? []).indexOf(row),
  129 |         columnIndex: Array.from(row.children).indexOf(cell),
  130 |       };
  131 |     });
  132 |
  133 | const readTargetMarkerOffset = async (page: Page, targetId: string) =>
  134 |   page.getByTestId("focus-distribution-panel")
  135 |     .locator(`[data-focus-target-id="${targetId}"]`)
  136 |     .evaluate((element) => ({
  137 |       x: (element as HTMLElement).style.getPropertyValue("--focus-distribution-target-marker-x"),
  138 |       y: (element as HTMLElement).style.getPropertyValue("--focus-distribution-target-marker-y"),
  139 |     }));
  140 |
  141 | const meanPatchDifference = (
  142 |   left: readonly { red: number; green: number; blue: number }[],
  143 |   right: readonly { red: number; green: number; blue: number }[],
  144 | ) => {
  145 |   if (left.length !== right.length || left.length === 0) throw new Error("Raster comparison needs paired patches");
  146 |   const channelDifference = left.reduce((total, patch, index) => {
  147 |     const counterpart = right[index];
  148 |     if (!counterpart) throw new Error("Raster comparison patch is missing");
  149 |     return total + Math.abs(patch.red - counterpart.red)
  150 |       + Math.abs(patch.green - counterpart.green)
  151 |       + Math.abs(patch.blue - counterpart.blue);
  152 |   }, 0);
  153 |   return channelDifference / (left.length * 3);
  154 | };
  155 |
  156 | test("Macro depth targets, Focus Distribution, and Raw/Upright raster stay aligned", async ({ page }, testInfo) => {
  157 |   test.setTimeout(90_000);
  158 |   await page.goto("/simulator/free/macro-depth-of-field");
  159 |
  160 |   const scene = page.getByTestId("scene-canvas");
  161 |   const rtt = page.getByTestId("ground-glass-rtt");
  162 |   const rttCanvas = rtt.locator("canvas");
  163 |   const distribution = page.getByTestId("focus-distribution-panel");
  164 |   await expect(scene.locator("canvas")).toHaveCount(1);
  165 |   await expect(rtt.locator("canvas")).toHaveCount(1);
  166 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  167 |   await expect(rtt).toHaveAttribute("data-rtt-resource-generation", /\d+/, { timeout: 60_000 });
  168 |   await expect(distribution.locator("[data-focus-target-id]")).toHaveCount(3);
  169 |
  170 |   const rawMarkerOffsets = new Map<string, { x: string; y: string }>();
  171 |   for (const targetId of TARGET_IDS) {
  172 |     await expect.poll(() => readTargetCell(page, targetId)).toEqual({
  173 |       rowIndex: 1,
  174 |       columnIndex: TARGET_COLUMNS.raw[targetId],
  175 |     });
  176 |     rawMarkerOffsets.set(targetId, await readTargetMarkerOffset(page, targetId));
  177 |   }
  178 |   const rawRttImage = await captureGroundGlassOutput(page,
  179 |     rttCanvas,
  180 |     testInfo.outputPath("macro-depth-of-field-raw-webgl-canvas.png"),
  181 |   );
  182 |   const rawPatches = await readCanvasPatches(
  183 |     rttCanvas,
  184 |     rawRttImage.toString("base64"),
  185 |     SPECIMEN_PROFILE_V.map((v) => ({ u: 0.5, v })),
  186 |   );
```