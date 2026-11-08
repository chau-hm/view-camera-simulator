# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scene-viewport-expansion.spec.ts >> simulator viewports expand in main without replacing their active canvases
- Location: src/tests/e2e/scene-viewport-expansion.spec.ts:97:1

# Error details

```
Error: expect(received).toBeCloseTo(expected, precision)

Expected: 1.25
Received: 1.1988203216292916

Expected precision:    2
Expected difference: < 0.005
Received difference:   0.05117967837070836
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
          - generic "GroundGlassColumn" [ref=e22]:
            - generic [ref=e23]:
              - generic [ref=e25]: center_focus_strong
              - heading "Ground Glass" [level=2] [ref=e26]
            - generic [ref=e27]:
              - generic [ref=e29]:
                - group "Preview" [ref=e30]:
                  - generic [ref=e31]: Preview
                  - generic [ref=e33]:
                    - generic [ref=e34]:
                      - radio "Raw Ground Glass" [checked] [ref=e35]
                      - generic [ref=e36]: Raw Ground Glass
                    - generic [ref=e37]:
                      - radio "Upright Assist" [ref=e38]
                      - generic [ref=e39]: Upright Assist
                - group "View Options" [ref=e40]:
                  - generic [ref=e41]: View Options
                  - region "View Options" [ref=e43]:
                    - generic [ref=e45]:
                      - checkbox "Grid" [checked] [ref=e46]
                      - generic [ref=e47]: Grid
              - generic "GroundGlassViewport" [ref=e48]:
                - generic [ref=e50]:
                  - generic [ref=e51]:
                    - button "Focus loupe · 4× Ground Glass" [ref=e52]:
                      - generic:
                        - generic: Ground glass preview
                        - generic:
                          - generic: 8890.0 mm focus / CoC 0.000 mm (100%)
                    - button "Focus loupe · 4× Ground Glass view" [ref=e56] [cursor=pointer]: Focus loupe · 4×
                  - generic [ref=e57]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                - region "Task and Feedback":
                  - button "Open Task and Feedback" [ref=e58] [cursor=pointer]:
                    - generic [ref=e59]: Task and Feedback
                - button "Restore Ground Glass" [active] [ref=e60] [cursor=pointer]:
                  - generic [ref=e61]: close_fullscreen
        - complementary [ref=e62]:
          - generic [ref=e63]:
            - region "Camera Controls" [ref=e64]:
              - heading "Camera Controls" [level=3] [ref=e66]
              - generic [ref=e67]:
                - region "Movement" [ref=e69]:
                  - generic [ref=e70]:
                    - heading "Front standard" [level=4] [ref=e71]
                    - button "Help" [ref=e72] [cursor=pointer]:
                      - generic [ref=e73]: "?"
                  - generic [ref=e74]:
                    - generic [ref=e75]:
                      - generic [ref=e76]: Rise
                      - slider "Rise" [ref=e77]: "0"
                      - generic [ref=e78]: 0.0 mm
                    - generic [ref=e79]:
                      - generic [ref=e80]: Tilt
                      - slider "Tilt" [ref=e81]: "0"
                      - generic [ref=e82]: 0.0°
                    - generic [ref=e83]:
                      - generic [ref=e84]: Swing
                      - slider "Swing" [ref=e85]: "0"
                      - generic [ref=e86]: 0.0°
                - region "Focus" [ref=e88]:
                  - heading "Focus" [level=3] [ref=e89]
                  - generic [ref=e90]:
                    - generic [ref=e91]: Focus distance
                    - slider "Focus distance" [ref=e92]: "8890"
                    - generic [ref=e93]: 8890.0 mm
                    - button "Infinity Reset" [ref=e95] [cursor=pointer]: ∞
                - region "Aperture" [ref=e97]:
                  - heading "Aperture" [level=3] [ref=e98]
                  - radiogroup "Aperture" [ref=e99]:
                    - generic [ref=e100] [cursor=pointer]:
                      - radio "f/5.6" [ref=e101]
                      - generic [ref=e102]: f/5.6
                    - generic [ref=e103] [cursor=pointer]:
                      - radio "f/8" [ref=e104]
                      - generic [ref=e105]: f/8
                    - generic [ref=e106] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e107]
                      - generic [ref=e108]: f/11
                    - generic [ref=e109] [cursor=pointer]:
                      - radio "f/16" [ref=e110]
                      - generic [ref=e111]: f/16
                    - generic [ref=e112] [cursor=pointer]:
                      - radio "f/22" [ref=e113]
                      - generic [ref=e114]: f/22
                    - generic [ref=e115] [cursor=pointer]:
                      - radio "f/32" [ref=e116]
                      - generic [ref=e117]: f/32
                - generic [ref=e118]:
                  - generic [ref=e119]: Reset
                  - region "Reset" [ref=e120]:
                    - button "Reset movements" [ref=e122] [cursor=pointer]
            - region "Developer Tools" [ref=e123]:
              - heading "Developer Tools" [level=3] [ref=e124]
              - generic [ref=e126]:
                - checkbox "Raw RTT — bypass DOF" [ref=e127]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  212 |     await page.getByRole("button", { name: "Restore 3D Scene" }).click();
  213 |     await expect(page.getByRole("button", { name: "Expand 3D Scene" })).toBeFocused();
  214 |     await expect(page.getByLabel("GroundGlassColumn")).toBeVisible();
  215 |     await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
  216 |     expect(
  217 |       await page.evaluate(
  218 |         (node) => node === document.querySelector('[data-testid="scene-canvas"]'),
  219 |         originalRenderer,
  220 |       ),
  221 |     ).toBe(true);
  222 |
  223 |     const restoredLayout = await readRestoredLayout();
  224 |     expect(restoredLayout.renderer.width / restoredLayout.renderer.height).toBeCloseTo(5 / 4, 2);
  225 |     expect(restoredLayout.renderer.left).toBeGreaterThanOrEqual(restoredLayout.sceneCard.left);
  226 |     expect(restoredLayout.renderer.right).toBeLessThanOrEqual(restoredLayout.sceneCard.right);
  227 |     expect(restoredLayout.renderer.bottom).toBeLessThanOrEqual(restoredLayout.sceneCard.bottom);
  228 |     expect(restoredLayout.renderer.right).toBeLessThanOrEqual(restoredLayout.groundGlassCard.left);
  229 |     expect(restoredLayout.sceneCard.right).toBeLessThanOrEqual(restoredLayout.groundGlassCard.left);
  230 |   }
  231 |
  232 |   await page.getByRole("button", { name: "Expand 3D Scene" }).click();
  233 |   const overlayMenu = page.getByRole("button", { name: "View overlays" });
  234 |   await overlayMenu.click();
  235 |   await expect(overlayMenu).toHaveAttribute("aria-expanded", "true");
  236 |   const overlayChoice = page.getByRole("button", { name: "Hide Focus plane" });
  237 |   await overlayChoice.focus();
  238 |   await page.keyboard.press("Escape");
  239 |   await expect(overlayMenu).toHaveAttribute("aria-expanded", "false");
  240 |   await expect(overlayMenu).toBeFocused();
  241 |   await expect(page.getByRole("button", { name: "Restore 3D Scene" })).toBeVisible();
  242 |   await expect(sceneRenderer).toHaveCount(1);
  243 |   await expect(sceneRenderer.locator("canvas")).toHaveCount(1);
  244 |   expect(
  245 |     await page.evaluate(
  246 |       (node) => node === document.querySelector('[data-testid="scene-canvas"]'),
  247 |       originalRenderer,
  248 |     ),
  249 |   ).toBe(true);
  250 |   await page.keyboard.press("Escape");
  251 |   await expect(page.getByRole("button", { name: "Expand 3D Scene" })).toBeFocused();
  252 |
  253 |   await page.getByRole("button", { name: "Expand 3D Scene" }).click();
  254 |   await page.getByRole("button", { name: "Help" }).click();
  255 |   await expect(page.getByRole("dialog", { name: "Movement help" })).toBeVisible();
  256 |   await expect(page.getByRole("button", { name: "Close help" })).toBeFocused();
  257 |   await page.getByLabel("Tilt").focus();
  258 |   await page.keyboard.press("Escape");
  259 |   await expect(page.getByRole("dialog", { name: "Movement help" })).toHaveCount(0);
  260 |   await expect(page.getByRole("button", { name: "Help" })).toBeFocused();
  261 |   await expect(page.getByRole("button", { name: "Restore 3D Scene" })).toBeVisible();
  262 |   await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
  263 |   await expect(sceneRenderer).toHaveCount(1);
  264 |   expect(
  265 |     await page.evaluate(
  266 |       (node) => node === document.querySelector('[data-testid="scene-canvas"]'),
  267 |       originalRenderer,
  268 |     ),
  269 |   ).toBe(true);
  270 |   await page.keyboard.press("Escape");
  271 |   await expect(page.getByRole("button", { name: "Expand 3D Scene" })).toBeFocused();
  272 |
  273 |   const groundGlassRenderer = page.getByTestId("ground-glass-rtt");
  274 |   await expect(groundGlassRenderer.locator("canvas")).toHaveCount(1);
  275 |   await expect(groundGlassRenderer).toHaveAttribute("data-rtt-resource-generation", /\d+/);
  276 |   const originalGroundGlassRenderer = await groundGlassRenderer.elementHandle();
  277 |   const originalGroundGlassCanvas = await groundGlassRenderer.locator("canvas").elementHandle();
  278 |   const originalResourceGeneration = await groundGlassRenderer.getAttribute("data-rtt-resource-generation");
  279 |   expect(originalGroundGlassRenderer).toBeTruthy();
  280 |   expect(originalGroundGlassCanvas).toBeTruthy();
  281 |
  282 |   await page.getByRole("button", { name: "Expand Ground Glass" }).click();
  283 |   await expect(page.getByRole("button", { name: "Restore Ground Glass" })).toBeFocused();
  284 |   await expect(page.getByTestId("scene-canvas")).toHaveCount(0);
  285 |   await expect(groundGlassRenderer).toHaveCount(1);
  286 |   await expect(groundGlassRenderer.locator("canvas")).toHaveCount(1);
  287 |   await expect(page.getByRole("dialog")).toHaveCount(0);
  288 |   await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
  289 |   expect(
  290 |     await page.evaluate(
  291 |       (node) => node === document.querySelector('[data-testid="ground-glass-rtt"]'),
  292 |       originalGroundGlassRenderer,
  293 |     ),
  294 |   ).toBe(true);
  295 |   expect(
  296 |     await page.evaluate(
  297 |       (node) => node === document.querySelector('[data-testid="ground-glass-rtt"] canvas'),
  298 |       originalGroundGlassCanvas,
  299 |     ),
  300 |   ).toBe(true);
  301 |   await expect(groundGlassRenderer).toHaveAttribute(
  302 |     "data-rtt-resource-generation",
  303 |     originalResourceGeneration ?? "",
  304 |   );
  305 |
  306 |   const groundGlassLayout = await readExpandedLayout(".groundglass-renderer-host--expanded");
  307 |   expect(groundGlassLayout.card.left).toBeGreaterThanOrEqual(groundGlassLayout.main.left - 1);
  308 |   expect(groundGlassLayout.card.right).toBeLessThanOrEqual(groundGlassLayout.main.right + 1);
  309 |   expect(groundGlassLayout.card.right).toBeLessThan(groundGlassLayout.aside.left);
  310 |   expect(groundGlassLayout.renderer.width).toBeGreaterThan(0);
  311 |   expect(groundGlassLayout.renderer.height).toBeGreaterThan(0);
> 312 |   expect(groundGlassLayout.renderer.width / groundGlassLayout.renderer.height).toBeCloseTo(5 / 4, 2);
      |                                                                                ^ Error: expect(received).toBeCloseTo(expected, precision)
  313 |   expect(groundGlassLayout.mainOverflowY).toBe("hidden");
  314 |   expect(groundGlassLayout.aside.overflowY).toBe("auto");
  315 |
  316 |   const tilt = page.getByLabel("Tilt");
  317 |   const tiltBefore = await tilt.inputValue();
  318 |   await tilt.press("ArrowRight");
  319 |   await expect(tilt).not.toHaveValue(tiltBefore);
  320 |
  321 |   await page.getByRole("button", { name: "Focus loupe · 4× Ground Glass view" }).click();
  322 |   const zoomedGroundGlass = page.getByRole("region", { name: "Pan Ground Glass" });
  323 |   await expect(zoomedGroundGlass).toHaveAttribute("data-zoomed", "true");
  324 |   await zoomedGroundGlass.focus();
  325 |   await page.keyboard.press("Escape");
  326 |   await expect(page.getByRole("button", { name: "Focus loupe · 4× Ground Glass", exact: true })).toHaveAttribute(
  327 |     "data-zoomed",
  328 |     "false",
  329 |   );
  330 |   await expect(page.getByRole("button", { name: "Restore Ground Glass" })).toBeVisible();
  331 |   await expect(page.getByTestId("scene-canvas")).toHaveCount(0);
  332 |   await expect(groundGlassRenderer).toHaveCount(1);
  333 |   await expect(groundGlassRenderer.locator("canvas")).toHaveCount(1);
  334 |   expect(
  335 |     await page.evaluate(
  336 |       (node) => node === document.querySelector('[data-testid="ground-glass-rtt"]'),
  337 |       originalGroundGlassRenderer,
  338 |     ),
  339 |   ).toBe(true);
  340 |
  341 |   await page.keyboard.press("Escape");
  342 |   await expect(page.getByRole("button", { name: "Expand Ground Glass" })).toBeFocused();
  343 |   await expect(page.getByTestId("scene-canvas")).toHaveCount(1);
  344 |   await expect(page.getByLabel("GroundGlassColumn")).toBeVisible();
  345 |   await expect(page.getByRole("region", { name: "Camera Controls" })).toBeVisible();
  346 |   expect(
  347 |     await page.evaluate(
  348 |       (node) => node === document.querySelector('[data-testid="ground-glass-rtt"]'),
  349 |       originalGroundGlassRenderer,
  350 |     ),
  351 |   ).toBe(true);
  352 |   expect(
  353 |     await page.evaluate(
  354 |       (node) => node === document.querySelector('[data-testid="ground-glass-rtt"] canvas'),
  355 |       originalGroundGlassCanvas,
  356 |     ),
  357 |   ).toBe(true);
  358 | });
  359 |
  360 | test("Ground Glass RTT follows expanded and live browser sizes without reallocating", async ({ page }) => {
  361 |   test.setTimeout(180_000);
  362 |   const pageErrors: string[] = [];
  363 |   const rendererWarnings: string[] = [];
  364 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  365 |   page.on("console", (message) => {
  366 |     if (isKnownFiberClockDeprecation(message)) return;
  367 |     const text = message.text();
  368 |     if (/GPU stall due to ReadPixels/i.test(text)) return;
  369 |     if (message.type() === "error" || (message.type() === "warning" && /React|Three|WebGL|render target|disposed|context lost/i.test(text))) {
  370 |       rendererWarnings.push(text);
  371 |     }
  372 |   });
  373 |   await page.setViewportSize({ width: 1440, height: 1000 });
  374 |   await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  375 |
  376 |   const rtt = page.getByTestId("ground-glass-rtt");
  377 |   const canvas = rtt.locator("canvas");
  378 |   await expect(rtt).toBeVisible();
  379 |   await expect(canvas).toHaveCount(1);
  380 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 120_000 });
  381 |   const rttHandle = await rtt.elementHandle();
  382 |   const canvasHandle = await canvas.elementHandle();
  383 |   if (!rttHandle || !canvasHandle) throw new Error("RTT identity handles unavailable");
  384 |   const normal = await readRttSnapshot(page);
  385 |   expect(normal.stageWidth / normal.stageHeight).toBeCloseTo(5 / 4, 2);
  386 |   expect(normal.logicalWidth).toBeGreaterThan(0);
  387 |   expect(normal.logicalWidth).toBeLessThan(900);
  388 |   expect(Math.abs(normal.logicalWidth - normal.stageWidth)).toBeLessThanOrEqual(LOGICAL_SIZE_TOLERANCE_PX);
  389 |   expect(Math.abs(normal.logicalHeight - normal.stageHeight)).toBeLessThanOrEqual(LOGICAL_SIZE_TOLERANCE_PX);
  390 |   expect(normal.internalWidth).toBe(normal.colorWidth);
  391 |   expect(normal.internalHeight).toBe(normal.colorHeight);
  392 |   expect(normal.colorWidth).toBe(normal.depthWidth);
  393 |   expect(normal.colorHeight).toBe(normal.depthHeight);
  394 |   expect(normal.blurWidth).toBe(Math.max(1, Math.floor(normal.internalWidth * normal.gatherScale)));
  395 |   expect(normal.blurHeight).toBe(Math.max(1, Math.floor(normal.internalHeight * normal.gatherScale)));
  396 |   expect(normal.colorWidth).toBe(normal.finalWidth);
  397 |   expect(normal.colorHeight).toBe(normal.finalHeight);
  398 |   expect(normal.horizontalShaderWidth).toBe(normal.internalWidth);
  399 |   expect(normal.horizontalShaderHeight).toBe(normal.internalHeight);
  400 |   expect(normal.verticalShaderWidth).toBe(normal.internalWidth);
  401 |   expect(normal.verticalShaderHeight).toBe(normal.internalHeight);
  402 |
  403 |   await page.getByRole("button", { name: "Expand Ground Glass" }).click();
  404 |   await expect(page.getByRole("button", { name: "Restore Ground Glass" })).toBeVisible();
  405 |   await expect.poll(async () => (await readRttSnapshot(page)).logicalWidth, { timeout: 30_000 }).toBeGreaterThan(normal.logicalWidth);
  406 |   const expanded = await readRttSnapshot(page);
  407 |   expect(expanded.stageWidth / expanded.stageHeight).toBeCloseTo(5 / 4, 2);
  408 |   expect(Math.abs(expanded.logicalWidth - expanded.stageWidth)).toBeLessThanOrEqual(LOGICAL_SIZE_TOLERANCE_PX);
  409 |   expect(Math.abs(expanded.logicalHeight - expanded.stageHeight)).toBeLessThanOrEqual(LOGICAL_SIZE_TOLERANCE_PX);
  410 |   expect(expanded.horizontalShaderWidth).toBe(expanded.internalWidth);
  411 |   expect(expanded.verticalShaderWidth).toBe(expanded.internalWidth);
  412 |   expect(expanded.generation).toBe(normal.generation);
```