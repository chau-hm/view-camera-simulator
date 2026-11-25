# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: groundglass-interaction.spec.ts >> Ground Glass interaction >> Architecture Rise: off-center anchor, drag pan, short-click preservation, and immediate re-zoom
- Location: src/tests/e2e/groundglass-interaction.spec.ts:169:3

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByLabel('GroundGlassViewport').locator('[data-zoomed]')

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
          - generic [ref=e12]: Architecture Rise
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
                            - paragraph [ref=e66]: Explore how Front Rise changes framing while the camera remains level and the whole-camera viewpoint stays fixed.
                            - list [ref=e67]:
                              - listitem [ref=e68]: Increase Front Rise to include more of the building.
                              - listitem [ref=e69]: Keep the camera body and intended film-plane orientation level; watch the parallel verticals.
                              - listitem [ref=e70]: Adjust Focus and Aperture to compare sharpness and depth of field.
            - generic "GroundGlassColumn" [ref=e71]:
              - generic [ref=e72]:
                - generic [ref=e74]: center_focus_strong
                - heading "Ground Glass" [level=2] [ref=e75]
              - generic [ref=e76]:
                - generic [ref=e78]:
                  - group "Preview" [ref=e79]:
                    - generic [ref=e80]: Preview
                    - generic [ref=e82]:
                      - generic [ref=e83]:
                        - radio "Raw Ground Glass" [checked] [ref=e84]
                        - generic [ref=e85]: Raw Ground Glass
                      - generic [ref=e86]:
                        - radio "Upright Assist" [ref=e87]
                        - generic [ref=e88]: Upright Assist
                  - group "View Options" [ref=e89]:
                    - generic [ref=e90]: View Options
                    - region "View Options" [ref=e92]:
                      - generic [ref=e94]:
                        - checkbox "Grid" [checked] [ref=e95]
                        - generic [ref=e96]: Grid
                - generic "GroundGlassViewport" [ref=e97]:
                  - generic [ref=e99]:
                    - generic [ref=e100]:
                      - button "Focus loupe · 4× Ground Glass" [ref=e101]:
                        - generic:
                          - generic: Ground glass preview
                          - generic:
                            - generic: 8890.0 mm focus / CoC 0.000 mm (100%)
                      - button "Focus loupe · 4× Ground Glass view" [active] [ref=e105] [cursor=pointer]: Focus loupe · 4×
                    - generic [ref=e106]: Ground Glass blur follows the physical optical model. Use the Focus Loupe to inspect critical focus.
                  - button "Expand Ground Glass" [ref=e107] [cursor=pointer]:
                    - generic [ref=e108]: open_in_new
            - generic [ref=e110]:
              - generic [ref=e111]:
                - heading "2D Geometry" [level=2] [ref=e112]
                - generic [ref=e113]:
                  - group "Geometry view" [ref=e114]:
                    - button "Side" [pressed] [ref=e115] [cursor=pointer]
                    - button "Top" [ref=e116] [cursor=pointer]
                  - group "Geometry framing" [ref=e117]:
                    - button "Fit Scene" [pressed] [ref=e118] [cursor=pointer]
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
                  - generic:
                    - generic "film plane"
                  - generic:
                    - generic "lens plane"
                  - generic:
                    - generic "focus plane"
                  - generic:
                    - generic "nearDof plane"
                  - generic [ref=e131]:
                    - generic "Simplified bellows connector"
                  - generic [ref=e137]: Building mid facade
              - generic "Optical depth order" [ref=e139]:
                - generic [ref=e142]: Film 0 mm
                - generic [ref=e145]: Lens 153 mm
                - generic [ref=e148]: DOF limit 6.4 m
                - generic [ref=e151]: Focus 9.0 m
                - generic [ref=e154]: Far DOF > 13.3 m
            - region "Focus distribution · Focus" [ref=e156]:
              - generic [ref=e157]:
                - heading "Focus distribution" [level=4] [ref=e158]
                - 'generic "Ground Glass orientation: Raw" [ref=e159]': Raw
              - table "Focus distribution" [ref=e160]:
                - caption [ref=e161]: Focus distribution
                - rowgroup [ref=e162]:
                  - row [ref=e163]:
                    - cell [ref=e164]
                    - cell [ref=e165]
                    - cell [ref=e166]
                  - 'row "Centre Centre · Building mid facade: 100% · Sharp" [ref=e167]':
                    - cell [ref=e168]
                    - 'cell "Centre Centre · Building mid facade: 100% · Sharp" [ref=e169]':
                      - generic "Centre" [ref=e170]
                      - 'group "Centre · Building mid facade: 100% · Sharp" [ref=e172]':
                        - generic "Building mid facade" [ref=e174]
                        - generic [ref=e175]:
                          - text: 100%
                          - generic [ref=e176]: ✓
                    - cell [ref=e177]
                  - row [ref=e178]:
                    - cell [ref=e179]
                    - cell [ref=e180]
                    - cell [ref=e181]
          - group [ref=e184]:
            - generic "Optical Debug architecture-rise · parallel" [ref=e185] [cursor=pointer]:
              - generic [ref=e186]: Optical Debug
              - generic [ref=e187]: architecture-rise · parallel
        - complementary [ref=e188]:
          - generic [ref=e189]:
            - region "Camera Controls" [ref=e190]:
              - heading "Camera Controls" [level=3] [ref=e192]
              - generic [ref=e193]:
                - region "Movement" [ref=e195]:
                  - generic [ref=e196]:
                    - heading "Front standard" [level=4] [ref=e197]
                    - button "Help" [ref=e198] [cursor=pointer]:
                      - generic [ref=e199]: "?"
                  - generic [ref=e200]:
                    - generic [ref=e201]:
                      - generic [ref=e202]: Rise
                      - slider "Rise" [ref=e203]: "0"
                      - generic [ref=e204]: 0.0 mm
                    - generic [ref=e205]:
                      - generic [ref=e206]: Tilt
                      - slider "Tilt" [ref=e207]: "0"
                      - generic [ref=e208]: 0.0°
                    - generic [ref=e209]:
                      - generic [ref=e210]: Swing
                      - slider "Swing" [ref=e211]: "0"
                      - generic [ref=e212]: 0.0°
                - region "Focus" [ref=e214]:
                  - heading "Focus" [level=3] [ref=e215]
                  - generic [ref=e216]:
                    - generic [ref=e217]: Focus distance
                    - slider "Focus distance" [ref=e218]: "8890"
                    - generic [ref=e219]: 8890.0 mm
                    - button "Infinity Reset" [ref=e221] [cursor=pointer]: ∞
                - region "Aperture" [ref=e223]:
                  - heading "Aperture" [level=3] [ref=e224]
                  - radiogroup "Aperture" [ref=e225]:
                    - generic [ref=e226] [cursor=pointer]:
                      - radio "f/5.6" [ref=e227]
                      - generic [ref=e228]: f/5.6
                    - generic [ref=e229] [cursor=pointer]:
                      - radio "f/8" [ref=e230]
                      - generic [ref=e231]: f/8
                    - generic [ref=e232] [cursor=pointer]:
                      - radio "f/11" [checked] [ref=e233]
                      - generic [ref=e234]: f/11
                    - generic [ref=e235] [cursor=pointer]:
                      - radio "f/16" [ref=e236]
                      - generic [ref=e237]: f/16
                    - generic [ref=e238] [cursor=pointer]:
                      - radio "f/22" [ref=e239]
                      - generic [ref=e240]: f/22
                    - generic [ref=e241] [cursor=pointer]:
                      - radio "f/32" [ref=e242]
                      - generic [ref=e243]: f/32
                - generic [ref=e244]:
                  - generic [ref=e245]: Reset
                  - region "Reset" [ref=e246]:
                    - button "Reset movements" [ref=e248] [cursor=pointer]
            - region "Developer Tools" [ref=e249]:
              - heading "Developer Tools" [level=3] [ref=e250]
              - generic [ref=e252]:
                - checkbox "Raw RTT — bypass DOF" [ref=e253]
                - text: Raw RTT — bypass DOF
```

# Test source

```ts
  1  | import { expect, type Locator, type Page } from "@playwright/test";
  2  | import { ACCEPTABLE_COC_DIAMETER_MM } from "../../../core/optics/physicalSharpness";
  3  | 
  4  | export type GroundGlassPhysicalScaleReading = {
  5  |   displayWidthPx: number;
  6  |   sampledFilmWidthMm: number;
  7  |   physicalBoundaryRadiusPx: number;
  8  | };
  9  | 
  10 | /** Confirms diagnostics report the direct physical CoC-to-visible-pixel mapping. */
  11 | export const expectGroundGlassPhysicalScale = async (
  12 |   rtt: Locator,
  13 | ): Promise<GroundGlassPhysicalScaleReading> => {
  14 |   await expect(rtt).not.toHaveAttribute("data-rtt-display-blur-scale");
  15 |   const reading = await rtt.evaluate((element) => ({
  16 |     displayWidthPx: Number(element.getAttribute("data-rtt-logical-width")),
  17 |     sampledFilmWidthMm: Number(element.getAttribute("data-rtt-sampled-film-width-mm")),
  18 |     physicalBoundaryRadiusPx: Number(element.getAttribute("data-rtt-physical-boundary-blur-radius-px")),
  19 |   }));
  20 |   if (!Object.values(reading).every(Number.isFinite) || reading.displayWidthPx <= 0 || reading.sampledFilmWidthMm <= 0) {
  21 |     throw new Error(`Ground Glass physical blur diagnostics are invalid: ${JSON.stringify(reading)}`);
  22 |   }
  23 |   const expectedRadiusPx =
  24 |     ACCEPTABLE_COC_DIAMETER_MM * reading.displayWidthPx / reading.sampledFilmWidthMm / 2;
  25 |   expect(reading.physicalBoundaryRadiusPx).toBeCloseTo(expectedRadiusPx, 4);
  26 |   return reading;
  27 | };
  28 | 
  29 | export type StageTransform = {
  30 |   translateX: number;
  31 |   translateY: number;
  32 |   scaleX: number;
  33 |   scaleY: number;
  34 | };
  35 | 
  36 | export type ElementBounds = {
  37 |   x: number;
  38 |   y: number;
  39 |   width: number;
  40 |   height: number;
  41 | };
  42 | 
  43 | // Resolve and read the transformed layer afresh on every call so React remounts
  44 | // cannot leave tests inspecting a detached element.
  45 | export const readStageTransform = async (locator: Locator): Promise<StageTransform> => {
  46 |   await expect(locator).toHaveCount(1);
  47 |   await expect(locator).toBeVisible();
  48 |   return locator.evaluate((element) => {
  49 |     const transform = getComputedStyle(element).transform;
  50 |     const matrix =
  51 |       !transform || transform === "none"
  52 |         ? new DOMMatrixReadOnly()
  53 |         : new DOMMatrixReadOnly(transform);
  54 |     const result = {
  55 |       translateX: matrix.m41,
  56 |       translateY: matrix.m42,
  57 |       scaleX: matrix.a,
  58 |       scaleY: matrix.d,
  59 |     };
  60 |     if (!Object.values(result).every(Number.isFinite)) {
  61 |       throw new Error(`Ground Glass transform contains non-finite values: ${transform}`);
  62 |     }
  63 |     return result;
  64 |   });
  65 | };
  66 | 
  67 | export const readFreshElementBounds = async (locator: Locator): Promise<ElementBounds> => {
  68 |   await expect(locator).toHaveCount(1);
  69 |   await expect(locator).toBeVisible();
> 70 |   return locator.evaluate((element) => {
     |                  ^ Error: locator.evaluate: Test timeout of 120000ms exceeded.
  71 |     const rect = element.getBoundingClientRect();
  72 |     const bounds = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  73 |     if (!Object.values(bounds).every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
  74 |       throw new Error(`Element has invalid bounds: ${JSON.stringify(bounds)}`);
  75 |     }
  76 |     return bounds;
  77 |   });
  78 | };
  79 | 
  80 | export const clickStageAt = async (
  81 |   page: Page,
  82 |   stage: Locator,
  83 |   xRatio: number,
  84 |   yRatio: number,
  85 | ): Promise<ElementBounds> => {
  86 |   const bounds = await readFreshElementBounds(stage);
  87 |   await page.mouse.click(
  88 |     bounds.x + bounds.width * xRatio,
  89 |     bounds.y + bounds.height * yRatio,
  90 |   );
  91 |   return bounds;
  92 | };
  93 | 
```