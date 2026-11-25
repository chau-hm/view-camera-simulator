# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: observer-webgpu-pilot.spec.ts >> application fallback remounts once and clears when the scene changes
- Location: src/tests/e2e/observer-webgpu-pilot.spec.ts:1435:1

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('scene-canvas')
Expected: "initialization"
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
                    - button "Reset 3D view" [active] [ref=e31] [cursor=pointer]
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
  1438 |     "This fault-injection case verifies application fallback; the native-required pilot test separately requires native execution.",
  1439 |   );
  1440 |   test.setTimeout(180_000);
  1441 |   const pageErrors: string[] = [];
  1442 |   const webgpuModuleRequests: string[] = [];
  1443 |   const documentNavigations: string[] = [];
  1444 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  1445 |   page.on("request", (request) => {
  1446 |     if (/three[._/-]webgpu/i.test(request.url())) webgpuModuleRequests.push(request.url());
  1447 |     if (request.isNavigationRequest() && request.resourceType() === "document") {
  1448 |       documentNavigations.push(request.url());
  1449 |     }
  1450 |   });
  1451 |   await page.route(/three[._/-]webgpu/i, (route) => route.abort());
  1452 | 
  1453 |   await page.goto("/simulator/free/view-camera-anatomy?observerRenderer=webgpu&rttDiagnostics=1");
  1454 |   const observer = await waitForMountedObserver(page);
  1455 |   await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  1456 |   await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl", {
  1457 |     timeout: 60_000,
  1458 |   });
  1459 |   await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  1460 |   await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  1461 |   await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
  1462 |   await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "initialization");
  1463 |   await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  1464 |   const initialEvidence = await attachMountedObserverEvidence(testInfo, observer);
  1465 |   const initialMountGeneration = Number(
  1466 |     initialEvidence["data-observer-renderer-generation"],
  1467 |   );
  1468 |   const sceneSubjectId = await observer.getAttribute("data-scene-subject-id") ?? "unknown";
  1469 | 
  1470 |   const groundGlass = page.getByTestId("ground-glass-rtt");
  1471 |   await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", {
  1472 |     timeout: 60_000,
  1473 |   });
  1474 |   const groundGlassContentful =
  1475 |     await groundGlass.getAttribute("data-rtt-final-contentful") === "true";
  1476 |   const canvas = observer.locator("canvas");
  1477 |   const canvasPixels = await attachScreenshots(
  1478 |     page,
  1479 |     testInfo,
  1480 |     canvas,
  1481 |     "test-results/observer-webgpu-app-fallback.png",
  1482 |     "test-results/observer-webgpu-app-fallback-page.png",
  1483 |   );
  1484 |   const interactions = await exerciseObserverControls(page, observer);
  1485 |   await selectAnatomySceneFocus(page, observer);
  1486 |   const sceneView = await setAnatomyVerificationView(page, observer);
  1487 |   const subjectRendering = await captureSubjectRenderingEvidence(page, observer, testInfo);
  1488 |   await restoreObserverSceneView(page, observer, sceneView);
  1489 |   const runtimeEvidence = await attachRuntimeVerification({
  1490 |     testInfo,
  1491 |     browser,
  1492 |     attributes: initialEvidence,
  1493 |     sceneSubjectId,
  1494 |     groundGlassContentful,
  1495 |     canvasPixels,
  1496 |     subjectRendering,
  1497 |     interactions,
  1498 |     pageErrors,
  1499 |   });
  1500 | 
  1501 |   expect(webgpuModuleRequests).toHaveLength(1);
  1502 |   expect(canvasPixels.contentful).toBe(true);
  1503 |   expect(subjectRendering.status).toBe("verified");
  1504 |   expect(runtimeEvidence.observerReadiness.status).toBe("ready");
  1505 |   expect(interactions).toEqual({
  1506 |     cameraFocusSelected: true,
  1507 |     orbitInteractionWorked: true,
  1508 |     resetRestoredCameraPosition: true,
  1509 |     resetRestoredOrbitTarget: true,
  1510 |   });
  1511 |   expect(pageErrors).toEqual([]);
  1512 | 
  1513 |   // The injected failure applies only to the first renderer import. The next
  1514 |   // scene is independently eligible and must be able to attempt WebGPU.
  1515 |   await page.unroute(/three[._/-]webgpu/i);
  1516 |   await navigateWithinSimulator(
  1517 |     page,
  1518 |     "/simulator/free/architecture-rise?observerRenderer=webgpu&rttDiagnostics=1",
  1519 |   );
  1520 |   await waitForMountedObserver(page, "architecture-rise");
  1521 |   await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  1522 |   await expect(observer).toHaveAttribute(
  1523 |     "data-observer-selection-reason",
  1524 |     "webgpu-pilot-approved",
  1525 |   );
  1526 |   await expect(observer).toHaveAttribute("data-observer-adapter-availability", /^(available|unavailable|api-absent|request-rejected|timed-out)$/);
  1527 |   await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  1528 |   const architectureFamily = await observer.getAttribute("data-observer-renderer-family");
  1529 |   if (architectureFamily === "webgpu-renderer") {
  1530 |     await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgpu");
  1531 |     await expect(observer).toHaveAttribute("data-observer-execution-backend", /^(webgpu|webgl2-fallback)$/);
  1532 |     await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  1533 |     await expect(observer).not.toHaveAttribute("data-observer-renderer-failure-stage");
  1534 |   } else {
  1535 |     await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  1536 |     await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  1537 |     await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
> 1538 |     await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "initialization");
       |                            ^ Error: expect(locator).toHaveAttribute(expected) failed
  1539 |   }
  1540 |   expect(webgpuModuleRequests.length).toBeGreaterThanOrEqual(1);
  1541 |   expect(documentNavigations).toHaveLength(1);
  1542 |   expect(pageErrors).toEqual([]);
  1543 |   await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");
  1544 |   const afterSceneChange = await readObserverAttributes(observer);
  1545 |   expect(Number(afterSceneChange["data-observer-renderer-generation"])).toBeGreaterThan(
  1546 |     initialMountGeneration,
  1547 |   );
  1548 |   expect(afterSceneChange["data-observer-selection-reason"]).toBe("webgpu-pilot-approved");
  1549 |   expect(afterSceneChange["data-observer-webgpu-initialization-attempts"]).toBe("1");
  1550 | 
  1551 |   await testInfo.attach("observer-application-fallback-lifecycle.json", {
  1552 |     body: JSON.stringify({
  1553 |       initialFallback: {
  1554 |         request: initialEvidence["data-observer-renderer-request"],
  1555 |         rendererAttempt: initialEvidence["data-observer-renderer-attempt"],
  1556 |         rendererFamily: initialEvidence["data-observer-renderer-family"],
  1557 |         executionBackend: initialEvidence["data-observer-execution-backend"],
  1558 |         applicationFallback: initialEvidence["data-observer-application-fallback"],
  1559 |         failureStage: initialEvidence["data-observer-renderer-failure-stage"],
  1560 |         initializationAttempts: initialEvidence["data-observer-webgpu-initialization-attempts"],
  1561 |         subjectRendering,
  1562 |         interactions,
  1563 |         groundGlassContentful,
  1564 |       },
  1565 |       afterSceneChange,
  1566 |       webgpuModuleRequests,
  1567 |       documentNavigations,
  1568 |       pageErrors,
  1569 |     }, null, 2),
  1570 |     contentType: "application/json",
  1571 |   });
  1572 | });
  1573 | 
  1574 | test("Architecture Rise uses one application fallback after a controlled WebGPU initialization failure", async ({ page }, testInfo) => {
  1575 |   test.skip(
  1576 |     nativeWebGpuRequired,
  1577 |     "This controlled initialization failure is separate from native-required renderer verification.",
  1578 |   );
  1579 |   test.setTimeout(180_000);
  1580 |   const pageErrors: string[] = [];
  1581 |   const webgpuRequests: string[] = [];
  1582 |   const webgpuModuleRoute = /three[._/-]webgpu/i;
  1583 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  1584 |   page.on("request", (request) => {
  1585 |     if (webgpuModuleRoute.test(request.url())) webgpuRequests.push(request.url());
  1586 |   });
  1587 |   await page.route(webgpuModuleRoute, (route) => route.abort());
  1588 |   await page.goto("/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=standard&rttDiagnostics=1");
  1589 | 
  1590 |   const observer = await waitForMountedObserver(page, "architecture-rise");
  1591 |   await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  1592 |   await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  1593 |   await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  1594 |   await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  1595 |   await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  1596 |   await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
  1597 |   await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "initialization");
  1598 |   await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  1599 |   await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
  1600 |   await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  1601 |   await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 60_000 });
  1602 |   const groundGlass = page.getByTestId("ground-glass-rtt").first();
  1603 |   await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  1604 |   await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise");
  1605 |   const architectureCanvas = observer.locator("canvas");
  1606 |   const architectureScreenshot = await captureObserverCanvasScreenshot(page, architectureCanvas);
  1607 |   const architectureCanvasPixels = analyzeCanvasScreenshot(architectureScreenshot);
  1608 |   expect(architectureCanvasPixels.contentful).toBe(true);
  1609 |   await testInfo.attach("architecture-rise-app-fallback-observer.png", {
  1610 |     body: architectureScreenshot,
  1611 |     contentType: "image/png",
  1612 |   });
  1613 |   expect(webgpuRequests).toHaveLength(1);
  1614 | 
  1615 |   const fallbackGeneration = await observer.getAttribute("data-observer-renderer-generation");
  1616 |   await setStepRangeInput(page, "Rise", 22);
  1617 |   await setStepRangeInput(page, "Tilt", 0.4);
  1618 |   await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  1619 |   await expect(observer).toHaveAttribute("data-observer-renderer-generation", fallbackGeneration ?? "");
  1620 |   await expect(observer).toHaveAttribute("data-observer-environment-status", "active");
  1621 |   await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");
  1622 | 
  1623 |   await navigateWithinSimulator(
  1624 |     page,
  1625 |     "/simulator/free/table-tilt?observerRenderer=webgpu&rttDiagnostics=1",
  1626 |   );
  1627 |   await expect(observer).toHaveAttribute("data-scene-subject-id", "table-tilt", { timeout: 60_000 });
  1628 |   await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  1629 |   await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  1630 |   await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  1631 |   await expect(observer).toHaveAttribute("data-observer-selection-reason", "scene-requirements-not-declared");
  1632 |   await expect(observer).toHaveAttribute("data-observer-adapter-availability", "not-requested");
  1633 |   await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "0");
  1634 |   expect(pageErrors).toHaveLength(1);
  1635 |   expect(pageErrors[0]).toMatch(/error during concurrent rendering.*React was able to recover/i);
  1636 |   const afterIneligibleScene = await readObserverAttributes(observer);
  1637 |   expect(Number(afterIneligibleScene["data-observer-renderer-generation"])).toBeGreaterThan(
  1638 |     Number(fallbackGeneration),
```