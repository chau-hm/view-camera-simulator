# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ground-glass-webgpu-host.spec.ts >> development Raw request defaults to WebGL and URL parameters cannot authorize the adapter
- Location: src/tests/e2e/ground-glass-webgpu-host.spec.ts:434:1

# Error details

```
Error: expect(locator).not.toBeChecked() failed

Locator: getByLabel('Raw RTT — bypass DOF')
Expected: not checked
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "not toBeChecked" with timeout 5000ms
  - waiting for getByLabel('Raw RTT — bypass DOF')

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  343 |       const meanRed = red / count;
  344 |       const meanGreen = green / count;
  345 |       const meanBlue = blue / count;
  346 |       return {
  347 |         red: meanRed,
  348 |         green: meanGreen,
  349 |         blue: meanBlue,
  350 |         luminance: meanRed * 0.2126 + meanGreen * 0.7152 + meanBlue * 0.0722,
  351 |         darkCount,
  352 |         darkCentroidX: darkCount ? darkX / darkCount : null,
  353 |         darkCentroidY: darkCount ? darkY / darkCount : null,
  354 |         brightCount,
  355 |         brightCentroidX: brightCount ? brightX / brightCount : null,
  356 |         brightCentroidY: brightCount ? brightY / brightCount : null,
  357 |       };
  358 |     };
  359 |     return {
  360 |       width: canvas.width,
  361 |       height: canvas.height,
  362 |       points: points.map((point) => ({ ...point, ...read(point.u, point.v) })),
  363 |     };
  364 |   }, { base64: input.screenshot.toString("base64"), points: samplePoints });
  365 | 
  366 |   const correctPoints = inspected.points.filter((point) => point.mapping === "correct");
  367 |   const score = (points: typeof inspected.points) => points.reduce((sum, point) => sum + (
  368 |     point.expected === "dark"
  369 |       ? Math.max(0, point.luminance - 55)
  370 |       : Math.max(0, 145 - point.luminance)
  371 |   ), 0) / Math.max(1, points.length);
  372 |   const correctScore = score(correctPoints);
  373 |   const wrongAxisScores = Object.fromEntries([
  374 |     "horizontal-reflection",
  375 |     "vertical-reflection",
  376 |     "x-y-swap",
  377 |   ].map((mapping) => [mapping, score(inspected.points.filter((point) => point.mapping === mapping))]));
  378 |   const coordinateErrors = correctPoints.map((point) => {
  379 |     const centroidX = point.expected === "dark" ? point.darkCentroidX : point.brightCentroidX;
  380 |     const centroidY = point.expected === "dark" ? point.darkCentroidY : point.brightCentroidY;
  381 |     return {
  382 |       id: point.id,
  383 |       expected: point.expected,
  384 |       errorPx: centroidX === null || centroidY === null
  385 |         ? null
  386 |         : Math.hypot(
  387 |             centroidX - point.u * (inspected.width - 1),
  388 |             centroidY - point.v * (inspected.height - 1),
  389 |           ),
  390 |     };
  391 |   });
  392 | 
  393 |   return {
  394 |     camera,
  395 |     filmDimensionsMm: { width: CAMERA_CONSTANTS.filmWidthMm, height: CAMERA_CONSTANTS.filmHeightMm },
  396 |     sourceCrop,
  397 |     targetDimensionsPx: { width: inspected.width, height: inspected.height },
  398 |     landmarks: correctPoints,
  399 |     correctScore,
  400 |     wrongAxisScores,
  401 |     coordinateErrors,
  402 |   };
  403 | };
  404 | 
  405 | const assertIndependentGeometryEvidence = (
  406 |   evidence: Awaited<ReturnType<typeof verifyIndependentSignGeometry>>,
  407 |   options: Readonly<{
  408 |     minimumLandmarks?: number;
  409 |     checkAppearanceScore?: boolean;
  410 |     checkWrongAxisControls?: boolean;
  411 |   }> = {},
  412 | ) => {
  413 |   expect(evidence.landmarks.length).toBeGreaterThanOrEqual(options.minimumLandmarks ?? 4);
  414 |   if (options.checkAppearanceScore !== false) expect(evidence.correctScore, `independent geometry score: ${JSON.stringify({
  415 |     targetDimensionsPx: evidence.targetDimensionsPx,
  416 |     sourceCrop: evidence.sourceCrop,
  417 |     landmarks: evidence.landmarks.map(({ id, expected, u, v, luminance, darkCentroidX, darkCentroidY }) => ({
  418 |       id, expected, u, v, luminance, darkCentroidX, darkCentroidY,
  419 |     })),
  420 |     correctScore: evidence.correctScore,
  421 |     wrongAxisScores: evidence.wrongAxisScores,
  422 |     coordinateErrors: evidence.coordinateErrors,
  423 |   })}`).toBeLessThan(45);
  424 |   if (options.checkWrongAxisControls !== false) {
  425 |     for (const [negativeControl, score] of Object.entries(evidence.wrongAxisScores)) {
  426 |       expect(score, `${negativeControl} must disagree with the independent geometry oracle`).toBeGreaterThan(evidence.correctScore + 6);
  427 |     }
  428 |   }
  429 |   const measuredErrors = evidence.coordinateErrors.flatMap((point) => point.errorPx === null ? [] : [point.errorPx]);
  430 |   expect(measuredErrors.length).toBeGreaterThanOrEqual(1);
  431 |   expect(Math.max(...measuredErrors)).toBeLessThanOrEqual(6);
  432 | };
  433 | 
  434 | test("development Raw request defaults to WebGL and URL parameters cannot authorize the adapter", async ({ page }) => {
  435 |   const webgpuModuleRequests: string[] = [];
  436 |   page.on("request", (request) => {
  437 |     if (/three[/._-]webgpu|GroundGlassWebGPUAdapter/i.test(request.url())) webgpuModuleRequests.push(request.url());
  438 |   });
  439 |   await page.setViewportSize({ width: 1440, height: 1000 });
  440 |   await page.goto("/simulator/free/architecture-rise?groundGlassBackend=webgpu&rawDebug=true&rttDiagnostics=1");
  441 | 
  442 |   const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
> 443 |   await expect(page.getByLabel("Raw RTT — bypass DOF")).not.toBeChecked();
      |                                                             ^ Error: expect(locator).not.toBeChecked() failed
  444 |   await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 60_000 });
  445 |   await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  446 |   await expect(pane).toHaveAttribute("data-actual-execution-api", /^webgl2?$/);
  447 |   await expect(page.getByTestId("ground-glass-webgpu-pilot")).toHaveCount(0);
  448 |   expect(webgpuModuleRequests).toEqual([]);
  449 | });
  450 | 
  451 | test("native-required app-host pilot renders Architecture Rise Raw RTT and cleans up across SPA remount", async ({ page }, testInfo) => {
  452 |   test.skip(!nativeWebGpuRequired, "Run with GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 in the headed Chrome project");
  453 |   test.setTimeout(300_000);
  454 | 
  455 |   const pageErrors: string[] = [];
  456 |   const consoleErrors: string[] = [];
  457 |   const webgpuModuleRequests: string[] = [];
  458 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  459 |   page.on("console", (message) => {
  460 |     if (message.type() === "error") consoleErrors.push(message.text());
  461 |   });
  462 |   page.on("request", (request) => {
  463 |     if (/three[/._-]webgpu|GroundGlassWebGPUAdapter/i.test(request.url())) webgpuModuleRequests.push(request.url());
  464 |   });
  465 | 
  466 |   await page.setViewportSize({ width: 1440, height: 1000 });
  467 |   await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  468 |   const pane = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  469 |   await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready", { timeout: 90_000 });
  470 |   await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  471 | 
  472 |   const rawDebug = page.getByLabel("Raw RTT — bypass DOF");
  473 |   await rawDebug.check();
  474 |   let pilot = page.getByTestId("ground-glass-webgpu-pilot");
  475 |   await expect(pilot).toBeVisible({ timeout: 90_000 });
  476 |   await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer", { timeout: 120_000 });
  477 |   await expect(pane).toHaveAttribute("data-actual-execution-api", "webgpu");
  478 |   await expect(pilot).toHaveAttribute("data-mounted-renderer-family", "webgpu-renderer");
  479 |   await expect(pilot).toHaveAttribute("data-actual-execution-api", "webgpu");
  480 |   await expect(pilot).toHaveAttribute("data-frame-ready", "true");
  481 |   await expect(pilot).toHaveAttribute("data-scene-subject-realization", "registered-ground-glass-profile");
  482 |   await expect(pilot).toHaveAttribute("data-scene-subject-mounted", "true");
  483 |   await expect(pilot).toHaveAttribute("data-scene-subject-child-count", /^[1-9]\d*$/);
  484 |   await expect(pilot).toHaveAttribute("data-camera-configured", "true");
  485 |   await expect(pilot).toHaveAttribute("data-camera-coordinate-system", "webgpu");
  486 |   await expect(pilot).toHaveAttribute("data-target-depth-enabled", "true");
  487 |   await expect(pilot).toHaveAttribute("data-target-depth-format", "depth24plus");
  488 |   await expect(pilot).toHaveAttribute("data-target-color-format", "rgba8unorm");
  489 |   await expect(pilot).toHaveAttribute("data-frame-scene-id", "architecture-rise");
  490 |   const initialGeneration = await pane.getAttribute("data-renderer-generation");
  491 |   const initialRequestId = await pane.getAttribute("data-frame-request-id");
  492 |   const currentCanvas = pilot.locator("canvas");
  493 |   const initialCanvasHandle = await currentCanvas.elementHandle();
  494 |   expect(initialGeneration).toBeTruthy();
  495 |   expect(initialRequestId).toBeTruthy();
  496 |   await expect(pane).toHaveAttribute("data-last-completed-request-id", initialRequestId!);
  497 |   await expect(pilot).toHaveAttribute("data-renderer-generation", initialGeneration!);
  498 |   await expect(pilot).toHaveAttribute("data-frame-request-id", initialRequestId!);
  499 |   await expect(pilot).toHaveAttribute("data-last-displayed-request-id", initialRequestId!);
  500 |   await expect(pilot).toHaveAttribute("data-last-displayed-frame-id", /generation-/);
  501 | 
  502 |   const initialCamera = await pilot.evaluate((element) => ({
  503 |     left: Number(element.getAttribute("data-camera-left")),
  504 |     right: Number(element.getAttribute("data-camera-right")),
  505 |     top: Number(element.getAttribute("data-camera-top")),
  506 |     bottom: Number(element.getAttribute("data-camera-bottom")),
  507 |     near: Number(element.getAttribute("data-camera-near")),
  508 |     far: Number(element.getAttribute("data-camera-far")),
  509 |   }));
  510 |   expect(Object.values(initialCamera).every(Number.isFinite)).toBe(true);
  511 |   expect(initialCamera.right).toBeGreaterThan(initialCamera.left);
  512 |   expect(initialCamera.top).toBeGreaterThan(initialCamera.bottom);
  513 |   expect(initialCamera.near).toBeGreaterThan(0);
  514 |   expect(initialCamera.far).toBeGreaterThan(initialCamera.near);
  515 | 
  516 |   const rawMode = page.getByRole("radio", { name: "Raw Ground Glass", exact: true });
  517 |   const uprightMode = page.getByRole("radio", { name: "Upright Assist", exact: true });
  518 |   await rawMode.check();
  519 |   await expect(pilot).toHaveAttribute("data-preview-mode", "raw");
  520 |   await waitForCurrentFrame(page);
  521 |   const rawImage = await currentCanvas.screenshot({ animations: "disabled" });
  522 |   const rawImageAnalysis = await analyzeCanvasScreenshot(page, rawImage);
  523 |   expect(rawImageAnalysis.contentful).toBe(true);
  524 |   expect(rawImageAnalysis.meanLuminance).toBeGreaterThan(1);
  525 |   const baselineRawGeometry = await verifyIndependentSignGeometry({
  526 |     page,
  527 |     pilot,
  528 |     screenshot: rawImage,
  529 |     riseMm: 0,
  530 |     previewMode: "raw",
  531 |   });
  532 |   assertIndependentGeometryEvidence(baselineRawGeometry);
  533 |   await testInfo.attach("ground-glass-m3-webgpu-raw-native.png", {
  534 |     body: rawImage,
  535 |     contentType: "image/png",
  536 |   });
  537 | 
  538 |   const rawRequestId = await pane.getAttribute("data-frame-request-id");
  539 |   await uprightMode.check();
  540 |   await expect(pilot).toHaveAttribute("data-preview-mode", "upright");
  541 |   await expect.poll(() => pane.getAttribute("data-frame-request-id"), { timeout: 60_000 }).not.toBe(rawRequestId);
  542 |   await waitForCurrentFrame(page);
  543 |   const uprightImage = await currentCanvas.screenshot({ animations: "disabled" });
```