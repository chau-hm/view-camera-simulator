# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: camera-movement-calibration-workbench.spec.ts >> session calibration separates geometry, optics, rig, reset, and SPA lifecycle
- Location: src/tests/e2e/camera-movement-calibration-workbench.spec.ts:46:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('[data-testid="scene-canvas"]')
Expected: "224"
Received: ""

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for locator('[data-testid="scene-canvas"]')

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
              - paragraph [ref=e106]: Side view | Neutral viewpoint
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
                    - generic "Simplified bellows connector"
                - generic [ref=e132]:
                  - generic [ref=e134]: Current
                  - generic [ref=e135]: Original
              - generic "Optical depth order" [ref=e136]:
                - generic [ref=e139]: Film 0 mm
                - generic [ref=e142]: Lens 94 mm
                - generic [ref=e145]: DOF limit 1.7 m
                - generic [ref=e148]: Focus 2.1 m
                - generic [ref=e151]: Far DOF > 2.7 m
          - group [ref=e154]:
            - generic "Optical Debug understanding-camera-movements · parallel" [ref=e155] [cursor=pointer]:
              - generic [ref=e156]: Optical Debug
              - generic [ref=e157]: understanding-camera-movements · parallel
        - complementary [ref=e158]:
          - generic [ref=e159]:
            - region "Camera Controls" [ref=e160]:
              - heading "Camera Controls" [level=3] [ref=e162]
              - generic [ref=e163]:
                - group "Lens / Angle of View" [ref=e165]:
                  - generic [ref=e166]: Lens / Angle of View
                  - paragraph [ref=e167]: "At the same camera position, focal length changes angle of view and framing, not perspective. Lens coverage is separate from focal length: lenses with the same focal length can cover different areas. Rise and Shift use spare coverage; they do not create more."
                  - radiogroup "Lens options" [ref=e168]:
                    - generic [ref=e169] [cursor=pointer]:
                      - 'radio "90 mm — Wide — Lens coverage: 100.9° simulator coverage (teaching profile)" [checked] [ref=e170]'
                      - generic [ref=e171]:
                        - generic [ref=e172]: Wide
                        - generic [ref=e173]: ·
                        - generic [ref=e174]: 90 mm
                      - generic [ref=e175]: "Lens coverage: 100.9° simulator coverage (teaching profile)"
                    - generic [ref=e176] [cursor=pointer]:
                      - 'radio "105 mm — — Lens coverage: 92.1° simulator coverage (teaching profile)" [ref=e177]'
                      - generic [ref=e179]: 105 mm
                      - generic [ref=e180]: "Lens coverage: 92.1° simulator coverage (teaching profile)"
                    - generic [ref=e181] [cursor=pointer]:
                      - 'radio "120 mm — — Lens coverage: 84.5° simulator coverage (teaching profile)" [ref=e182]'
                      - generic [ref=e184]: 120 mm
                      - generic [ref=e185]: "Lens coverage: 84.5° simulator coverage (teaching profile)"
                    - generic [ref=e186] [cursor=pointer]:
                      - 'radio "150 mm — Standard — Lens coverage: 72° simulator coverage (teaching profile)" [ref=e187]'
                      - generic [ref=e188]:
                        - generic [ref=e189]: Standard
                        - generic [ref=e190]: ·
                        - generic [ref=e191]: 150 mm
                      - generic [ref=e192]: "Lens coverage: 72° simulator coverage (teaching profile)"
                  - generic [ref=e193]:
                    - generic [ref=e194]: Selected lens
                    - generic [ref=e195]: Wide · 90 mm
                    - generic [ref=e196]:
                      - generic [ref=e197]: Lens coverage
                      - generic [ref=e198]: 100.9° simulator coverage (teaching profile)
                    - generic [ref=e199]:
                      - generic [ref=e200]: Image circle
                      - generic [ref=e201]: 228.2 mm at current focus
                - region "Camera Movement" [ref=e203]:
                  - heading "Camera Movement" [level=3] [ref=e204]
                  - paragraph [ref=e205]: Explore viewpoint and standard movements continuously.
                  - region "Viewpoint" [ref=e206]:
                    - heading "Viewpoint" [level=4] [ref=e207]
                    - paragraph [ref=e208]: Move the whole camera lower or higher while keeping the standards neutral.
                    - generic [ref=e209]:
                      - generic [ref=e210]: Viewpoint
                      - generic [ref=e211]: Neutral viewpoint
                    - slider "Viewpoint" [ref=e212]: "0"
                    - group "Viewpoint positions" [ref=e213]:
                      - generic [ref=e214]: Lower
                      - generic [ref=e215]: Neutral
                      - generic [ref=e216]: Higher
                  - region "Tilt" [ref=e217]:
                    - heading "Tilt" [level=4] [ref=e218]
                    - paragraph [ref=e219]: Tilt the front or rear standard while the camera remains at the neutral viewpoint.
                    - group "Tilt standard" [ref=e220]:
                      - generic [ref=e221]: Standard
                      - generic [ref=e222]:
                        - radio "Front standard" [checked] [ref=e223]
                        - generic [ref=e224]: Front standard
                      - generic [ref=e225]:
                        - radio "Rear standard" [ref=e226]
                        - generic [ref=e227]: Rear standard
                    - generic [ref=e228]:
                      - generic [ref=e229]: Tilt
                      - generic [ref=e230]: 0.0°
                    - slider "Tilt" [ref=e231]: "0"
                    - group "Tilt positions" [ref=e232]:
                      - generic [ref=e233]: Negative -5.0°
                      - generic [ref=e234]: Zero
                      - generic [ref=e235]: Positive +5.0°
                  - region "Vertical Framing" [ref=e236]:
                    - heading "Vertical Framing" [level=4] [ref=e237]
                    - paragraph [ref=e238]: Move the front or rear standard vertically to frame a lower or higher part of the subject.
                    - group "Vertical framing standard" [ref=e239]:
                      - generic [ref=e240]: Standard
                      - generic [ref=e241]:
                        - radio "Front standard" [checked] [ref=e242]
                        - generic [ref=e243]: Front standard
                      - generic [ref=e244]:
                        - radio "Rear standard" [ref=e245]
                        - generic [ref=e246]: Rear standard
                    - generic [ref=e247]:
                      - generic [ref=e248]: Vertical framing
                      - generic [ref=e249]: Front standard, middle framing
                    - slider "Vertical framing" [ref=e250]: "0"
                    - group "Vertical framing positions" [ref=e251]:
                      - generic [ref=e252]: Lower
                      - generic [ref=e253]: Middle
                      - generic [ref=e254]: Upper
                  - status [ref=e255]: Neutral viewpoint
                - region "Focus" [ref=e257]:
                  - heading "Focus" [level=3] [ref=e258]
                  - generic [ref=e259]:
                    - generic [ref=e260]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e261]: "2000"
                    - generic [ref=e262]: 2000.0 mm
                  - generic [ref=e263]: Focus is fixed for this lesson
                - region "Aperture" [ref=e265]:
                  - heading "Aperture" [level=3] [ref=e266]
                  - radiogroup "Aperture" [disabled] [ref=e267]:
                    - generic [ref=e268]:
                      - radio "f/5.6" [disabled] [ref=e269]
                      - generic [ref=e270]: f/5.6
                    - generic [ref=e271]:
                      - radio "f/8" [disabled] [ref=e272]
                      - generic [ref=e273]: f/8
                    - generic [ref=e274]:
                      - radio "f/11" [checked] [disabled] [ref=e275]
                      - generic [ref=e276]: f/11
                    - generic [ref=e277]:
                      - radio "f/16" [disabled] [ref=e278]
                      - generic [ref=e279]: f/16
                    - generic [ref=e280]:
                      - radio "f/22" [disabled] [ref=e281]
                      - generic [ref=e282]: f/22
                    - generic [ref=e283]:
                      - radio "f/32" [disabled] [ref=e284]
                      - generic [ref=e285]: f/32
                  - generic [ref=e286]: Aperture is fixed for this lesson
                - generic [ref=e287]:
                  - generic [ref=e288]: Reset
                  - region "Reset" [ref=e289]:
                    - button "Reset movements" [ref=e291] [cursor=pointer]
            - region "Developer Tools" [ref=e292]:
              - heading "Developer Tools" [level=3] [ref=e293]
              - generic [ref=e295]:
                - checkbox "Raw RTT — bypass DOF" [ref=e296]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1   | import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
  2   | import { expect, test, type Page } from "@playwright/test";
  3   |
  4   | const collectGraphicsErrors = (page: Page) => {
  5   |   const pageErrors: string[] = [];
  6   |   const graphicsErrors: string[] = [];
  7   |   page.on("pageerror", (error) => pageErrors.push(error.message));
  8   |   page.on("console", (message) => {
  9   |     if (isKnownFiberClockDeprecation(message)) return;
  10  |     if (!["warning", "error"].includes(message.type())) return;
  11  |     const text = message.text();
  12  |     if (!/(WebGL|THREE|GPU)/i.test(text) || /GPU stall due to ReadPixels/i.test(text)) return;
  13  |     graphicsErrors.push(`${message.type()}: ${text}`);
  14  |   });
  15  |   return { pageErrors, graphicsErrors };
  16  | };
  17  |
  18  | const expectSharedLattice = async (
  19  |   page: Page,
  20  |   expectedEdgeCount: string,
  21  |   expectContentDiagnostics = true,
  22  | ) => {
  23  |   const scene = page.locator('[data-testid="scene-canvas"]');
  24  |   const rtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  25  |   await expect(scene).toHaveAttribute("data-mounted-lattice", "true", { timeout: 15_000 });
> 26  |   await expect(scene).toHaveAttribute("data-mounted-lattice-edge-count", expectedEdgeCount);
      |                       ^ Error: expect(locator).toHaveAttribute(expected) failed
  27  |   const geometryId = await scene.getAttribute("data-mounted-lattice-geometry-id");
  28  |   expect(geometryId).toBeTruthy();
  29  |   await expect(rtt).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
  30  |   await expect(rtt).toHaveAttribute("data-rtt-lattice-edge-count", expectedEdgeCount);
  31  |   if (expectContentDiagnostics) {
  32  |     await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15_000 });
  33  |     await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 15_000 });
  34  |   }
  35  |   return { scene, rtt, geometryId: geometryId! };
  36  | };
  37  |
  38  | test("calibration workbench is hidden on the production route", async ({ page }) => {
  39  |   await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  40  |   await expect(page.getByRole("region", { name: "Camera movement calibration workbench" })).toHaveCount(0);
  41  |   const { scene, rtt } = await expectSharedLattice(page, "224");
  42  |   await expect(scene).toHaveAttribute("data-camera-rig-origin", "0.000000,0.000000,0.000000");
  43  |   await expect(rtt).toHaveAttribute("data-rtt-focal-length-mm", "90");
  44  | });
  45  |
  46  | test("session calibration separates geometry, optics, rig, reset, and SPA lifecycle", async ({ page }) => {
  47  |   test.setTimeout(120_000);
  48  |   const errors = collectGraphicsErrors(page);
  49  |   await page.goto(
  50  |     "/simulator/free/understanding-camera-movements?cameraCalibration=1&rttDiagnostics=1",
  51  |   );
  52  |   const workbench = page.getByRole("region", {
  53  |     name: "Camera movement calibration workbench",
  54  |   });
  55  |   await expect(workbench).toBeVisible();
  56  |   await expect(workbench.getByText(/Session revision 0/)).toBeVisible();
  57  |
  58  |   const baseline = await expectSharedLattice(page, "224");
  59  |   const baselineGeneration = await baseline.scene.getAttribute(
  60  |     "data-mounted-lattice-generation",
  61  |   );
  62  |   await workbench.getByLabel("Levels").fill("7");
  63  |   await workbench.getByLabel("Levels").press("Enter");
  64  |   const sevenLevel = await expectSharedLattice(page, "304");
  65  |   expect(sevenLevel.geometryId).not.toBe(baseline.geometryId);
  66  |   await expect(workbench.getByText(/Session revision 1/)).toBeVisible();
  67  |
  68  |   const geometryGeneration = await sevenLevel.scene.getAttribute(
  69  |     "data-mounted-lattice-generation",
  70  |   );
  71  |   expect(geometryGeneration).not.toBe(baselineGeneration);
  72  |
  73  |   await workbench.getByLabel("Focal length (mm)").fill("120");
  74  |   await workbench.getByLabel("Focal length (mm)").press("Enter");
  75  |   await expect(sevenLevel.rtt).toHaveAttribute("data-rtt-focal-length-mm", "120");
  76  |   await expect(sevenLevel.scene).toHaveAttribute(
  77  |     "data-mounted-lattice-geometry-id",
  78  |     sevenLevel.geometryId,
  79  |   );
  80  |   await expect(sevenLevel.scene).toHaveAttribute(
  81  |     "data-mounted-lattice-generation",
  82  |     geometryGeneration!,
  83  |   );
  84  |
  85  |   await workbench.getByLabel("Viewpoint anchor").selectOption("high");
  86  |   await expect(sevenLevel.scene).toHaveAttribute("data-camera-rig-anchor", "high");
  87  |   await expect(workbench.getByLabel("Front rise (mm)")).toBeDisabled();
  88  |   await expect(workbench.getByLabel("Rear tilt (°)")).toBeDisabled();
  89  |   await expect(workbench.getByLabel("Camera body pitch (°)")).toBeEnabled();
  90  |   await workbench.getByLabel("Camera body pitch (°)").fill("-8");
  91  |   await workbench.getByLabel("Camera body pitch (°)").press("Enter");
  92  |   await expect(sevenLevel.scene).toHaveAttribute("data-camera-body-pitch-deg", "-8.000000");
  93  |   await expect(sevenLevel.scene).toHaveAttribute(
  94  |     "data-mounted-lattice-generation",
  95  |     geometryGeneration!,
  96  |   );
  97  |   await expect(sevenLevel.rtt).toHaveAttribute("data-rtt-final-contentful", "true");
  98  |
  99  |   await workbench.getByRole("button", { name: "Reset calibration" }).click();
  100 |   const reset = await expectSharedLattice(page, "224");
  101 |   await expect(reset.scene).toHaveAttribute("data-camera-rig-anchor", "mid");
  102 |   await expect(reset.scene).toHaveAttribute("data-camera-body-pitch-deg", "0.000000");
  103 |   await expect(reset.scene).toHaveAttribute("data-mounted-lattice-presentation-region", "middle");
  104 |   await expect(reset.rtt).toHaveAttribute("data-rtt-focal-length-mm", "90");
  105 |   await expect(workbench.getByLabel("Focus distance (mm)")).toHaveValue("2000");
  106 |
  107 |   await workbench.getByLabel("Levels").fill("7");
  108 |   await workbench.getByLabel("Levels").press("Enter");
  109 |   await expect(workbench.getByText(/Session revision 1/)).toBeVisible();
  110 |   await page.getByRole("link", { name: "All Scenes" }).click();
  111 |   await expect(page).toHaveURL(/\/scenes$/);
  112 |   await expect(workbench).toHaveCount(0);
  113 |   await page.goBack();
  114 |   await expect(workbench).toBeVisible();
  115 |   await expect(workbench.getByText(/Session revision 0/)).toBeVisible();
  116 |   await expect(workbench.getByLabel("Levels")).toHaveValue("5");
  117 |
  118 |   await page.getByRole("link", { name: "All Scenes" }).click();
  119 |   await page
  120 |     .getByRole("article")
  121 |     .filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) })
  122 |     .getByRole("link", { name: "Open Scene" })
  123 |     .click();
  124 |   await expect(workbench).toHaveCount(0);
  125 |   await page.getByRole("link", { name: "All Scenes" }).click();
  126 |   await page
```