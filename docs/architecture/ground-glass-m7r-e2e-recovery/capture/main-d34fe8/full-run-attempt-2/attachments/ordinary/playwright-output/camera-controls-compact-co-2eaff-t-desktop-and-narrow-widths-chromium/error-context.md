# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: camera-controls-compact.spec.ts >> compact common camera controls stay usable at desktop and narrow widths
- Location: src/tests/e2e/camera-controls-compact.spec.ts:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('region', { name: 'Camera Controls' }).getByRole('region', { name: 'Movement' }).getByRole('slider', { name: 'Tilt' })
    - locator resolved to <input max="10" min="-10" value="0" step="0.1" id="_r_i_" type="range" aria-label="Tilt" class="range-slider compact-range-row__slider"/>

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
                  - region "Task and Feedback" [ref=e54]:
                    - generic [ref=e55]:
                      - group "Task and Feedback views" [ref=e57]:
                        - button "Task" [pressed] [ref=e58] [cursor=pointer]
                        - button "Feedback" [ref=e59] [cursor=pointer]
                      - generic "Task" [ref=e61]:
                        - region "Task" [ref=e62]:
                          - generic [ref=e63]:
                            - generic [ref=e65]: Free practice
                            - paragraph [ref=e66]: "Explore the cumulative Architecture + Foreground problem: use Rise for framing, Tilt and Focus for focus-plane alignment, and Aperture for usable depth across the full photograph."
                            - list [ref=e67]:
                              - listitem [ref=e68]: At neutral, notice that the roof is cropped while the building base remains in frame.
                              - listitem [ref=e69]: Increase Front Rise to include the roof while keeping the camera level and the verticals parallel.
                              - listitem [ref=e70]: Use Front Tilt to rotate the plane of sharp focus toward the foreground-to-building depth.
                              - listitem [ref=e71]: Adjust Focus to place that plane through the near foreground and the useful building reference.
                              - listitem [ref=e72]: Stop down Aperture to expand usable depth around the already-aligned focus plane.
            - generic "GroundGlassColumn" [ref=e73]:
              - generic [ref=e74]:
                - generic [ref=e76]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e77]
              - generic [ref=e78]:
                - generic [ref=e80]:
                  - group "Preview" [ref=e81]:
                    - generic [ref=e82]: Preview
                    - generic [ref=e84]:
                      - generic [ref=e85]:
                        - radio "Raw Ground Glass" [checked] [ref=e86]
                        - generic [ref=e87]: Raw Ground Glass
                      - generic [ref=e88]:
                        - radio "Upright Assist" [ref=e89]
                        - generic [ref=e90]: Upright Assist
                  - group "View Options" [ref=e91]:
                    - generic [ref=e92]: View Options
                    - region "View Options" [ref=e94]:
                      - generic [ref=e96]:
                        - checkbox "Grid" [checked] [ref=e97]
                        - generic [ref=e98]: Grid
                - generic "GroundGlassViewport" [ref=e99]:
                  - generic [ref=e101]:
                    - generic [ref=e102]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e103]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 9490.0 mm focus / CoC 0.223 mm (0%)
                      - button "Focus loupe · 4× Ground Glass view" [ref=e107] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e108]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e109] [cursor=pointer]:
                    - generic [ref=e110]: open_in_new
            - generic [ref=e112]:
              - generic [ref=e113]:
                - heading "2D Geometry" [level=2] [ref=e114]
                - generic [ref=e115]:
                  - group "Geometry view" [ref=e116]:
                    - button "Side" [pressed] [ref=e117] [cursor=pointer]
                    - button "Top" [ref=e118] [cursor=pointer]
                  - group "Geometry framing" [ref=e119]:
                    - button "Fit Scene" [pressed] [ref=e120] [cursor=pointer]
                  - button "Expand 2D Geometry" [ref=e121] [cursor=pointer]:
                    - generic [ref=e122]: open_in_new
              - paragraph [ref=e123]: "Side view | Rise: 0.0 mm | Tilt: 0.0° | Swing: 0.0°"
              - img [ref=e125]:
                - generic [ref=e126]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e127]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e128]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e129]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e130]
                  - generic [ref=e132]: Optical axis
                  - generic [ref=e134]: Foreground ground
                  - generic [ref=e136]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e137]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e143]: Near foreground
                  - generic [ref=e147]: Middle foreground
                  - generic [ref=e151]: Building base
                  - generic [ref=e155]: Building middle
                - generic [ref=e157]:
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e158]
                  - generic "image-side construction line from a film edge to the lens centre" [ref=e159]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e160]
                  - generic "FOV boundary ray from a film edge through the lens centre" [ref=e161]
                  - generic [ref=e163]: Optical axis
                  - generic [ref=e165]: Foreground ground
                  - generic [ref=e167]: Building profile
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e168]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e174]: Near foreground
                  - generic [ref=e178]: Middle foreground
                  - generic [ref=e182]: Building base
                  - generic [ref=e186]: Building middle
                - generic [ref=e188]:
                  - generic [ref=e190]: Current
                  - generic [ref=e191]: Original
              - generic "Optical depth order" [ref=e192]:
                - generic [ref=e195]: Film 0 mm
                - generic [ref=e198]: Lens 152 mm
                - generic [ref=e201]: DOF limit 6.7 m
                - generic [ref=e204]: Focus 9.6 m
                - generic [ref=e207]: Far DOF > 12.8 m
            - region "Focus distribution · Focus" [ref=e209]:
              - generic [ref=e210]:
                - heading "Focus distribution" [level=4] [ref=e211]
                - 'generic "Ground Glass orientation: Raw" [ref=e212]': Raw
              - table "Focus distribution" [ref=e213]:
                - caption [ref=e214]: Focus distribution
                - rowgroup [ref=e215]:
                  - 'row "Upper centre Upper centre · Near foreground: 0% · Soft Upper centre · Middle foreground: 18% · Soft" [ref=e216]':
                    - cell [ref=e217]
                    - 'cell "Upper centre Upper centre · Near foreground: 0% · Soft Upper centre · Middle foreground: 18% · Soft" [ref=e218]':
                      - generic "Upper centre" [ref=e219]
                      - generic [ref=e220]:
                        - 'group "Upper centre · Near foreground: 0% · Soft" [ref=e221]':
                          - generic "Near foreground" [ref=e222]
                          - generic [ref=e223]:
                            - text: 0%
                            - generic [ref=e224]: —
                        - 'group "Upper centre · Middle foreground: 18% · Soft" [ref=e225]':
                          - generic "Middle foreground" [ref=e226]
                          - generic [ref=e227]:
                            - text: 18%
                            - generic [ref=e228]: —
                    - cell [ref=e229]
                  - 'row "Centre Centre · Building base: 100% · Sharp Centre · Building middle: 100% · Sharp" [ref=e230]':
                    - cell [ref=e231]
                    - 'cell "Centre Centre · Building base: 100% · Sharp Centre · Building middle: 100% · Sharp" [ref=e232]':
                      - generic "Centre" [ref=e233]
                      - generic [ref=e234]:
                        - 'group "Centre · Building base: 100% · Sharp" [ref=e235]':
                          - generic "Building base" [ref=e236]
                          - generic [ref=e237]:
                            - text: 100%
                            - generic [ref=e238]: ✓
                        - 'group "Centre · Building middle: 100% · Sharp" [ref=e239]':
                          - generic "Building middle" [ref=e240]
                          - generic [ref=e241]:
                            - text: 100%
                            - generic [ref=e242]: ✓
                    - cell [ref=e243]
                  - row [ref=e244]:
                    - cell [ref=e245]
                    - cell [ref=e246]
                    - cell [ref=e247]
          - group [ref=e250]:
            - generic "Optical Debug architecture-foreground · parallel" [ref=e251] [cursor=pointer]:
              - generic [ref=e252]: Optical Debug
              - generic [ref=e253]: architecture-foreground · parallel
        - complementary [ref=e254]:
          - generic [ref=e255]:
            - region "Camera Controls" [ref=e256]:
              - heading "Camera Controls" [level=3] [ref=e258]
              - paragraph [ref=e259]:
                - generic [ref=e260]: 🔒
                - generic [ref=e261]: Disabled for this guided task
              - generic [ref=e262]:
                - region "Movement" [ref=e264]:
                  - generic [ref=e265]:
                    - heading "Front standard" [level=4] [ref=e266]
                    - button "Help" [ref=e267] [cursor=pointer]:
                      - generic [ref=e268]: "?"
                  - generic [ref=e269]:
                    - generic [ref=e270]:
                      - generic [ref=e271]: Rise
                      - slider "Rise" [ref=e272]: "0"
                      - generic [ref=e273]: 0.0 mm
                    - generic [ref=e274]:
                      - generic [ref=e275]: Tilt
                      - slider "Tilt" [ref=e276]: "0"
                      - generic [ref=e277]: 0.0°
                    - generic [ref=e278]:
                      - generic [ref=e279]: Swing
                      - slider "Swing" [disabled] [ref=e280]: "0"
                      - generic [ref=e281]: 0.0°
                - region "Focus" [ref=e283]:
                  - heading "Focus" [level=3] [ref=e284]
                  - generic [ref=e285]:
                    - generic [ref=e286]: Focus distance
                    - slider "Focus distance" [ref=e287]: "9490"
                    - generic [ref=e288]: 9490.0 mm
                - region "Aperture" [ref=e290]:
                  - heading "Aperture" [level=3] [ref=e291]
                  - radiogroup "Aperture" [ref=e292]:
                    - generic [ref=e293] [cursor=pointer]:
                      - radio "f/5.6" [ref=e294]
                      - generic [ref=e295]: f/5.6
                    - generic [ref=e296] [cursor=pointer]:
                      - radio "f/8" [ref=e297]
                      - generic [ref=e298]: f/8
                    - generic [ref=e299] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e300]
                      - generic [ref=e301]: f/11
                    - generic [ref=e302] [cursor=pointer]:
                      - radio "f/16" [ref=e303]
                      - generic [ref=e304]: f/16
                    - generic [ref=e305] [cursor=pointer]:
                      - radio "f/22" [ref=e306]
                      - generic [ref=e307]: f/22
                    - generic [ref=e308] [cursor=pointer]:
                      - radio "f/32" [ref=e309]
                      - generic [ref=e310]: f/32
                - generic [ref=e311]:
                  - generic [ref=e312]: Reset
                  - region "Reset" [ref=e313]:
                    - button "Reset movements" [ref=e315] [cursor=pointer]
            - region "Developer Tools" [ref=e316]:
              - heading "Developer Tools" [level=3] [ref=e317]
              - generic [ref=e319]:
                - checkbox "Raw RTT — bypass DOF" [ref=e320]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | test("compact common camera controls stay usable at desktop and narrow widths", async ({ page }) => {
  4   |   for (const viewport of [
  5   |     { width: 1280, height: 800 },
  6   |     { width: 390, height: 844 },
  7   |   ]) {
  8   |     await page.setViewportSize(viewport);
  9   |     await page.goto("/simulator/free/architecture-foreground");
  10  | 
  11  |     const controls = page.getByRole("region", { name: "Camera Controls" });
  12  |     await controls.scrollIntoViewIfNeeded();
  13  |     await expect(controls.getByRole("heading", { name: "Front standard" })).toBeVisible();
  14  | 
  15  |     const workspaceLayout = await page.locator(".simulator-body").evaluate((element) => {
  16  |       const styles = getComputedStyle(element);
  17  |       const main = element.querySelector<HTMLElement>(".simulator-main")?.getBoundingClientRect();
  18  |       const aside = element.querySelector<HTMLElement>(".simulator-aside")?.getBoundingClientRect();
  19  |       return {
  20  |         gridTemplateColumns: styles.gridTemplateColumns,
  21  |         gridTemplateRows: styles.gridTemplateRows,
  22  |         main,
  23  |         aside,
  24  |       };
  25  |     });
  26  |     expect(workspaceLayout.gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
  27  |     expect(workspaceLayout.gridTemplateRows.trim().split(/\s+/)).toHaveLength(1);
  28  |     expect(workspaceLayout.main).not.toBeNull();
  29  |     expect(workspaceLayout.aside).not.toBeNull();
  30  |     expect(workspaceLayout.aside!.left).toBeGreaterThanOrEqual(workspaceLayout.main!.right - 1);
  31  |     expect(Math.abs(workspaceLayout.aside!.top - workspaceLayout.main!.top)).toBeLessThanOrEqual(1);
  32  | 
  33  |     const movement = controls.getByRole("region", { name: "Movement" });
  34  |     await expect(movement.getByRole("slider")).toHaveCount(3);
  35  |     await expect(movement.getByRole("slider", { name: /rear/i })).toHaveCount(0);
  36  | 
  37  |     const tilt = movement.getByRole("slider", { name: "Tilt" });
> 38  |     await tilt.fill("3.2");
      |                ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  39  |     await expect(tilt).toHaveValue("3.2");
  40  |     await expect(movement.locator(".compact-range-row").nth(1).locator(".compact-range-row__value")).toHaveText("3.2°");
  41  | 
  42  |     const aperture = controls.getByRole("radiogroup", { name: "Aperture" });
  43  |     await expect(aperture.getByRole("radio")).toHaveCount(6);
  44  |     await expect(aperture.getByRole("radio", { name: "f/16" })).toBeVisible();
  45  | 
  46  |     const railLayout = await controls.evaluate((element) => {
  47  |       const rail = element.getBoundingClientRect();
  48  |       return {
  49  |         right: rail.right,
  50  |         scrollWidth: element.scrollWidth,
  51  |         clientWidth: element.clientWidth,
  52  |       };
  53  |     });
  54  |     expect(railLayout.scrollWidth).toBeLessThanOrEqual(railLayout.clientWidth);
  55  | 
  56  |     const asideBounds = await page.locator(".simulator-aside").evaluate((element) => {
  57  |       const rect = element.getBoundingClientRect();
  58  |       return { left: rect.left, right: rect.right };
  59  |     });
  60  |     const rects = await controls.locator(".compact-range-row, .aperture-control__option").evaluateAll(
  61  |       (elements) => elements.map((element) => {
  62  |         const rect = element.getBoundingClientRect();
  63  |         return { left: rect.left, right: rect.right };
  64  |       }),
  65  |     );
  66  |     expect(rects.every(({ left, right }) => left >= asideBounds.left - 1 && right <= asideBounds.right + 1)).toBe(true);
  67  |   }
  68  | });
  69  | 
  70  | test("responsive workspace keeps the primary simulator wider than the controls rail", async ({ page }) => {
  71  |   for (const { viewport, maxToolbarHeight } of [
  72  |     { viewport: { width: 1440, height: 900 }, maxToolbarHeight: 40 },
  73  |     { viewport: { width: 1280, height: 800 }, maxToolbarHeight: 40 },
  74  |     { viewport: { width: 1024, height: 768 }, maxToolbarHeight: 80 },
  75  |   ]) {
  76  |     await page.setViewportSize(viewport);
  77  |     await page.goto("/simulator/free/architecture-rise");
  78  |     await page.locator(".scene-toolbar").waitFor();
  79  | 
  80  |     const layout = await page.locator(".simulator-body").evaluate((element) => {
  81  |       const main = element.querySelector<HTMLElement>(".simulator-main")?.getBoundingClientRect();
  82  |       const aside = element.querySelector<HTMLElement>(".simulator-aside")?.getBoundingClientRect();
  83  |       const sceneToolbar = element.querySelector<HTMLElement>(".scene-toolbar")?.getBoundingClientRect();
  84  |       const groundGlassToolbar = element.querySelector<HTMLElement>(".groundglass-control-groups")?.getBoundingClientRect();
  85  |       if (!main || !aside || !sceneToolbar || !groundGlassToolbar) {
  86  |         throw new Error("Responsive workspace bounds unavailable");
  87  |       }
  88  |       return {
  89  |         mainWidth: main.width,
  90  |         asideWidth: aside.width,
  91  |         sceneToolbarHeight: sceneToolbar.height,
  92  |         groundGlassToolbarHeight: groundGlassToolbar.height,
  93  |       };
  94  |     });
  95  | 
  96  |     expect(layout.asideWidth).toBeLessThan(layout.mainWidth);
  97  |     expect(layout.asideWidth).toBeLessThan(viewport.width * 0.31);
  98  |     expect(layout.sceneToolbarHeight).toBeLessThanOrEqual(maxToolbarHeight);
  99  |     expect(layout.groundGlassToolbarHeight).toBeLessThanOrEqual(maxToolbarHeight);
  100 |   }
  101 | });
  102 | 
  103 | test("camera control rows keep useful rendered tracks across rail widths", {
  104 |   tag: "@m7j-renderer-contention",
  105 | }, async ({ page }) => {
  106 |   test.setTimeout(120_000);
  107 |   await page.goto("/simulator/free/architecture-foreground");
  108 |   for (const viewport of [
  109 |     { width: 1440, height: 900 },
  110 |     { width: 1280, height: 800 },
  111 |     { width: 1133, height: 800 },
  112 |     { width: 1024, height: 768 },
  113 |     { width: 860, height: 768 },
  114 |     { width: 390, height: 844 },
  115 |     { width: 1499, height: 900 },
  116 |     { width: 1500, height: 900 },
  117 |     { width: 1501, height: 900 },
  118 |     { width: 1600, height: 900 },
  119 |     { width: 1900, height: 900 },
  120 |   ]) {
  121 |     await page.setViewportSize(viewport);
  122 | 
  123 |     const controls = page.getByRole("region", { name: "Camera Controls" });
  124 |     const rail = page.locator(".simulator-aside__scroll");
  125 |     await expect(controls).toBeVisible();
  126 |     await expect(controls.getByRole("slider", { name: "Rise" })).toBeEnabled();
  127 |     await expect(controls.getByRole("slider", { name: "Tilt" })).toBeEnabled();
  128 |     await expect(controls.getByRole("slider", { name: "Swing" })).toBeVisible();
  129 | 
  130 |     const railBounds = await rail.evaluate((element) => {
  131 |       const rect = element.getBoundingClientRect();
  132 |       return {
  133 |         left: rect.left,
  134 |         right: rect.right,
  135 |         width: rect.width,
  136 |         scrollWidth: element.scrollWidth,
  137 |         clientWidth: element.clientWidth,
  138 |       };
```