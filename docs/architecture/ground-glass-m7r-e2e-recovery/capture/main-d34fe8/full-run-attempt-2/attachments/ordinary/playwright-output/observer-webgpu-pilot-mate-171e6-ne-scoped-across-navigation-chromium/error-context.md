# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: observer-webgpu-pilot.spec.ts >> material-aware output adapts the Architecture Rise Observer and stays scene-scoped across navigation
- Location: src/tests/e2e/observer-webgpu-pilot.spec.ts:1843:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 30000ms exceeded while waiting on the predicate
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
  1900 |   await expect(observer).toHaveAttribute("data-observer-webgpu-pilot-eligibility", "eligible");
  1901 |   await expect(observer).toHaveAttribute("data-observer-output-policy-requested", "material-aware");
  1902 |   await expect(observer).toHaveAttribute("data-observer-output-policy-requested-param", "material-aware");
  1903 |   await expect(observer).toHaveAttribute("data-observer-webgpu-initialization-attempts", "1");
  1904 |   await page.waitForFunction(() => {
  1905 |     const element = document.querySelector<HTMLElement>('[data-testid="scene-canvas"]');
  1906 |     const family = element?.getAttribute("data-observer-renderer-family");
  1907 |     const fallback = element?.getAttribute("data-observer-application-fallback");
  1908 |     return (family === "webgpu-renderer" && element?.getAttribute("data-observer-output-policy-status") === "active") ||
  1909 |       (family === "webgl-renderer" && fallback === "app-webgl");
  1910 |   }, undefined, { timeout: 90_000 });
  1911 |   await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
  1912 |   await expect.poll(async () => {
  1913 |     const value = await observer.getAttribute("data-observer-material-inventory");
  1914 |     if (!value) return false;
  1915 |     try {
  1916 |       return (JSON.parse(value) as { environment?: { assigned?: boolean } }).environment?.assigned === true;
  1917 |     } catch {
  1918 |       return false;
  1919 |     }
> 1920 |   }, { timeout: 30_000 }).toBe(true);
       |                           ^ Error: expect(received).toBe(expected) // Object.is equality
  1921 |   const firstGeneration = Number(await observer.getAttribute("data-observer-renderer-generation"));
  1922 |   const firstFamily = await observer.getAttribute("data-observer-renderer-family");
  1923 |   if (nativeWebGpuRequired) {
  1924 |     await expect(observer).toHaveAttribute("data-observer-webgpu-api-present", "true");
  1925 |     await expect(observer).toHaveAttribute("data-observer-adapter-availability", "available", {
  1926 |       timeout: 60_000,
  1927 |     });
  1928 |     expectNativeWebGpuMount(await readObserverAttributes(observer));
  1929 |   }
  1930 |   let materialInventory: Record<string, unknown> | null = null;
  1931 |   if (firstFamily === "webgpu-renderer") {
  1932 |     await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgpu");
  1933 |     await expect(observer).toHaveAttribute("data-observer-execution-backend", /^(webgpu|webgl2-fallback)$/);
  1934 |     await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  1935 |     await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "material-aware");
  1936 |     await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "material-aware");
  1937 |     await expect(observer).toHaveAttribute("data-observer-output-policy-status", "active", { timeout: 60_000 });
  1938 |     const inventoryValue = await observer.getAttribute("data-observer-material-inventory");
  1939 |     if (!inventoryValue) throw new Error("The mounted material-aware candidate did not publish a runtime inventory");
  1940 |     materialInventory = JSON.parse(inventoryValue) as Record<string, unknown>;
  1941 |     expect(materialInventory.sceneId).toBe("architecture-rise");
  1942 |     expect(materialInventory.unsupportedMaterialInstances).toBe(0);
  1943 |     expect(Number(materialInventory.adaptedMaterialInstances)).toBeGreaterThan(0);
  1944 |     expect(Array.isArray(materialInventory.families)).toBe(true);
  1945 |     expect((materialInventory.families as Array<Record<string, unknown>>).length).toBeGreaterThan(0);
  1946 |     expect((materialInventory.families as Array<Record<string, unknown>>).every((family) => family.status === "supported")).toBe(true);
  1947 |     expect((materialInventory.environment as Record<string, unknown>).assigned).toBe(true);
  1948 |   } else if (firstFamily === "webgl-renderer") {
  1949 |     await expect(observer).toHaveAttribute("data-observer-renderer-attempt", "webgl");
  1950 |     await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  1951 |     await expect(observer).toHaveAttribute("data-observer-application-fallback", "app-webgl");
  1952 |     await expect(observer).toHaveAttribute("data-observer-output-policy-selected", "standard");
  1953 |     await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
  1954 |     await expect(observer).toHaveAttribute("data-observer-renderer-failure-stage", /^(initialization|output-policy)$/);
  1955 |   } else {
  1956 |     throw new Error(`The material-aware request mounted an unsupported renderer family: ${String(firstFamily)}`);
  1957 |   }
  1958 |   await expect(observer).toHaveAttribute("data-observer-environment-status", "active", { timeout: 90_000 });
  1959 |   const groundGlass = page.getByTestId("ground-glass-rtt").first();
  1960 |   await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 90_000 });
  1961 |   const firstMountAttributes = await readObserverAttributes(observer);
  1962 |   const firstScreenshot = await captureObserverCanvasScreenshot(page, observer.locator("canvas"));
  1963 |   const firstScreenshotPixels = analyzeCanvasScreenshot(firstScreenshot);
  1964 |   expect(firstScreenshotPixels.contentful).toBe(true);
  1965 |   const firstViewState = await readObserverViewState(observer);
  1966 |   expect(vectorsMatch(webglViewState.position, firstViewState.position)).toBe(true);
  1967 |   expect(vectorsMatch(webglViewState.target, firstViewState.target)).toBe(true);
  1968 |   const candidateOverlayVisibility = await readOverlayVisibility(observer);
  1969 |   expect(candidateOverlayVisibility).toEqual(webglOverlayVisibility);
  1970 |   await expandSceneViewport(page);
  1971 |   const candidateCaptureConfiguration = await readObserverCaptureConfiguration(page, observer);
  1972 |   await applyOverlayVisibility(page, observer, {
  1973 |     focusPlane: false,
  1974 |     dofRegion: false,
  1975 |     opticalGeometry: false,
  1976 |   });
  1977 |   await collapseOverlayControls(page);
  1978 |   const webgpuFocusChartCapture = await captureObserverFramebufferScreenshot(page, observer.locator("canvas"));
  1979 |   await setObserverViewFocus(page, observer, "camera");
  1980 |   await applyOverlayVisibility(page, observer, {
  1981 |     focusPlane: false,
  1982 |     dofRegion: false,
  1983 |     opticalGeometry: true,
  1984 |   });
  1985 |   await collapseOverlayControls(page);
  1986 |   const webgpuOpticalGeometryCapture = await captureObserverFramebufferScreenshot(page, observer.locator("canvas"));
  1987 |   const webgpuOpticalAxisViewState = await readObserverViewState(observer);
  1988 |   expect(vectorsMatch(webglOpticalAxisViewState.position, webgpuOpticalAxisViewState.position)).toBe(true);
  1989 |   expect(vectorsMatch(webglOpticalAxisViewState.target, webgpuOpticalAxisViewState.target)).toBe(true);
  1990 |   await setObserverViewFocus(page, observer, "scene");
  1991 |   await applyOverlayVisibility(page, observer, candidateOverlayVisibility);
  1992 |   await restoreSceneViewport(page);
  1993 |   await mkdir(testInfo.outputDir, { recursive: true });
  1994 |   await Promise.all([
  1995 |     writeFile(testInfo.outputPath("architecture-rise-webgl-focus-chart-no-overlays.png"), webglFocusChartCapture),
  1996 |     writeFile(testInfo.outputPath("architecture-rise-webgl-optical-geometry-only.png"), webglOpticalGeometryCapture),
  1997 |     writeFile(testInfo.outputPath("architecture-rise-webgpu-focus-chart-no-overlays.png"), webgpuFocusChartCapture),
  1998 |     writeFile(testInfo.outputPath("architecture-rise-webgpu-optical-geometry-only.png"), webgpuOpticalGeometryCapture),
  1999 |   ]);
  2000 |   await testInfo.attach("architecture-rise-webgpu-focus-chart-no-overlays.png", {
  2001 |     body: webgpuFocusChartCapture,
  2002 |     contentType: "image/png",
  2003 |   });
  2004 |   await testInfo.attach("architecture-rise-webgpu-optical-geometry-only.png", {
  2005 |     body: webgpuOpticalGeometryCapture,
  2006 |     contentType: "image/png",
  2007 |   });
  2008 |   await testInfo.attach("architecture-rise-webgl-focus-chart-no-overlays.png", {
  2009 |     body: webglFocusChartCapture,
  2010 |     contentType: "image/png",
  2011 |   });
  2012 |   await testInfo.attach("architecture-rise-webgl-optical-geometry-only.png", {
  2013 |     body: webglOpticalGeometryCapture,
  2014 |     contentType: "image/png",
  2015 |   });
  2016 |   const focusChartReference = decodePngScreenshot(webglFocusChartCapture);
  2017 |   const focusChartRegion = projectWorldBoundsRegion(
  2018 |     focusChartReference.width,
  2019 |     focusChartReference.height,
  2020 |     webglViewState,
```