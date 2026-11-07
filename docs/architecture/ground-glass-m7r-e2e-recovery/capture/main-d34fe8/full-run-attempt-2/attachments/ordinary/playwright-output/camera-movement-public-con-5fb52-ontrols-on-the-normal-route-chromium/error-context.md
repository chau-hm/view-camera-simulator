# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: camera-movement-public-controls.spec.ts >> public camera movement controls on the normal route
- Location: src/tests/e2e/camera-movement-public-controls.spec.ts:24:1

# Error details

```
Test timeout of 150000ms exceeded.
```

```
Error: expect(locator).toHaveValue(expected) failed

Locator:  getByRole('slider', { name: 'Vertical framing' })
Expected: "-1"
Received: ""

Call log:
  - Expect "toHaveValue" with timeout 5000ms
  - waiting for getByRole('slider', { name: 'Vertical framing' })

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
          - generic [ref=e12]: Understanding Camera Movements
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
                      - button "Focus loupe · 4× Ground Glass preview" [ref=e86]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 2000.0 mm focus
                      - button "Focus loupe · 4× Ground Glass preview view" [ref=e90] [cursor=pointer]: Focus loupe · 4×
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
              - paragraph [ref=e106]: Side view | Front standard · Lower framing · -20.0 mm
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
                  - generic:
                    - generic "farDof plane"
                  - generic [ref=e117]:
                    - generic "Camera body rail"
                    - generic "Simplified bellows connector"
                - generic [ref=e121]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e122]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e123]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e124]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e125]
                  - generic [ref=e127]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e128]:
                    - generic "Camera body rail"
                    - generic "Simplified bellows connector" [ref=e129]
                  - generic "chief ray from film centre through lens centre" [ref=e132]
                - generic [ref=e134]:
                  - generic [ref=e136]: Current
                  - generic [ref=e137]: Original
              - generic "Optical depth order" [ref=e138]:
                - generic [ref=e141]: Film 0 mm
                - generic [ref=e144]: Lens 94 mm
                - generic [ref=e147]: DOF limit 1.7 m
                - generic [ref=e150]: Focus 2.1 m
                - generic [ref=e153]: Far DOF > 2.7 m
          - group [ref=e156]:
            - generic "Optical Debug understanding-camera-movements · parallel" [ref=e157] [cursor=pointer]:
              - generic [ref=e158]: Optical Debug
              - generic [ref=e159]: understanding-camera-movements · parallel
        - complementary [ref=e160]:
          - generic [ref=e161]:
            - region "Camera Controls" [ref=e162]:
              - heading "Camera Controls" [level=3] [ref=e164]
              - generic [ref=e165]:
                - group "Lens / Angle of View" [ref=e167]:
                  - generic [ref=e168]: Lens / Angle of View
                  - paragraph [ref=e169]: "At the same camera position, focal length changes angle of view and framing, not perspective. Lens coverage is separate from focal length: lenses with the same focal length can cover different areas. Rise and Shift use spare coverage; they do not create more."
                  - radiogroup "Lens options" [ref=e170]:
                    - generic [ref=e171] [cursor=pointer]:
                      - 'radio "90 mm — Wide — Lens coverage: 100.9° simulator coverage (teaching profile)" [checked] [ref=e172]'
                      - generic [ref=e173]:
                        - generic [ref=e174]: Wide
                        - generic [ref=e175]: ·
                        - generic [ref=e176]: 90 mm
                      - generic [ref=e177]: "Lens coverage: 100.9° simulator coverage (teaching profile)"
                    - generic [ref=e178] [cursor=pointer]:
                      - 'radio "105 mm — — Lens coverage: 92.1° simulator coverage (teaching profile)" [ref=e179]'
                      - generic [ref=e181]: 105 mm
                      - generic [ref=e182]: "Lens coverage: 92.1° simulator coverage (teaching profile)"
                    - generic [ref=e183] [cursor=pointer]:
                      - 'radio "120 mm — — Lens coverage: 84.5° simulator coverage (teaching profile)" [ref=e184]'
                      - generic [ref=e186]: 120 mm
                      - generic [ref=e187]: "Lens coverage: 84.5° simulator coverage (teaching profile)"
                    - generic [ref=e188] [cursor=pointer]:
                      - 'radio "150 mm — Standard — Lens coverage: 72° simulator coverage (teaching profile)" [ref=e189]'
                      - generic [ref=e190]:
                        - generic [ref=e191]: Standard
                        - generic [ref=e192]: ·
                        - generic [ref=e193]: 150 mm
                      - generic [ref=e194]: "Lens coverage: 72° simulator coverage (teaching profile)"
                  - generic [ref=e195]:
                    - generic [ref=e196]: Selected lens
                    - generic [ref=e197]: Wide · 90 mm
                    - generic [ref=e198]:
                      - generic [ref=e199]: Lens coverage
                      - generic [ref=e200]: 100.9° simulator coverage (teaching profile)
                    - generic [ref=e201]:
                      - generic [ref=e202]: Image circle
                      - generic [ref=e203]: 228.2 mm at current focus
                - region "Camera Movement" [ref=e205]:
                  - heading "Camera Movement" [level=3] [ref=e206]
                  - paragraph [ref=e207]: Explore viewpoint and standard movements continuously.
                  - region "Viewpoint" [ref=e208]:
                    - heading "Viewpoint" [level=4] [ref=e209]
                    - paragraph [ref=e210]: Move the whole camera lower or higher while keeping the standards neutral.
                    - generic [ref=e211]:
                      - generic [ref=e212]: Viewpoint
                      - generic [ref=e213]: Neutral viewpoint
                    - slider "Viewpoint" [ref=e214]: "0"
                    - group "Viewpoint positions" [ref=e215]:
                      - generic [ref=e216]: Lower
                      - generic [ref=e217]: Neutral
                      - generic [ref=e218]: Higher
                  - region "Tilt" [ref=e219]:
                    - heading "Tilt" [level=4] [ref=e220]
                    - paragraph [ref=e221]: Tilt the front or rear standard while the camera remains at the neutral viewpoint.
                    - group "Tilt standard" [ref=e222]:
                      - generic [ref=e223]: Standard
                      - generic [ref=e224]:
                        - radio "Front standard" [checked] [ref=e225]
                        - generic [ref=e226]: Front standard
                      - generic [ref=e227]:
                        - radio "Rear standard" [ref=e228]
                        - generic [ref=e229]: Rear standard
                    - generic [ref=e230]:
                      - generic [ref=e231]: Tilt
                      - generic [ref=e232]: 0.0°
                    - slider "Tilt" [ref=e233]: "0"
                    - group "Tilt positions" [ref=e234]:
                      - generic [ref=e235]: Negative -5.0°
                      - generic [ref=e236]: Zero
                      - generic [ref=e237]: Positive +5.0°
                  - region "Vertical Framing" [ref=e238]:
                    - heading "Vertical Framing" [level=4] [ref=e239]
                    - paragraph [ref=e240]: Move the front or rear standard vertically to frame a lower or higher part of the subject.
                    - group "Vertical framing standard" [ref=e241]:
                      - generic [ref=e242]: Standard
                      - generic [ref=e243]:
                        - radio "Front standard" [checked] [ref=e244]
                        - generic [ref=e245]: Front standard
                      - generic [ref=e246]:
                        - radio "Rear standard" [ref=e247]
                        - generic [ref=e248]: Rear standard
                    - generic [ref=e249]:
                      - generic [ref=e250]: Vertical framing
                      - generic [ref=e251]: Front standard, lower framing
                    - slider "Vertical framing" [active] [ref=e252]: "-1"
                    - group "Vertical framing positions" [ref=e253]:
                      - generic [ref=e254]: Lower
                      - generic [ref=e255]: Middle
                      - generic [ref=e256]: Upper
                  - status [ref=e257]: Front standard · Lower framing · -20.0 mm
                - region "Focus" [ref=e259]:
                  - heading "Focus" [level=3] [ref=e260]
                  - generic [ref=e261]:
                    - generic [ref=e262]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e263]: "2000"
                    - generic [ref=e264]: 2000.0 mm
                  - generic [ref=e265]: Focus is fixed for this lesson
                - region "Aperture" [ref=e267]:
                  - heading "Aperture" [level=3] [ref=e268]
                  - radiogroup "Aperture" [disabled] [ref=e269]:
                    - generic [ref=e270]:
                      - radio "f/5.6" [disabled] [ref=e271]
                      - generic [ref=e272]: f/5.6
                    - generic [ref=e273]:
                      - radio "f/8" [disabled] [ref=e274]
                      - generic [ref=e275]: f/8
                    - generic [ref=e276]:
                      - radio "f/11" [checked] [disabled] [ref=e277]
                      - generic [ref=e278]: f/11
                    - generic [ref=e279]:
                      - radio "f/16" [disabled] [ref=e280]
                      - generic [ref=e281]: f/16
                    - generic [ref=e282]:
                      - radio "f/22" [disabled] [ref=e283]
                      - generic [ref=e284]: f/22
                    - generic [ref=e285]:
                      - radio "f/32" [disabled] [ref=e286]
                      - generic [ref=e287]: f/32
                  - generic [ref=e288]: Aperture is fixed for this lesson
                - generic [ref=e289]:
                  - generic [ref=e290]: Reset
                  - region "Reset" [ref=e291]:
                    - button "Reset movements" [ref=e293] [cursor=pointer]
            - region "Developer Tools" [ref=e294]:
              - heading "Developer Tools" [level=3] [ref=e295]
              - generic [ref=e297]:
                - checkbox "Raw RTT — bypass DOF" [ref=e298]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1   | import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
  2   | import { test, expect, type Page } from "@playwright/test";
  3   | 
  4   | const disableOpticalGeometry = async (page: Page) => {
  5   |   const scene = page.locator('[data-testid="scene-canvas"]');
  6   |   if ((await scene.getAttribute("data-optical-geometry-visible")) !== "true") return;
  7   |   const trigger = page.getByRole("button", { name: "View overlays" });
  8   |   if (await trigger.isVisible()) await trigger.click();
  9   |   await page.getByRole("button", { name: "Hide Optical geometry" }).click();
  10  |   await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  11  | };
  12  | 
  13  | const expectGroundGlassValid = async (page: Page) => {
  14  |   const rtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  15  |   await expect(rtt).toHaveCount(1);
  16  |   await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel^="camera-movement-"]')).toHaveCount(0);
  17  |   await expect(rtt).toBeVisible({ timeout: 15000 });
  18  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 10000 });
  19  |   await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5000 });
  20  |   await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 10000 });
  21  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 5000 });
  22  | };
  23  | 
  24  | test("public camera movement controls on the normal route", async ({ page }) => {
  25  |   test.setTimeout(150_000);
  26  |   const pageErrors: string[] = [];
  27  |   const unexpectedGraphicsMessages: string[] = [];
  28  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  29  |   page.on("console", (message) => {
  30  |     if (isKnownFiberClockDeprecation(message)) return;
  31  |     const text = message.text();
  32  |     if (!(message.type() === "warning" || message.type() === "error") || !/(WebGL|THREE|GPU)/i.test(text)) return;
  33  |     if (/GPU stall due to ReadPixels/i.test(text)) return;
  34  |     unexpectedGraphicsMessages.push(`${message.type()}: ${text}`);
  35  |   });
  36  | 
  37  |   await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  38  |   const scene = page.locator('[data-testid="scene-canvas"]');
  39  |   await expect(scene).toHaveAttribute("data-mounted-lattice", "true", { timeout: 15000 });
  40  |   await disableOpticalGeometry(page);
  41  |   await expectGroundGlassValid(page);
  42  | 
  43  |   // 1. Viewpoint starts at neutral and no workbench is visible.
  44  |   const viewpoint = page.getByRole("slider", { name: "Viewpoint" });
  45  |   const tilt = page.getByRole("slider", { name: "Tilt" });
  46  |   const framing = page.getByRole("slider", { name: "Vertical framing" });
  47  |   const tiltStandards = page.getByRole("group", { name: "Tilt standard" });
  48  |   const framingStandards = page.getByRole("group", { name: "Vertical framing standard" });
  49  |   await expect(viewpoint).toHaveValue("0");
  50  |   await expect(tilt).toHaveValue("0");
  51  |   await expect(framing).toHaveValue("0");
  52  |   await expect(tiltStandards.getByRole("radio", { name: "Front standard" })).toBeChecked();
  53  |   await expect(page.getByRole("radio", { name: "A — Front tilt" })).toHaveCount(0);
  54  |   await expect(page.getByRole("radio", { name: "C3 — Higher viewpoint" })).toHaveCount(0);
  55  |   await expect(page.getByRole("radio", { name: "C1 — Front rise" })).toHaveCount(0);
  56  |   await expect(page.getByText("Camera Movement Calibration")).toHaveCount(0);
  57  |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  58  |   await expect(scene).toHaveAttribute("data-lattice-target-region", "middle");
  59  | 
  60  |   // 2. Select a continuous Front tilt; the rig remains at Mid.
  61  |   await tilt.fill("3.2");
  62  |   await expect(tilt).toHaveValue("3.2");
  63  |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  64  |   await expectGroundGlassValid(page);
  65  | 
  66  |   // 3. Switch the active standard while preserving the signed tilt value.
  67  |   await tiltStandards.getByRole("radio", { name: "Rear standard" }).click();
  68  |   await expect(tiltStandards.getByRole("radio", { name: "Rear standard" })).toBeChecked();
  69  |   await expect(tilt).toHaveValue("3.2");
  70  |   await expectGroundGlassValid(page);
  71  | 
  72  |   // 4. Move to the higher viewpoint endpoint: upper target, positive body pitch.
  73  |   await viewpoint.fill("1");
  74  |   await expect(viewpoint).toHaveValue("1");
  75  |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "high");
  76  |   await expect(scene).toHaveAttribute("data-lattice-target-region", "upper");
  77  |   await expect(scene).toHaveAttribute("data-camera-body-pitch-deg", "34.000000");
  78  |   await expectGroundGlassValid(page);
  79  | 
  80  |   // 5. Switch to Camera inspection and confirm the camera stays visible.
  81  |   await page.getByRole("button", { name: "Camera", exact: true }).click();
  82  |   await expect(scene).toHaveAttribute("data-view-focus", "camera", { timeout: 5000 });
  83  |   await expectGroundGlassValid(page);
  84  |   await page.getByRole("button", { name: "Scene", exact: true }).click();
  85  | 
  86  |   // 6. Move to the lower viewpoint endpoint: lower target, negative body pitch.
  87  |   await viewpoint.fill("-1");
  88  |   await expect(viewpoint).toHaveValue("-1");
  89  |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "low");
  90  |   await expect(scene).toHaveAttribute("data-lattice-target-region", "lower");
  91  |   await expect(scene).toHaveAttribute("data-camera-body-pitch-deg", "-34.000000");
  92  |   await expectGroundGlassValid(page);
  93  | 
  94  |   // 7. Select the continuous lower framing endpoint and confirm negative fall.
  95  |   await framingStandards.getByRole("radio", { name: "Front standard" }).click();
  96  |   await framing.fill("-1");
> 97  |   await expect(framing).toHaveValue("-1");
      |                         ^ Error: expect(locator).toHaveValue(expected) failed
  98  |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  99  |   await expect(page.locator(".camera-movement-controls__status")).toContainText("Lower framing");
  100 |   await expectGroundGlassValid(page);
  101 | 
  102 |   // 8. Reset Movements returns to the neutral Viewpoint state.
  103 |   await page.getByRole("button", { name: "Reset Movements" }).click();
  104 |   await expect(viewpoint).toHaveValue("0");
  105 |   await expect(tilt).toHaveValue("0");
  106 |   await expect(framing).toHaveValue("0");
  107 |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  108 |   await expect(scene).toHaveAttribute("data-lattice-target-region", "middle");
  109 | 
  110 |   // 9. Orbit/zoom then Reset View restores the observer preset and preserves the case.
  111 |   await framing.fill("1");
  112 |   await expect(framing).toHaveValue("1");
  113 |   const sceneCanvas = scene.locator("canvas");
  114 |   const bounds = await sceneCanvas.boundingBox();
  115 |   if (bounds) {
  116 |     const x = bounds.x + bounds.width * 0.58;
  117 |     const y = bounds.y + bounds.height * 0.52;
  118 |     await page.mouse.move(x, y);
  119 |     await page.mouse.down();
  120 |     await page.mouse.move(x + 72, y - 36, { steps: 6 });
  121 |     await page.mouse.up();
  122 |   }
  123 |   await page.getByRole("button", { name: "Reset 3D view" }).click();
  124 |   await expect(framing).toHaveValue("1");
  125 |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  126 |   await expectGroundGlassValid(page);
  127 | 
  128 |   // 10. Navigate away and return; neutral Viewpoint is restored.
  129 |   await page.getByRole("link", { name: "All Scenes" }).click();
  130 |   await page
  131 |     .getByRole("article")
  132 |     .filter({ has: page.getByRole("heading", { name: "Understanding Camera Movements" }) })
  133 |     .getByRole("link", { name: "Open Scene" })
  134 |     .click();
  135 |   await page.evaluate(() => {
  136 |     const url = new URL(window.location.href);
  137 |     url.searchParams.set("rttDiagnostics", "1");
  138 |     window.history.replaceState(window.history.state, "", url);
  139 |   });
  140 |   await expect(page.getByRole("slider", { name: "Viewpoint" })).toHaveValue("0", { timeout: 15000 });
  141 |   await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  142 |   await expect(scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  143 |   await expectGroundGlassValid(page);
  144 | 
  145 |   expect(pageErrors).toEqual([]);
  146 |   expect(unexpectedGraphicsMessages).toEqual([]);
  147 | });
  148 | 
  149 | test("3D Scene layout stays stable across continuous movement sliders", async ({ page }) => {
  150 |   test.setTimeout(90_000);
  151 |   await page.setViewportSize({ width: 1680, height: 900 });
  152 |   await page.goto("/simulator/free/understanding-camera-movements");
  153 | 
  154 |   const viewportHost = page.locator(".scene-viewport-host");
  155 |   await expect(viewportHost).toBeVisible({ timeout: 15_000 });
  156 |   const initialBounds = await viewportHost.boundingBox();
  157 |   if (!initialBounds) throw new Error("3D Scene viewport bounds unavailable");
  158 |   const scenePanel = page.locator(".scene-panel");
  159 | 
  160 |   const viewpoint = page.getByRole("slider", { name: "Viewpoint" });
  161 |   const framing = page.getByRole("slider", { name: "Vertical framing" });
  162 |   for (const [slider, value] of [
  163 |     [viewpoint, "0"],
  164 |     [viewpoint, "-0.12"],
  165 |     [viewpoint, "-1"],
  166 |     [viewpoint, "0.5"],
  167 |     [viewpoint, "1"],
  168 |     [framing, "0"],
  169 |     [framing, "-0.12"],
  170 |     [framing, "-1"],
  171 |     [framing, "0.5"],
  172 |     [framing, "1"],
  173 |   ] as const) {
  174 |     await slider.fill(value);
  175 |     await expect(slider).toHaveValue(value);
  176 |     await expect
  177 |       .poll(async () => {
  178 |         const bounds = await viewportHost.boundingBox();
  179 |         return Boolean(
  180 |           bounds &&
  181 |             Math.abs(bounds.y - initialBounds.y) <= 1 &&
  182 |             Math.abs(bounds.height - initialBounds.height) <= 1,
  183 |         );
  184 |       })
  185 |       .toBe(true);
  186 |     await expect(scenePanel).not.toContainText("Front standard Y:");
  187 |     await expect(scenePanel).not.toContainText("Loaded assets:");
  188 |   }
  189 | });
  190 | 
  191 | test("calibration route preserves workbench and hides public controls", async ({ page }) => {
  192 |   test.setTimeout(90_000);
  193 |   await page.goto("/simulator/free/understanding-camera-movements?cameraCalibration=1&rttDiagnostics=1");
  194 |   await expect(page.getByText("Camera Movement Calibration")).toBeVisible({ timeout: 15000 });
  195 |   await expect(page.getByRole("radio", { name: "A — Front tilt" })).toHaveCount(0);
  196 | 
  197 |   // Make one valid calibration edit (change focal length from 90 to 120.5)
```