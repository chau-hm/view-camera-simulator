# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mirror-shift-rig-lateral.spec.ts >> Mirror Shift moves the canonical rig while keeping its RTT mounted
- Location: src/tests/e2e/mirror-shift-rig-lateral.spec.ts:72:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: getByRole('slider', { name: 'Camera Position' })
Expected: "0"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveValue" with timeout 5000ms
  - waiting for getByRole('slider', { name: 'Camera Position' })

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page } from "@playwright/test";
  2   | 
  3   | type ViewState = {
  4   |   position: number[];
  5   |   target: number[];
  6   | };
  7   | 
  8   | const parseVector = (value: string | null): number[] => {
  9   |   const parsed = value?.split(",").map(Number) ?? [];
  10  |   if (parsed.length !== 3 || parsed.some((coordinate) => !Number.isFinite(coordinate))) {
  11  |     throw new Error(`Invalid observer vector: ${value}`);
  12  |   }
  13  |   return parsed;
  14  | };
  15  | 
  16  | const readViewState = async (scene: Locator): Promise<ViewState> => ({
  17  |   position: parseVector(await scene.getAttribute("data-observer-camera-position")),
  18  |   target: parseVector(await scene.getAttribute("data-orbit-target")),
  19  | });
  20  | 
  21  | const readStableViewState = async (scene: Locator): Promise<ViewState> => {
  22  |   let previous = "";
  23  |   await expect.poll(async () => {
  24  |     const current = JSON.stringify(await readViewState(scene));
  25  |     const stable = current === previous;
  26  |     previous = current;
  27  |     return stable;
  28  |   }).toBe(true);
  29  |   return readViewState(scene);
  30  | };
  31  | 
  32  | const viewDistance = (view: ViewState) =>
  33  |   Math.hypot(...view.position.map((coordinate, index) => coordinate - view.target[index]));
  34  | 
  35  | const expectSameObserverOffset = (reference: ViewState, actual: ViewState) => {
  36  |   for (let index = 0; index < 3; index += 1) {
  37  |     expect(actual.position[index] - actual.target[index]).toBeCloseTo(
  38  |       reference.position[index] - reference.target[index],
  39  |       5,
  40  |     );
  41  |   }
  42  | };
  43  | 
  44  | const orbitScene = async (page: Page, scene: Locator) => {
  45  |   const canvas = scene.locator("canvas");
  46  |   const bounds = await canvas.boundingBox();
  47  |   if (!bounds) throw new Error("3D Scene canvas bounds unavailable");
  48  | 
  49  |   const overlayBounds = await page.getByTestId("learning-overlay-drawer").boundingBox();
  50  |   const candidates = [
  51  |     { x: bounds.x + bounds.width * 0.58, y: bounds.y + bounds.height * 0.2 },
  52  |     { x: bounds.x + bounds.width * 0.8, y: bounds.y + bounds.height * 0.2 },
  53  |     { x: bounds.x + bounds.width * 0.2, y: bounds.y + bounds.height * 0.2 },
  54  |     { x: bounds.x + bounds.width * 0.58, y: bounds.y + bounds.height * 0.8 },
  55  |   ];
  56  |   const point = candidates.find(({ x, y }) =>
  57  |     !overlayBounds ||
  58  |     x < overlayBounds.x ||
  59  |     x > overlayBounds.x + overlayBounds.width ||
  60  |     y < overlayBounds.y ||
  61  |     y > overlayBounds.y + overlayBounds.height,
  62  |   );
  63  |   if (!point) throw new Error("No Scene orbit point available outside the learning overlay");
  64  | 
  65  |   const { x, y } = point;
  66  |   await page.mouse.move(x, y);
  67  |   await page.mouse.down();
  68  |   await page.mouse.move(x + 72, y - 36, { steps: 6 });
  69  |   await page.mouse.up();
  70  | };
  71  | 
  72  | test("Mirror Shift moves the canonical rig while keeping its RTT mounted", async ({ page }) => {
  73  |   test.setTimeout(150_000);
  74  |   await page.goto("/simulator/free/mirror-shift?rttDiagnostics=1");
  75  | 
  76  |   const scene = page.locator('[data-testid="scene-canvas"]');
  77  |   const rtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  78  |   const position = page.getByRole("slider", { name: "Camera Position" });
  79  |   const frontShift = page.getByRole("slider", { name: "Front Shift" });
  80  | 
> 81  |   await expect(position).toHaveValue("0");
      |                          ^ Error: expect(locator).toHaveValue(expected) failed
  82  |   await expect(frontShift).toHaveValue("0");
  83  |   await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  84  |   await expect(page.getByRole("slider", { name: "Tilt" })).toHaveCount(0);
  85  |   await expect(page.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  86  |   await expect(scene).toHaveAttribute(
  87  |     "data-camera-rig-origin",
  88  |     "0.000000,0.000000,0.000000",
  89  |   );
  90  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  91  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  92  | 
  93  |   const sceneElement = await scene.elementHandle();
  94  |   const rttElement = await rtt.elementHandle();
  95  |   const resourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  96  |   expect(resourceGeneration).toBeTruthy();
  97  | 
  98  |   await position.fill("1800");
  99  |   await expect(position).toHaveValue("1800");
  100 |   await expect(scene).toHaveAttribute(
  101 |     "data-camera-rig-origin",
  102 |     "1800.000000,0.000000,0.000000",
  103 |   );
  104 |   await expect(scene).toHaveAttribute("data-camera-lens-center-world", "1800.000000,0.000000,0.000000");
  105 |   const movedFilmCenter = await scene.getAttribute("data-camera-film-center-world");
  106 |   expect(movedFilmCenter?.split(",")[0]).toBe("1800.000000");
  107 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  108 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  109 |   await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  110 |   await expect.poll(() => page.evaluate((node) => node?.isConnected, sceneElement)).toBe(true);
  111 |   await expect.poll(() => page.evaluate((node) => node?.isConnected, rttElement)).toBe(true);
  112 | 
  113 |   await frontShift.fill("-50");
  114 |   await expect(frontShift).toHaveValue("-50");
  115 |   await expect(scene).toHaveAttribute(
  116 |     "data-camera-rig-origin",
  117 |     "1800.000000,0.000000,0.000000",
  118 |   );
  119 |   await expect(scene).toHaveAttribute("data-camera-lens-center-world", "1750.000000,0.000000,0.000000");
  120 |   const movedFilmCenterAfterShift = await scene.getAttribute("data-camera-film-center-world");
  121 |   expect(movedFilmCenterAfterShift?.split(",")[0]).toBe("1800.000000");
  122 |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  123 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  124 |   await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  125 |   await expect.poll(() => page.evaluate((node) => node?.isConnected, sceneElement)).toBe(true);
  126 |   await expect.poll(() => page.evaluate((node) => node?.isConnected, rttElement)).toBe(true);
  127 | 
  128 |   await page.getByRole("button", { name: "Reset movements" }).click();
  129 |   await expect(position).toHaveValue("0");
  130 |   await expect(frontShift).toHaveValue("0");
  131 |   await expect(scene).toHaveAttribute(
  132 |     "data-camera-rig-origin",
  133 |     "0.000000,0.000000,0.000000",
  134 |   );
  135 | });
  136 | 
  137 | test("Mirror Shift Camera focus follows the rig while Scene focus stays fixed", async ({ page }) => {
  138 |   test.setTimeout(90_000);
  139 |   await page.goto("/simulator/free/mirror-shift");
  140 | 
  141 |   const scene = page.locator('[data-testid="scene-canvas"]');
  142 |   const position = page.getByRole("slider", { name: "Camera Position" });
  143 |   const cameraButton = page.getByRole("button", { name: "Camera", exact: true });
  144 |   const sceneButton = page.getByRole("button", { name: "Scene", exact: true });
  145 | 
  146 |   await expect(scene.locator("canvas")).toHaveCount(1);
  147 |   await cameraButton.click();
  148 |   await expect(scene).toHaveAttribute("data-view-focus", "camera");
  149 |   const neutralCameraPreset = await readStableViewState(scene);
  150 |   // Mirror Shift uses the shared stable body-midpoint anchor at -60 mm for
  151 |   // its 120 mm camera, rather than the former subject-space target.
  152 |   expect(neutralCameraPreset.target).toEqual([0, 0, -0.06]);
  153 |   expect(viewDistance(neutralCameraPreset)).toBeCloseTo(0.72, 4);
  154 |   await orbitScene(page, scene);
  155 |   await expect.poll(async () => (await readViewState(scene)).position).not.toEqual(
  156 |     neutralCameraPreset.position,
  157 |   );
  158 |   const neutralCameraView = await readStableViewState(scene);
  159 | 
  160 |   await position.fill("1800");
  161 |   await expect(position).toHaveValue("1800");
  162 |   await expect(scene).toHaveAttribute(
  163 |     "data-camera-rig-origin",
  164 |     "1800.000000,0.000000,0.000000",
  165 |   );
  166 |   const movedCameraView = await readStableViewState(scene);
  167 | 
  168 |   expect(movedCameraView.target[0] - neutralCameraView.target[0]).toBeCloseTo(1.8, 5);
  169 |   expect(movedCameraView.position[0] - neutralCameraView.position[0]).toBeCloseTo(1.8, 5);
  170 |   for (const index of [1, 2]) {
  171 |     expect(movedCameraView.target[index] - neutralCameraView.target[index]).toBeCloseTo(0, 5);
  172 |     expect(movedCameraView.position[index] - neutralCameraView.position[index]).toBeCloseTo(0, 5);
  173 |   }
  174 |   expectSameObserverOffset(neutralCameraView, movedCameraView);
  175 |   expect(viewDistance(movedCameraView)).toBeCloseTo(viewDistance(neutralCameraView), 5);
  176 | 
  177 |   await sceneButton.click();
  178 |   await expect(scene).toHaveAttribute("data-view-focus", "scene");
  179 |   const sceneViewAtMovedRig = await readStableViewState(scene);
  180 | 
  181 |   await position.fill("-1800");
```