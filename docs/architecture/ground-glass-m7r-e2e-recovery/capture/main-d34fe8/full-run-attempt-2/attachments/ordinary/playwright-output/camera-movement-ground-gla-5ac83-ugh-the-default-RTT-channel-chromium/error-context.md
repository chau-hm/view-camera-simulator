# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: camera-movement-ground-glass-comparison.spec.ts >> public camera-movement Ground Glass renders one live Current view through the default RTT channel
- Location: src/tests/e2e/camera-movement-ground-glass-comparison.spec.ts:16:1

# Error details

```
Test timeout of 150000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]')
Expected: visible
Received: undefined

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]')

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
              - paragraph [ref=e106]: Side view | Rear Tilt · -2.4°
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
                  - generic "film plane" [ref=e130]
                  - generic:
                    - generic "lens plane"
                  - generic "focus plane" [ref=e132]
                  - generic "nearDof plane" [ref=e134]
                  - generic "farDof plane" [ref=e136]
                  - generic [ref=e137]:
                    - generic "Camera body rail"
                    - generic "Simplified bellows connector"
                - generic [ref=e142]:
                  - generic [ref=e144]: Current
                  - generic [ref=e145]: Original
              - generic "Optical depth order" [ref=e146]:
                - generic [ref=e149]: Film 0 mm
                - generic [ref=e152]: Lens 94 mm
                - generic [ref=e155]: Scheimpflug intersection 94 mm
                - generic [ref=e158]: DOF limit 1.7 m
                - generic [ref=e161]: Focus 2.1 m
                - generic [ref=e164]: Far DOF > 2.7 m
          - group [ref=e167]:
            - generic "Optical Debug understanding-camera-movements · scheimpflug" [ref=e168] [cursor=pointer]:
              - generic [ref=e169]: Optical Debug
              - generic [ref=e170]: understanding-camera-movements · scheimpflug
        - complementary [ref=e171]:
          - generic [ref=e172]:
            - region "Camera Controls" [ref=e173]:
              - heading "Camera Controls" [level=3] [ref=e175]
              - generic [ref=e176]:
                - group "Lens / Angle of View" [ref=e178]:
                  - generic [ref=e179]: Lens / Angle of View
                  - paragraph [ref=e180]: "At the same camera position, focal length changes angle of view and framing, not perspective. Lens coverage is separate from focal length: lenses with the same focal length can cover different areas. Rise and Shift use spare coverage; they do not create more."
                  - radiogroup "Lens options" [ref=e181]:
                    - generic [ref=e182] [cursor=pointer]:
                      - 'radio "90 mm — Wide — Lens coverage: 100.9° simulator coverage (teaching profile)" [checked] [ref=e183]'
                      - generic [ref=e184]:
                        - generic [ref=e185]: Wide
                        - generic [ref=e186]: ·
                        - generic [ref=e187]: 90 mm
                      - generic [ref=e188]: "Lens coverage: 100.9° simulator coverage (teaching profile)"
                    - generic [ref=e189] [cursor=pointer]:
                      - 'radio "105 mm — — Lens coverage: 92.1° simulator coverage (teaching profile)" [ref=e190]'
                      - generic [ref=e192]: 105 mm
                      - generic [ref=e193]: "Lens coverage: 92.1° simulator coverage (teaching profile)"
                    - generic [ref=e194] [cursor=pointer]:
                      - 'radio "120 mm — — Lens coverage: 84.5° simulator coverage (teaching profile)" [ref=e195]'
                      - generic [ref=e197]: 120 mm
                      - generic [ref=e198]: "Lens coverage: 84.5° simulator coverage (teaching profile)"
                    - generic [ref=e199] [cursor=pointer]:
                      - 'radio "150 mm — Standard — Lens coverage: 72° simulator coverage (teaching profile)" [ref=e200]'
                      - generic [ref=e201]:
                        - generic [ref=e202]: Standard
                        - generic [ref=e203]: ·
                        - generic [ref=e204]: 150 mm
                      - generic [ref=e205]: "Lens coverage: 72° simulator coverage (teaching profile)"
                  - generic [ref=e206]:
                    - generic [ref=e207]: Selected lens
                    - generic [ref=e208]: Wide · 90 mm
                    - generic [ref=e209]:
                      - generic [ref=e210]: Lens coverage
                      - generic [ref=e211]: 100.9° simulator coverage (teaching profile)
                    - generic [ref=e212]:
                      - generic [ref=e213]: Reference image circle
                      - generic [ref=e214]: 228.2 mm at current focus
                    - paragraph [ref=e215]: This is the perpendicular reference circle. The tilted film's actual coverage is the Coverage Footprint shown in Ground Glass and 3D.
                - region "Camera Movement" [ref=e217]:
                  - heading "Camera Movement" [level=3] [ref=e218]
                  - paragraph [ref=e219]: Explore viewpoint and standard movements continuously.
                  - region "Viewpoint" [ref=e220]:
                    - heading "Viewpoint" [level=4] [ref=e221]
                    - paragraph [ref=e222]: Move the whole camera lower or higher while keeping the standards neutral.
                    - generic [ref=e223]:
                      - generic [ref=e224]: Viewpoint
                      - generic [ref=e225]: Neutral viewpoint
                    - slider "Viewpoint" [ref=e226]: "0"
                    - group "Viewpoint positions" [ref=e227]:
                      - generic [ref=e228]: Lower
                      - generic [ref=e229]: Neutral
                      - generic [ref=e230]: Higher
                  - region "Tilt" [ref=e231]:
                    - heading "Tilt" [level=4] [ref=e232]
                    - paragraph [ref=e233]: Tilt the front or rear standard while the camera remains at the neutral viewpoint.
                    - group "Tilt standard" [ref=e234]:
                      - generic [ref=e235]: Standard
                      - generic [ref=e236]:
                        - radio "Front standard" [ref=e237]
                        - generic [ref=e238]: Front standard
                      - generic [ref=e239]:
                        - radio "Rear standard" [checked] [active] [ref=e240]
                        - generic [ref=e241]: Rear standard
                    - generic [ref=e242]:
                      - generic [ref=e243]: Tilt
                      - generic [ref=e244]: "-2.4°"
                    - slider "Tilt" [ref=e245]: "-2.4"
                    - group "Tilt positions" [ref=e246]:
                      - generic [ref=e247]: Negative -5.0°
                      - generic [ref=e248]: Zero
                      - generic [ref=e249]: Positive +5.0°
                  - region "Vertical Framing" [ref=e250]:
                    - heading "Vertical Framing" [level=4] [ref=e251]
                    - paragraph [ref=e252]: Move the front or rear standard vertically to frame a lower or higher part of the subject.
                    - group "Vertical framing standard" [ref=e253]:
                      - generic [ref=e254]: Standard
                      - generic [ref=e255]:
                        - radio "Front standard" [ref=e256]
                        - generic [ref=e257]: Front standard
                      - generic [ref=e258]:
                        - radio "Rear standard" [checked] [ref=e259]
                        - generic [ref=e260]: Rear standard
                    - generic [ref=e261]:
                      - generic [ref=e262]: Vertical framing
                      - generic [ref=e263]: Rear standard, middle framing
                    - slider "Vertical framing" [ref=e264]: "0"
                    - group "Vertical framing positions" [ref=e265]:
                      - generic [ref=e266]: Lower
                      - generic [ref=e267]: Middle
                      - generic [ref=e268]: Upper
                  - status [ref=e269]: Rear tilt · -2.4°
                - region "Focus" [ref=e271]:
                  - heading "Focus" [level=3] [ref=e272]
                  - generic [ref=e273]:
                    - generic [ref=e274]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e275]: "2000"
                    - generic [ref=e276]: 2000.0 mm
                  - generic [ref=e277]: Focus is fixed for this lesson
                - region "Aperture" [ref=e279]:
                  - heading "Aperture" [level=3] [ref=e280]
                  - radiogroup "Aperture" [disabled] [ref=e281]:
                    - generic [ref=e282]:
                      - radio "f/5.6" [disabled] [ref=e283]
                      - generic [ref=e284]: f/5.6
                    - generic [ref=e285]:
                      - radio "f/8" [disabled] [ref=e286]
                      - generic [ref=e287]: f/8
                    - generic [ref=e288]:
                      - radio "f/11" [checked] [disabled] [ref=e289]
                      - generic [ref=e290]: f/11
                    - generic [ref=e291]:
                      - radio "f/16" [disabled] [ref=e292]
                      - generic [ref=e293]: f/16
                    - generic [ref=e294]:
                      - radio "f/22" [disabled] [ref=e295]
                      - generic [ref=e296]: f/22
                    - generic [ref=e297]:
                      - radio "f/32" [disabled] [ref=e298]
                      - generic [ref=e299]: f/32
                  - generic [ref=e300]: Aperture is fixed for this lesson
                - generic [ref=e301]:
                  - generic [ref=e302]: Reset
                  - region "Reset" [ref=e303]:
                    - button "Reset movements" [ref=e305] [cursor=pointer]
            - region "Developer Tools" [ref=e306]:
              - heading "Developer Tools" [level=3] [ref=e307]
              - generic [ref=e309]:
                - checkbox "Raw RTT — bypass DOF" [ref=e310]
                - text: Raw RTT — bypass DOF
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
> 9   |   await expect(rtt).toBeVisible({ timeout: 15_000 });
      |                     ^ Error: expect(locator).toBeVisible() failed
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
  30  |   await expect(page.getByRole("heading", { name: "Ground Glass", exact: true })).toBeVisible();
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
```