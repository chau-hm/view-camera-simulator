# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: macro-depth-of-field-orientation.spec.ts >> Architecture Rise WebGL raster distinguishes the Raw/Upright X and Y mapping
- Location: src/tests/e2e/macro-depth-of-field-orientation.spec.ts:237:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('ground-glass-rtt').first().locator('canvas')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByTestId('ground-glass-rtt').first().locator('canvas')
    5 × locator resolved to 0 elements
      - unexpected value "0"

```

# Test source

```ts
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
> 243 |   await expect(canvas).toHaveCount(1);
      |                        ^ Error: expect(locator).toHaveCount(expected) failed
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
  265 |     page,
  266 |     canvas,
  267 |     testInfo.outputPath("architecture-rise-upright-webgl-raster.png"),
  268 |   );
  269 |   const uprightPoints = await readCanvasPatches(
  270 |     canvas,
  271 |     uprightImage.toString("base64"),
  272 |     ARCHITECTURE_RASTER_POINTS.map(({ u, v }) => ({ u: 1 - u, v: 1 - v })),
  273 |   );
  274 |   const incorrectHorizontalPoints = await readCanvasPatches(
  275 |     canvas,
  276 |     uprightImage.toString("base64"),
  277 |     ARCHITECTURE_RASTER_POINTS.map(({ u, v }) => ({ u, v: 1 - v })),
  278 |   );
  279 |   const incorrectVerticalPoints = await readCanvasPatches(
  280 |     canvas,
  281 |     uprightImage.toString("base64"),
  282 |     ARCHITECTURE_RASTER_POINTS.map(({ u, v }) => ({ u: 1 - u, v })),
  283 |   );
  284 |   const correctDifference = meanPatchDifference(rawPatches, uprightPoints);
  285 |   const incorrectHorizontalDifference = meanPatchDifference(rawPatches, incorrectHorizontalPoints);
  286 |   const incorrectVerticalDifference = meanPatchDifference(rawPatches, incorrectVerticalPoints);
  287 |   await testInfo.attach("architecture-rise-upright-webgl-raster", { body: uprightImage, contentType: "image/png" });
  288 |   const rasterEvidence = JSON.stringify({
  289 |     points: ARCHITECTURE_RASTER_POINTS,
  290 |     rawPatches,
  291 |     uprightPatches: uprightPoints,
  292 |     incorrectHorizontalPoints,
  293 |     incorrectVerticalPoints,
  294 |     meanChannelDifference: {
  295 |       correct: correctDifference,
  296 |       incorrectHorizontal: incorrectHorizontalDifference,
  297 |       incorrectVertical: incorrectVerticalDifference,
  298 |     },
  299 |   }, null, 2);
  300 |   await testInfo.attach("architecture-rise-raster-mapping-differences", {
  301 |     body: rasterEvidence,
  302 |     contentType: "application/json",
  303 |   });
  304 |   await writeFile(testInfo.outputPath("architecture-rise-raster-mapping-differences.json"), rasterEvidence);
  305 |   const luminance = ({ red, green, blue }: { red: number; green: number; blue: number }) =>
  306 |     (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
  307 |   const sideContextIndex = ARCHITECTURE_RASTER_POINTS.findIndex(({ id }) => id === "left-side-context");
  308 |   const sideReturnIndex = ARCHITECTURE_RASTER_POINTS.findIndex(({ id }) => id === "right-side-return");
  309 |   const rawSideContext = rawPatches[sideContextIndex];
  310 |   const rawSideReturn = rawPatches[sideReturnIndex];
  311 |   expect(rawSideContext).toBeDefined();
  312 |   expect(rawSideReturn).toBeDefined();
  313 |   // Architecture Rise has a one-sided side-return mass at +X (the subject
  314 |   // factory places it at x=1900 mm). In Raw screen coordinates it occupies
  315 |   // this independently selected right-side patch; the opposite patch is open
  316 |   // context. This absolute landmark catches a shared wrong transform in both
  317 |   // preview modes, which cross-mode comparison alone cannot expose.
  318 |   expect(luminance(rawSideReturn!) + 20, "one-sided Architecture Rise return must occupy the fixed Raw-side patch").toBeLessThan(luminance(rawSideContext!));
  319 |   expect(Math.max(...rawPatches.map(luminance)) - Math.min(...rawPatches.map(luminance)), "fixed samples must span real raster contrast").toBeGreaterThan(20);
  320 |   expect(correctDifference, "Raw and Upright counterpart patches should match").toBeLessThan(8);
  321 |   expect(incorrectHorizontalDifference, "omitting horizontal reflection must worsen raster agreement").toBeGreaterThan(correctDifference + 8);
  322 |   expect(incorrectVerticalDifference, "omitting vertical reflection must worsen raster agreement").toBeGreaterThan(correctDifference + 8);
  323 | });
  324 | 
```