# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture-rise-focus-range.spec.ts >> Architecture Rise exposes visible blur for the reported strong-defocus state
- Location: src/tests/e2e/architecture-rise-focus-range.spec.ts:176:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('ground-glass-rtt').first()
Expected: "true"
Received: ""

Call log:
  - Expect "toHaveAttribute" with timeout 60000ms
  - waiting for getByTestId('ground-glass-rtt').first()

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
                      - slider "Swing" [ref=e209]: "-1.1"
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
                      - radio "f/5.6" [checked] [active] [ref=e225]
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
  98  |     await m7pCapture?.finish();
  99  |     m7oCapture?.settleAssertion("failed", error instanceof Error ? error.message : String(error));
  100 |     if (m7oCapture) {
  101 |       await m7oCapture.captureBoundary("immediate-canvas-assertion-failure-snapshot");
  102 |     }
  103 |     await finishM7nCapture?.("canvas-count-assertion-failure");
  104 |     if (m7oCapture) {
  105 |       if (process.env.M7O_POST_FAILURE_POLL === "1") {
  106 |         m7oCapture.mark("separate-diagnostic-expect-poll-started", { timeoutMs: canvasCountTimeoutMs });
  107 |         let diagnosticPollResult: "passed" | "failed" = "failed";
  108 |         let diagnosticPollError: string | null = null;
  109 |         try {
  110 |           await expect.poll(async () => {
  111 |             const nodeRequestStartMs = performance.now();
  112 |             const browser = await page.evaluate(() => {
  113 |               const diagnostics = (window as Window & {
  114 |                 __m7oCanvasTimingCapture?: { observeDom: () => Record<string, unknown> };
  115 |               }).__m7oCanvasTimingCapture;
  116 |               return diagnostics?.observeDom() ?? null;
  117 |             });
  118 |             const nodeResponseEndMs = performance.now();
  119 |             const dom = browser;
  120 |             const scenes = Array.isArray(dom?.sceneContainers) ? dom.sceneContainers as Array<Record<string, unknown>> : [];
  121 |             const canvases = scenes.flatMap((container) => Array.isArray(container.canvases)
  122 |               ? container.canvases as Array<Record<string, unknown>>
  123 |               : []);
  124 |             m7oCapture?.recordPollObservation({
  125 |               nodeRequestStartMs,
  126 |               nodeResponseEndMs,
  127 |               browserMonotonicMs: typeof browser?.sampledAtPageMonotonicMs === "number"
  128 |                 ? browser.sampledAtPageMonotonicMs
  129 |                 : null,
  130 |               count: canvases.length,
  131 |               documentIdentity: typeof dom?.documentIdentity === "string" ? dom.documentIdentity : null,
  132 |               sceneContainerIdentities: scenes.flatMap((container) => typeof container.identity === "string" ? [container.identity] : []),
  133 |               canvasIdentities: canvases.flatMap((canvas) => typeof canvas.identity === "string" ? [canvas.identity] : []),
  134 |             });
  135 |             return canvases.length;
  136 |           }, { timeout: canvasCountTimeoutMs }).toBe(1);
  137 |           diagnosticPollResult = "passed";
  138 |         } catch (pollError) {
  139 |           diagnosticPollError = pollError instanceof Error ? pollError.message.split("\n")[0] : String(pollError);
  140 |         }
  141 |         m7oCapture.mark("separate-diagnostic-expect-poll-settled", {
  142 |           result: diagnosticPollResult,
  143 |           errorSummary: diagnosticPollError,
  144 |           primaryAssertionOutcomeUnchanged: "failed",
  145 |         });
  146 |       }
  147 |     }
  148 |     throw error;
  149 |   }
  150 |   const syntheticStallError = await syntheticStallSettled;
  151 |   if (syntheticStallError) throw new Error(`M7P synthetic stall failed: ${syntheticStallError}`);
  152 |   await m7pCapture?.recordBrowserEvaluation("assertion-settlement-snapshot");
  153 |   await m7pCapture?.finish();
  154 |   await expect(scene).toHaveAttribute("data-optics-fallback-applied", "false");
  155 |   await expect(focus).toBeEnabled();
  156 |   await expect(focus).toHaveValue("8890");
  157 |   await expect(focus).toHaveAttribute("min", "3090");
  158 |   await expect(focus).toHaveAttribute("max", "13000");
  159 |   await page.screenshot({ path: testInfo.outputPath("architecture-rise-focus-canonical.png") });
  160 |
  161 |   // Home is a standard accessible range-control action and reaches the public
  162 |   // minimum without hundreds of expensive intermediate WebGL updates.
  163 |   await focus.focus();
  164 |   await focus.press("Home");
  165 |   await expect(focus).toHaveValue("3090");
  166 |
  167 |   const lens = await readVector(scene, "data-camera-lens-center-world");
  168 |   const film = await readVector(scene, "data-camera-film-center-world");
  169 |   const lensToFilmDistanceMm = distance(lens, film);
  170 |   expect(lensToFilmDistanceMm).toBeCloseTo((150 * 3090) / (3090 - 150), 2);
  171 |   expect(lensToFilmDistanceMm).toBeLessThan(160);
  172 |   expect(lensToFilmDistanceMm).toBeLessThan(2400);
  173 |   await page.screenshot({ path: testInfo.outputPath("architecture-rise-focus-minimum.png") });
  174 | });
  175 |
  176 | test("Architecture Rise exposes visible blur for the reported strong-defocus state", async ({ page }, testInfo) => {
  177 |   test.setTimeout(120_000);
  178 |   await page.goto("/simulator/free/architecture-rise?rttDiagnostics=1");
  179 |
  180 |   const scene = page.getByTestId("scene-canvas");
  181 |   const rtt = page.getByTestId("ground-glass-rtt").first();
  182 |   const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  183 |   const aperture = page.getByRole("radiogroup", { name: "Aperture", exact: true });
  184 |
  185 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  186 |   await setStepRangeInput(page, "Rise", 22);
  187 |   await setStepRangeInput(page, "Tilt", 0.4);
  188 |   await setStepRangeInput(page, "Swing", -1.1);
  189 |   await focus.focus();
  190 |   await focus.press("End");
  191 |   await expect(focus).toHaveValue("13000");
  192 |   await aperture.getByRole("radio", { name: "f/5.6" }).check();
  193 |
  194 |   await expect(focus).toHaveValue("13000");
  195 |   await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  196 |   await expect(scene).toHaveAttribute("data-optics-fallback-applied", "false");
  197 |   const fullFilmScale = await expectGroundGlassPhysicalScale(rtt);
> 198 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
      |                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  199 |   await expect.poll(() => readFocusDistributionPercent(page, { targetId: "building-mid-facade" })).toBe(0);
  200 |   await testInfo.attach("architecture-rise-strong-defocus-physical-blur-scale", {
  201 |     body: JSON.stringify(fullFilmScale),
  202 |     contentType: "application/json",
  203 |   });
  204 |   await writeFile(
  205 |     testInfo.outputPath("architecture-rise-strong-defocus-physical-blur-scale.json"),
  206 |     JSON.stringify(fullFilmScale, null, 2),
  207 |   );
  208 |   await page.screenshot({ path: testInfo.outputPath("architecture-rise-strong-defocus.png") });
  209 |   await rtt.locator("canvas").screenshot({ path: testInfo.outputPath("architecture-rise-strong-defocus-ground-glass.png") });
  210 |
  211 |   const loupeButton = page.getByRole("button", { name: /Focus loupe.*Ground Glass view/ });
  212 |   await loupeButton.click();
  213 |   await expect(rtt).toHaveAttribute("data-rtt-inspection-window-active", "true");
  214 |   const loupeScale = await expectGroundGlassPhysicalScale(rtt);
  215 |   expect(loupeScale.physicalBoundaryRadiusPx / fullFilmScale.physicalBoundaryRadiusPx).toBeCloseTo(
  216 |     fullFilmScale.sampledFilmWidthMm / loupeScale.sampledFilmWidthMm,
  217 |     4,
  218 |   );
  219 |   await page.screenshot({ path: testInfo.outputPath("architecture-rise-strong-defocus-focus-loupe.png") });
  220 |   await rtt.locator("canvas").screenshot({ path: testInfo.outputPath("architecture-rise-strong-defocus-focus-loupe-ground-glass.png") });
  221 |   await testInfo.attach("architecture-rise-focus-loupe-physical-scale", {
  222 |     body: JSON.stringify({ fullFilmScale, loupeScale }),
  223 |     contentType: "application/json",
  224 |   });
  225 | });
  226 |
```