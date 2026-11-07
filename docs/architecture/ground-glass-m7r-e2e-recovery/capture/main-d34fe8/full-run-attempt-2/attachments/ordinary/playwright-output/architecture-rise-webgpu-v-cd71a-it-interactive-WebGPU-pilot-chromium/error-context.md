# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture-rise-webgpu-validation.spec.ts >> normal Architecture Rise route keeps WebGL as default and runs an explicit interactive WebGPU pilot
- Location: src/tests/e2e/architecture-rise-webgpu-validation.spec.ts:355:1

# Error details

```
Test timeout of 300000ms exceeded.
```

```
Error: locator.click: Test timeout of 300000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Reset 3D view', exact: true })
    - locator resolved to <button type="button" class="btn btn--compact">Reset 3D view</button>
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
                            - generic: 13000.0 mm focus / CoC 0.169 mm (0%)
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
              - paragraph [ref=e106]: "Side view | Rise: 22.0 mm | Tilt: 0.4° | Swing: -1.1°"
              - img [ref=e108]:
                - generic [ref=e109]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e110]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e111]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e112]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e113]
                  - generic [ref=e116]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic "lens plane" [ref=e118]
                  - generic "focus plane" [ref=e120]
                  - generic "nearDof plane" [ref=e122]
                  - generic "Simplified bellows connector" [ref=e124]
                  - generic "chief ray from film centre through lens centre" [ref=e128]
                  - generic [ref=e132]: Building mid facade
              - generic "Optical depth order" [ref=e134]:
                - generic [ref=e137]: Film 0 mm
                - generic [ref=e140]: Scheimpflug intersection 0 mm
                - generic [ref=e143]: Lens 152 mm
                - generic [ref=e146]: DOF limit 10.0 m
                - generic [ref=e149]: Focus 13.1 m
                - generic [ref=e152]: Far DOF > 13.3 m
            - region "Focus distribution · Focus" [ref=e154]:
              - generic [ref=e155]:
                - heading "Focus distribution" [level=4] [ref=e156]
                - 'generic "Ground Glass orientation: Raw" [ref=e157]': Raw
              - table "Focus distribution" [ref=e158]:
                - caption [ref=e159]: Focus distribution
                - rowgroup [ref=e160]:
                  - row [ref=e161]:
                    - cell [ref=e162]
                    - cell [ref=e163]
                    - cell [ref=e164]
                  - 'row "Centre Centre · Building mid facade: 0% · Soft" [ref=e165]':
                    - cell [ref=e166]
                    - 'cell "Centre Centre · Building mid facade: 0% · Soft" [ref=e167]':
                      - generic "Centre" [ref=e168]
                      - 'group "Centre · Building mid facade: 0% · Soft" [ref=e170]':
                        - generic "Building mid facade" [ref=e172]
                        - generic [ref=e173]:
                          - text: 0%
                          - generic [ref=e174]: —
                    - cell [ref=e175]
                  - row [ref=e176]:
                    - cell [ref=e177]
                    - cell [ref=e178]
                    - cell [ref=e179]
          - group [ref=e182]:
            - generic "Optical Debug architecture-rise · scheimpflug" [ref=e183] [cursor=pointer]:
              - generic [ref=e184]: Optical Debug
              - generic [ref=e185]: architecture-rise · scheimpflug
        - complementary [ref=e186]:
          - generic [ref=e187]:
            - region "Camera Controls" [ref=e188]:
              - heading "Camera Controls" [level=3] [ref=e190]
              - generic [ref=e191]:
                - region "Movement" [ref=e193]:
                  - generic [ref=e194]:
                    - heading "Front standard" [level=4] [ref=e195]
                    - button "Help" [ref=e196] [cursor=pointer]:
                      - generic [ref=e197]: "?"
                  - generic [ref=e198]:
                    - generic [ref=e199]:
                      - generic [ref=e200]: Rise
                      - slider "Rise" [ref=e201]: "22"
                      - generic [ref=e202]: 22.0 mm
                    - generic [ref=e203]:
                      - generic [ref=e204]: Tilt
                      - slider "Tilt" [ref=e205]: "0.4"
                      - generic [ref=e206]: 0.4°
                    - generic [ref=e207]:
                      - generic [ref=e208]: Swing
                      - slider "Swing" [active] [ref=e209]: "-1.1"
                      - generic [ref=e210]: "-1.1°"
                - region "Focus" [ref=e212]:
                  - heading "Focus" [level=3] [ref=e213]
                  - generic [ref=e214]:
                    - generic [ref=e215]: Focus distance
                    - slider "Focus distance" [ref=e216]: "13000"
                    - generic [ref=e217]: 13000.0 mm
                    - button "Infinity Reset" [ref=e219] [cursor=pointer]: ∞
                - region "Aperture" [ref=e221]:
                  - heading "Aperture" [level=3] [ref=e222]
                  - radiogroup "Aperture" [ref=e223]:
                    - generic [ref=e224] [cursor=pointer]:
                      - radio "f/5.6" [checked] [ref=e225]
                      - generic [ref=e226]: f/5.6
                    - generic [ref=e227] [cursor=pointer]:
                      - radio "f/8" [ref=e228]
                      - generic [ref=e229]: f/8
                    - generic [ref=e230] [cursor=pointer]:
                      - radio "f/11" [ref=e231]
                      - generic [ref=e232]: f/11
                    - generic [ref=e233] [cursor=pointer]:
                      - radio "f/16" [ref=e234]
                      - generic [ref=e235]: f/16
                    - generic [ref=e236] [cursor=pointer]:
                      - radio "f/22" [ref=e237]
                      - generic [ref=e238]: f/22
                    - generic [ref=e239] [cursor=pointer]:
                      - radio "f/32" [ref=e240]
                      - generic [ref=e241]: f/32
                - generic [ref=e242]:
                  - generic [ref=e243]: Reset
                  - region "Reset" [ref=e244]:
                    - button "Reset movements" [ref=e246] [cursor=pointer]
            - region "Developer Tools" [ref=e247]:
              - heading "Developer Tools" [level=3] [ref=e248]
              - generic [ref=e250]:
                - checkbox "Raw RTT — bypass DOF" [ref=e251]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  445 |   await expect(pilotObserver).toHaveAttribute("data-observer-renderer-family", /^(webgl-renderer|webgpu-renderer)$/);
  446 |   await expect(pilotObserver).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
  447 |   await expect(pilotObserver).toHaveAttribute("data-observer-adapter-availability", /^(available|unavailable|api-absent|request-rejected|timed-out)$/ , { timeout: 30_000 });
  448 |   await expect(pilotObserver).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  449 |   await expect(pilotObserver).toHaveAttribute("data-scene-subject-id", "architecture-rise");
  450 |   const pilotGeneration = await pilotObserver.getAttribute("data-observer-renderer-generation");
  451 |   expect(pilotGeneration).not.toBe(defaultEvidence.generation);
  452 |   const groundGlass = page.getByTestId("ground-glass-rtt").first();
  453 |   await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
  454 | 
  455 |   if (pilotObserver) await applyVerificationView(page, pilotObserver, closePosition, closeTarget);
  456 |   const pilotView = await readView(pilotObserver);
  457 |   expect(vectorsMatch(pilotView.position, defaultView.position)).toBe(true);
  458 |   expect(vectorsMatch(pilotView.target, defaultView.target)).toBe(true);
  459 |   const pilotCapture = await captureCanvas(pilotObserver, testInfo, "architecture-rise-normal-route-webgpu-pilot.png");
  460 |   const pilotDimensions = await analyzeImageRegions(page, pilotCapture, null, {
  461 |     wholeFrame: { left: 0, top: 0, right: 100_000, bottom: 100_000 },
  462 |   });
  463 |   const pilotFacadeRegion = projectBounds(
  464 |     facadeWorldBounds,
  465 |     pilotDimensions.width,
  466 |     pilotDimensions.height,
  467 |     pilotView,
  468 |   );
  469 |   if (!pilotFacadeRegion) throw new Error("The Architecture Rise facade ROI is outside the pilot Observer image");
  470 |   const pilotFacadePixels = await analyzeImageRegions(page, pilotCapture, null, {
  471 |     facade: pilotFacadeRegion,
  472 |   });
  473 |   const matchedFacadeComparison = await analyzeImageRegions(page, defaultCapture, pilotCapture, {
  474 |     facade: defaultFacadeRegion,
  475 |   });
  476 |   expect(pilotFacadePixels.regions.facade.pixels).toBeGreaterThan(500);
  477 |   expect(pilotFacadePixels.regions.facade.distinctColorBuckets).toBeGreaterThan(24);
  478 |   expect(pilotFacadePixels.regions.facade.luminanceStdDev).toBeGreaterThan(6);
  479 |   expect(matchedFacadeComparison.regions.facade.changedPixels).toBeGreaterThan(100);
  480 | 
  481 |   const mounted = await attachMountedObserverEvidence(testInfo, pilotObserver);
  482 |   const family = mounted["data-observer-renderer-family"];
  483 |   const backend = mounted["data-observer-execution-backend"];
  484 |   const fallback = mounted["data-observer-application-fallback"];
  485 |   const failureStage = mounted["data-observer-renderer-failure-stage"] ?? null;
  486 |   if (nativeWebGpuRequired) {
  487 |     expect(mounted["data-observer-webgpu-api-present"]).toBe("true");
  488 |     expect(mounted["data-observer-adapter-availability"]).toBe("available");
  489 |     expect(family).toBe("webgpu-renderer");
  490 |     expect(backend).toBe("webgpu");
  491 |     expect(fallback).toBe("none");
  492 |     expect(failureStage).toBeNull();
  493 |   } else if (family === "webgpu-renderer") {
  494 |     expect(backend).toMatch(/^(webgpu|webgl2-fallback)$/);
  495 |     expect(fallback).toBe("none");
  496 |     expect(failureStage).toBeNull();
  497 |   } else {
  498 |     expect(family).toBe("webgl-renderer");
  499 |     expect(backend).toBe("webgl2");
  500 |     expect(fallback).toBe("app-webgl");
  501 |     expect(failureStage).toBe("initialization");
  502 |   }
  503 | 
  504 |   const generationBeforeControls = await pilotObserver.getAttribute("data-observer-renderer-generation");
  505 |   const groundGlassBeforeControls = await captureCanvas(
  506 |     groundGlass,
  507 |     testInfo,
  508 |     "architecture-rise-normal-route-ground-glass-before-controls.png",
  509 |   );
  510 |   const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  511 |   await focus.focus();
  512 |   await focus.press("End");
  513 |   await expect(focus).toHaveValue("13000");
  514 |   const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  515 |   await aperture.getByRole("radio", { name: "f/5.6" }).check();
  516 |   await setStepRangeInput(page, "Rise", 22);
  517 |   await setStepRangeInput(page, "Tilt", 0.4);
  518 |   await setStepRangeInput(page, "Swing", -1.1);
  519 |   await expect(page.getByRole("slider", { name: "Rise", exact: true })).toHaveValue("22");
  520 |   await expect(page.getByRole("slider", { name: "Tilt", exact: true })).toHaveValue("0.4");
  521 |   await expect(page.getByRole("slider", { name: "Swing", exact: true })).toHaveValue("-1.1");
  522 |   const groundGlassAfterControls = await captureCanvas(
  523 |     groundGlass,
  524 |     testInfo,
  525 |     "architecture-rise-normal-route-ground-glass-after-controls.png",
  526 |   );
  527 |   const groundGlassDimensions = await analyzeImageRegions(page, groundGlassBeforeControls, null, {
  528 |     wholeFrame: { left: 0, top: 0, right: 100_000, bottom: 100_000 },
  529 |   });
  530 |   const groundGlassControlResponse = await analyzeImageRegions(
  531 |     page,
  532 |     groundGlassBeforeControls,
  533 |     groundGlassAfterControls,
  534 |     {
  535 |       wholeFrame: {
  536 |         left: 0,
  537 |         top: 0,
  538 |         right: groundGlassDimensions.width,
  539 |         bottom: groundGlassDimensions.height,
  540 |       },
  541 |     },
  542 |   );
  543 |   expect(groundGlassControlResponse.regions.wholeFrame.changedPixels).toBeGreaterThan(100);
  544 | 
> 545 |   await page.getByRole("button", { name: "Reset 3D view", exact: true }).click();
      |                                                                          ^ Error: locator.click: Test timeout of 300000ms exceeded.
  546 |   const cameraBaseline = await readView(pilotObserver);
  547 |   await page.getByRole("button", { name: "Camera", exact: true }).click();
  548 |   await expect(pilotObserver).toHaveAttribute("data-view-focus", "camera");
  549 |   await page.getByRole("button", { name: "Scene", exact: true }).click();
  550 |   await expect(pilotObserver).toHaveAttribute("data-view-focus", "scene");
  551 |   const canvasBounds = await pilotObserver.locator("canvas").boundingBox();
  552 |   if (!canvasBounds) throw new Error("Architecture Rise Observer canvas is not visible for orbit input");
  553 |   await page.mouse.move(canvasBounds.x + canvasBounds.width / 2, canvasBounds.y + canvasBounds.height / 2);
  554 |   await page.mouse.down();
  555 |   await page.mouse.move(canvasBounds.x + canvasBounds.width / 2 + 55, canvasBounds.y + canvasBounds.height / 2 + 18, { steps: 4 });
  556 |   await page.mouse.up();
  557 |   await expect.poll(async () => {
  558 |     const current = await readView(pilotObserver);
  559 |     return !vectorsMatch(current.position, cameraBaseline.position) || !vectorsMatch(current.target, cameraBaseline.target);
  560 |   }).toBe(true);
  561 |   await page.getByRole("button", { name: "Reset 3D view", exact: true }).click();
  562 |   await expect.poll(async () => {
  563 |     const current = await readView(pilotObserver);
  564 |     return vectorsMatch(current.position, cameraBaseline.position) && vectorsMatch(current.target, cameraBaseline.target);
  565 |   }).toBe(true);
  566 |   await expect(pilotObserver).toHaveAttribute("data-observer-renderer-generation", generationBeforeControls ?? "");
  567 |   await expect(pilotObserver).toHaveAttribute("data-observer-environment-status", "active");
  568 |   await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");
  569 | 
  570 |   const finalCapture = await captureCanvas(pilotObserver, testInfo, "architecture-rise-normal-route-interactive-final.png");
  571 |   await attachJson(testInfo, "architecture-rise-normal-route-pilot-runtime-evidence.json", {
  572 |     browser: page.context().browser()?.version() ?? "unknown",
  573 |     operatingSystem: `${process.platform} ${release()}`,
  574 |     threeRevision: REVISION,
  575 |     webgpuApiPresent: mounted["data-observer-webgpu-api-present"],
  576 |     adapterAvailability: mounted["data-observer-adapter-availability"],
  577 |     requestedRenderer: mounted["data-observer-renderer-request"],
  578 |     selectionReason: mounted["data-observer-selection-reason"],
  579 |     compatibility: mounted["data-observer-webgpu-scene-compatibility"],
  580 |     verifiedRequirements: mounted["data-observer-scene-rendering-requirements"],
  581 |     mountedRendererFamily: family,
  582 |     executionBackend: backend,
  583 |     applicationFallback: fallback,
  584 |     initializationFailure: failureStage,
  585 |     initializationAttempts: mounted["data-observer-webgpu-initialization-attempts"],
  586 |     hardwareAcceleration: mounted["data-observer-hardware-acceleration"],
  587 |     sceneSubjectId: await pilotObserver.getAttribute("data-scene-subject-id"),
  588 |     observerEnvironment: await pilotObserver.getAttribute("data-observer-environment-status"),
  589 |     subjectFramebufferEvidence: {
  590 |       method: "canonical-primary-facade projected ROI from normal Observer framebuffer",
  591 |       region: pilotFacadeRegion,
  592 |       pixels: pilotFacadePixels.regions.facade,
  593 |       webglToPilotDifference: matchedFacadeComparison.regions.facade,
  594 |     },
  595 |     interactions: {
  596 |       focusDistanceMm: await focus.inputValue(),
  597 |       aperture: await aperture.getAttribute("data-selected-aperture"),
  598 |       riseMm: await page.getByRole("slider", { name: "Rise", exact: true }).inputValue(),
  599 |       tiltDeg: await page.getByRole("slider", { name: "Tilt", exact: true }).inputValue(),
  600 |       swingDeg: await page.getByRole("slider", { name: "Swing", exact: true }).inputValue(),
  601 |       sceneCameraFocus: await pilotObserver.getAttribute("data-view-focus"),
  602 |       reset3DView: true,
  603 |       orbit: true,
  604 |       generationStable: generationBeforeControls === await pilotObserver.getAttribute("data-observer-renderer-generation"),
  605 |     },
  606 |     groundGlassContentful: await groundGlass.getAttribute("data-rtt-final-contentful"),
  607 |     groundGlassControlResponse: groundGlassControlResponse.regions.wholeFrame,
  608 |     screenshots: ["architecture-rise-normal-route-webgl-default.png", "architecture-rise-normal-route-webgpu-pilot.png", "architecture-rise-normal-route-interactive-final.png"],
  609 |     developmentWebGpuModuleRequests,
  610 |     documentNavigations,
  611 |     pageErrors,
  612 |     consoleErrors,
  613 |   });
  614 |   expect(finalCapture.length).toBeGreaterThan(0);
  615 |   expect(documentNavigations).toHaveLength(1);
  616 |   expect(pageErrors).toEqual([]);
  617 |   expect(consoleErrors).toEqual([]);
  618 | });
  619 | 
  620 | test("r187 native public Architecture Rise Observer pilot preserves WebGL Ground Glass", async ({ page }, testInfo) => {
  621 |   test.skip(!nativeWebGpuRequired, "Requires OBSERVER_NATIVE_WEBGPU_REQUIRED=1 and headed Chrome native WebGPU");
  622 |   test.setTimeout(180_000);
  623 |   expect(REVISION).toBe("187");
  624 | 
  625 |   const pageErrors: string[] = [];
  626 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  627 |   await page.setViewportSize({ width: 1440, height: 1000 });
  628 |   await page.goto("/simulator/free/architecture-rise?observerRenderer=webgpu&rttDiagnostics=1");
  629 | 
  630 |   const observer = page.getByTestId("scene-canvas");
  631 |   await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  632 |   await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  633 |   await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  634 |   await expect(observer).toHaveAttribute("data-observer-three-revision", "187");
  635 |   await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgpu-renderer");
  636 |   await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgpu");
  637 |   await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  638 |   await expect(observer).toHaveAttribute("data-observer-webgpu-api-present", "true");
  639 |   await expect(observer).toHaveAttribute("data-observer-adapter-availability", "available");
  640 |   await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
  641 |   await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  642 |   await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
  643 |   await expect(observer).toHaveAttribute("data-observer-shadow-map-status", "active");
  644 |   await expect(observer).toHaveAttribute("data-observer-shadow-map-type", "pcf");
  645 |   await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise");
```