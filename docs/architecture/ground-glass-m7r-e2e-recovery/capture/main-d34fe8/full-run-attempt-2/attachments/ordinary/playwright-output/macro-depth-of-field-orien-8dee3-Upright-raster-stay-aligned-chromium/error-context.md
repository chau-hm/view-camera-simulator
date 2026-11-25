# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: macro-depth-of-field-orientation.spec.ts >> Macro depth targets, Focus Distribution, and Raw/Upright raster stay aligned
- Location: src/tests/e2e/macro-depth-of-field-orientation.spec.ts:156:1

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
          - generic [ref=e12]: Three-Dimensional Macro
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
                            - generic: 400.0 mm focus / CoC 0.412 mm (0%)
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
                  - generic:
                    - generic "farDof plane"
                  - generic [ref=e117]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e123]: Near detail
                  - generic [ref=e127]: Middle detail
                  - generic [ref=e131]: Far detail
              - generic "Optical depth order" [ref=e133]:
                - generic [ref=e136]: Film 0 mm
                - generic [ref=e139]: Lens 240 mm
                - generic [ref=e142]: DOF limit 638 mm
                - generic [ref=e145]: Focus 640 mm
                - generic [ref=e148]: Far DOF 642 mm
            - region "Focus distribution · Focus" [ref=e150]:
              - generic [ref=e151]:
                - heading "Focus distribution" [level=4] [ref=e152]
                - 'generic "Ground Glass orientation: Raw" [ref=e153]': Raw
              - table "Focus distribution" [ref=e154]:
                - caption [ref=e155]: Focus distribution
                - rowgroup [ref=e156]:
                  - row [ref=e157]:
                    - cell [ref=e158]
                    - cell [ref=e159]
                    - cell [ref=e160]
                  - 'row "Middle left Middle left · Near detail: 0% · Soft Centre Centre · Middle detail: 100% · Sharp Middle right Middle right · Far detail: 0% · Soft" [ref=e161]':
                    - 'cell "Middle left Middle left · Near detail: 0% · Soft" [ref=e162]':
                      - generic "Middle left" [ref=e163]
                      - 'group "Middle left · Near detail: 0% · Soft" [ref=e165]':
                        - generic "Near detail" [ref=e167]
                        - generic [ref=e168]:
                          - text: 0%
                          - generic [ref=e169]: —
                    - 'cell "Centre Centre · Middle detail: 100% · Sharp" [ref=e170]':
                      - generic "Centre" [ref=e171]
                      - 'group "Centre · Middle detail: 100% · Sharp" [ref=e173]':
                        - generic "Middle detail" [ref=e175]
                        - generic [ref=e176]:
                          - text: 100%
                          - generic [ref=e177]: ✓
                    - 'cell "Middle right Middle right · Far detail: 0% · Soft" [ref=e178]':
                      - generic "Middle right" [ref=e179]
                      - 'group "Middle right · Far detail: 0% · Soft" [ref=e181]':
                        - generic "Far detail" [ref=e183]
                        - generic [ref=e184]:
                          - text: 0%
                          - generic [ref=e185]: —
                  - row [ref=e186]:
                    - cell [ref=e187]
                    - cell [ref=e188]
                    - cell [ref=e189]
          - group [ref=e192]:
            - generic "Optical Debug macro-depth-of-field · parallel" [ref=e193] [cursor=pointer]:
              - generic [ref=e194]: Optical Debug
              - generic [ref=e195]: macro-depth-of-field · parallel
        - complementary [ref=e196]:
          - generic [ref=e197]:
            - region "Camera Controls" [ref=e198]:
              - heading "Camera Controls" [level=3] [ref=e200]
              - generic [ref=e201]:
                - region "Focus" [ref=e203]:
                  - heading "Focus" [level=3] [ref=e204]
                  - generic [ref=e205]:
                    - generic [ref=e206]: Focus distance
                    - slider "Focus distance" [ref=e207]: "400"
                    - generic [ref=e208]: 400.0 mm
                - region "Aperture" [ref=e210]:
                  - heading "Aperture" [level=3] [ref=e211]
                  - radiogroup "Aperture" [ref=e212]:
                    - generic [ref=e213] [cursor=pointer]:
                      - radio "f/5.6" [checked] [ref=e214]
                      - generic [ref=e215]: f/5.6
                    - generic [ref=e216] [cursor=pointer]:
                      - radio "f/8" [ref=e217]
                      - generic [ref=e218]: f/8
                    - generic [ref=e219] [cursor=pointer]:
                      - radio "f/11" [ref=e220]
                      - generic [ref=e221]: f/11
                    - generic [ref=e222] [cursor=pointer]:
                      - radio "f/16" [ref=e223]
                      - generic [ref=e224]: f/16
                    - generic [ref=e225] [cursor=pointer]:
                      - radio "f/22" [ref=e226]
                      - generic [ref=e227]: f/22
                    - generic [ref=e228] [cursor=pointer]:
                      - radio "f/32" [ref=e229]
                      - generic [ref=e230]: f/32
            - region "Developer Tools" [ref=e231]:
              - heading "Developer Tools" [level=3] [ref=e232]
              - generic [ref=e234]:
                - checkbox "Raw RTT — bypass DOF" [ref=e235]
                - text: Raw RTT — bypass DOF
          - region "Macro focus" [ref=e237]:
            - heading "Macro focus" [level=3] [ref=e238]
            - generic [ref=e239]:
              - generic [ref=e240]:
                - term [ref=e241]: Bellows extension (lens to film)
                - definition [ref=e242]: 240.0 mm
              - generic [ref=e243]:
                - term [ref=e244]: Magnification
                - definition [ref=e245]: 0.60×
              - generic [ref=e246]:
                - term [ref=e247]: Bellows factor
                - definition [ref=e248]: 2.56×
              - generic [ref=e249]:
                - term [ref=e250]: Exposure compensation
                - definition [ref=e251]: +1.36 stops
            - generic [ref=e252]: At the selected focus plane. Exposure compensation assumes a symmetric thin lens.
```

# Test source

```ts
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
  86  |   return canvas.evaluate(async (_element, input) => {
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
> 164 |   await expect(scene.locator("canvas")).toHaveCount(1);
      |                                         ^ Error: expect(locator).toHaveCount(expected) failed
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
  187 |   await testInfo.attach("macro-depth-of-field-raw-webgl-output", { body: rawRttImage, contentType: "image/png" });
  188 |   await page.screenshot({ path: testInfo.outputPath("macro-depth-of-field-raw-rtt.png"), animations: "disabled" });
  189 |   await page.screenshot({ path: testInfo.outputPath("macro-depth-of-field-raw.png") });
  190 | 
  191 |   await page.getByRole("radio", { name: "Upright Assist" }).check();
  192 |   await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Upright");
  193 |   await page.evaluate(() => new Promise<void>((resolve) => {
  194 |     requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  195 |   }));
  196 |   for (const targetId of TARGET_IDS) {
  197 |     await expect.poll(() => readTargetCell(page, targetId)).toEqual({
  198 |       rowIndex: 1,
  199 |       columnIndex: TARGET_COLUMNS.upright[targetId],
  200 |     });
  201 |     const rawOffset = rawMarkerOffsets.get(targetId);
  202 |     const uprightOffset = await readTargetMarkerOffset(page, targetId);
  203 |     expect(rawOffset).toBeDefined();
  204 |     expect(uprightOffset.x).toBe(rawOffset?.x === "-3px" ? "3px" : rawOffset?.x === "3px" ? "-3px" : "0px");
  205 |     expect(uprightOffset.y).toBe(rawOffset?.y === "-3px" ? "3px" : rawOffset?.y === "3px" ? "-3px" : "0px");
  206 |   }
  207 |   const uprightRttImage = await captureGroundGlassOutput(page,
  208 |     rttCanvas,
  209 |     testInfo.outputPath("macro-depth-of-field-upright-webgl-canvas.png"),
  210 |   );
  211 |   const uprightPatches = await readCanvasPatches(
  212 |     rttCanvas,
  213 |     uprightRttImage.toString("base64"),
  214 |     SPECIMEN_PROFILE_V.map((v) => ({ u: 0.5, v: 1 - v })),
  215 |   );
  216 |   await testInfo.attach("macro-depth-of-field-upright-webgl-output", { body: uprightRttImage, contentType: "image/png" });
  217 |   await page.screenshot({ path: testInfo.outputPath("macro-depth-of-field-upright-rtt.png"), animations: "disabled" });
  218 |   await testInfo.attach("macro-depth-of-field-orientation-samples", {
  219 |     body: JSON.stringify({ rawPatches, uprightPatches }, null, 2),
  220 |     contentType: "application/json",
  221 |   });
  222 |   const patchLuminance = [...rawPatches, ...uprightPatches]
  223 |     .map(({ red, green, blue }) => (red + green + blue) / 3);
  224 |   expect(Math.max(...patchLuminance) - Math.min(...patchLuminance)).toBeGreaterThan(20);
  225 |   for (let index = 0; index < rawPatches.length; index += 1) {
  226 |     const raw = rawPatches[index];
  227 |     const upright = uprightPatches[index];
  228 |     expect(raw).toBeDefined();
  229 |     expect(upright).toBeDefined();
  230 |     expect(Math.abs(raw!.red - upright!.red)).toBeLessThanOrEqual(8);
  231 |     expect(Math.abs(raw!.green - upright!.green)).toBeLessThanOrEqual(8);
  232 |     expect(Math.abs(raw!.blue - upright!.blue)).toBeLessThanOrEqual(8);
  233 |   }
  234 |   await page.screenshot({ path: testInfo.outputPath("macro-depth-of-field-upright.png") });
  235 | });
  236 | 
  237 | test("Architecture Rise WebGL raster distinguishes the Raw/Upright X and Y mapping", async ({ page }, testInfo) => {
  238 |   test.setTimeout(90_000);
  239 |   await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  240 | 
  241 |   const rtt = page.getByTestId("ground-glass-rtt").first();
  242 |   const canvas = rtt.locator("canvas");
  243 |   await expect(canvas).toHaveCount(1);
  244 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  245 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  246 | 
  247 |   const rawImage = await captureGroundGlassOutput(
  248 |     page,
  249 |     canvas,
  250 |     testInfo.outputPath("architecture-rise-raw-webgl-raster.png"),
  251 |   );
  252 |   const rawPatches = await readCanvasPatches(
  253 |     canvas,
  254 |     rawImage.toString("base64"),
  255 |     ARCHITECTURE_RASTER_POINTS,
  256 |   );
  257 |   await testInfo.attach("architecture-rise-raw-webgl-raster", { body: rawImage, contentType: "image/png" });
  258 | 
  259 |   await page.getByRole("radio", { name: "Upright Assist" }).check();
  260 |   await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Upright");
  261 |   await page.evaluate(() => new Promise<void>((resolve) => {
  262 |     requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  263 |   }));
  264 |   const uprightImage = await captureGroundGlassOutput(
```