# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ground-glass-dof-profiling.spec.ts >> profiling preserves Raw RTT bypass and can be disabled
- Location: src/tests/e2e/ground-glass-dof-profiling.spec.ts:211:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('ground-glass-rtt')
Expected: "true"
Received: ""
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('ground-glass-rtt')
    2 × locator resolved to <div data-three-revision="187" data-rtt-channel="default" data-testid="ground-glass-rtt" data-pilot-retry-status="none" data-frame-channel-id="default" data-frame-result-status="pending" data-policy-selected-backend="webgl" data-application-fallback="not-observed" data-render-host-lifecycle="initializing" data-render-cleanup-status="not-required" data-rtt-scene-id="architecture-foreground" data-frame-scene-id="architecture-foreground" data-frame-request-id="gg-mw5sivua-xeem3lh76ed-default-request-2…>…</div>
      - unexpected value "null"

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
  80  | };
  81  | 
  82  | const profileReadiness = (
  83  |   snapshot: ProfileSnapshot,
  84  |   rawDebug: boolean,
  85  | ): ProfileReadiness => {
  86  |   const expectedPasses = rawDebug
  87  |     ? ["sceneRenderMs", "compositeMs"] as const
  88  |     : ["sceneRenderMs", "cocFootprintMs", "farGatherMs", "nearGatherMs", "compositeMs"] as const;
  89  |   const passWindowsPopulated = expectedPasses.every((pass) =>
  90  |     (snapshot.passes[pass]?.count ?? 0) > 0,
  91  |   );
  92  | 
  93  |   if (snapshot.rawDebug !== rawDebug) return "waiting";
  94  |   if (snapshot.profilingBackend === "cpu-fallback") {
  95  |     const groundGlass = snapshot.groundGlassCpuSubmit?.count ?? 0;
  96  |     const physicalDof = snapshot.physicalDofCpuSubmit?.count ?? 0;
  97  |     return groundGlass > 0 && (rawDebug || physicalDof > 0) && passWindowsPopulated
  98  |       ? "ready"
  99  |       : "waiting";
  100 |   }
  101 |   if (snapshot.profilingBackend !== "gpu-query") return "waiting";
  102 | 
  103 |   if (snapshot.profilingDiagnostics.gpuQueryState === "active") {
  104 |     const groundGlass = snapshot.groundGlassGpu?.count ?? 0;
  105 |     const physicalDof = snapshot.physicalDofGpu?.count ?? 0;
  106 |     return groundGlass > 0 &&
  107 |       (rawDebug || physicalDof > 0) &&
  108 |       snapshot.profilingDiagnostics.framesCompletedGpu > 0 &&
  109 |       passWindowsPopulated
  110 |       ? "ready"
  111 |       : "waiting";
  112 |   }
  113 |   return hasExplicitGpuDegradedState(snapshot) ? "degraded" : "waiting";
  114 | };
  115 | 
  116 | const expectBackendTimingSamples = (
  117 |   snapshot: ProfileSnapshot,
  118 |   rawDebug: boolean,
  119 | ) => {
  120 |   const expectedPasses = rawDebug
  121 |     ? ["sceneRenderMs", "compositeMs"] as const
  122 |     : ["sceneRenderMs", "cocFootprintMs", "farGatherMs", "nearGatherMs", "compositeMs"] as const;
  123 | 
  124 |   if (snapshot.profilingBackend === "cpu-fallback") {
  125 |     expect(snapshot.groundGlassCpuSubmit?.count).toBeGreaterThan(0);
  126 |     if (rawDebug) {
  127 |       expect(snapshot.physicalDofCpuSubmit).toBeNull();
  128 |     } else {
  129 |       expect(snapshot.physicalDofCpuSubmit?.count).toBeGreaterThan(0);
  130 |     }
  131 |     expectedPasses.forEach((pass) => {
  132 |       expect(snapshot.passes[pass]?.count).toBeGreaterThan(0);
  133 |     });
  134 |   } else {
  135 |     const state = snapshot.profilingDiagnostics.gpuQueryState;
  136 |     if (state === "active") {
  137 |       expect(snapshot.groundGlassGpu?.count).toBeGreaterThan(0);
  138 |       if (rawDebug) {
  139 |         expect(snapshot.physicalDofGpu).toBeNull();
  140 |       } else {
  141 |         expect(snapshot.physicalDofGpu?.count).toBeGreaterThan(0);
  142 |       }
  143 |       expect(snapshot.profilingDiagnostics.framesCompletedGpu).toBeGreaterThan(0);
  144 |       expectedPasses.forEach((pass) => {
  145 |         expect(snapshot.passes[pass]?.count).toBeGreaterThan(0);
  146 |       });
  147 |     } else {
  148 |       expect(["stalled", "disjoint", "error"]).toContain(state);
  149 |       expect(hasExplicitGpuDegradedState(snapshot)).toBe(true);
  150 |     }
  151 |   }
  152 |   if (rawDebug) {
  153 |     expect(snapshot.passes.cocFootprintMs).toBeNull();
  154 |     expect(snapshot.passes.farGatherMs).toBeNull();
  155 |     expect(snapshot.passes.nearGatherMs).toBeNull();
  156 |     expect(snapshot.physicalDofGpu).toBeNull();
  157 |     expect(snapshot.physicalDofCpuSubmit).toBeNull();
  158 |   }
  159 | };
  160 | 
  161 | const waitForProfileContract = async (
  162 |   page: import("@playwright/test").Page,
  163 |   rawDebug: boolean,
  164 | ): Promise<void> => {
  165 |   await expect.poll(
  166 |     async () => {
  167 |       const snapshot = await readProfileSnapshotIfAvailable(page);
  168 |       return snapshot ? profileReadiness(snapshot, rawDebug) : "waiting";
  169 |     },
  170 |     { timeout: 120_000, intervals: [250, 500, 1_000] },
  171 |   ).toMatch(/^(ready|degraded)$/);
  172 | };
  173 | 
  174 | const expectPopulatedProfile = async (
  175 |   page: import("@playwright/test").Page,
  176 |   sceneId: string,
  177 | ) => {
  178 |   const rtt = page.getByTestId("ground-glass-rtt");
  179 |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", sceneId);
> 180 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-enabled", "true");
      |                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  181 |   await expect(rtt).toHaveAttribute(
  182 |     "data-rtt-profiling-backend",
  183 |     /^(gpu-query|cpu-fallback)$/,
  184 |   );
  185 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-frame-count", /[1-9]\d*/, {
  186 |     timeout: 120_000,
  187 |   });
  188 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", {
  189 |     timeout: 120_000,
  190 |   });
  191 | 
  192 |   const frameCount = Number(await rtt.getAttribute("data-rtt-profiling-frame-count"));
  193 |   expect(Number.isFinite(frameCount)).toBe(true);
  194 |   expect(frameCount).toBeGreaterThan(0);
  195 |   await waitForProfileContract(page, false);
  196 |   const snapshot = await readProfileSnapshot(page);
  197 |   expect(snapshot.rawDebug).toBe(false);
  198 |   expectBackendTimingSamples(snapshot, false);
  199 |   await expect(page.getByTestId("ground-glass-profiling-snapshot")).not.toContainText(/NaN|Infinity/);
  200 | };
  201 | 
  202 | test("Ground Glass profiling populates finite snapshots across representative scenes", async ({ page }) => {
  203 |   test.setTimeout(240_000);
  204 | 
  205 |   for (const sceneId of profiledScenes) {
  206 |     await page.goto(`/simulator/free/${sceneId}?dofProfiling=1&rttDiagnostics=1`);
  207 |     await expectPopulatedProfile(page, sceneId);
  208 |   }
  209 | });
  210 | 
  211 | test("profiling preserves Raw RTT bypass and can be disabled", async ({ page }) => {
  212 |   test.setTimeout(180_000);
  213 |   await page.goto("/simulator/free/architecture-foreground?dofProfiling=1&rttDiagnostics=1");
  214 | 
  215 |   const rtt = page.getByTestId("ground-glass-rtt");
  216 |   await expectPopulatedProfile(page, "architecture-foreground");
  217 | 
  218 |   const rawToggle = page.getByLabel("Raw RTT — bypass DOF");
  219 |   await rawToggle.check();
  220 |   await expect(rawToggle).toBeChecked();
  221 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-raw-debug", "true", {
  222 |     timeout: 120_000,
  223 |   });
  224 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", {
  225 |     timeout: 120_000,
  226 |   });
  227 | 
  228 |   await expect(page.getByTestId("ground-glass-profiling-snapshot")).toContainText(
  229 |     '"rawDebug": true',
  230 |     { timeout: 120_000 },
  231 |   );
  232 |   await waitForProfileContract(page, true);
  233 |   const rawSnapshot = await readProfileSnapshot(page);
  234 |   expectBackendTimingSamples(rawSnapshot, true);
  235 | 
  236 |   await rawToggle.uncheck();
  237 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-raw-debug", "false", {
  238 |     timeout: 120_000,
  239 |   });
  240 |   await expect(page.getByTestId("ground-glass-profiling-snapshot")).toContainText(
  241 |     '"rawDebug": false',
  242 |     { timeout: 120_000 },
  243 |   );
  244 |   await waitForProfileContract(page, false);
  245 |   const processedSnapshot = await readProfileSnapshot(page);
  246 |   expectBackendTimingSamples(processedSnapshot, false);
  247 | 
  248 |   await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");
  249 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-enabled", "false");
  250 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-backend", "disabled");
  251 |   await expect(rtt).not.toHaveAttribute("data-rtt-profiling-frame-count", /.+/);
  252 | });
  253 | 
```