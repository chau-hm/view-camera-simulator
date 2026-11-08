# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scene-switching.spec.ts >> public SPA scene switching keeps one current scene and its RTT renderer channels without reloads
- Location: src/tests/e2e/scene-switching.spec.ts:57:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('scene-canvas')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByTestId('scene-canvas')
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
          - generic [ref=e12]: Lesson 0 — Meet the View Camera
          - generic [ref=e13]: Lesson
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
                        - button "Scene" [ref=e35] [cursor=pointer]
                        - button "Camera" [pressed] [ref=e36] [cursor=pointer]
                  - generic [ref=e37]:
                    - generic [ref=e38]: Render quality
                    - combobox "Render quality" [ref=e39]:
                      - option "High" [selected]
                      - option "Standard"
                      - option "Low"
                - button "Expand 3D Scene" [ref=e47] [cursor=pointer]:
                  - generic [ref=e48]: open_in_new
            - generic "GroundGlassColumn" [ref=e49]:
              - generic [ref=e50]:
                - generic [ref=e52]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e53]
              - generic [ref=e54]:
                - generic [ref=e56]:
                  - group "Preview" [ref=e57]:
                    - generic [ref=e58]: Preview
                    - generic [ref=e60]:
                      - generic [ref=e61]:
                        - radio "Raw Ground Glass" [checked] [ref=e62]
                        - generic [ref=e63]: Raw Ground Glass
                      - generic [ref=e64]:
                        - radio "Upright Assist" [ref=e65]
                        - generic [ref=e66]: Upright Assist
                  - group "View Options" [ref=e67]:
                    - generic [ref=e68]: View Options
                    - region "View Options" [ref=e70]:
                      - generic [ref=e72]:
                        - checkbox "Grid" [checked] [ref=e73]
                        - generic [ref=e74]: Grid
                - generic "GroundGlassViewport" [ref=e75]:
                  - generic [ref=e77]:
                    - generic [ref=e78]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e79]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 2000.0 mm focus
                      - button "Focus loupe · 4× Ground Glass view" [ref=e83] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e84]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e85] [cursor=pointer]:
                    - generic [ref=e86]: open_in_new
        - complementary [ref=e87]:
          - region "The complete camera" [ref=e89]:
            - generic [ref=e90]:
              - paragraph [ref=e91]: Lesson 0 · Meet the View Camera
              - paragraph [ref=e92]: Step 1 of 20
            - generic [ref=e93]:
              - heading "The complete camera" [level=3] [ref=e94]
              - paragraph [ref=e95]: A view camera is built from two standards connected by flexible bellows. The front carries the lens; the rear carries the focusing or recording back.
              - paragraph [ref=e96]: Use the three-quarter view to see how the front, bellows, rear, and support fit together.
            - generic [ref=e97]:
              - button "Previous" [disabled] [ref=e98]
              - button "Next" [ref=e99] [cursor=pointer]
            - generic [ref=e100]:
              - button "Restart lesson" [ref=e101] [cursor=pointer]
              - link "Back to Scenes" [ref=e102] [cursor=pointer]:
                - /url: /scenes
```

# Test source

```ts
  10  | const isAllowedEnvironmentConsoleMessage = (message: string) =>
  11  |   /GL Driver Message .*GPU stall due to ReadPixels/.test(message);
  12  |
  13  | const discoverPublicSceneVisits = async (page: Page): Promise<SceneVisit[]> => {
  14  |   const hrefs = await page
  15  |     .locator("article.scene-feature-card a.btn--primary")
  16  |     .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  17  |
  18  |   expect(hrefs.length, "the public scene listing should expose at least one scene").toBeGreaterThan(0);
  19  |
  20  |   const visits = hrefs.map((href, linkIndex) => {
  21  |     expect(href, `public scene link ${linkIndex} must have an href`).toBeTruthy();
  22  |     if (!href) throw new Error(`Public scene link ${linkIndex} has no href`);
  23  |
  24  |     const route = new URL(href, page.url());
  25  |     const match = route.pathname.match(/^\/simulator\/free\/([^/]+)$/);
  26  |     expect(match, `unexpected public scene route: ${href}`).not.toBeNull();
  27  |     if (!match) throw new Error(`Unexpected public scene route: ${href}`);
  28  |
  29  |     return {
  30  |       sceneId: decodeURIComponent(match[1]),
  31  |       href,
  32  |       linkIndex,
  33  |     };
  34  |   });
  35  |
  36  |   const sceneIds = visits.map(({ sceneId }) => sceneId);
  37  |   expect(new Set(sceneIds).size, "public scene links must have unique scene IDs").toBe(
  38  |     sceneIds.length,
  39  |   );
  40  |
  41  |   return visits;
  42  | };
  43  |
  44  | const openPublicScene = async (page: Page, visit: SceneVisit) => {
  45  |   const link = page.locator("article.scene-feature-card a.btn--primary").nth(visit.linkIndex);
  46  |   await expect(link).toHaveCount(1);
  47  |   await expect(link).toHaveAttribute("href", visit.href);
  48  |   await link.click();
  49  |   const expectedRoute = new URL(visit.href, page.url());
  50  |   await expect(page).toHaveURL(
  51  |     (actualRoute) =>
  52  |       actualRoute.pathname === expectedRoute.pathname &&
  53  |       actualRoute.search === expectedRoute.search,
  54  |   );
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
> 110 |     await expect(sceneCanvas).toHaveCount(1);
      |                               ^ Error: expect(locator).toHaveCount(expected) failed
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
  155 |     previousSceneCanvas = await sceneCanvas.elementHandle();
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