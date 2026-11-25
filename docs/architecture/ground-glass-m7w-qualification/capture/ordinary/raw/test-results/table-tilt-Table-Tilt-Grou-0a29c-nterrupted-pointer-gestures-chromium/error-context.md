# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-tilt.spec.ts >> Table Tilt Ground Glass recovers from interrupted pointer gestures
- Location: src/tests/e2e/table-tilt.spec.ts:976:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByLabel('GroundGlassViewport').locator('[data-zoomed]')
Expected: 1
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByLabel('GroundGlassViewport').locator('[data-zoomed]')
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
> 68 |   await expect(locator).toHaveCount(1);
     |                         ^ Error: expect(locator).toHaveCount(expected) failed
  69 |   await expect(locator).toBeVisible();
  70 |   return locator.evaluate((element) => {
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