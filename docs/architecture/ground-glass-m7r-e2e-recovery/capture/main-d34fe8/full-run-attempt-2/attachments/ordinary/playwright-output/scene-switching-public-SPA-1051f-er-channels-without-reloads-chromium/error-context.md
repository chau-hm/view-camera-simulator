# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scene-switching.spec.ts >> public SPA scene switching keeps one current scene and its RTT renderer channels without reloads
- Location: src/tests/e2e/scene-switching.spec.ts:57:1

# Error details

```
Test timeout of 480000ms exceeded.
```

```
Error: locator.elementHandle: Test timeout of 480000ms exceeded.
Call log:
  - waiting for getByTestId('scene-canvas')
    - locator resolved to visible <div data-view-focus="scene" data-testid="scene-canvas" data-focus-overlay-vertices="4" data-dof-overlay-visible="true" data-image-circle-visible="true" data-image-circle-ray-count="12" data-scheimpflug-line-points="0" data-far-dof-overlay-vertices="4" data-focus-overlay-visible="true" data-lens-coverage-visible="true" data-lens-coverage-ray-count="12" data-observer-three-revision="187" data-near-dof-overlay-vertices="4" data-scheimpflug-film-vertices="0" data-scheimpflug-lens-vertices="0" data-sch…>…</div>

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
          - generic [ref=e12]: Oblique Macro Plane
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
                            - generic: 400.0 mm focus / CoC 0.552 mm (0%)
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
                    - button "Scheimpflug Section" [ref=e102] [cursor=pointer]
                  - group "Geometry framing" [ref=e103]:
                    - button "Fit Scene" [pressed] [ref=e104] [cursor=pointer]
                    - button "Fit Construction" [disabled] [ref=e105]
                  - button "Expand 2D Geometry" [ref=e106] [cursor=pointer]:
                    - generic [ref=e107]: open_in_new
              - paragraph [ref=e108]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e110]:
                - generic [ref=e111]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e112]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e113]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e114]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e115]
                  - generic [ref=e117]: Optical axis
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
                  - generic [ref=e119]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e125]: Near planar detail
                  - generic [ref=e129]: Middle planar detail
                  - generic [ref=e133]: Far planar detail
                - generic [ref=e135]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e136]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e137]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e138]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e139]
                  - generic [ref=e141]: Optical axis
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
                  - generic [ref=e143]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e149]: Near planar detail
                  - generic [ref=e153]: Middle planar detail
                  - generic [ref=e157]: Far planar detail
                - generic [ref=e159]:
                  - generic [ref=e161]: Current
                  - generic [ref=e162]: Original
              - generic "Optical depth order" [ref=e163]:
                - generic [ref=e166]: Film 0 mm
                - generic [ref=e169]: Lens 240 mm
                - generic [ref=e172]: DOF limit 638 mm
                - generic [ref=e175]: Focus 640 mm
                - generic [ref=e178]: Far DOF 642 mm
            - region "Focus distribution · Focus" [ref=e180]:
              - generic [ref=e181]:
                - heading "Focus distribution" [level=4] [ref=e182]
                - 'generic "Ground Glass orientation: Raw" [ref=e183]': Raw
              - table "Focus distribution" [ref=e184]:
                - caption [ref=e185]: Focus distribution
                - rowgroup [ref=e186]:
                  - 'row "Upper centre Upper centre · Near planar detail: 0% · Soft" [ref=e187]':
                    - cell [ref=e188]
                    - 'cell "Upper centre Upper centre · Near planar detail: 0% · Soft" [ref=e189]':
                      - generic "Upper centre" [ref=e190]
                      - 'group "Upper centre · Near planar detail: 0% · Soft" [ref=e192]':
                        - generic "Near planar detail" [ref=e194]
                        - generic [ref=e195]:
                          - text: 0%
                          - generic [ref=e196]: —
                    - cell [ref=e197]
                  - 'row "Centre Centre · Middle planar detail: 81% · Sharp" [ref=e198]':
                    - cell [ref=e199]
                    - 'cell "Centre Centre · Middle planar detail: 81% · Sharp" [ref=e200]':
                      - generic "Centre" [ref=e201]
                      - 'group "Centre · Middle planar detail: 81% · Sharp" [ref=e203]':
                        - generic "Middle planar detail" [ref=e205]
                        - generic [ref=e206]:
                          - text: 81%
                          - generic [ref=e207]: ✓
                    - cell [ref=e208]
                  - 'row "Lower centre Lower centre · Far planar detail: 0% · Soft" [ref=e209]':
                    - cell [ref=e210]
                    - 'cell "Lower centre Lower centre · Far planar detail: 0% · Soft" [ref=e211]':
                      - generic "Lower centre" [ref=e212]
                      - 'group "Lower centre · Far planar detail: 0% · Soft" [ref=e214]':
                        - generic "Far planar detail" [ref=e216]
                        - generic [ref=e217]:
                          - text: 0%
                          - generic [ref=e218]: —
                    - cell [ref=e219]
          - group [ref=e222]:
            - generic "Optical Debug macro-oblique-plane · parallel" [ref=e223] [cursor=pointer]:
              - generic [ref=e224]: Optical Debug
              - generic [ref=e225]: macro-oblique-plane · parallel
        - complementary [ref=e226]:
          - generic [ref=e227]:
            - region "Camera Controls" [ref=e228]:
              - heading "Camera Controls" [level=3] [ref=e230]
              - generic [ref=e231]:
                - group "Movement" [ref=e233]:
                  - generic [ref=e234]: Movement
                  - radiogroup "Movement" [ref=e235]:
                    - generic [ref=e236]:
                      - radio "Front Tilt" [checked] [ref=e237]
                      - text: Front Tilt
                - generic [ref=e239]:
                  - generic [ref=e240]: Front Tilt (0.0°)
                  - slider "Front Tilt" [ref=e241]: "0"
                - region "Focus" [ref=e243]:
                  - heading "Focus" [level=3] [ref=e244]
                  - generic [ref=e245]:
                    - generic [ref=e246]: Focus distance
                    - slider "Focus distance" [ref=e247]: "400"
                    - generic [ref=e248]: 400.0 mm
                - region "Aperture" [ref=e250]:
                  - heading "Aperture" [level=3] [ref=e251]
                  - radiogroup "Aperture" [disabled] [ref=e252]:
                    - generic [ref=e253]:
                      - radio "f/5.6" [checked] [disabled] [ref=e254]
                      - generic [ref=e255]: f/5.6
                    - generic [ref=e256]:
                      - radio "f/8" [disabled] [ref=e257]
                      - generic [ref=e258]: f/8
                    - generic [ref=e259]:
                      - radio "f/11" [disabled] [ref=e260]
                      - generic [ref=e261]: f/11
                    - generic [ref=e262]:
                      - radio "f/16" [disabled] [ref=e263]
                      - generic [ref=e264]: f/16
                    - generic [ref=e265]:
                      - radio "f/22" [disabled] [ref=e266]
                      - generic [ref=e267]: f/22
                    - generic [ref=e268]:
                      - radio "f/32" [disabled] [ref=e269]
                      - generic [ref=e270]: f/32
                  - generic [ref=e271]: Aperture is fixed for this lesson
                - generic [ref=e272]:
                  - generic [ref=e273]: Reset
                  - region "Reset" [ref=e274]:
                    - button "Reset movements" [ref=e276] [cursor=pointer]
            - region "Developer Tools" [ref=e277]:
              - heading "Developer Tools" [level=3] [ref=e278]
              - generic [ref=e280]:
                - checkbox "Raw RTT — bypass DOF" [ref=e281]
                - text: Raw RTT — bypass DOF
          - region "Macro focus" [ref=e283]:
            - heading "Macro focus" [level=3] [ref=e284]
            - generic [ref=e285]:
              - generic [ref=e286]:
                - term [ref=e287]: Bellows extension (lens to film)
                - definition [ref=e288]: 240.0 mm
              - generic [ref=e289]:
                - term [ref=e290]: Magnification
                - definition [ref=e291]: 0.60×
              - generic [ref=e292]:
                - term [ref=e293]: Bellows factor
                - definition [ref=e294]: 2.56×
              - generic [ref=e295]:
                - term [ref=e296]: Exposure compensation
                - definition [ref=e297]: +1.36 stops
            - generic [ref=e298]: At the selected focus plane. Exposure compensation assumes a symmetric thin lens.
```

# Test source

```ts
  55  | };
  56  | 
  57  | test("public SPA scene switching keeps one current scene and its RTT renderer channels without reloads", async ({ page }) => {
  58  |   test.setTimeout(480_000);
  59  |   const pageErrors: string[] = [];
  60  |   const consoleProblems: string[] = [];
  61  |   page.on("pageerror", (error) => pageErrors.push(error.message));
  62  |   page.on("console", (message) => {
  63  |     if (isKnownFiberClockDeprecation(message)) return;
  64  |     if ((message.type() === "error" || message.type() === "warning") && !isAllowedEnvironmentConsoleMessage(message.text())) {
  65  |       consoleProblems.push(message.text());
  66  |     }
  67  |   });
  68  | 
  69  |   await page.addInitScript(() => {
  70  |     (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken =
  71  |       `${Date.now()}-${Math.random()}`;
  72  |   });
  73  |   await page.goto("/scenes");
  74  |   const visits = await discoverPublicSceneVisits(page);
  75  |   const discoveredSceneIds = visits.map(({ sceneId }) => sceneId);
  76  |   const documentToken = await page.evaluate(
  77  |     () => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken,
  78  |   );
  79  |   expect(documentToken).toBeTruthy();
  80  | 
  81  |   let previousSceneCanvas: ElementHandle<Element> | null = null;
  82  |   let previousGroundGlasses: ElementHandle<Node>[] = [];
  83  |   let previousSanityState: string | null = null;
  84  |   let previousSceneId: string | null = null;
  85  |   const seenRttOwnerIds = new Set<string>();
  86  |   const seenRendererGenerationIds = new Set<string>();
  87  |   const visitedSceneIds = new Set<string>();
  88  | 
  89  |   for (const visit of visits) {
  90  |     expect(visitedSceneIds.has(visit.sceneId), `scene ${visit.sceneId} should be visited once`).toBe(false);
  91  |     visitedSceneIds.add(visit.sceneId);
  92  |     await openPublicScene(page, visit);
  93  |     await expect
  94  |       .poll(() => page.evaluate(() => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken))
  95  |       .toBe(documentToken);
  96  | 
  97  |     // Opt-in diagnostics without navigation
  98  |     await page.evaluate(() => {
  99  |       const url = new URL(window.location.href);
  100 |       url.searchParams.set("rttDiagnostics", "1");
  101 |       window.history.replaceState(window.history.state, "", url);
  102 |     });
  103 |     await expect
  104 |       .poll(() => page.evaluate(() => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken))
  105 |       .toBe(documentToken);
  106 | 
  107 |     const sceneCanvas = page.getByTestId("scene-canvas");
  108 |     const groundGlassPanes = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  109 |     const groundGlass = groundGlassPanes;
  110 |     await expect(sceneCanvas).toHaveCount(1);
  111 |     await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", visit.sceneId);
  112 |     await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  113 |     await expect(groundGlassPanes).toHaveCount(1);
  114 |     await expect(groundGlassPanes.locator("canvas")).toHaveCount(1);
  115 | 
  116 |     // Use dedicated scene-id attribute instead of parsing internal cache key
  117 |     for (const pane of await groundGlassPanes.all()) {
  118 |       await expect(pane).toHaveAttribute("data-rtt-scene-id", visit.sceneId, { timeout: 60_000 });
  119 |       await expect(pane).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  120 |       await expect(pane).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 60_000 });
  121 |       await expect(pane).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  122 |       await expect(pane).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  123 |       await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  124 |       await expect(pane).toHaveAttribute("data-actual-execution-api", /^webgl2?$/);
  125 |       await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready");
  126 |       await expect(pane).toHaveAttribute("data-frame-result-status", "completed");
  127 |       const acceptedRequestId = await pane.getAttribute("data-frame-request-id");
  128 |       expect(acceptedRequestId).toBeTruthy();
  129 |       await expect(pane).toHaveAttribute("data-last-completed-request-id", acceptedRequestId!);
  130 |     }
  131 |     await expect(groundGlass).toHaveAttribute("data-rtt-owner-id", /^ground-glass-rtt-owner-/, { timeout: 60_000 });
  132 |     await expect(groundGlass).toHaveAttribute("data-rtt-resource-generation", /^[1-9]\d*$/, { timeout: 60_000 });
  133 |     const rttOwnerId = await groundGlass.getAttribute("data-rtt-owner-id");
  134 |     expect(rttOwnerId).toBeTruthy();
  135 |     expect(seenRttOwnerIds.has(rttOwnerId!)).toBe(false);
  136 |     seenRttOwnerIds.add(rttOwnerId!);
  137 |     const rendererGenerationId = await groundGlass.getAttribute("data-renderer-generation");
  138 |     expect(rendererGenerationId).toBeTruthy();
  139 |     expect(seenRendererGenerationIds.has(rendererGenerationId!)).toBe(false);
  140 |     seenRendererGenerationIds.add(rendererGenerationId!);
  141 |     const sanityState = await groundGlass.getAttribute("data-rtt-sanity-state");
  142 |     expect(sanityState).toBeTruthy();
  143 |     if (previousSceneId && previousSceneId !== visit.sceneId) {
  144 |       expect(sanityState).not.toBe(previousSanityState);
  145 |     }
  146 |     const priorSceneCanvas = previousSceneCanvas;
  147 |     if (priorSceneCanvas) {
  148 |       await expect.poll(() => page.evaluate((node) => !node.isConnected, priorSceneCanvas)).toBe(true);
  149 |     }
  150 |     for (const priorPane of previousGroundGlasses) {
  151 |       await expect.poll(() => page.evaluate((node) => !node.isConnected, priorPane)).toBe(true);
  152 |     }
  153 |     previousSanityState = sanityState;
  154 |     previousSceneId = visit.sceneId;
> 155 |     previousSceneCanvas = await sceneCanvas.elementHandle();
      |                                             ^ Error: locator.elementHandle: Test timeout of 480000ms exceeded.
  156 |     previousGroundGlasses = await groundGlassPanes.elementHandles();
  157 |     expect(previousSceneCanvas).toBeTruthy();
  158 | 
  159 |     await page.getByRole("link", { name: "All Scenes" }).click();
  160 |     await expect(page).toHaveURL(/\/scenes$/);
  161 |     await expect
  162 |       .poll(() => page.evaluate(() => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken))
  163 |       .toBe(documentToken);
  164 |     const detachedSceneCanvas = previousSceneCanvas;
  165 |     if (detachedSceneCanvas) {
  166 |       await expect.poll(() => page.evaluate((node) => !node.isConnected, detachedSceneCanvas)).toBe(true);
  167 |     }
  168 |     for (const detachedPane of previousGroundGlasses) {
  169 |       await expect.poll(() => page.evaluate((node) => !node.isConnected, detachedPane)).toBe(true);
  170 |     }
  171 |   }
  172 | 
  173 |   expect([...visitedSceneIds].sort()).toEqual([...discoveredSceneIds].sort());
  174 |   expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  175 |   expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
  176 | });
  177 | 
```