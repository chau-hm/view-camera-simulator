# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: oblique-architecture.spec.ts >> Oblique Architecture free practice exposes Rise, Swing, and Focus
- Location: src/tests/e2e/oblique-architecture.spec.ts:95:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Reset movements' })
    - locator resolved to <button type="button" class="btn btn--danger" aria-label="Reset movements">Reset movements</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

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
          - generic [ref=e12]: Oblique Architecture
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
                            - generic: 13100.0 mm focus / CoC 0.029 mm (71%)
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
              - paragraph [ref=e106]: "Side view | Rise: 20.0 mm | Tilt: 0.0° | Swing: 1.0°"
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
                  - generic [ref=e122]: Near façade
                  - generic [ref=e126]: Middle façade
                  - generic [ref=e130]: Far façade
                - generic [ref=e132]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e133]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e134]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e135]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e136]
                  - generic [ref=e138]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic "Simplified bellows connector" [ref=e140]
                  - generic "chief ray from film centre through lens centre" [ref=e143]
                  - generic [ref=e147]: Near façade
                  - generic [ref=e151]: Middle façade
                  - generic [ref=e155]: Far façade
                - generic [ref=e157]:
                  - generic [ref=e159]: Current
                  - generic [ref=e160]: Original
              - generic "Optical depth order" [ref=e161]:
                - generic [ref=e164]: Film 0 mm
                - generic [ref=e167]: Scheimpflug intersection 0 mm
                - generic [ref=e170]: Lens 152 mm
                - generic [ref=e173]: DOF limit 8.2 m
                - generic [ref=e176]: Focus 13.2 m
                - generic [ref=e179]: Far DOF > 19.3 m
            - region "Focus distribution · Focus" [ref=e181]:
              - generic [ref=e182]:
                - heading "Focus distribution" [level=4] [ref=e183]
                - 'generic "Ground Glass orientation: Raw" [ref=e184]': Raw
              - table "Focus distribution" [ref=e185]:
                - caption [ref=e186]: Focus distribution
                - rowgroup [ref=e187]:
                  - row [ref=e188]:
                    - cell [ref=e189]
                    - cell [ref=e190]
                    - cell [ref=e191]
                  - 'row "Centre Centre · Far façade: 61% · Acceptable Centre · Middle façade: 84% · Sharp Centre · Near façade: 71% · Acceptable" [ref=e192]':
                    - cell [ref=e193]
                    - 'cell "Centre Centre · Far façade: 61% · Acceptable Centre · Middle façade: 84% · Sharp Centre · Near façade: 71% · Acceptable" [ref=e194]':
                      - generic "Centre" [ref=e195]
                      - generic [ref=e196]:
                        - 'group "Centre · Far façade: 61% · Acceptable" [ref=e197]':
                          - generic "Far façade" [ref=e199]
                          - generic [ref=e200]:
                            - text: 61%
                            - generic [ref=e201]: ~
                        - 'group "Centre · Middle façade: 84% · Sharp" [ref=e202]':
                          - generic "Middle façade" [ref=e204]
                          - generic [ref=e205]:
                            - text: 84%
                            - generic [ref=e206]: ✓
                        - 'group "Centre · Near façade: 71% · Acceptable" [ref=e207]':
                          - generic "Near façade" [ref=e209]
                          - generic [ref=e210]:
                            - text: 71%
                            - generic [ref=e211]: ~
                    - cell [ref=e212]
                  - row [ref=e213]:
                    - cell [ref=e214]
                    - cell [ref=e215]
                    - cell [ref=e216]
          - group [ref=e219]:
            - generic "Optical Debug oblique-architecture · scheimpflug" [ref=e220] [cursor=pointer]:
              - generic [ref=e221]: Optical Debug
              - generic [ref=e222]: oblique-architecture · scheimpflug
        - complementary [ref=e223]:
          - generic [ref=e224]:
            - region "Camera Controls" [ref=e225]:
              - heading "Camera Controls" [level=3] [ref=e227]
              - paragraph [ref=e228]:
                - generic [ref=e229]: 🔒
                - generic [ref=e230]: Disabled for this guided task
              - generic [ref=e231]:
                - region "Movement" [ref=e233]:
                  - generic [ref=e234]:
                    - heading "Front standard" [level=4] [ref=e235]
                    - button "Help" [ref=e236] [cursor=pointer]:
                      - generic [ref=e237]: "?"
                  - generic [ref=e238]:
                    - generic [ref=e239]:
                      - generic [ref=e240]: Rise
                      - slider "Rise" [ref=e241]: "20"
                      - generic [ref=e242]: 20.0 mm
                    - generic [ref=e243]:
                      - generic [ref=e244]: Tilt
                      - slider "Tilt" [disabled] [ref=e245]: "0"
                      - generic [ref=e246]: 0.0°
                    - generic [ref=e247]:
                      - generic [ref=e248]: Swing
                      - slider "Swing" [ref=e249]: "1"
                      - generic [ref=e250]: 1.0°
                - region "Focus" [ref=e252]:
                  - heading "Focus" [level=3] [ref=e253]
                  - generic [ref=e254]:
                    - generic [ref=e255]: Focus distance
                    - slider "Focus distance" [active] [ref=e256]: "13100"
                    - generic [ref=e257]: 13100.0 mm
                - region "Aperture" [ref=e259]:
                  - heading "Aperture" [level=3] [ref=e260]
                  - radiogroup "Aperture" [disabled] [ref=e261]:
                    - generic [ref=e262]:
                      - radio "f/5.6" [disabled] [ref=e263]
                      - generic [ref=e264]: f/5.6
                    - generic [ref=e265]:
                      - radio "f/8" [disabled] [ref=e266]
                      - generic [ref=e267]: f/8
                    - generic [ref=e268]:
                      - radio "f/11" [checked] [disabled] [ref=e269]
                      - generic [ref=e270]: f/11
                    - generic [ref=e271]:
                      - radio "f/16" [disabled] [ref=e272]
                      - generic [ref=e273]: f/16
                    - generic [ref=e274]:
                      - radio "f/22" [disabled] [ref=e275]
                      - generic [ref=e276]: f/22
                    - generic [ref=e277]:
                      - radio "f/32" [disabled] [ref=e278]
                      - generic [ref=e279]: f/32
                  - generic [ref=e280]: Aperture is fixed for this lesson
                - generic [ref=e281]:
                  - generic [ref=e282]: Reset
                  - region "Reset" [ref=e283]:
                    - button "Reset movements" [ref=e285] [cursor=pointer]
            - region "Developer Tools" [ref=e286]:
              - heading "Developer Tools" [level=3] [ref=e287]
              - generic [ref=e289]:
                - checkbox "Raw RTT — bypass DOF" [ref=e290]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  34  |   await getLearningOverlay(page).getByRole("button", { name: "Task", exact: true }).click();
  35  | };
  36  | 
  37  | const assertSharedObliqueRendering = async (page: Page) => {
  38  |   await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();
  39  |   await expect(page.getByRole("heading", { name: "Ground Glass", exact: true })).toBeVisible();
  40  | 
  41  |   const sceneCanvas = page.getByTestId("scene-canvas");
  42  |   await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "oblique-architecture");
  43  |   await expect(sceneCanvas).toHaveAttribute("data-optics-fallback-applied", "false");
  44  |   await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  45  | 
  46  |   const rtt = page.getByTestId("ground-glass-rtt");
  47  |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", "oblique-architecture");
  48  |   await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  49  |   await expect(rtt).toHaveAttribute("data-rtt-depth-available", "true", { timeout: 60_000 });
  50  |   await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 60_000 });
  51  |   await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "parallel-thin-lens");
  52  |   await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  53  |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  54  |   expect(Number(await rtt.getAttribute("data-rtt-final-variance"))).toBeGreaterThan(4);
  55  |   expect(Number(await rtt.getAttribute("data-rtt-final-non-background"))).toBeGreaterThan(0);
  56  |   await expect(rtt.locator("canvas")).toBeVisible();
  57  | 
  58  |   const sharpness = Object.values(
  59  |     await readFocusDistributionScores(page, ["facade-near", "facade-middle", "facade-far"]),
  60  |   );
  61  |   expect(sharpness[1]).toBeGreaterThan(sharpness[0]);
  62  |   expect(sharpness[1]).toBeGreaterThan(sharpness[2]);
  63  | 
  64  |   return { rtt, sceneCanvas };
  65  | };
  66  | 
  67  | const assertRiseTaskControls = async (page: Page) => {
  68  |   const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  69  |   const rise = cameraControls.getByRole("slider", { name: "Rise" });
  70  |   await expect(rise).toBeVisible();
  71  |   await expect(rise).toBeEnabled();
  72  |   await expect(cameraControls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  73  |   await expect(cameraControls.getByRole("slider", { name: "Tilt" })).toBeDisabled();
  74  |   await expect(page.getByLabel("Focus distance")).toBeDisabled();
  75  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  76  |   await expect(page.getByRole("button", { name: "Reset movements" })).toBeVisible();
  77  |   return rise;
  78  | };
  79  | 
  80  | const assertFreeControls = async (page: Page) => {
  81  |   const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  82  |   const rise = cameraControls.getByRole("slider", { name: "Rise" });
  83  |   const swing = cameraControls.getByRole("slider", { name: "Swing" });
  84  |   const tilt = cameraControls.getByRole("slider", { name: "Tilt" });
  85  |   const focus = page.getByLabel("Focus distance");
  86  |   await expect(rise).toBeEnabled();
  87  |   await expect(swing).toBeEnabled();
  88  |   await expect(tilt).toBeDisabled();
  89  |   await expect(focus).toBeEnabled();
  90  |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  91  |   await expect(page.getByRole("button", { name: "Reset movements" })).toBeVisible();
  92  |   return { rise, swing, focus, rtt: page.getByTestId("ground-glass-rtt") };
  93  | };
  94  | 
  95  | test("Oblique Architecture free practice exposes Rise, Swing, and Focus", async ({ page }) => {
  96  |   test.setTimeout(120_000);
  97  |   const pageErrors: string[] = [];
  98  |   const consoleProblems: string[] = [];
  99  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  100 |   page.on("console", (message) => {
  101 |     if (isKnownFiberClockDeprecation(message)) return;
  102 |     if (
  103 |       (message.type() === "error" || message.type() === "warning") &&
  104 |       !isAllowedEnvironmentConsoleMessage(message.text())
  105 |     ) {
  106 |       consoleProblems.push(message.text());
  107 |     }
  108 |   });
  109 | 
  110 |   await page.goto("/simulator/free/oblique-architecture?rttDiagnostics=1");
  111 |   await expect(page).toHaveURL(/\/simulator\/free\/oblique-architecture\?rttDiagnostics=1$/);
  112 |   await assertSharedObliqueRendering(page);
  113 |   const { rise, swing, focus, rtt } = await assertFreeControls(page);
  114 |   await expect(page.getByRole("region", { name: "Guided lesson progress" })).not.toBeVisible();
  115 |   await expect(rise).toHaveValue("0");
  116 |   await expect(page.getByText("Aperture is fixed for this lesson", { exact: true })).toBeVisible();
  117 |   await expect(swing).toHaveValue("0");
  118 | 
  119 |   await setStepRangeInput(page, "Rise", 20);
  120 |   await setStepRangeInput(page, "Swing", 5);
  121 |   await expect(rise).toHaveValue("20");
  122 |   await expect(swing).toHaveValue("5");
  123 | 
  124 |   const focusBefore = await focus.inputValue();
  125 | 
  126 |   const neutralSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  127 |   await setStepRangeInput(page, "Swing", 1);
  128 |   await expect(swing).toHaveValue("1");
  129 |   await setStepRangeInput(page, "Focus distance", Number(focusBefore) - 100);
  130 |   await expect(focus).not.toHaveValue(focusBefore);
  131 |   await expect.poll(async () => rtt.getAttribute("data-rtt-sanity-state")).not.toBe(neutralSanityState);
  132 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  133 | 
> 134 |   await page.getByRole("button", { name: "Reset movements" }).click();
      |                                                               ^ Error: locator.click: Test timeout of 120000ms exceeded.
  135 |   await expect(rise).toHaveValue("0");
  136 |   await expect(swing).toHaveValue("0");
  137 |   await expect(focus).toHaveValue(focusBefore);
  138 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  139 | 
  140 |   expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  141 |   expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
  142 | });
  143 | 
  144 | test("Oblique Architecture guided Rise task solves observable framing and restarts to neutral", async ({ page }) => {
  145 |   test.setTimeout(120_000);
  146 |   await page.goto("/simulator/guided/oblique-architecture/oblique-rise-01?rttDiagnostics=1");
  147 |   await expect(page).toHaveURL(/\/simulator\/guided\/oblique-architecture\/oblique-rise-01\?rttDiagnostics=1$/);
  148 |   await openPinnedLearningDrawer(page);
  149 |   await expect(page.getByText("Frame the Building", { exact: true })).toBeVisible();
  150 |   await expect(
  151 |     page.getByText(
  152 |       "Use Front Rise to include the full building while keeping the camera level and the verticals parallel.",
  153 |       { exact: true },
  154 |     ),
  155 |   ).toBeVisible();
  156 | 
  157 |   const { rtt } = await assertSharedObliqueRendering(page);
  158 |   const rise = await assertRiseTaskControls(page);
  159 |   await expect(rise).toHaveValue("0");
  160 |   await expectLearningFeedbackNotCompleted(page);
  161 |   await expect(page.getByRole("button", { name: "Restart task" })).toBeVisible();
  162 | 
  163 |   const neutralSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  164 |   await setStepRangeInput(page, "Rise", 20);
  165 |   await expect(rise).toHaveValue("20");
  166 |   await expect.poll(async () => rtt.getAttribute("data-rtt-sanity-state")).not.toBe(neutralSanityState);
  167 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  168 |   const riseFeedback = await openCompletedFeedback(page);
  169 |   await expect(riseFeedback.getByRole("progressbar", { name: "Task requirements completed" })).toHaveAttribute(
  170 |     "aria-valuenow",
  171 |     "4",
  172 |   );
  173 |   await getLearningOverlay(page).getByRole("button", { name: "Task", exact: true }).click();
  174 | 
  175 |   await page.getByRole("button", { name: "Restart task" }).click();
  176 |   await expect(rise).toHaveValue("0");
  177 |   await expectLearningFeedbackNotCompleted(page);
  178 |   await expect(page.getByRole("button", { name: "Restart task" })).toBeVisible();
  179 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  180 | });
  181 | 
  182 | test("Oblique Architecture guided Swing + Focus task starts from solved Rise and restarts deterministically", async ({ page }) => {
  183 |   test.setTimeout(120_000);
  184 |   await page.goto("/simulator/guided/oblique-architecture/oblique-swing-focus-01?rttDiagnostics=1");
  185 |   await expect(page).toHaveURL(/\/simulator\/guided\/oblique-architecture\/oblique-swing-focus-01\?rttDiagnostics=1$/);
  186 |   await openPinnedLearningDrawer(page);
  187 |   await expect(page.getByText("Align the Façade Focus", { exact: true })).toBeVisible();
  188 |   await expect(
  189 |     page.getByText(
  190 |       "Use Front Swing and Focus to keep the receding façade sharp from near to far while preserving the architectural framing.",
  191 |       { exact: true },
  192 |     ),
  193 |   ).toBeVisible();
  194 | 
  195 |   const { rtt } = await assertSharedObliqueRendering(page);
  196 |   const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  197 |   const rise = cameraControls.getByRole("slider", { name: "Rise" });
  198 |   const swing = cameraControls.getByRole("slider", { name: "Swing" });
  199 |   const tilt = cameraControls.getByRole("slider", { name: "Tilt" });
  200 |   const focus = page.getByLabel("Focus distance");
  201 | 
  202 |   await expect(rise).toHaveValue("20");
  203 |   await expect(rise).toBeDisabled();
  204 |   await expect(swing).toHaveValue("0");
  205 |   await expect(swing).toBeEnabled();
  206 |   await expect(tilt).toBeDisabled();
  207 |   await expect(focus).toHaveValue("13200");
  208 |   await expect(focus).toBeEnabled();
  209 |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  210 |   await expectLearningFeedbackNotCompleted(page);
  211 | 
  212 |   const neutralSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  213 |   await setStepRangeInput(page, "Swing", 9.8);
  214 |   await setRangeDirect(page, "Focus distance", 5190);
  215 |   await expect.poll(async () => rtt.getAttribute("data-rtt-sanity-state")).not.toBe(neutralSanityState);
  216 |   const swingFeedback = await openCompletedFeedback(page);
  217 |   await expect(swingFeedback.getByRole("progressbar", { name: "Task requirements completed" })).toHaveAttribute(
  218 |     "aria-valuenow",
  219 |     "6",
  220 |   );
  221 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  222 |   await getLearningOverlay(page).getByRole("button", { name: "Task", exact: true }).click();
  223 | 
  224 |   await page.getByRole("button", { name: "Restart task" }).click();
  225 |   await expect(rise).toHaveValue("20");
  226 |   await expect(swing).toHaveValue("0");
  227 |   await expect(focus).toHaveValue("13200");
  228 |   await expectLearningFeedbackNotCompleted(page);
  229 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  230 | });
  231 | 
  232 | test("Oblique Architecture compound task solves Rise, Swing, and Focus from neutral", async ({ page }) => {
  233 |   test.setTimeout(120_000);
  234 |   await page.goto("/simulator/guided/oblique-architecture/oblique-compound-01?rttDiagnostics=1");
```