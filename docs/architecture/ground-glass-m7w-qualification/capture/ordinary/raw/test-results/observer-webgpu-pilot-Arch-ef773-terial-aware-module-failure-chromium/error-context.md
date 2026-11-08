# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: observer-webgpu-pilot.spec.ts >> Architecture Rise restores standard output after a controlled material-aware module failure
- Location: src/tests/e2e/observer-webgpu-pilot.spec.ts:1758:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('scene-canvas')
Expected: "webgl-renderer"
Received: ""
Timeout:  5000ms

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
  1699 |       groundGlassContentful: true,
  1700 |       architectureCanvasPixels,
  1701 |       afterIneligibleScene,
  1702 |       recoveredEligibleScene,
  1703 |       pageErrors,
  1704 |     }, null, 2),
  1705 |     contentType: "application/json",
  1706 |   });
  1707 | });
  1708 |
  1709 | test("an unevaluated scene refuses the WebGPU pilot", async ({ page }, testInfo) => {
  1710 |   const webgpuModuleRequests: string[] = [];
  1711 |   page.on("request", (request) => {
  1712 |     if (/three[._/-]webgpu/i.test(request.url())) webgpuModuleRequests.push(request.url());
  1713 |   });
  1714 |
  1715 |   await page.goto("/simulator/free/table-tilt?observerRenderer=webgpu&rttDiagnostics=1");
  1716 |   const observer = await waitForMountedObserver(page, "table-tilt");
  1717 |   await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  1718 |   await expect(observer).toHaveAttribute(
  1719 |     "data-observer-selection-reason",
  1720 |     "scene-requirements-not-declared",
  1721 |   );
  1722 |   await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  1723 |   await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  1724 |   await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  1725 |   await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  1726 |   await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "not-evaluated");
  1727 |   await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "not-eligible");
  1728 |   await expect(observer).toHaveAttribute("data-observer-scene-requirements-status", "not-evaluated");
  1729 |   await expect(observer).toHaveAttribute(
  1730 |     "data-observer-scene-known-backend-constraints",
  1731 |     "none",
  1732 |   );
  1733 |   await expect(observer).toHaveAttribute("data-observer-adapter-availability", "not-requested");
  1734 |   await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "0");
  1735 |   await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute(
  1736 |     "data-rtt-final-contentful",
  1737 |     "true",
  1738 |     { timeout: 60_000 },
  1739 |   );
  1740 |   expect(webgpuModuleRequests).toEqual([]);
  1741 |
  1742 |   const attributes = await attachMountedObserverEvidence(testInfo, observer);
  1743 |   await testInfo.attach("architecture-rise-backend-selection.json", {
  1744 |     body: JSON.stringify({
  1745 |       requestedRenderer: attributes["data-observer-renderer-request"],
  1746 |       selectionReason: attributes["data-observer-selection-reason"],
  1747 |       rendererAttempt: attributes["data-observer-renderer-attempt"],
  1748 |       mountedRendererFamily: attributes["data-observer-renderer-family"],
  1749 |       executionBackend: attributes["data-observer-execution-backend"],
  1750 |       adapterAvailability: attributes["data-observer-adapter-availability"],
  1751 |       webgpuModuleRequests,
  1752 |       groundGlassContentful: true,
  1753 |     }, null, 2),
  1754 |     contentType: "application/json",
  1755 |   });
  1756 | });
  1757 |
  1758 | test("Architecture Rise restores standard output after a controlled material-aware module failure", async ({ page }, testInfo) => {
  1759 |   test.skip(
  1760 |     nativeWebGpuRequired,
  1761 |     "This fault-injection case verifies output-policy fallback; native-required parity runs without module interception.",
  1762 |   );
  1763 |   test.setTimeout(180_000);
  1764 |   const pageErrors: string[] = [];
  1765 |   const materialAwareModuleRequests: string[] = [];
  1766 |   const materialAwareModuleRoute = /materialAwareObserverOutput/i;
  1767 |   let releaseOutputPolicyFailure!: () => void;
  1768 |   const outputPolicyFailureGate = new Promise<void>((resolve) => {
  1769 |     releaseOutputPolicyFailure = resolve;
  1770 |   });
  1771 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  1772 |   page.on("request", (request) => {
  1773 |     if (materialAwareModuleRoute.test(request.url())) {
  1774 |       materialAwareModuleRequests.push(request.url());
  1775 |     }
  1776 |   });
  1777 |   const moduleRequest = page.waitForRequest(materialAwareModuleRoute, { timeout: 90_000 });
  1778 |   await page.route(materialAwareModuleRoute, async (route) => {
  1779 |     await outputPolicyFailureGate;
  1780 |     await route.abort();
  1781 |   });
  1782 |   await page.goto(
  1783 |     "/simulator/free/architecture-rise?observerRenderer=webgpu&rttDiagnostics=1",
  1784 |     { waitUntil: "domcontentloaded" },
  1785 |   );
  1786 |
  1787 |   const observer = await waitForMountedObserver(page, "architecture-rise");
  1788 |   await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  1789 |   await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  1790 |   await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  1791 |   await expect(observer).toHaveAttribute("data-observer-output-policy-requested", "material-aware");
  1792 |   await expect(observer).toHaveAttribute("data-observer-output-policy-requested-param", "unspecified");
  1793 |   await moduleRequest;
  1794 |   await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgpu-renderer", { timeout: 90_000 });
  1795 |   await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgpu");
  1796 |   await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  1797 |   releaseOutputPolicyFailure();
  1798 |   await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl", { timeout: 90_000 });
> 1799 |   await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
       |                          ^ Error: expect(locator).toHaveAttribute(expected) failed
  1800 |   await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  1801 |   await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
  1802 |   await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", "output-policy");
  1803 |   await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "standard");
  1804 |   await expect(observer).toHaveAttribute("data-observer-output-policy-selection-reason", "webgpu-not-selected");
  1805 |   await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
  1806 |   await expect(observer).toHaveAttribute("data-observer-tone-mapping", "aces-filmic");
  1807 |   await expect(observer).toHaveAttribute("data-observer-output-color-space", "srgb");
  1808 |   await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  1809 |   await expect(observer).toHaveAttribute("data-scene-subject-id", "architecture-rise");
  1810 |
  1811 |   const screenshot = await captureObserverCanvasScreenshot(page, observer.locator("canvas"));
  1812 |   const screenshotPixels = analyzeCanvasScreenshot(screenshot);
  1813 |   expect(screenshotPixels.contentful).toBe(true);
  1814 |   const groundGlass = page.getByTestId("ground-glass-rtt").first();
  1815 |   await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  1816 |   expect(materialAwareModuleRequests).toHaveLength(1);
  1817 |   expect(pageErrors).toEqual([]);
  1818 |
  1819 |   await testInfo.attach("architecture-rise-material-aware-fallback.png", {
  1820 |     body: screenshot,
  1821 |     contentType: "image/png",
  1822 |   });
  1823 |   await testInfo.attach("architecture-rise-material-aware-fallback.json", {
  1824 |     body: JSON.stringify({
  1825 |       request: page.url(),
  1826 |       outputPolicyRequested: await observer.getAttribute("data-observer-output-policy-requested"),
  1827 |       outputPolicySelectedAfterFallback: await observer.getAttribute("data-observer-output-policy-selected"),
  1828 |       outputPolicyFailure: await observer.getAttribute("data-observer-output-policy-failure"),
  1829 |       rendererFamily: await observer.getAttribute("data-observer-renderer-family"),
  1830 |       executionBackend: await observer.getAttribute("data-observer-execution-backend"),
  1831 |       applicationFallback: await observer.getAttribute("data-observer-application-fallback"),
  1832 |       failureStage: await observer.getAttribute("data-observer-renderer-failure-stage"),
  1833 |       initializationAttempts: await observer.getAttribute("data-observer-webgpu-initialization-attempts"),
  1834 |       screenshotPixels,
  1835 |       groundGlassContentful: await groundGlass.getAttribute("data-rtt-final-contentful"),
  1836 |       materialAwareModuleRequests,
  1837 |       pageErrors,
  1838 |     }, null, 2),
  1839 |     contentType: "application/json",
  1840 |   });
  1841 | });
  1842 |
  1843 | test("material-aware output adapts the Architecture Rise Observer and stays scene-scoped across navigation", async ({ page }, testInfo) => {
  1844 |   test.setTimeout(240_000);
  1845 |   const pageErrors: string[] = [];
  1846 |   const materialAwareModuleRequests: string[] = [];
  1847 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  1848 |   page.on("request", (request) => {
  1849 |     if (/materialAwareObserverOutput/i.test(request.url())) {
  1850 |       materialAwareModuleRequests.push(request.url());
  1851 |     }
  1852 |   });
  1853 |   await page.setViewportSize({ width: 1440, height: 1000 });
  1854 |   await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  1855 |   const webglObserver = await waitForMountedObserver(page, "architecture-rise");
  1856 |   await expect(webglObserver).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  1857 |   await expect(webglObserver).toHaveAttribute("data-observer-execution-backend", "webgl2");
  1858 |   await expect(page.getByTestId("ground-glass-rtt").first()).toHaveAttribute("data-rtt-final-contentful", "true");
  1859 |   const webglViewState = await readObserverViewState(webglObserver);
  1860 |   const webglOverlayVisibility = await readOverlayVisibility(webglObserver);
  1861 |   await expandSceneViewport(page);
  1862 |   const webglCaptureConfiguration = await readObserverCaptureConfiguration(page, webglObserver);
  1863 |   await applyOverlayVisibility(page, webglObserver, {
  1864 |     focusPlane: false,
  1865 |     dofRegion: false,
  1866 |     opticalGeometry: false,
  1867 |   });
  1868 |   await collapseOverlayControls(page);
  1869 |   const webglFocusChartCapture = await captureObserverFramebufferScreenshot(page, webglObserver.locator("canvas"));
  1870 |   await setObserverViewFocus(page, webglObserver, "camera");
  1871 |   await applyOverlayVisibility(page, webglObserver, {
  1872 |     focusPlane: false,
  1873 |     dofRegion: false,
  1874 |     opticalGeometry: true,
  1875 |   });
  1876 |   await collapseOverlayControls(page);
  1877 |   const webglOpticalGeometryCapture = await captureObserverFramebufferScreenshot(page, webglObserver.locator("canvas"));
  1878 |   const webglOpticalAxisViewState = await readObserverViewState(webglObserver);
  1879 |   await setObserverViewFocus(page, webglObserver, "scene");
  1880 |   await applyOverlayVisibility(page, webglObserver, webglOverlayVisibility);
  1881 |   await restoreSceneViewport(page);
  1882 |   expect(materialAwareModuleRequests).toHaveLength(0);
  1883 |   await testInfo.attach("architecture-rise-webgl-focus-chart-no-overlays.png", {
  1884 |     body: webglFocusChartCapture,
  1885 |     contentType: "image/png",
  1886 |   });
  1887 |   await testInfo.attach("architecture-rise-webgl-optical-geometry-only.png", {
  1888 |     body: webglOpticalGeometryCapture,
  1889 |     contentType: "image/png",
  1890 |   });
  1891 |
  1892 |   const candidatePath = "/simulator/free/architecture-rise?observerRenderer=webgpu&observerOutput=material-aware&rttDiagnostics=1";
  1893 |   await page.goto(candidatePath);
  1894 |
  1895 |   const observer = await waitForMountedObserver(page, "architecture-rise");
  1896 |   await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  1897 |   await expect(observer).toHaveAttribute("data-observer-renderer-request", "webgpu-pilot");
  1898 |   await expect(observer).toHaveAttribute("data-observer-selection-reason", "webgpu-pilot-approved");
  1899 |   await expect(observer).toHaveAttribute("data-observer-webgpu-scene-compatibility", "verified");
```