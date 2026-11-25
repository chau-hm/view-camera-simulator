# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-tilt.spec.ts >> Table Tilt Focus Distribution keeps a same-cell target stack co-equal
- Location: src/tests/e2e/table-tilt.spec.ts:143:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('focus-distribution-panel').locator('.focus-distribution-cell--stacked')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByTestId('focus-distribution-panel').locator('.focus-distribution-cell--stacked')
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
          - generic [ref=e12]: Table Tilt
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
                            - generic: 4600.0 mm focus / CoC 0.212 mm (0%)
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
                  - generic [ref=e119]: Tabletop
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
                  - generic [ref=e121]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e124]: Focus plane
                  - generic [ref=e128]: Near card
                  - generic [ref=e132]: Middle notebook
                  - generic [ref=e136]: Far chart
              - generic "Optical depth order" [ref=e138]:
                - generic [ref=e141]: Film 0 mm
                - generic [ref=e144]: Lens 155 mm
                - generic [ref=e147]: DOF limit 3.9 m
                - generic [ref=e150]: Focus 4.8 m
                - generic [ref=e153]: Far DOF 6.0 m
            - region "Focus distribution · Point focus" [ref=e155]:
              - generic [ref=e156]:
                - heading "Focus distribution" [level=4] [ref=e157]
                - 'generic "Ground Glass orientation: Raw" [ref=e158]': Raw
              - table "Focus distribution" [ref=e159]:
                - caption [ref=e160]: Focus distribution
                - rowgroup [ref=e161]:
                  - 'row "Upper centre Upper centre · Near card: 0% · Soft Upper centre · Middle notebook: 100% · Sharp · Closest point Upper centre · Far chart: 0% · Soft" [ref=e162]':
                    - cell [ref=e163]
                    - 'cell "Upper centre Upper centre · Near card: 0% · Soft Upper centre · Middle notebook: 100% · Sharp · Closest point Upper centre · Far chart: 0% · Soft" [ref=e164]':
                      - generic "Upper centre" [ref=e165]
                      - generic [ref=e166]:
                        - 'group "Upper centre · Near card: 0% · Soft" [ref=e167]':
                          - generic "Near card" [ref=e169]
                          - generic [ref=e170]:
                            - text: 0%
                            - generic [ref=e171]: —
                        - 'group "Upper centre · Middle notebook: 100% · Sharp · Closest point" [ref=e172]':
                          - generic "Middle notebook" [ref=e174]
                          - generic [ref=e175]:
                            - text: 100%
                            - generic [ref=e176]: ✓
                        - 'group "Upper centre · Far chart: 0% · Soft" [ref=e177]':
                          - generic "Far chart" [ref=e179]
                          - generic [ref=e180]:
                            - text: 0%
                            - generic [ref=e181]: —
                    - cell [ref=e182]
                  - row [ref=e183]:
                    - cell [ref=e184]
                    - cell [ref=e185]
                    - cell [ref=e186]
                  - row [ref=e187]:
                    - cell [ref=e188]
                    - cell [ref=e189]
                    - cell [ref=e190]
          - group [ref=e193]:
            - generic "Optical Debug table-tilt · parallel" [ref=e194] [cursor=pointer]:
              - generic [ref=e195]: Optical Debug
              - generic [ref=e196]: table-tilt · parallel
        - complementary [ref=e197]:
          - generic [ref=e198]:
            - region "Camera Controls" [ref=e199]:
              - heading "Camera Controls" [level=3] [ref=e201]
              - generic [ref=e202]:
                - region "Movement" [ref=e204]:
                  - generic [ref=e205]:
                    - heading "Front standard" [level=4] [ref=e206]
                    - button "Help" [ref=e207] [cursor=pointer]:
                      - generic [ref=e208]: "?"
                  - generic [ref=e209]:
                    - generic [ref=e210]:
                      - generic [ref=e211]: Rise
                      - slider "Rise" [ref=e212]: "0"
                      - generic [ref=e213]: 0.0 mm
                    - generic [ref=e214]:
                      - generic [ref=e215]: Tilt
                      - slider "Tilt" [ref=e216]: "0"
                      - generic [ref=e217]: 0.0°
                    - generic [ref=e218]:
                      - generic [ref=e219]: Swing
                      - slider "Swing" [ref=e220]: "0"
                      - generic [ref=e221]: 0.0°
                - region "Focus" [ref=e223]:
                  - heading "Focus" [level=3] [ref=e224]
                  - generic [ref=e225]:
                    - generic [ref=e226]: Focus distance
                    - slider "Focus distance" [ref=e227]: "4600"
                    - generic [ref=e228]: 4600.0 mm
                    - button "Infinity Reset" [ref=e230] [cursor=pointer]: ∞
                - region "Aperture" [ref=e232]:
                  - heading "Aperture" [level=3] [ref=e233]
                  - radiogroup "Aperture" [ref=e234]:
                    - generic [ref=e235] [cursor=pointer]:
                      - radio "f/5.6" [ref=e236]
                      - generic [ref=e237]: f/5.6
                    - generic [ref=e238] [cursor=pointer]:
                      - radio "f/8" [ref=e239]
                      - generic [ref=e240]: f/8
                    - generic [ref=e241] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e242]
                      - generic [ref=e243]: f/11
                    - generic [ref=e244] [cursor=pointer]:
                      - radio "f/16" [ref=e245]
                      - generic [ref=e246]: f/16
                    - generic [ref=e247] [cursor=pointer]:
                      - radio "f/22" [ref=e248]
                      - generic [ref=e249]: f/22
                    - generic [ref=e250] [cursor=pointer]:
                      - radio "f/32" [ref=e251]
                      - generic [ref=e252]: f/32
                - generic [ref=e253]:
                  - generic [ref=e254]: Reset
                  - region "Reset" [ref=e255]:
                    - button "Reset movements" [ref=e257] [cursor=pointer]
            - region "Developer Tools" [ref=e258]:
              - heading "Developer Tools" [level=3] [ref=e259]
              - generic [ref=e261]:
                - checkbox "Raw RTT — bypass DOF" [ref=e262]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  49  | ) => {
  50  |   const [physicalLine, traceLine] = await Promise.all([
  51  |     readProjectedLine(physical),
  52  |     readProjectedLine(trace),
  53  |   ]);
  54  |   const physicalVector = {
  55  |     x: physicalLine.x2 - physicalLine.x1,
  56  |     y: physicalLine.y2 - physicalLine.y1,
  57  |   };
  58  |   const traceVector = {
  59  |     x: traceLine.x2 - traceLine.x1,
  60  |     y: traceLine.y2 - traceLine.y1,
  61  |   };
  62  |   const denominator =
  63  |     Math.hypot(physicalVector.x, physicalVector.y) *
  64  |     Math.hypot(traceVector.x, traceVector.y);
  65  |   expect(denominator).toBeGreaterThan(0);
  66  |   const residual = Math.abs(
  67  |     physicalVector.x * traceVector.y - physicalVector.y * traceVector.x,
  68  |   ) / denominator;
  69  |   expect(residual).toBeLessThan(1e-8);
  70  | };
  71  | 
  72  | test("Table Tilt card exposes free and guided navigation", async ({ page }) => {
  73  |   await page.goto("/scenes");
  74  |   const card = tableTiltCard(page);
  75  |   await expect(card).toBeVisible();
  76  |   await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
  77  |     "href",
  78  |     "/simulator/free/table-tilt",
  79  |   );
  80  |   await expect(card.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
  81  |     "href",
  82  |     "/simulator/guided/table-tilt/tilt-01",
  83  |   );
  84  | 
  85  |   await card.getByRole("link", { name: "Start Guided Task" }).click();
  86  |   await expect(page).toHaveURL(/\/simulator\/guided\/table-tilt\/tilt-01$/);
  87  |   await openLearningDrawer(page);
  88  |   await expect(page.getByText("Align the tabletop plane of sharp focus")).toBeVisible();
  89  | });
  90  | 
  91  | test("Table Tilt Ground Glass uses one RTT surface", async ({ page }) => {
  92  |   await page.goto("/simulator/free/table-tilt");
  93  |   const viewport = page.getByLabel("GroundGlassViewport");
  94  |   await expect(viewport).toBeVisible();
  95  |   await expect(viewport.getByTestId("ground-glass-rtt")).toHaveCount(1);
  96  |   await expect(viewport.getByTestId("ground-glass-focus-ring")).toHaveCount(0);
  97  |   await expect(viewport.locator('[data-testid^="ground-glass-target-"]')).toHaveCount(0);
  98  | 
  99  |   await expect(viewport.getByTestId("ground-glass-focus-ring")).toHaveCount(0);
  100 | });
  101 | 
  102 | test("Table Tilt Focus Distribution follows the displayed Raw/Upright orientation", async ({ page }) => {
  103 |   await page.goto("/simulator/free/table-tilt");
  104 |   const panel = page.getByTestId("focus-distribution-panel");
  105 |   await expect(page.getByTestId("current-settings-readout")).toHaveCount(0);
  106 |   await expect(panel).toBeVisible();
  107 |   await expect(panel.locator("table.focus-distribution-panel__table")).toBeVisible();
  108 |   expect(await panel.evaluate((element) => element.parentElement?.classList.contains("simulator-primary-info-grid"))).toBe(false);
  109 | 
  110 |   const readTargetCell = async (targetId: string) =>
  111 |     panel.locator(`[data-focus-target-id="${targetId}"]`).evaluate((element) => {
  112 |       const cell = element.closest("td");
  113 |       const row = cell?.closest("tr");
  114 |       if (!cell || !row) throw new Error(`Target ${element.getAttribute("data-focus-target-id")} is not in a grid cell`);
  115 |       return {
  116 |         rowIndex: Array.from(row.parentElement?.children ?? []).indexOf(row),
  117 |         columnIndex: Array.from(row.children).indexOf(cell),
  118 |         label: element.getAttribute("aria-label"),
  119 |       };
  120 |     });
  121 | 
  122 |   const targetIds = ["near-cup", "mid-notebook", "far-book"];
  123 |   const rawCells = await Promise.all(targetIds.map(readTargetCell));
  124 |   await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Raw");
  125 |   expect(new Set(rawCells.map(({ rowIndex, columnIndex }) => `${rowIndex}:${columnIndex}`)).size).toBe(1);
  126 | 
  127 |   await page.getByRole("radio", { name: "Upright Assist" }).check();
  128 |   await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Upright");
  129 |   const uprightCells = await Promise.all(targetIds.map(readTargetCell));
  130 | 
  131 |   uprightCells.forEach((cell, index) => {
  132 |     expect(cell.rowIndex).toBe(2 - rawCells[index].rowIndex);
  133 |     expect(cell.columnIndex).toBe(2 - rawCells[index].columnIndex);
  134 |     expect(cell.label).toContain(["Near card", "Middle notebook", "Far chart"][index]);
  135 |     expect(cell.label?.match(/\d+%/)?.[0]).toBe(rawCells[index].label?.match(/\d+%/)?.[0]);
  136 |   });
  137 | 
  138 |   await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  139 |   await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Raw");
  140 |   await expect.poll(async () => (await readTargetCell("near-cup")).rowIndex).toBe(rawCells[0].rowIndex);
  141 | });
  142 | 
  143 | test("Table Tilt Focus Distribution keeps a same-cell target stack co-equal", async ({ page }) => {
  144 |   await page.setViewportSize({ width: 1680, height: 900 });
  145 |   await page.goto("/simulator/free/table-tilt");
  146 |   const panel = page.getByTestId("focus-distribution-panel");
  147 |   const targetIds = ["near-cup", "mid-notebook", "far-book"];
  148 | 
> 149 |   await expect(panel.locator(".focus-distribution-cell--stacked")).toHaveCount(1);
      |                                                                    ^ Error: expect(locator).toHaveCount(expected) failed
  150 |   await expect(panel.locator(".focus-distribution-panel__additional")).toHaveCount(0);
  151 |   for (const targetId of targetIds) {
  152 |     const target = panel.locator(`[data-focus-target-id="${targetId}"]`);
  153 |     await expect(target).toBeVisible();
  154 |     await expect(target.locator(".focus-distribution-cell__target-marker")).toBeVisible();
  155 |     await expect(target).toHaveAttribute("aria-label", /\d+%/);
  156 |   }
  157 | });
  158 | 
  159 | test("Table Tilt Focus Distribution stays compact when its panel is constrained", async ({ page }) => {
  160 |   await page.goto("/simulator/free/table-tilt");
  161 |   const panel = page.getByTestId("focus-distribution-panel");
  162 |   const targetIds = ["near-cup", "mid-notebook", "far-book"];
  163 | 
  164 |   const readResponsiveLayout = () =>
  165 |     panel.evaluate((element) => {
  166 |       const stackedCell = element.querySelector(".focus-distribution-cell--stacked");
  167 |       const marker = stackedCell?.querySelector(".focus-distribution-cell__target-marker");
  168 |       const cellBounds = stackedCell?.getBoundingClientRect();
  169 |       const targetRows = [...(stackedCell?.querySelectorAll("[data-focus-target-id]") ?? [])];
  170 |       return {
  171 |         panelWidth: element.getBoundingClientRect().width,
  172 |         cellHeight: cellBounds?.height ?? 0,
  173 |         targetRowHeights: targetRows.map((target) => target.getBoundingClientRect().height),
  174 |         markerDisplay: marker ? getComputedStyle(marker).display : "missing",
  175 |         horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
  176 |       };
  177 |     });
  178 | 
  179 |   for (const width of [1280, 1100, 1024, 950, 901]) {
  180 |     await page.setViewportSize({ width, height: 900 });
  181 |     await expect.poll(async () => (await readResponsiveLayout()).panelWidth).toBeLessThan(440);
  182 |     const layout = await readResponsiveLayout();
  183 |     expect(layout.cellHeight).toBeLessThan(180);
  184 |     expect(layout.targetRowHeights.every((height) => height < 60)).toBe(true);
  185 |     expect(layout.markerDisplay).toBe("none");
  186 |     expect(layout.horizontalOverflow).toBe(false);
  187 | 
  188 |     const stackedCell = panel.locator(".focus-distribution-cell--stacked");
  189 |     for (const targetId of targetIds) {
  190 |       const target = stackedCell.locator(`[data-focus-target-id="${targetId}"]`);
  191 |       await expect(target).toBeVisible();
  192 |       await expect(target).toHaveAttribute("aria-label", /\d+%/);
  193 |     }
  194 |   }
  195 | 
  196 |   await page.setViewportSize({ width: 1680, height: 900 });
  197 |   await expect.poll(async () => (await readResponsiveLayout()).panelWidth).toBeGreaterThan(440);
  198 |   const wideLayout = await readResponsiveLayout();
  199 |   expect(wideLayout.markerDisplay).not.toBe("none");
  200 |   expect(wideLayout.cellHeight).toBeLessThan(140);
  201 | });
  202 | 
  203 | test("Table Tilt Focus Loupe maps displayed centers to the pre-composite RTT crop", async ({ page }) => {
  204 |   await page.goto("/simulator/free/table-tilt?rttDiagnostics=1");
  205 |   const viewport = page.getByLabel("GroundGlassViewport");
  206 |   const stage = viewport.locator("[data-zoomed]");
  207 |   const rtt = viewport.getByTestId("ground-glass-rtt");
  208 |   await expect(stage).toBeVisible();
  209 |   await expect(rtt).toBeVisible();
  210 | 
  211 |   const readCenters = async () => ({
  212 |     displayU: Number(await stage.getAttribute("data-focus-loupe-center-u")),
  213 |     displayV: Number(await stage.getAttribute("data-focus-loupe-center-v")),
  214 |     cropU: Number(await rtt.getAttribute("data-rtt-inspection-center-u")),
  215 |     cropV: Number(await rtt.getAttribute("data-rtt-inspection-center-v")),
  216 |   });
  217 | 
  218 |   const expectCropRelation = async (mode: "raw" | "upright") => {
  219 |     await expect.poll(async () => {
  220 |       const centers = await readCenters();
  221 |       if (!Object.values(centers).every(Number.isFinite)) return false;
  222 |       const expectedU = mode === "raw" ? 1 - centers.displayU : centers.displayU;
  223 |       const expectedV = mode === "raw" ? 1 - centers.displayV : centers.displayV;
  224 |       return Math.abs(centers.cropU - expectedU) < 0.01 && Math.abs(centers.cropV - expectedV) < 0.01;
  225 |     }, { timeout: 30_000 }).toBe(true);
  226 |     return readCenters();
  227 |   };
  228 | 
  229 |   await expect(page.getByRole("radio", { name: "Raw Ground Glass" })).toBeChecked();
  230 |   await clickStageAt(page, stage, 0.25, 0.25);
  231 |   await expect(stage).toHaveAttribute("data-focus-loupe-active", "true");
  232 |   const rawCenters = await expectCropRelation("raw");
  233 |   expect(rawCenters.displayU).toBeLessThan(0.4);
  234 |   expect(rawCenters.displayV).toBeLessThan(0.4);
  235 |   expect(rawCenters.cropU).toBeGreaterThan(0.6);
  236 |   expect(rawCenters.cropV).toBeGreaterThan(0.6);
  237 | 
  238 |   await viewport.getByRole("button", { name: "Reset Ground Glass view" }).click();
  239 |   await expect(stage).toHaveAttribute("data-focus-loupe-active", "false");
  240 |   await page.getByRole("radio", { name: "Upright Assist" }).check();
  241 |   await clickStageAt(page, stage, 0.75, 0.25);
  242 |   await expect(stage).toHaveAttribute("data-focus-loupe-active", "true");
  243 |   const uprightCenters = await expectCropRelation("upright");
  244 |   expect(uprightCenters.displayU).toBeGreaterThan(0.6);
  245 |   expect(uprightCenters.displayV).toBeLessThan(0.4);
  246 |   expect(uprightCenters.cropU).toBeGreaterThan(0.6);
  247 |   expect(uprightCenters.cropV).toBeLessThan(0.4);
  248 | });
  249 | 
```