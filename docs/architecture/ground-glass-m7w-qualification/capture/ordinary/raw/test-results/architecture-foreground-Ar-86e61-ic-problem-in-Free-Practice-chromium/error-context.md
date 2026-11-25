# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: architecture-foreground.spec.ts >> Architecture + Foreground exposes the cumulative photographic problem in Free Practice
- Location: src/tests/e2e/architecture-foreground.spec.ts:10:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByText('Explore the cumulative Architecture + Foreground problem: use Rise for framing, Tilt and Focus for focus-plane alignment, and Aperture for usable depth across the full photograph.', { exact: true })
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByText('Explore the cumulative Architecture + Foreground problem: use Rise for framing, Tilt and Focus for focus-plane alignment, and Aperture for usable depth across the full photograph.', { exact: true })
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
          - generic [ref=e12]: Architecture + Foreground
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
                            - generic: 9490.0 mm focus / CoC 0.223 mm (0%)
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
                  - generic [ref=e117]: Foreground ground
                  - generic [ref=e119]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e120]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e126]: Near foreground
                  - generic [ref=e130]: Middle foreground
                  - generic [ref=e134]: Building base
                  - generic [ref=e138]: Building middle
                - generic [ref=e140]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e141]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e142]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e143]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e144]
                  - generic [ref=e146]: Optical axis
                  - generic [ref=e148]: Foreground ground
                  - generic [ref=e150]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e151]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e157]: Near foreground
                  - generic [ref=e161]: Middle foreground
                  - generic [ref=e165]: Building base
                  - generic [ref=e169]: Building middle
                - generic [ref=e171]:
                  - generic [ref=e173]: Current
                  - generic [ref=e174]: Original
              - generic "Optical depth order" [ref=e175]:
                - generic [ref=e178]: Film 0 mm
                - generic [ref=e181]: Lens 152 mm
                - generic [ref=e184]: DOF limit 6.7 m
                - generic [ref=e187]: Focus 9.6 m
                - generic [ref=e190]: Far DOF > 12.8 m
            - region "Focus distribution · Focus" [ref=e192]:
              - generic [ref=e193]:
                - heading "Focus distribution" [level=4] [ref=e194]
                - 'generic "Ground Glass orientation: Raw" [ref=e195]': Raw
              - table "Focus distribution" [ref=e196]:
                - caption [ref=e197]: Focus distribution
                - rowgroup [ref=e198]:
                  - 'row "Upper centre Upper centre · Near foreground: 0% · Soft Upper centre · Middle foreground: 18% · Soft" [ref=e199]':
                    - cell [ref=e200]
                    - 'cell "Upper centre Upper centre · Near foreground: 0% · Soft Upper centre · Middle foreground: 18% · Soft" [ref=e201]':
                      - generic "Upper centre" [ref=e202]
                      - generic [ref=e203]:
                        - 'group "Upper centre · Near foreground: 0% · Soft" [ref=e204]':
                          - generic "Near foreground" [ref=e206]
                          - generic [ref=e207]:
                            - text: 0%
                            - generic [ref=e208]: —
                        - 'group "Upper centre · Middle foreground: 18% · Soft" [ref=e209]':
                          - generic "Middle foreground" [ref=e211]
                          - generic [ref=e212]:
                            - text: 18%
                            - generic [ref=e213]: —
                    - cell [ref=e214]
                  - 'row "Centre Centre · Building base: 100% · Sharp Centre · Building middle: 100% · Sharp" [ref=e215]':
                    - cell [ref=e216]
                    - 'cell "Centre Centre · Building base: 100% · Sharp Centre · Building middle: 100% · Sharp" [ref=e217]':
                      - generic "Centre" [ref=e218]
                      - generic [ref=e219]:
                        - 'group "Centre · Building base: 100% · Sharp" [ref=e220]':
                          - generic "Building base" [ref=e222]
                          - generic [ref=e223]:
                            - text: 100%
                            - generic [ref=e224]: ✓
                        - 'group "Centre · Building middle: 100% · Sharp" [ref=e225]':
                          - generic "Building middle" [ref=e227]
                          - generic [ref=e228]:
                            - text: 100%
                            - generic [ref=e229]: ✓
                    - cell [ref=e230]
                  - row [ref=e231]:
                    - cell [ref=e232]
                    - cell [ref=e233]
                    - cell [ref=e234]
          - group [ref=e237]:
            - generic "Optical Debug architecture-foreground · parallel" [ref=e238] [cursor=pointer]:
              - generic [ref=e239]: Optical Debug
              - generic [ref=e240]: architecture-foreground · parallel
        - complementary [ref=e241]:
          - generic [ref=e242]:
            - region "Camera Controls" [ref=e243]:
              - heading "Camera Controls" [level=3] [ref=e245]
              - paragraph [ref=e246]:
                - generic [ref=e247]: 🔒
                - generic [ref=e248]: Disabled for this guided task
              - generic [ref=e249]:
                - region "Movement" [ref=e251]:
                  - generic [ref=e252]:
                    - heading "Front standard" [level=4] [ref=e253]
                    - button "Help" [ref=e254] [cursor=pointer]:
                      - generic [ref=e255]: "?"
                  - generic [ref=e256]:
                    - generic [ref=e257]:
                      - generic [ref=e258]: Rise
                      - slider "Rise" [ref=e259]: "0"
                      - generic [ref=e260]: 0.0 mm
                    - generic [ref=e261]:
                      - generic [ref=e262]: Tilt
                      - slider "Tilt" [ref=e263]: "0"
                      - generic [ref=e264]: 0.0°
                    - generic [ref=e265]:
                      - generic [ref=e266]: Swing
                      - slider "Swing" [disabled] [ref=e267]: "0"
                      - generic [ref=e268]: 0.0°
                - region "Focus" [ref=e270]:
                  - heading "Focus" [level=3] [ref=e271]
                  - generic [ref=e272]:
                    - generic [ref=e273]: Focus distance
                    - slider "Focus distance" [ref=e274]: "9490"
                    - generic [ref=e275]: 9490.0 mm
                - region "Aperture" [ref=e277]:
                  - heading "Aperture" [level=3] [ref=e278]
                  - radiogroup "Aperture" [ref=e279]:
                    - generic [ref=e280] [cursor=pointer]:
                      - radio "f/5.6" [ref=e281]
                      - generic [ref=e282]: f/5.6
                    - generic [ref=e283] [cursor=pointer]:
                      - radio "f/8" [ref=e284]
                      - generic [ref=e285]: f/8
                    - generic [ref=e286] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e287]
                      - generic [ref=e288]: f/11
                    - generic [ref=e289] [cursor=pointer]:
                      - radio "f/16" [ref=e290]
                      - generic [ref=e291]: f/16
                    - generic [ref=e292] [cursor=pointer]:
                      - radio "f/22" [ref=e293]
                      - generic [ref=e294]: f/22
                    - generic [ref=e295] [cursor=pointer]:
                      - radio "f/32" [ref=e296]
                      - generic [ref=e297]: f/32
                - generic [ref=e298]:
                  - generic [ref=e299]: Reset
                  - region "Reset" [ref=e300]:
                    - button "Reset movements" [ref=e302] [cursor=pointer]
            - region "Developer Tools" [ref=e303]:
              - heading "Developer Tools" [level=3] [ref=e304]
              - generic [ref=e306]:
                - checkbox "Raw RTT — bypass DOF" [ref=e307]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1   | import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
  2   | import { expect, test } from "@playwright/test";
  3   | import { readFocusDistributionScores } from "./helpers/focusDistribution";
  4   | import { openLearningDrawer } from "./helpers/learningOverlay";
  5   | import { setRangeDirect } from "./helpers/rangeInput";
  6   |
  7   | const isAllowedEnvironmentConsoleMessage = (message: string) =>
  8   |   /GL Driver Message .*GPU stall due to ReadPixels/.test(message);
  9   |
  10  | test("Architecture + Foreground exposes the cumulative photographic problem in Free Practice", async ({ page }) => {
  11  |   test.setTimeout(120_000);
  12  |   const pageErrors: string[] = [];
  13  |   const consoleProblems: string[] = [];
  14  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  15  |   page.on("console", (message) => {
  16  |     if (isKnownFiberClockDeprecation(message)) return;
  17  |     if (
  18  |       (message.type() === "error" || message.type() === "warning") &&
  19  |       !isAllowedEnvironmentConsoleMessage(message.text())
  20  |     ) {
  21  |       consoleProblems.push(message.text());
  22  |     }
  23  |   });
  24  |
  25  |   await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");
  26  |   await expect(page).toHaveURL(/\/simulator\/free\/architecture-foreground\?rttDiagnostics=1$/);
  27  |   const objective = page.getByText(
  28  |     "Explore the cumulative Architecture + Foreground problem: use Rise for framing, Tilt and Focus for focus-plane alignment, and Aperture for usable depth across the full photograph.",
  29  |     { exact: true },
  30  |   );
> 31  |   await expect(objective).toHaveCount(1);
      |                           ^ Error: expect(locator).toHaveCount(expected) failed
  32  |   await expect(objective).toBeHidden();
  33  |   const drawer = await openLearningDrawer(page);
  34  |   await expect(drawer).toContainText("Explore the cumulative Architecture + Foreground problem");
  35  |   await expect(objective).toBeVisible();
  36  |   await expect(page.getByRole("region", { name: "Guided lesson progress" })).not.toBeVisible();
  37  |
  38  |   const sceneCanvas = page.getByTestId("scene-canvas");
  39  |   await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "architecture-foreground");
  40  |   await expect(sceneCanvas).toHaveAttribute("data-optics-fallback-applied", "false");
  41  |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  42  |
  43  |   const rtt = page.getByTestId("ground-glass-rtt");
  44  |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  45  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  46  |   await expect(rtt).toHaveAttribute("data-rtt-depth-available", "true", { timeout: 60_000 });
  47  |   await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 60_000 });
  48  |   await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "parallel-thin-lens");
  49  |   await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  50  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  51  |   expect(Number(await rtt.getAttribute("data-rtt-final-variance"))).toBeGreaterThan(4);
  52  |   expect(Number(await rtt.getAttribute("data-rtt-final-non-background"))).toBeGreaterThan(0);
  53  |   await expect(rtt.locator("canvas")).toBeVisible();
  54  |
  55  |   const sharpness = Object.values(
  56  |     await readFocusDistributionScores(page, [
  57  |       "foreground-near",
  58  |       "foreground-middle",
  59  |       "building-base",
  60  |       "building-middle",
  61  |     ]),
  62  |   );
  63  |   expect(sharpness[0]).toBeLessThan(sharpness[3]);
  64  |   expect(sharpness[1]).toBeGreaterThan(sharpness[0]);
  65  |   expect(sharpness[3]).toBeGreaterThanOrEqual(80);
  66  |
  67  |   const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  68  |   await expect(cameraControls.getByRole("slider", { name: "Rise" })).toBeEnabled();
  69  |   await expect(cameraControls.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  70  |   await expect(cameraControls.getByRole("slider", { name: "Tilt" })).toBeEnabled();
  71  |   await expect(cameraControls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  72  |   await expect(page.getByLabel("Focus distance")).toBeEnabled();
  73  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeEnabled();
  74  |
  75  |   await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  76  |   await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "side");
  77  |   await expect(page.getByTestId("geometry-svg-side")).toBeVisible();
  78  |   await expect(page.getByTestId("architecture-foreground-ground-guide").first()).toBeVisible();
  79  |   await expect(page.getByTestId("architecture-foreground-building-guide").first()).toBeVisible();
  80  |
  81  |   expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  82  |   expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
  83  | });
  84  |
  85  | test("Architecture + Foreground focus propagates to the physical film plane and processed RTT", async ({ page }) => {
  86  |   test.setTimeout(120_000);
  87  |   const pageErrors: string[] = [];
  88  |   const consoleProblems: string[] = [];
  89  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  90  |   page.on("console", (message) => {
  91  |     if (isKnownFiberClockDeprecation(message)) return;
  92  |     if (
  93  |       (message.type() === "error" || message.type() === "warning") &&
  94  |       !isAllowedEnvironmentConsoleMessage(message.text())
  95  |     ) {
  96  |       consoleProblems.push(message.text());
  97  |     }
  98  |   });
  99  |
  100 |   await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");
  101 |   const sceneCanvas = page.getByTestId("scene-canvas");
  102 |   const rtt = page.getByTestId("ground-glass-rtt");
  103 |   const focus = page.getByLabel("Focus distance");
  104 |   const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  105 |
  106 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  107 |   await aperture.getByRole("radio", { name: "f/5.6" }).check();
  108 |   await setRangeDirect(page, "Focus distance", 3920);
  109 |   await expect(focus).toHaveValue("3920");
  110 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  111 |
  112 |   const lensAtNear = await sceneCanvas.getAttribute("data-camera-lens-center-world");
  113 |   const filmAtNear = await sceneCanvas.getAttribute("data-camera-film-center-world");
  114 |   const varianceAtNear = Number(await rtt.getAttribute("data-rtt-final-variance"));
  115 |   expect(lensAtNear).toBeTruthy();
  116 |   expect(filmAtNear).toBeTruthy();
  117 |   expect(Number.isFinite(varianceAtNear)).toBe(true);
  118 |
  119 |   await setRangeDirect(page, "Focus distance", 9450);
  120 |   await expect(focus).toHaveValue("9450");
  121 |   await expect.poll(() => sceneCanvas.getAttribute("data-camera-film-center-world")).not.toBe(filmAtNear);
  122 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  123 |
  124 |   const lensAtFar = await sceneCanvas.getAttribute("data-camera-lens-center-world");
  125 |   const filmAtFar = await sceneCanvas.getAttribute("data-camera-film-center-world");
  126 |   const varianceAtFar = Number(await rtt.getAttribute("data-rtt-final-variance"));
  127 |   expect(lensAtFar).toBe(lensAtNear);
  128 |   expect(filmAtFar).not.toBe(filmAtNear);
  129 |   expect(Number.isFinite(varianceAtFar)).toBe(true);
  130 |   expect(Math.abs(varianceAtFar - varianceAtNear)).toBeGreaterThan(0.01);
  131 |   await expect(page.locator("body")).not.toContainText(/NaN|Infinity/);
```