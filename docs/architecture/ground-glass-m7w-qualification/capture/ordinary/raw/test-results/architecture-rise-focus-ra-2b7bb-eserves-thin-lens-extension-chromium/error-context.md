# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture-rise-focus-range.spec.ts >> Architecture Rise focus control stays within scene depth and preserves thin-lens extension
- Location: src/tests/e2e/architecture-rise-focus-range.spec.ts:62:1

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
  1   | import { writeFile } from "node:fs/promises";
  2   | import { expect, test, type Locator } from "@playwright/test";
  3   | import { readFocusDistributionPercent } from "./helpers/focusDistribution";
  4   | import { expectGroundGlassPhysicalScale } from "./helpers/groundGlass";
  5   | import { setStepRangeInput } from "./helpers/stepRangeInput";
  6   | import { installM7nRendererLifecycleCapture } from "./helpers/m7nRendererLifecycleCapture";
  7   | import { installM7oCanvasAssertionTimingCapture, type M7oCapture } from "./helpers/m7oCanvasAssertionTimingCapture";
  8   | import { installM7pAssertionSchedulingCapture, type M7pAssertionSchedulingCapture } from "./helpers/m7pAssertionSchedulingCapture";
  9   |
  10  | let finishM7nCapture: ((capturePhase?: "after-test" | "canvas-count-assertion-failure") => Promise<void>) | null = null;
  11  | let m7oCapture: M7oCapture | null = null;
  12  | let m7pCapture: M7pAssertionSchedulingCapture | null = null;
  13  |
  14  | test.beforeEach(async ({ page }, testInfo) => {
  15  |   if (process.env.M7P_CAPTURE_DIAGNOSTICS === "1") {
  16  |     m7pCapture = await installM7pAssertionSchedulingCapture(
  17  |       page,
  18  |       testInfo,
  19  |       process.env.M7P_CAPTURE_ID ?? "unlabelled",
  20  |     );
  21  |   }
  22  |   if (process.env.M7O_CAPTURE_DIAGNOSTICS === "1") {
  23  |     m7oCapture = await installM7oCanvasAssertionTimingCapture(
  24  |       page,
  25  |       testInfo,
  26  |       process.env.M7O_CAPTURE_ID ?? "unlabelled",
  27  |     );
  28  |   }
  29  |   if (process.env.M7N_CAPTURE_DIAGNOSTICS !== "1") return;
  30  |   finishM7nCapture = await installM7nRendererLifecycleCapture(
  31  |     page,
  32  |     testInfo,
  33  |     process.env.M7N_CAPTURE_RUN_ID ?? "unlabelled",
  34  |   );
  35  | });
  36  |
  37  | test.afterEach(async () => {
  38  |   const finish = finishM7nCapture;
  39  |   finishM7nCapture = null;
  40  |   await finish?.();
  41  |   const capture = m7oCapture;
  42  |   m7oCapture = null;
  43  |   await capture?.finish();
  44  |   const m7p = m7pCapture;
  45  |   m7pCapture = null;
  46  |   await m7p?.finish();
  47  | });
  48  |
  49  | const readVector = async (locator: Locator, attribute: string): Promise<[number, number, number]> => {
  50  |   const value = await locator.getAttribute(attribute);
  51  |   if (!value) throw new Error(`${attribute} is missing from the Architecture Rise diagnostics`);
  52  |   const vector = value.split(",").map(Number);
  53  |   if (vector.length !== 3 || !vector.every(Number.isFinite)) {
  54  |     throw new Error(`${attribute} is not a finite three-dimensional vector: ${value}`);
  55  |   }
  56  |   return vector as [number, number, number];
  57  | };
  58  |
  59  | const distance = (a: readonly number[], b: readonly number[]) =>
  60  |   Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  61  |
  62  | test("Architecture Rise focus control stays within scene depth and preserves thin-lens extension", async ({ page }, testInfo) => {
  63  |   test.setTimeout(90_000);
  64  |   await page.goto("/simulator/free/architecture-rise");
  65  |
  66  |   const scene = page.getByTestId("scene-canvas");
  67  |   const focus = page.getByRole("slider", { name: "Focus distance", exact: true });
  68  |   const canvasCountTimeoutMs = 5_000;
  69  |   const syntheticStallMs = Number(process.env.M7P_SYNTHETIC_STALL_MS ?? "0");
  70  |   if (syntheticStallMs > 0) {
  71  |     if (!m7pCapture) throw new Error("M7P synthetic stall requires diagnostic capture to be enabled.");
  72  |     const waitStartedAtMs = performance.now();
  73  |     await page.waitForFunction(
  74  |       () => document.querySelector('[data-testid="scene-canvas"] canvas') !== null,
  75  |       undefined,
  76  |       { timeout: canvasCountTimeoutMs },
  77  |     );
  78  |     m7pCapture?.recordNodeInterval("synthetic-control-waited-for-connected-canvas", waitStartedAtMs, performance.now());
  79  |     await m7pCapture?.recordBrowserEvaluation("synthetic-control-before-stall");
  80  |   }
  81  |   await m7oCapture?.captureBoundary("before-canvas-count-assertion");
  82  |   await m7pCapture?.recordBrowserEvaluation("assertion-entry-anchor");
  83  |   m7pCapture?.beginAssertion(canvasCountTimeoutMs);
  84  |   m7oCapture?.beginAssertion(canvasCountTimeoutMs);
  85  |   const syntheticStallSettled = syntheticStallMs > 0
  86  |     ? m7pCapture?.beginSyntheticMainThreadStall(syntheticStallMs)
  87  |       .then(() => null, (error: unknown) => error instanceof Error ? error.message : String(error))
  88  |     : null;
  89  |   try {
> 90  |     await expect(scene.locator("canvas")).toHaveCount(1, { timeout: canvasCountTimeoutMs });
      |                                           ^ Error: expect(locator).toHaveCount(expected) failed
  91  |     m7pCapture?.settleAssertion("passed");
  92  |     m7oCapture?.settleAssertion("passed");
  93  |   } catch (error) {
  94  |     m7pCapture?.settleAssertion("failed", error instanceof Error ? error.message : String(error));
  95  |     await m7pCapture?.recordBrowserEvaluation("assertion-failure-catch");
  96  |     const syntheticStallError = await syntheticStallSettled;
  97  |     if (syntheticStallError) throw new Error(`M7P synthetic stall failed: ${syntheticStallError}`, { cause: error });
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
```