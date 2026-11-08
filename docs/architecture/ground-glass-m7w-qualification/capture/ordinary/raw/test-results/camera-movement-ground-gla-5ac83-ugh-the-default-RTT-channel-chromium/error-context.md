# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: camera-movement-ground-glass-comparison.spec.ts >> public camera-movement Ground Glass renders one live Current view through the default RTT channel
- Location: src/tests/e2e/camera-movement-ground-glass-comparison.spec.ts:16:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Ground Glass', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Ground Glass', exact: true })

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  1   | import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
  2   | import { expect, test } from "@playwright/test";
  3   |
  4   | const currentRtt = (page: import("@playwright/test").Page) =>
  5   |   page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  6   |
  7   | const assertCurrentContentful = async (page: import("@playwright/test").Page) => {
  8   |   const rtt = currentRtt(page);
  9   |   await expect(rtt).toBeVisible({ timeout: 15_000 });
  10  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15_000 });
  11  |   await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5_000 });
  12  |   await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15_000 });
  13  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 15_000 });
  14  | };
  15  |
  16  | test("public camera-movement Ground Glass renders one live Current view through the default RTT channel", async ({ page }) => {
  17  |   test.setTimeout(150_000);
  18  |   const pageErrors: string[] = [];
  19  |   const graphicsErrors: string[] = [];
  20  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  21  |   page.on("console", (message) => {
  22  |     if (isKnownFiberClockDeprecation(message)) return;
  23  |     if (!["warning", "error"].includes(message.type())) return;
  24  |     const text = message.text();
  25  |     if (!/(WebGL|THREE|GPU)/i.test(text) || /GPU stall due to ReadPixels/i.test(text)) return;
  26  |     graphicsErrors.push(`${message.type()}: ${text}`);
  27  |   });
  28  |
  29  |   await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
> 30  |   await expect(page.getByRole("heading", { name: "Ground Glass", exact: true })).toBeVisible();
      |                                                                                  ^ Error: expect(locator).toBeVisible() failed
  31  |   await expect(page.getByRole("heading", { name: "Original", exact: true })).toHaveCount(0);
  32  |   await expect(page.getByRole("heading", { name: "Current", exact: true })).toHaveCount(0);
  33  |   await expect(page.getByText("Compare the neutral camera with the selected movement.")).toHaveCount(0);
  34  |   await expect(page.getByRole("region", { name: "Original and Current Ground Glass comparison" })).toHaveCount(0);
  35  |   await expect(page.getByRole("radio", { name: "Raw Ground Glass" })).toHaveCount(1);
  36  |   await expect(page.getByRole("radio", { name: "Upright Assist" })).toHaveCount(1);
  37  |   await expect(page.getByRole("button", { name: "Focus loupe · 4× Ground Glass preview view", exact: true })).toHaveCount(1);
  38  |   await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel^="camera-movement-"]')).toHaveCount(0);
  39  |   await expect(currentRtt(page)).toHaveCount(1);
  40  |
  41  |   await assertCurrentContentful(page);
  42  |   const current = currentRtt(page);
  43  |   const scene = page.locator('[data-testid="scene-canvas"]');
  44  |   const geometryId = await current.getAttribute("data-rtt-lattice-geometry-id");
  45  |   const resourceGeneration = await current.getAttribute("data-rtt-resource-generation");
  46  |   const subjectGeneration = await current.getAttribute("data-rtt-lattice-subject-generation");
  47  |   const resourceKey = await current.getAttribute("data-rtt-lattice-resource-key");
  48  |   expect(geometryId).toBeTruthy();
  49  |   expect(resourceGeneration).toBeTruthy();
  50  |   expect(subjectGeneration).toBeTruthy();
  51  |   expect(resourceKey).toBeTruthy();
  52  |   await expect(current).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
  53  |   await expect(current).toHaveAttribute("data-rtt-lattice-edge-count", "224");
  54  |   await expect(scene).toHaveAttribute("data-mounted-lattice-presentation-region", "whole");
  55  |   await expect(current).toHaveAttribute("data-rtt-lattice-presentation-region", "whole");
  56  |
  57  |   const neutralSanityState = await current.getAttribute("data-rtt-sanity-state");
  58  |   expect(neutralSanityState).toBeTruthy();
  59  |
  60  |   const assertStableRendererIdentities = async () => {
  61  |     await expect(current).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
  62  |     await expect(current).toHaveAttribute("data-rtt-lattice-subject-generation", subjectGeneration!);
  63  |     await expect(current).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  64  |     await expect(current).toHaveAttribute("data-rtt-lattice-resource-key", resourceKey!);
  65  |   };
  66  |
  67  |   const waitForSanityStateChange = async (previousState: string) => {
  68  |     await expect
  69  |       .poll(async () => current.getAttribute("data-rtt-sanity-state"))
  70  |       .not.toBe(previousState);
  71  |     const nextState = await current.getAttribute("data-rtt-sanity-state");
  72  |     expect(nextState).toBeTruthy();
  73  |     return nextState!;
  74  |   };
  75  |
  76  |   const assertPresentation = async (expectedRegion: string) => {
  77  |     await expect(scene).toHaveAttribute("data-mounted-lattice-presentation-region", expectedRegion);
  78  |     await expect(current).toHaveAttribute("data-rtt-lattice-presentation-region", expectedRegion);
  79  |     await assertStableRendererIdentities();
  80  |     await assertCurrentContentful(page);
  81  |   };
  82  |
  83  |   const viewpoint = page.getByRole("slider", { name: "Viewpoint" });
  84  |   const tilt = page.getByRole("slider", { name: "Tilt" });
  85  |   const framing = page.getByRole("slider", { name: "Vertical framing" });
  86  |   const tiltStandards = page.getByRole("group", { name: "Tilt standard" });
  87  |   const framingStandards = page.getByRole("group", { name: "Vertical framing standard" });
  88  |   const movementStatus = page.locator(".camera-movement-controls__status");
  89  |   await tilt.fill("3.2");
  90  |   await expect(tilt).toHaveValue("3.2");
  91  |   await expect(tiltStandards.getByRole("radio", { name: "Front standard" })).toBeChecked();
  92  |   await expect(movementStatus).toContainText("Front tilt · +3.2°");
  93  |   let previousSanityState = await waitForSanityStateChange(neutralSanityState!);
  94  |   await assertPresentation("middle");
  95  |
  96  |   await tiltStandards.getByRole("radio", { name: "Rear standard" }).click();
  97  |   await expect(tiltStandards.getByRole("radio", { name: "Rear standard" })).toBeChecked();
  98  |   await expect(tilt).toHaveValue("3.2");
  99  |   await expect(movementStatus).toContainText("Rear tilt · +3.2°");
  100 |   previousSanityState = await waitForSanityStateChange(previousSanityState);
  101 |   await assertPresentation("middle");
  102 |
  103 |   // Transfer the preserved framing value to the Front standard and apply the
  104 |   // C1-compatible upper endpoint through the continuous control.
  105 |   await framingStandards.getByRole("radio", { name: "Front standard" }).click();
  106 |   await framing.fill("1");
  107 |   await expect(framing).toHaveValue("1");
  108 |   previousSanityState = await waitForSanityStateChange(previousSanityState);
  109 |   await assertPresentation("upper");
  110 |
  111 |   await viewpoint.fill("1");
  112 |   await expect(viewpoint).toHaveValue("1");
  113 |   previousSanityState = await waitForSanityStateChange(previousSanityState);
  114 |   await assertPresentation("whole");
  115 |
  116 |   const presentationCases: Array<{ change: () => Promise<void>; expectedRegion: string }> = [
  117 |     { change: async () => tilt.fill("-2.4"), expectedRegion: "middle" },
  118 |     { change: async () => tiltStandards.getByRole("radio", { name: "Rear standard" }).click(), expectedRegion: "middle" },
  119 |     { change: async () => framingStandards.getByRole("radio", { name: "Front standard" }).click(), expectedRegion: "middle" },
  120 |     { change: async () => framing.fill("1"), expectedRegion: "upper" },
  121 |     { change: async () => framingStandards.getByRole("radio", { name: "Rear standard" }).click(), expectedRegion: "upper" },
  122 |     { change: async () => framing.fill("-1"), expectedRegion: "lower" },
  123 |     { change: async () => framingStandards.getByRole("radio", { name: "Front standard" }).click(), expectedRegion: "lower" },
  124 |     { change: async () => viewpoint.fill("1"), expectedRegion: "whole" },
  125 |     { change: async () => viewpoint.fill("-1"), expectedRegion: "whole" },
  126 |     { change: async () => viewpoint.fill("0"), expectedRegion: "whole" },
  127 |   ];
  128 |
  129 |   for (const { change, expectedRegion } of presentationCases) {
  130 |     await change();
```