# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: viewport-learning-overlay.spec.ts >> keyboard focus remains visible on the rail while the drawer opens transiently
- Location: src/tests/e2e/viewport-learning-overlay.spec.ts:144:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: expect(locator).not.toBeVisible() failed

Locator:  getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')
Expected: not visible
Received: visible

Call log:
  - Expect "not toBeVisible" with timeout 5000ms
  - waiting for getByTestId('learning-overlay-panel').getByTestId('learning-overlay-drawer')

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
          - generic [ref=e12]: Table Tilt
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
                    - button "Open Task and Feedback" [active] [ref=e54] [cursor=pointer]:
                      - generic [ref=e55]: Task and Feedback
                    - generic:
                      - generic:
                        - group:
                          - button [pressed]: Task
                          - button: Feedback
                        - generic:
                          - button:
                            - generic: push_pin
                          - button:
                            - generic: close
                      - region [ref=e58]:
                        - generic [ref=e59]:
                          - generic [ref=e61]: Guided task
                          - heading [level=3] [ref=e62]: Align the tabletop plane of sharp focus
                          - paragraph [ref=e63]: Use Front Tilt and Focus to align the plane of sharp focus with all three coplanar focus cards.
                          - generic [ref=e64]:
                            - strong [ref=e65]: "Allowed controls:"
                            - text: Front TiltFocusAperture2D Geometry
                          - group [ref=e66]:
                            - generic [ref=e67] [cursor=pointer]: View requirements
            - generic "GroundGlassColumn" [ref=e68]:
              - generic [ref=e69]:
                - generic [ref=e71]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e72]
              - generic [ref=e73]:
                - generic [ref=e75]:
                  - group "Preview" [ref=e76]:
                    - generic [ref=e77]: Preview
                    - generic [ref=e79]:
                      - generic [ref=e80]:
                        - radio "Raw Ground Glass" [checked] [ref=e81]
                        - generic [ref=e82]: Raw Ground Glass
                      - generic [ref=e83]:
                        - radio "Upright Assist" [ref=e84]
                        - generic [ref=e85]: Upright Assist
                  - group "View Options" [ref=e86]:
                    - generic [ref=e87]: View Options
                    - region "View Options" [ref=e89]:
                      - generic [ref=e91]:
                        - checkbox "Grid" [checked] [disabled] [ref=e92]
                        - generic [ref=e93]: Grid
                        - generic [ref=e94]: Disabled for this guided task
                - generic "GroundGlassViewport" [ref=e95]:
                  - generic [ref=e97]:
                    - generic [ref=e98]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e99]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 4600.0 mm focus / CoC 0.222 mm (0%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e103] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e104]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e105] [cursor=pointer]:
                    - generic [ref=e106]: open_in_new
            - generic [ref=e108]:
              - generic [ref=e109]:
                - heading "2D Geometry" [level=2] [ref=e110]
                - generic [ref=e111]:
                  - group "Geometry view" [ref=e112]:
                    - button "Side" [pressed] [ref=e113] [cursor=pointer]
                    - button "Top" [ref=e114] [cursor=pointer]
                    - button "Scheimpflug Section" [ref=e115] [cursor=pointer]
                  - group "Geometry framing" [ref=e116]:
                    - button "Fit Scene" [pressed] [ref=e117] [cursor=pointer]
                    - button "Fit Construction" [disabled] [ref=e118]
                  - button "Expand 2D Geometry" [ref=e119] [cursor=pointer]:
                    - generic [ref=e120]: open_in_new
              - paragraph [ref=e121]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e123]:
                - generic [ref=e124]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e125]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e126]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e127]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e128]
                  - generic [ref=e130]: Optical axis
                  - generic [ref=e132]: Tabletop
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
                  - generic [ref=e134]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e137]: Focus plane
                  - generic [ref=e141]: Near card
                  - generic [ref=e145]: Middle notebook
                  - generic [ref=e149]: Far chart
              - generic "Optical depth order" [ref=e151]:
                - generic [ref=e154]: Film 0 mm
                - generic [ref=e157]: Lens 155 mm
                - generic [ref=e160]: DOF limit 3.9 m
                - generic [ref=e163]: Focus 4.8 m
                - generic [ref=e166]: Far DOF 6.0 m
            - region "Focus distribution · Patch coverage" [ref=e168]:
              - generic [ref=e169]:
                - heading "Focus distribution" [level=4] [ref=e170]
                - 'generic "Ground Glass orientation: Raw" [ref=e171]': Raw
              - table "Focus distribution" [ref=e172]:
                - caption [ref=e173]: Focus distribution
                - rowgroup [ref=e174]:
                  - 'row "Upper centre Upper centre · Near card: 0% · Soft Upper centre · Middle notebook: 96% · Sharp Upper centre · Far chart: 0% · Soft" [ref=e175]':
                    - cell [ref=e176]
                    - 'cell "Upper centre Upper centre · Near card: 0% · Soft Upper centre · Middle notebook: 96% · Sharp Upper centre · Far chart: 0% · Soft" [ref=e177]':
                      - generic "Upper centre" [ref=e178]
                      - generic [ref=e179]:
                        - 'group "Upper centre · Near card: 0% · Soft" [ref=e180]':
                          - generic "Near card" [ref=e182]
                          - generic [ref=e183]:
                            - text: 0%
                            - generic [ref=e184]: —
                        - 'group "Upper centre · Middle notebook: 96% · Sharp" [ref=e185]':
                          - generic "Middle notebook" [ref=e187]
                          - generic [ref=e188]:
                            - text: 96%
                            - generic [ref=e189]: ✓
                        - 'group "Upper centre · Far chart: 0% · Soft" [ref=e190]':
                          - generic "Far chart" [ref=e192]
                          - generic [ref=e193]:
                            - text: 0%
                            - generic [ref=e194]: —
                    - cell [ref=e195]
                  - row [ref=e196]:
                    - cell [ref=e197]
                    - cell [ref=e198]
                    - cell [ref=e199]
                  - row [ref=e200]:
                    - cell [ref=e201]
                    - cell [ref=e202]
                    - cell [ref=e203]
          - group [ref=e206]:
            - generic "Optical Debug table-tilt · parallel" [ref=e207] [cursor=pointer]:
              - generic [ref=e208]: Optical Debug
              - generic [ref=e209]: table-tilt · parallel
        - complementary [ref=e210]:
          - generic [ref=e211]:
            - region "Camera Controls" [ref=e212]:
              - heading "Camera Controls" [level=3] [ref=e214]
              - paragraph [ref=e215]:
                - generic [ref=e216]: 🔒
                - generic [ref=e217]: Disabled for this guided task
              - generic [ref=e218]:
                - region "Movement" [ref=e220]:
                  - generic [ref=e221]:
                    - heading "Front standard" [level=4] [ref=e222]
                    - button "Help" [ref=e223] [cursor=pointer]:
                      - generic [ref=e224]: "?"
                  - generic [ref=e225]:
                    - generic [ref=e226]:
                      - generic [ref=e227]: Rise
                      - slider "Rise" [disabled] [ref=e228]: "0"
                      - generic [ref=e229]: 0.0 mm
                    - generic [ref=e230]:
                      - generic [ref=e231]: Tilt
                      - slider "Tilt" [ref=e232]: "0"
                      - generic [ref=e233]: 0.0°
                    - generic [ref=e234]:
                      - generic [ref=e235]: Swing
                      - slider "Swing" [disabled] [ref=e236]: "0"
                      - generic [ref=e237]: 0.0°
                - region "Focus" [ref=e239]:
                  - heading "Focus" [level=3] [ref=e240]
                  - generic [ref=e241]:
                    - generic [ref=e242]: Focus distance
                    - slider "Focus distance" [ref=e243]: "4600"
                    - generic [ref=e244]: 4600.0 mm
                    - button "Infinity Reset" [ref=e246] [cursor=pointer]: ∞
                - region "Aperture" [ref=e248]:
                  - heading "Aperture" [level=3] [ref=e249]
                  - radiogroup "Aperture" [ref=e250]:
                    - generic [ref=e251] [cursor=pointer]:
                      - radio "f/5.6" [ref=e252]
                      - generic [ref=e253]: f/5.6
                    - generic [ref=e254] [cursor=pointer]:
                      - radio "f/8" [ref=e255]
                      - generic [ref=e256]: f/8
                    - generic [ref=e257] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e258]
                      - generic [ref=e259]: f/11
                    - generic [ref=e260] [cursor=pointer]:
                      - radio "f/16" [ref=e261]
                      - generic [ref=e262]: f/16
                    - generic [ref=e263] [cursor=pointer]:
                      - radio "f/22" [ref=e264]
                      - generic [ref=e265]: f/22
                    - generic [ref=e266] [cursor=pointer]:
                      - radio "f/32" [ref=e267]
                      - generic [ref=e268]: f/32
                - generic [ref=e269]:
                  - generic [ref=e270]: Reset
                  - region "Reset" [ref=e271]:
                    - generic [ref=e272]:
                      - button "Reset movements" [ref=e273] [cursor=pointer]
                      - button "Restart task" [ref=e274] [cursor=pointer]
            - region "Developer Tools" [ref=e275]:
              - heading "Developer Tools" [level=3] [ref=e276]
              - generic [ref=e278]:
                - checkbox "Raw RTT — bypass DOF" [ref=e279]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  99  |   await page.mouse.move(groundGlassAfter.x + groundGlassAfter.width / 2, groundGlassAfter.y + 24);
  100 |   await expect(drawer).toBeVisible();
  101 | 
  102 |   await page.getByRole("button", { name: "Allow Task and Feedback to auto-hide" }).click();
  103 |   await page.getByRole("button", { name: "Close Task and Feedback" }).click();
  104 |   await expect(drawer).not.toBeVisible({ timeout: 2_000 });
  105 |   await expect(rail).toHaveAttribute("aria-expanded", "false");
  106 |   await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  107 | });
  108 | 
  109 | test("learning drawer supports keyboard focus and internal scrolling without changing Task/Feedback content", async ({ page }) => {
  110 |   test.setTimeout(120_000);
  111 |   await page.setViewportSize({ width: 1024, height: 900 });
  112 |   await page.goto("/simulator/guided/oblique-architecture/oblique-rise-01?lesson=1");
  113 | 
  114 |   const drawer = getLearningDrawer(page);
  115 |   const rail = getLearningRail(page);
  116 |   await openLearningDrawer(page);
  117 |   await page.waitForTimeout(220);
  118 | 
  119 |   const content = drawer.locator(".learning-overlay-panel__content");
  120 |   const contentMetrics = await content.evaluate((element) => ({
  121 |     clientHeight: element.clientHeight,
  122 |     scrollHeight: element.scrollHeight,
  123 |   }));
  124 |   expect(contentMetrics.scrollHeight).toBeGreaterThan(contentMetrics.clientHeight);
  125 |   const initialScrollTop = await content.evaluate((element) => element.scrollTop);
  126 |   await content.hover();
  127 |   await page.mouse.wheel(0, 800);
  128 |   await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(initialScrollTop);
  129 | 
  130 |   const feedback = drawer.getByRole("button", { name: "Feedback", exact: true });
  131 |   await feedback.focus();
  132 |   await page.keyboard.press("Enter");
  133 |   await expect(drawer.getByTestId("learning-overlay-feedback-view")).toBeVisible();
  134 |   await page.keyboard.press("Escape");
  135 |   await expect(drawer).not.toBeVisible({ timeout: 2_000 });
  136 |   await expect(rail).toBeFocused();
  137 | 
  138 |   await rail.click();
  139 |   await expect(drawer).toBeVisible();
  140 |   await drawer.getByRole("button", { name: "Task", exact: true }).focus();
  141 |   await expect(drawer).toBeVisible();
  142 | });
  143 | 
  144 | test("keyboard focus remains visible on the rail while the drawer opens transiently", async ({ page }) => {
  145 |   test.setTimeout(120_000);
  146 |   await page.setViewportSize({ width: 1440, height: 1000 });
  147 |   await page.goto("/simulator/guided/table-tilt/tilt-01");
  148 | 
  149 |   const learning = getLearningOverlay(page);
  150 |   const rail = getLearningRail(page);
  151 |   const drawer = getLearningDrawer(page);
  152 |   const stage = page.locator(".scene-viewport-stage");
  153 | 
  154 |   await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  155 |   await expect(drawer).not.toBeVisible();
  156 | 
  157 |   await page.evaluate(() => {
  158 |     if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  159 |   });
  160 |   for (let tabCount = 0; tabCount < 80; tabCount += 1) {
  161 |     if (await rail.evaluate((element) => element === document.activeElement)) break;
  162 |     await page.keyboard.press("Tab");
  163 |   }
  164 |   await expect(learning).toHaveAttribute("data-drawer-state", "transient");
  165 |   await expect(rail).toBeFocused();
  166 |   await expect(rail).toHaveCSS("opacity", "1");
  167 |   await expect(drawer).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  168 |   const railBounds = await requireBounds(rail, "Focused learning rail");
  169 |   expect(railBounds.width).toBeGreaterThan(0);
  170 |   expect(railBounds.height).toBeGreaterThan(0);
  171 |   const focusedRailIsTopmost = await page.evaluate(({ x, y }) => {
  172 |     const railElement = document.querySelector<HTMLElement>(".learning-overlay-panel__rail");
  173 |     const topmostElement = document.elementFromPoint(x, y);
  174 |     return Boolean(railElement && topmostElement && (topmostElement === railElement || railElement.contains(topmostElement)));
  175 |   }, {
  176 |     x: railBounds.x + railBounds.width / 2,
  177 |     y: railBounds.y + railBounds.height / 2,
  178 |   });
  179 |   expect(focusedRailIsTopmost).toBe(true);
  180 | 
  181 |   const stageBounds = await requireBounds(stage, "Scene stage");
  182 |   const drawerBounds = await requireBounds(drawer, "Learning drawer");
  183 |   const outsidePoint = {
  184 |     x: stageBounds.x + stageBounds.width - 12,
  185 |     y: stageBounds.y + stageBounds.height / 2,
  186 |   };
  187 |   expect(outsidePoint.x).toBeGreaterThan(drawerBounds.x + drawerBounds.width);
  188 |   await page.mouse.move(outsidePoint.x, outsidePoint.y);
  189 |   await page.waitForTimeout(500);
  190 |   await expect(learning).toHaveAttribute("data-drawer-state", "transient");
  191 |   await expect(drawer).toBeVisible();
  192 |   await expect(rail).toBeFocused();
  193 | 
  194 |   await page.keyboard.press("Tab");
  195 |   await expect(drawer.getByRole("button", { name: "Task", exact: true })).toBeFocused();
  196 | 
  197 |   await page.keyboard.press("Escape");
  198 |   await expect(learning).toHaveAttribute("data-drawer-state", "peek");
> 199 |   await expect(drawer).not.toBeVisible();
      |                            ^ Error: expect(locator).not.toBeVisible() failed
  200 |   await expect(rail).toBeFocused();
  201 | });
  202 | 
  203 | test("guided completion updates the peek rail without auto-opening or leaving Task", async ({ page }) => {
  204 |   test.setTimeout(120_000);
  205 |   await page.setViewportSize({ width: 1440, height: 1000 });
  206 |   await page.goto("/simulator/guided/architecture-rise/rise-01");
  207 | 
  208 |   const learning = getLearningOverlay(page);
  209 |   const rail = getLearningRail(page);
  210 |   const drawer = getLearningDrawer(page);
  211 |   await expect(drawer).not.toBeVisible();
  212 |   await setStepRangeInput(page, "Rise", 12);
  213 | 
  214 |   await expect(rail).toHaveAccessibleName("Task and Feedback — Task completed");
  215 |   await expect(rail.locator(".learning-overlay-panel__completion-cue")).toBeVisible();
  216 |   await expect(drawer).not.toBeVisible();
  217 |   await expect(learning).toHaveAttribute("data-drawer-state", "peek");
  218 | 
  219 |   await rail.click();
  220 |   await expect(drawer.getByRole("button", { name: "Task", exact: true })).toHaveAttribute("aria-pressed", "true");
  221 |   await expectLearningFeedbackCompleted(page);
  222 | });
  223 | 
  224 | test("narrow layouts keep the learning surface in flow without horizontal overflow", async ({ page }) => {
  225 |   test.setTimeout(120_000);
  226 |   await page.setViewportSize({ width: 700, height: 800 });
  227 |   await page.goto("/simulator/free/shelf-swing");
  228 | 
  229 |   const learning = getLearningOverlay(page);
  230 |   const rail = getLearningRail(page);
  231 |   const drawer = getLearningDrawer(page);
  232 |   await expect(learning).toHaveAttribute("data-drawer-state", "flow");
  233 |   await expect(drawer).toBeVisible();
  234 |   await expect(drawer).toHaveCSS("position", "static");
  235 |   await expect(rail).toHaveCSS("display", "none");
  236 |   expect(await rail.boundingBox()).toBeNull();
  237 |   await expect(drawer.getByRole("button", { name: "Keep Task and Feedback open" })).toHaveCount(0);
  238 |   await expect(drawer.getByRole("button", { name: "Close Task and Feedback" })).toHaveCount(0);
  239 |   await expect(drawer.getByRole("button", { name: "Task", exact: true })).toHaveAttribute("aria-pressed", "true");
  240 |   await expect(drawer.getByTestId("learning-overlay-task-view")).toContainText("Free practice");
  241 | 
  242 |   const taskButton = drawer.getByRole("button", { name: "Task", exact: true });
  243 |   const feedbackButton = drawer.getByRole("button", { name: "Feedback", exact: true });
  244 |   await taskButton.focus();
  245 |   await expect(taskButton).toBeFocused();
  246 |   await page.keyboard.press("Tab");
  247 |   await expect(feedbackButton).toBeFocused();
  248 | 
  249 |   const feedback = await openLearningFeedback(page);
  250 |   await expect(feedback).toContainText("Live observation");
  251 |   await expect(learning).toHaveAttribute("data-drawer-state", "flow");
  252 |   await expect(rail).toHaveCSS("display", "none");
  253 |   expect(await rail.boundingBox()).toBeNull();
  254 |   const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  255 |   expect(hasHorizontalOverflow).toBe(false);
  256 | });
  257 | 
  258 | test("desktop learning rail and Scene overlay controls keep separate visual anchors", async ({ page }) => {
  259 |   test.setTimeout(120_000);
  260 |   await page.setViewportSize({ width: 1024, height: 900 });
  261 |   await page.goto("/simulator/free/architecture-rise");
  262 |   await page.getByRole("combobox", { name: "Language" }).selectOption("zh-HK");
  263 | 
  264 |   const rail = getLearningRail(page);
  265 |   const railLabel = rail.locator(".learning-overlay-panel__rail-label");
  266 |   const trigger = page.getByRole("button", { name: "檢視疊加層", exact: true });
  267 |   const stage = page.locator(".scene-viewport-stage");
  268 |   await expect(rail).toBeVisible();
  269 |   await expect(rail).toHaveAccessibleName("開啟任務及回饋");
  270 |   await expect(railLabel).toHaveText("任務及回饋");
  271 |   await expect(railLabel).toHaveCSS("writing-mode", "vertical-rl");
  272 |   await expect(railLabel).toHaveCSS("text-orientation", "mixed");
  273 |   await expect(railLabel).toHaveCSS("transform", "none");
  274 |   await expect(trigger).toBeVisible();
  275 | 
  276 |   const railBounds = await requireBounds(rail, "Learning rail");
  277 |   const triggerBounds = await requireBounds(trigger, "View overlays trigger");
  278 |   expect(railBounds.width).toBeGreaterThan(36);
  279 |   expect(railBounds.height).toBeGreaterThan(112);
  280 |   await expect(railLabel).toHaveCSS("font-size", "12px");
  281 |   await expect(railLabel).toHaveCSS("font-weight", "800");
  282 |   const railSurface = await rail.evaluate((element) => {
  283 |     const style = getComputedStyle(element);
  284 |     return {
  285 |       borderColor: style.borderTopColor,
  286 |       backgroundImage: style.backgroundImage,
  287 |       boxShadow: style.boxShadow,
  288 |     };
  289 |   });
  290 |   expect(railSurface.borderColor).toContain("143, 234, 255");
  291 |   expect(railSurface.backgroundImage).toContain("linear-gradient");
  292 |   expect(railSurface.boxShadow).toContain("53, 200, 237");
  293 |   expect(triggerBounds.x).toBeGreaterThan(railBounds.x + railBounds.width);
  294 | 
  295 |   await trigger.click();
  296 |   await expect(trigger).toHaveAttribute("aria-expanded", "true");
  297 |   const menu = page.locator(".scene-overlay-menu__panel");
  298 |   await expect(menu).toBeVisible();
  299 |   const menuBounds = await requireBounds(menu, "View overlays menu");
```