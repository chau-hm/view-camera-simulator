# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shelf-swing.spec.ts >> Shelf Swing free and guided workflows stay accessible without console errors
- Location: src/tests/e2e/shelf-swing.spec.ts:128:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByLabel('Rise').locator('..')
Expected substring: "Disabled for this guided task"
Received string:    "Rise0.0 mm"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByLabel('Rise').locator('..')
    5 × locator resolved to <div data-active="false" class="compact-range-row">…</div>
      - unexpected value "Rise0.0 mm"

```

```yaml
- text: Rise
- slider "Rise" [disabled]: "0"
```

# Test source

```ts
  49  |     first: { x: number; y: number; width: number; height: number },
  50  |     second: { x: number; y: number; width: number; height: number },
  51  |     gapPx: number,
  52  |   ) =>
  53  |     !(
  54  |       first.x + first.width + gapPx <= second.x ||
  55  |       second.x + second.width + gapPx <= first.x ||
  56  |       first.y + first.height + gapPx <= second.y ||
  57  |       second.y + second.height + gapPx <= first.y
  58  |     );
  59  | 
  60  |   expect(overlapsWithGap(guideBox, markerBox, 4)).toBe(false);
  61  |   expect(overlapsWithGap(guideBox, middleLabelBox, 4)).toBe(false);
  62  |   expect(guideBox.x).toBeGreaterThanOrEqual(svgBox.x);
  63  |   expect(guideBox.y).toBeGreaterThanOrEqual(svgBox.y);
  64  |   expect(guideBox.x + guideBox.width).toBeLessThanOrEqual(svgBox.x + svgBox.width);
  65  |   expect(guideBox.y + guideBox.height).toBeLessThanOrEqual(svgBox.y + svgBox.height);
  66  | };
  67  | 
  68  | const readRttVariance = async (page: Page) => {
  69  |   const rtt = page.getByTestId("ground-glass-rtt");
  70  |   return {
  71  |     raw: Number(await rtt.getAttribute("data-rtt-raw-variance")),
  72  |     final: Number(await rtt.getAttribute("data-rtt-final-variance")),
  73  |   };
  74  | };
  75  | 
  76  | const expectRttContent = async (page: Page) => {
  77  |   const rtt = page.getByTestId("ground-glass-rtt");
  78  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 120_000 });
  79  |   await expect(rtt).toHaveAttribute("data-rtt-depth-available", "true");
  80  |   await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true");
  81  |   await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "derived-planes");
  82  |   await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true");
  83  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true");
  84  |   expect(Number(await rtt.getAttribute("data-rtt-raw-variance"))).toBeGreaterThan(4);
  85  |   expect(Number(await rtt.getAttribute("data-rtt-final-variance"))).toBeGreaterThan(4);
  86  |   expect(Number(await rtt.getAttribute("data-rtt-raw-non-background"))).toBeGreaterThan(0);
  87  |   expect(Number(await rtt.getAttribute("data-rtt-final-non-background"))).toBeGreaterThan(0);
  88  |   await expect(rtt.locator("canvas")).toBeVisible();
  89  |   expect((await rtt.locator("canvas").screenshot()).byteLength).toBeGreaterThan(5_000);
  90  | };
  91  | 
  92  | test("Shelf Swing card exposes free and guided modes", async ({ page }) => {
  93  |   await page.goto("/scenes");
  94  |   const card = shelfCard(page);
  95  |   await expect(card).toBeVisible();
  96  |   const thumbnail = card.locator("img");
  97  |   await expect(thumbnail).toHaveAttribute("src", /assets\/shelf-swing\.webp$/);
  98  |   await expect.poll(() => thumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  99  |   await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
  100 |     "href",
  101 |     "/simulator/free/shelf-swing",
  102 |   );
  103 |   await expect(card.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
  104 |     "href",
  105 |     "/simulator/guided/shelf-swing/swing-01",
  106 |   );
  107 |   await expect(card.getByText("In development")).toHaveCount(0);
  108 | 
  109 |   await card.getByRole("link", { name: "Open Scene" }).click();
  110 |   await expect(page).toHaveURL(/\/simulator\/free\/shelf-swing$/);
  111 | });
  112 | 
  113 | test("Shelf Swing routes reject mismatched and free-mode task IDs", async ({ page }) => {
  114 |   await page.goto("/simulator/guided/shelf-swing/tilt-01");
  115 |   await expect(page).toHaveURL(/\/scenes$/);
  116 |   await expect(page.getByText("Align the tabletop plane of sharp focus")).toHaveCount(0);
  117 | 
  118 |   await page.goto("/simulator/free/shelf-swing/swing-01");
  119 |   await expect(page).toHaveURL(/\/scenes$/);
  120 |   await expect(page.getByText("Align the diagonal plane of sharp focus")).toHaveCount(0);
  121 | 
  122 |   await page.goto("/simulator/guided/shelf-swing/swing-01");
  123 |   await expect(page).toHaveURL(/\/simulator\/guided\/shelf-swing\/swing-01$/);
  124 |   await openLearningDrawer(page);
  125 |   await expect(page.getByText("Align the diagonal plane of sharp focus")).toBeVisible();
  126 | });
  127 | 
  128 | test("Shelf Swing free and guided workflows stay accessible without console errors", async ({ page }) => {
  129 |   const pageErrors: string[] = [];
  130 |   const consoleProblems: string[] = [];
  131 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  132 |   page.on("console", (message) => {
  133 |     if (isKnownFiberClockDeprecation(message)) return;
  134 |     if (message.type() === "error" || message.type() === "warning") {
  135 |       if (!isAllowedEnvironmentConsoleMessage(message.text())) {
  136 |         consoleProblems.push(message.text());
  137 |       }
  138 |     }
  139 |   });
  140 | 
  141 |   await page.goto("/simulator/free/shelf-swing");
  142 |   for (const label of ["Rise", "Tilt", "Swing", "Focus distance"]) {
  143 |     await expect(page.getByLabel(label)).toBeEnabled();
  144 |   }
  145 | 
  146 |   await page.goto("/simulator/guided/shelf-swing/swing-01");
  147 |   await expect(page.getByLabel("Rise")).toBeDisabled();
  148 |   await expect(page.getByLabel("Tilt")).toBeDisabled();
> 149 |   await expect(page.getByLabel("Rise").locator("..")).toContainText("Disabled for this guided task");
      |                                                       ^ Error: expect(locator).toContainText(expected) failed
  150 |   await expect(page.getByLabel("Tilt").locator("..")).toContainText("Disabled for this guided task");
  151 |   await expect(page.getByRole("region", { name: "Guided lesson progress" })).toHaveCount(0);
  152 | 
  153 |   const overlayTrigger = page.getByRole("button", { name: "View overlays" }).first();
  154 |   await overlayTrigger.click();
  155 |   const focusPlaneToggle = page.getByRole("button", { name: /focus plane/i }).first();
  156 |   await expect(focusPlaneToggle).toHaveAttribute("aria-pressed", /true|false/);
  157 |   await expect(page.getByRole("button", { name: "Expand 2D Geometry" })).toBeVisible();
  158 |   await openLearningDrawer(page);
  159 |   await expect(page.getByText("Align the diagonal plane of sharp focus", { exact: true })).toBeVisible();
  160 | 
  161 |   expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  162 |   expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
  163 | });
  164 | 
  165 | test("Shelf Swing free scene uses canonical R3F and contentful RTT rendering", async ({ page }) => {
  166 |   test.setTimeout(180_000);
  167 |   await page.goto("/simulator/free/shelf-swing?rttDiagnostics=1");
  168 | 
  169 |   await expect(page.getByRole("heading", { name: "3D Scene", level: 2 })).toBeVisible();
  170 |   await expect(page.getByRole("heading", { name: "Ground Glass", level: 2 })).toBeVisible();
  171 |   await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
  172 |     "data-scene-subject-id",
  173 |     "shelf-swing",
  174 |   );
  175 |   await expect(page.getByText(/WebGL is unavailable/)).toHaveCount(0);
  176 |   await expect(page.getByTestId("ground-glass-rtt")).toHaveCount(1);
  177 |   await expectRttContent(page);
  178 | });
  179 | 
  180 | test("Shelf Swing physical focus becomes near-sharp and approaches the Raw RTT control", async ({ page }) => {
  181 |   test.setTimeout(180_000);
  182 |   await page.goto("/simulator/free/shelf-swing?rttDiagnostics=1");
  183 |   await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/11" }).check();
  184 | 
  185 |   await setRangeDirect(page, "Swing", -3.961086726);
  186 |   await setRangeDirect(page, "Focus distance", 2000);
  187 |   await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-final-contentful", "true");
  188 |   await expect.poll(async () => Object.values(await readSharpness(page)).every((score) => score >= 80)).toBe(false);
  189 |   const wrongFocus = await readSharpness(page);
  190 |   const wrongFocusVariance = await readRttVariance(page);
  191 |   expect(Number.isFinite(wrongFocusVariance.final)).toBe(true);
  192 |   expect(Number.isFinite(wrongFocusVariance.raw)).toBe(true);
  193 | 
  194 |   await setRangeDirect(page, "Focus distance", 3397.409);
  195 |   await expect.poll(async () => Object.values(await readSharpness(page)).every((score) => score >= 80)).toBe(true);
  196 |   const calibrated = await readSharpness(page);
  197 |   await expectRttContent(page);
  198 |   const calibratedVariance = await readRttVariance(page);
  199 |   expect(Number.isFinite(calibratedVariance.final)).toBe(true);
  200 |   expect(Number.isFinite(calibratedVariance.raw)).toBe(true);
  201 |   expect(Math.min(...Object.values(calibrated))).toBeGreaterThan(
  202 |     Math.max(...Object.values(wrongFocus)),
  203 |   );
  204 |   expect(Math.abs(calibratedVariance.final - calibratedVariance.raw)).toBeLessThan(
  205 |     Math.abs(wrongFocusVariance.final - wrongFocusVariance.raw),
  206 |   );
  207 | 
  208 |   const calibratedStateKey = await page
  209 |     .getByTestId("ground-glass-rtt")
  210 |     .getAttribute("data-rtt-sanity-state");
  211 | 
  212 |   await setRangeDirect(page, "Swing", 3.802);
  213 |   await expect.poll(async () => Object.values(await readSharpness(page)).every((score) => score >= 80)).toBe(false);
  214 |   const opposite = await readSharpness(page);
  215 |   expect(Math.min(opposite["shelf-front"], opposite["shelf-back"])).toBeLessThan(
  216 |     Math.min(calibrated["shelf-front"], calibrated["shelf-back"]),
  217 |   );
  218 |   await expect
  219 |     .poll(() => page.getByTestId("ground-glass-rtt").getAttribute("data-rtt-sanity-state"))
  220 |     .not.toBe(calibratedStateKey);
  221 | 
  222 |   const rawToggle = page.getByLabel("Raw RTT — bypass DOF");
  223 |   await rawToggle.check();
  224 |   await expectRttContent(page);
  225 |   await rawToggle.uncheck();
  226 |   await expectRttContent(page);
  227 | });
  228 | 
  229 | test("Shelf Swing Ground Glass zoom, pan, reset, orientation, and quality stay live", async ({ page }) => {
  230 |   test.setTimeout(180_000);
  231 |   await page.goto("/simulator/free/shelf-swing?rttDiagnostics=1");
  232 |   await expectRttContent(page);
  233 |   const viewport = page.getByLabel("GroundGlassViewport");
  234 |   const stage = viewport.locator('[data-zoomed]');
  235 |   const layer = viewport.getByTestId("ground-glass-image-layer");
  236 | 
  237 |   await clickStageAt(page, stage, 0.25, 0.25);
  238 |   await expect(stage).toHaveAttribute("data-zoomed", "true");
  239 |   // RTT scenes keep the CSS image at identity and crop the physical render target.
  240 |   await expect(stage).toHaveAttribute("data-focus-loupe-scale", "4");
  241 |   await expect(stage).toHaveAttribute("data-presentation-css-scale", "1");
  242 |   await expect(stage).toHaveAttribute("data-scale", "1");
  243 |   await expect
  244 |     .poll(async () => Number(await stage.getAttribute("data-focus-loupe-window-width")))
  245 |     .toBeCloseTo(0.25, 2);
  246 |   const zoomedPan = {
  247 |     x: await stage.getAttribute("data-inspection-pan-x"),
  248 |     y: await stage.getAttribute("data-inspection-pan-y"),
  249 |   };
```