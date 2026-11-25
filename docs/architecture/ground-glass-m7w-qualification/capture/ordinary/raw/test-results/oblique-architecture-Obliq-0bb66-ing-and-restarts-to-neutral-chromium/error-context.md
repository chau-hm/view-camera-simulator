# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: oblique-architecture.spec.ts >> Oblique Architecture guided Rise task solves observable framing and restarts to neutral
- Location: src/tests/e2e/oblique-architecture.spec.ts:144:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Restart task' })

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
          - generic [ref=e13]: Guided Lesson
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
                    - button "Task and Feedback — Task completed" [expanded]:
                      - generic: Task and Feedback
                      - generic: ✓
                    - generic [ref=e54]:
                      - generic [ref=e55]:
                        - group "Task and Feedback views" [ref=e56]:
                          - button "Task" [active] [pressed] [ref=e57] [cursor=pointer]
                          - button "Feedback — Task completed" [ref=e58] [cursor=pointer]:
                            - text: Feedback
                            - generic [ref=e59]: ✓
                        - generic [ref=e60]:
                          - button "Allow Task and Feedback to auto-hide" [pressed] [ref=e61] [cursor=pointer]:
                            - generic [ref=e62]: keep
                          - button "Close Task and Feedback" [ref=e63] [cursor=pointer]:
                            - generic [ref=e64]: close
                      - generic "Task" [ref=e66]:
                        - region "Task" [ref=e67]:
                          - generic [ref=e68]:
                            - generic [ref=e70]: Guided task
                            - heading "Frame the Building" [level=3] [ref=e71]
                            - paragraph [ref=e72]: Use Front Rise to include the full building while keeping the camera level and the verticals parallel.
                            - generic [ref=e73]:
                              - strong [ref=e74]: "Allowed controls:"
                              - text: Front Rise2D Geometry
                            - group [ref=e75]:
                              - generic "View requirements" [ref=e76] [cursor=pointer]
            - generic "GroundGlassColumn" [ref=e77]:
              - generic [ref=e78]:
                - generic [ref=e80]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e81]
              - generic [ref=e82]:
                - generic [ref=e84]:
                  - group "Preview" [ref=e85]:
                    - generic [ref=e86]: Preview
                    - generic [ref=e88]:
                      - generic [ref=e89]:
                        - radio "Raw Ground Glass" [checked] [ref=e90]
                        - generic [ref=e91]: Raw Ground Glass
                      - generic [ref=e92]:
                        - radio "Upright Assist" [ref=e93]
                        - generic [ref=e94]: Upright Assist
                  - group "View Options" [ref=e95]:
                    - generic [ref=e96]: View Options
                    - region "View Options" [ref=e98]:
                      - generic [ref=e100]:
                        - checkbox "Grid" [checked] [disabled] [ref=e101]
                        - generic [ref=e102]: Grid
                        - generic [ref=e103]: Disabled for this guided task
                - generic "GroundGlassViewport" [ref=e104]:
                  - generic [ref=e106]:
                    - generic [ref=e107]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e108]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 13200.0 mm focus / CoC 0.047 mm (53%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e112] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e113]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e114] [cursor=pointer]:
                    - generic [ref=e115]: open_in_new
            - generic [ref=e117]:
              - generic [ref=e118]:
                - heading "2D Geometry" [level=2] [ref=e119]
                - generic [ref=e120]:
                  - group "Geometry view" [ref=e121]:
                    - button "Side" [pressed] [ref=e122] [cursor=pointer]
                    - button "Top" [ref=e123] [cursor=pointer]
                  - group "Geometry framing" [ref=e124]:
                    - button "Fit Scene" [pressed] [ref=e125] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e126] [cursor=pointer]:
                    - generic [ref=e127]: open_in_new
              - paragraph [ref=e128]: "Side view | Rise: 20.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e130]:
                - generic [ref=e131]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e132]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e133]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e134]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e135]
                  - generic [ref=e137]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e138]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e144]: Near façade
                  - generic [ref=e148]: Middle façade
                  - generic [ref=e152]: Far façade
                - generic [ref=e154]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e155]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e156]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e157]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e158]
                  - generic [ref=e160]: Optical axis
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic "Simplified bellows connector" [ref=e162]
                  - generic "chief ray from film centre through lens centre" [ref=e165]
                  - generic [ref=e169]: Near façade
                  - generic [ref=e173]: Middle façade
                  - generic [ref=e177]: Far façade
                - generic [ref=e179]:
                  - generic [ref=e181]: Current
                  - generic [ref=e182]: Original
              - generic "Optical depth order" [ref=e183]:
                - generic [ref=e186]: Film 0 mm
                - generic [ref=e189]: Lens 152 mm
                - generic [ref=e192]: DOF limit 8.2 m
                - generic [ref=e195]: Focus 13.4 m
                - generic [ref=e198]: Far DOF > 19.3 m
            - region "Focus distribution · Focus" [ref=e200]:
              - generic [ref=e201]:
                - heading "Focus distribution" [level=4] [ref=e202]
                - 'generic "Ground Glass orientation: Raw" [ref=e203]': Raw
              - table "Focus distribution" [ref=e204]:
                - caption [ref=e205]: Focus distribution
                - rowgroup [ref=e206]:
                  - row [ref=e207]:
                    - cell [ref=e208]
                    - cell [ref=e209]
                    - cell [ref=e210]
                  - 'row "Centre Centre · Far façade: 71% · Acceptable Centre · Middle façade: 97% · Sharp Centre · Near façade: 53% · Acceptable" [ref=e211]':
                    - cell [ref=e212]
                    - 'cell "Centre Centre · Far façade: 71% · Acceptable Centre · Middle façade: 97% · Sharp Centre · Near façade: 53% · Acceptable" [ref=e213]':
                      - generic "Centre" [ref=e214]
                      - generic [ref=e215]:
                        - 'group "Centre · Far façade: 71% · Acceptable" [ref=e216]':
                          - generic "Far façade" [ref=e218]
                          - generic [ref=e219]:
                            - text: 71%
                            - generic [ref=e220]: ~
                        - 'group "Centre · Middle façade: 97% · Sharp" [ref=e221]':
                          - generic "Middle façade" [ref=e223]
                          - generic [ref=e224]:
                            - text: 97%
                            - generic [ref=e225]: ✓
                        - 'group "Centre · Near façade: 53% · Acceptable" [ref=e226]':
                          - generic "Near façade" [ref=e228]
                          - generic [ref=e229]:
                            - text: 53%
                            - generic [ref=e230]: ~
                    - cell [ref=e231]
                  - row [ref=e232]:
                    - cell [ref=e233]
                    - cell [ref=e234]
                    - cell [ref=e235]
          - group [ref=e238]:
            - generic "Optical Debug oblique-architecture · parallel" [ref=e239] [cursor=pointer]:
              - generic [ref=e240]: Optical Debug
              - generic [ref=e241]: oblique-architecture · parallel
        - complementary [ref=e242]:
          - generic [ref=e243]:
            - region "Camera Controls" [ref=e244]:
              - heading "Camera Controls" [level=3] [ref=e246]
              - paragraph [ref=e247]:
                - generic [ref=e248]: 🔒
                - generic [ref=e249]: Disabled for this guided task
              - generic [ref=e250]:
                - region "Movement" [ref=e252]:
                  - generic [ref=e253]:
                    - heading "Front standard" [level=4] [ref=e254]
                    - button "Help" [ref=e255] [cursor=pointer]:
                      - generic [ref=e256]: "?"
                  - generic [ref=e257]:
                    - generic [ref=e258]:
                      - generic [ref=e259]: Rise
                      - slider "Rise" [ref=e260]: "20"
                      - generic [ref=e261]: 20.0 mm
                    - generic [ref=e262]:
                      - generic [ref=e263]: Tilt
                      - slider "Tilt" [disabled] [ref=e264]: "0"
                      - generic [ref=e265]: 0.0°
                    - generic [ref=e266]:
                      - generic [ref=e267]: Swing
                      - slider "Swing" [disabled] [ref=e268]: "0"
                      - generic [ref=e269]: 0.0°
                - region "Focus" [ref=e271]:
                  - heading "Focus" [level=3] [ref=e272]
                  - generic [ref=e273]:
                    - generic [ref=e274]: Focus distance
                    - slider "Focus distance" [disabled] [ref=e275]: "13200"
                    - generic [ref=e276]: 13200.0 mm
                - region "Aperture" [ref=e278]:
                  - heading "Aperture" [level=3] [ref=e279]
                  - radiogroup "Aperture" [disabled] [ref=e280]:
                    - generic [ref=e281]:
                      - radio "f/5.6" [disabled] [ref=e282]
                      - generic [ref=e283]: f/5.6
                    - generic [ref=e284]:
                      - radio "f/8" [disabled] [ref=e285]
                      - generic [ref=e286]: f/8
                    - generic [ref=e287]:
                      - radio "f/11" [checked] [disabled] [ref=e288]
                      - generic [ref=e289]: f/11
                    - generic [ref=e290]:
                      - radio "f/16" [disabled] [ref=e291]
                      - generic [ref=e292]: f/16
                    - generic [ref=e293]:
                      - radio "f/22" [disabled] [ref=e294]
                      - generic [ref=e295]: f/22
                    - generic [ref=e296]:
                      - radio "f/32" [disabled] [ref=e297]
                      - generic [ref=e298]: f/32
                  - generic [ref=e299]: Aperture is fixed for this lesson
                - generic [ref=e300]:
                  - generic [ref=e301]: Reset
                  - region "Reset" [ref=e302]:
                    - generic [ref=e303]:
                      - button "Reset movements" [ref=e304] [cursor=pointer]
                      - button "Restart task" [ref=e305] [cursor=pointer]
            - region "Developer Tools" [ref=e306]:
              - heading "Developer Tools" [level=3] [ref=e307]
              - generic [ref=e309]:
                - checkbox "Raw RTT — bypass DOF" [ref=e310]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
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
  134 |   await page.getByRole("button", { name: "Reset movements" }).click();
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
> 175 |   await page.getByRole("button", { name: "Restart task" }).click();
      |                                                            ^ Error: locator.click: Test timeout of 120000ms exceeded.
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
  235 |   await expect(page).toHaveURL(/\/simulator\/guided\/oblique-architecture\/oblique-compound-01\?rttDiagnostics=1$/);
  236 |   await openPinnedLearningDrawer(page);
  237 |   await expect(page.getByText("Complete the Photograph", { exact: true })).toBeVisible();
  238 |   await expect(
  239 |     page.getByText(
  240 |       "Use Front Rise, Front Swing, and Focus to frame the building, keep its verticals parallel, and make the receding façade sharp from near to far.",
  241 |       { exact: true },
  242 |     ),
  243 |   ).toBeVisible();
  244 |
  245 |   const { rtt } = await assertSharedObliqueRendering(page);
  246 |   const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  247 |   const rise = cameraControls.getByRole("slider", { name: "Rise" });
  248 |   const swing = cameraControls.getByRole("slider", { name: "Swing" });
  249 |   const tilt = cameraControls.getByRole("slider", { name: "Tilt" });
  250 |   const focus = page.getByLabel("Focus distance");
  251 |
  252 |   await expect(rise).toHaveValue("0");
  253 |   await expect(rise).toBeEnabled();
  254 |   await expect(swing).toHaveValue("0");
  255 |   await expect(swing).toBeEnabled();
  256 |   await expect(tilt).toBeDisabled();
  257 |   await expect(focus).toHaveValue("13200");
  258 |   await expect(focus).toBeEnabled();
  259 |   await expect(page.getByRole("button", { name: "Expand 2D Geometry" })).toBeVisible();
  260 |   await expect(page.getByRole("radiogroup", { name: "Aperture" })).toBeDisabled();
  261 |   await expectLearningFeedbackNotCompleted(page);
  262 |
  263 |   const neutralSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  264 |   await setStepRangeInput(page, "Rise", 20);
  265 |   await expect(rise).toHaveValue("20");
  266 |   await expectLearningFeedbackNotCompleted(page);
  267 |
  268 |   await setStepRangeInput(page, "Swing", 9.8);
  269 |   await expect(swing).toHaveValue("9.8");
  270 |   await expectLearningFeedbackNotCompleted(page);
  271 |
  272 |   await setRangeDirect(page, "Focus distance", 5190);
  273 |   await expect(focus).toHaveValue("5190");
  274 |   await expect.poll(async () => rtt.getAttribute("data-rtt-sanity-state")).not.toBe(neutralSanityState);
  275 |   const compoundFeedback = await openCompletedFeedback(page);
```