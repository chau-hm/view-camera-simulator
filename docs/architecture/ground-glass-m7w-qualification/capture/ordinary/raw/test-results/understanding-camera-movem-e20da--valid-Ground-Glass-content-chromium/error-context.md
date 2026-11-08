# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: understanding-camera-movements.spec.ts >> camera movements scene loads and renders valid Ground Glass content
- Location: src/tests/e2e/understanding-camera-movements.spec.ts:74:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('region', { name: 'Camera Movement' }).getByRole('status')
Expected substring: "Neutral viewpoint"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByRole('region', { name: 'Camera Movement' }).getByRole('status')

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  1   | import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
  2   | import { test, expect, type Locator, type Page } from "@playwright/test";
  3   |
  4   | const disableOpticalGeometry = async (page: Page, scene: Locator) => {
  5   |   if ((await scene.getAttribute("data-optical-geometry-visible")) !== "true") return;
  6   |   const trigger = page.getByRole("button", { name: "View overlays" });
  7   |   if (await trigger.isVisible()) await trigger.click();
  8   |   await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  9   |   await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  10  | };
  11  |
  12  | const enableRttDiagnosticsWithoutNavigation = async (page: Page) => {
  13  |   await page.evaluate(() => {
  14  |     const url = new URL(window.location.href);
  15  |     url.searchParams.set("rttDiagnostics", "1");
  16  |     window.history.replaceState(window.history.state, "", url);
  17  |   });
  18  | };
  19  |
  20  | async function readSceneCanvasVisualSample(canvas: Locator) {
  21  |   const screenshot = await canvas.screenshot();
  22  |   return canvas.evaluate(async (_element, screenshotBase64) => {
  23  |     const image = new Image();
  24  |     image.src = `data:image/png;base64,${screenshotBase64}`;
  25  |     await image.decode();
  26  |     const width = Math.min(image.width, 640);
  27  |     const height = Math.min(image.height, 480);
  28  |     const sampleCanvas = document.createElement("canvas");
  29  |     sampleCanvas.width = width;
  30  |     sampleCanvas.height = height;
  31  |     const context = sampleCanvas.getContext("2d");
  32  |     if (!context) return { supported: false, chromaticPixels: 0, brightNeutralPixels: 0, brightPixels: 0 };
  33  |     context.drawImage(image, 0, 0, width, height);
  34  |     const pixels = context.getImageData(0, 0, width, height).data;
  35  |     let chromaticPixels = 0;
  36  |     let brightNeutralPixels = 0;
  37  |     let brightPixels = 0;
  38  |     for (let index = 0; index < pixels.length; index += 4) {
  39  |       const red = pixels[index] ?? 0;
  40  |       const green = pixels[index + 1] ?? 0;
  41  |       const blue = pixels[index + 2] ?? 0;
  42  |       const maximum = Math.max(red, green, blue);
  43  |       const minimum = Math.min(red, green, blue);
  44  |       if (maximum > 55) {
  45  |         brightPixels += 1;
  46  |         if (maximum - minimum < 18) brightNeutralPixels += 1;
  47  |       }
  48  |       if (maximum > 55 && maximum - minimum > 24) chromaticPixels += 1;
  49  |     }
  50  |     return { supported: true, chromaticPixels, brightNeutralPixels, brightPixels };
  51  |   }, screenshot.toString("base64"));
  52  | }
  53  |
  54  | const expectFiniteVectorAttribute = async (
  55  |   locator: Locator,
  56  |   attribute: string,
  57  | ): Promise<number[]> => {
  58  |   const serialized = await locator.getAttribute(attribute);
  59  |   expect(serialized, attribute).toBeTruthy();
  60  |   const components = serialized!.split(",").map(Number);
  61  |   expect(components, attribute).toHaveLength(3);
  62  |   expect(components.every(Number.isFinite), attribute).toBe(true);
  63  |   return components;
  64  | };
  65  |
  66  | const rttForChannel = (
  67  |   page: Page,
  68  |   channel: "default" | "camera-movement-original" | "camera-movement-current",
  69  | ) => page.locator(`[data-testid="ground-glass-rtt"][data-rtt-channel="${channel}"]`);
  70  |
  71  | const publicCurrentRtt = (page: Page) =>
  72  |   rttForChannel(page, "default");
  73  |
  74  | test("camera movements scene loads and renders valid Ground Glass content", async ({ page }) => {
  75  |   await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  76  |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  77  |   await expect(page.getByTestId("current-settings-readout")).toHaveCount(0);
> 78  |   await expect(page.getByRole("region", { name: "Camera Movement" }).getByRole("status")).toContainText("Neutral viewpoint");
      |                                                                                           ^ Error: expect(locator).toContainText(expected) failed
  79  |   await expect(page.locator('[data-testid="scene-canvas"]')).toBeVisible({ timeout: 15000 });
  80  |   await expect(page.locator('[data-optical-geometry-visible="true"]')).toBeVisible({ timeout: 5000 });
  81  |
  82  |   const rtt = publicCurrentRtt(page);
  83  |   await expect(rtt).toHaveCount(1);
  84  |   await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel^="camera-movement-"]')).toHaveCount(0);
  85  |   await expect(rtt).toBeVisible({ timeout: 15000 });
  86  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });
  87  |   await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5000 });
  88  |   await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15000 });
  89  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });
  90  |   const rawNonBg = Number(await rtt.getAttribute("data-rtt-raw-non-background"));
  91  |   const finalNonBg = Number(await rtt.getAttribute("data-rtt-final-non-background"));
  92  |   expect(Number.isFinite(rawNonBg) && rawNonBg > 0).toBe(true);
  93  |   expect(Number.isFinite(finalNonBg) && finalNonBg > 0).toBe(true);
  94  |   const sanityError = await rtt.getAttribute("data-rtt-sanity-error");
  95  |   expect(sanityError === null || sanityError === "" || sanityError === "null").toBe(true);
  96  |
  97  |   await expect(page.getByRole("slider", { name: "Viewpoint" })).toBeVisible();
  98  |   await expect(page.getByRole("slider", { name: "Tilt" })).toBeVisible();
  99  |   await expect(page.getByRole("slider", { name: "Vertical framing" })).toBeVisible();
  100 |   await expect(page.getByRole("group", { name: "Tilt standard" })).toBeVisible();
  101 |   await expect(page.getByRole("group", { name: "Vertical framing standard" })).toBeVisible();
  102 |   await expect(page.getByRole("group", { name: "Tilt standard" }).getByRole("radio", { name: "Front standard" })).toBeVisible();
  103 |   await expect(page.getByRole("group", { name: "Vertical framing standard" }).getByRole("radio", { name: "Rear standard" })).toBeVisible();
  104 |   await expect(page.getByRole("radio", { name: "C1 — Front rise" })).toHaveCount(0);
  105 |   await expect(page.getByRole("radio", { name: "C2 — Rear rise" })).toHaveCount(0);
  106 |   await expect(page.getByRole("radio", { name: "D1 — Front fall" })).toHaveCount(0);
  107 |   await expect(page.getByRole("radio", { name: "D2 — Rear fall" })).toHaveCount(0);
  108 |   await expect(page.getByRole("radio", { name: "Neutral" })).toHaveCount(0);
  109 |   await expect(page.getByRole("radio", { name: "A — Front tilt" })).toHaveCount(0);
  110 |   await expect(page.getByRole("radio", { name: "C3 — Higher viewpoint" })).toHaveCount(0);
  111 |   await expect(page.getByRole("radio", { name: "D3 — Lower viewpoint" })).toHaveCount(0);
  112 |
  113 |   await expect(page.getByRole("button", { name: "Reset Movements" })).toBeVisible();
  114 |   await expect(page.getByRole("button", { name: "Restart Task" })).toHaveCount(0);
  115 |   await expect(aperture).toHaveAttribute("data-selected-aperture", "11");
  116 |   await expect(aperture).toBeDisabled();
  117 | });
  118 |
  119 | test("continuous viewpoint, tilt, and vertical framing change Ground Glass without breaking", async ({ page }) => {
  120 |   test.setTimeout(120_000);
  121 |   await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  122 |   const rtt = publicCurrentRtt(page);
  123 |   await expect(rtt).toBeVisible({ timeout: 15000 });
  124 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });
  125 |
  126 |   const viewpoint = page.getByRole("slider", { name: "Viewpoint" });
  127 |   const tilt = page.getByRole("slider", { name: "Tilt" });
  128 |   const framing = page.getByRole("slider", { name: "Vertical framing" });
  129 |   const tiltStandards = page.getByRole("group", { name: "Tilt standard" });
  130 |   const framingStandards = page.getByRole("group", { name: "Vertical framing standard" });
  131 |   await tilt.fill("3.2");
  132 |   await expect(tilt).toHaveValue("3.2");
  133 |   await tiltStandards.getByRole("radio", { name: "Rear standard" }).click();
  134 |   await expect(tiltStandards.getByRole("radio", { name: "Rear standard" })).toBeChecked();
  135 |   await expect(tilt).toHaveValue("3.2");
  136 |   await viewpoint.fill("0.5");
  137 |   await expect(viewpoint).toHaveValue("0.5");
  138 |   await viewpoint.fill("1");
  139 |   await expect(viewpoint).toHaveValue("1");
  140 |   await framingStandards.getByRole("radio", { name: "Front standard" }).click();
  141 |   await framing.fill("1");
  142 |   await expect(framing).toHaveValue("1");
  143 |   await framingStandards.getByRole("radio", { name: "Rear standard" }).click();
  144 |   await framing.fill("-1");
  145 |   await expect(framing).toHaveValue("-1");
  146 |
  147 |   // RTT stays valid after each continuous or compatibility transition.
  148 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 5000 });
  149 |   await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5000 });
  150 |   await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
  151 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });
  152 | });
  153 |
  154 | test("Reset Movements restores zero state and keeps Ground Glass valid", async ({ page }) => {
  155 |   test.setTimeout(60_000);
  156 |   await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  157 |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  158 |   const rtt = publicCurrentRtt(page);
  159 |   await expect(rtt).toBeVisible({ timeout: 15000 });
  160 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15000 });
  161 |
  162 |   // Select a non-neutral continuous state.
  163 |   await page.getByRole("slider", { name: "Viewpoint" }).fill("-0.6");
  164 |   await expect(page.getByRole("slider", { name: "Viewpoint" })).toHaveValue("-0.6");
  165 |
  166 |   const prevState = await rtt.getAttribute("data-rtt-sanity-state");
  167 |
  168 |   // Reset Movements restores complete Neutral
  169 |   await page.getByRole("button", { name: "Reset Movements" }).click();
  170 |
  171 |   // Neutral Viewpoint should be selected again.
  172 |   await expect(page.getByRole("slider", { name: "Viewpoint" })).toHaveValue("0");
  173 |   await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  174 |   await expect(aperture).toHaveAttribute("data-selected-aperture", "11");
  175 |   await expect(aperture).toBeDisabled();
  176 |
  177 |   // Wait for a new RTT frame after reset
  178 |   await expect.poll(async () => {
```