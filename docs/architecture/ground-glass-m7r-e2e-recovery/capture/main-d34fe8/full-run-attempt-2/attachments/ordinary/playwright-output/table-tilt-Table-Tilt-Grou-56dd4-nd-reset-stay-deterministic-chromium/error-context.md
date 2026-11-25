# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-tilt.spec.ts >> Table Tilt Ground Glass zoom, pan, jitter, and reset stay deterministic
- Location: src/tests/e2e/table-tilt.spec.ts:906:1

# Error details

```
Error: Timeout 5000ms exceeded while waiting on the predicate
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
                      - button "Focus loupe · 4× Ground Glass" [active] [ref=e86]:
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
  782 |     .getByTestId("plane-line-focus");
  783 |   await expect(fallbackFocusLine).toHaveCount(1);
  784 |   const fallbackFocus = await readProjectedLine(fallbackFocusLine);
  785 |   expect(
  786 |     Math.hypot(
  787 |       fallbackFocus.x2 - fallbackFocus.x1,
  788 |       fallbackFocus.y2 - fallbackFocus.y1,
  789 |     ),
  790 |   ).toBeGreaterThan(1);
  791 |   for (const targetId of ["near-cup", "mid-notebook", "far-book"]) {
  792 |     await expect(page.getByTestId(`geometry-target-${targetId}`)).toBeVisible();
  793 |   }
  794 |   await setRangeDirect(page, "Tilt", 7);
  795 |   await expect(geometryPanel).toHaveAttribute("data-geometry-view", "side");
  796 |   await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  797 |   await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");
  798 | 
  799 |   await topButton.click();
  800 |   await setRangeDirect(page, "Tilt", 0);
  801 |   const topSvg = page.getByTestId("geometry-svg-top");
  802 |   const zeroSwingLens = await readProjectedLine(topSvg.getByTestId("physical-lens-segment"));
  803 |   await setRangeDirect(page, "Swing", 5);
  804 |   await expect.poll(async () => {
  805 |     const swungLens = await readProjectedLine(topSvg.getByTestId("physical-lens-segment"));
  806 |     return Math.abs(projectedSlope(swungLens) - projectedSlope(zeroSwingLens));
  807 |   }).toBeGreaterThan(0.01);
  808 |   await expectProjectedCollinearity(
  809 |     topSvg.getByTestId("physical-lens-segment"),
  810 |     topSvg.getByTestId("plane-line-lens"),
  811 |   );
  812 | });
  813 | 
  814 | test("3D overlay controls switch responsively without wrapping or blocking the scene", async ({ page }) => {
  815 |   await page.setViewportSize({ width: 1024, height: 900 });
  816 |   await page.goto("/simulator/free/table-tilt");
  817 |   const responsive = page.locator(".scene-overlay-responsive").first();
  818 |   const sceneShell = page.locator(".scene-viewport-shell");
  819 |   await expect(responsive).toHaveAttribute("data-overlay-presentation", "collapsed");
  820 |   const trigger = page.getByRole("button", { name: "View overlays" });
  821 |   await expect(trigger).toBeVisible();
  822 |   await trigger.click();
  823 |   await expect(trigger).toHaveAttribute("aria-expanded", "true");
  824 |   const menu = page.getByTestId("scene-overlay-collapsed");
  825 |   await expect(menu).toBeVisible();
  826 |   const triggerBox = await trigger.boundingBox();
  827 |   const menuBox = await menu.boundingBox();
  828 |   const shellBox = await sceneShell.boundingBox();
  829 |   if (!triggerBox || !menuBox || !shellBox) throw new Error("Overlay menu bounds were unavailable");
  830 |   expect(menuBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height);
  831 |   expect(menuBox.x).toBeGreaterThanOrEqual(shellBox.x);
  832 |   expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(shellBox.x + shellBox.width + 1);
  833 |   expect(menuBox.height).toBeLessThan(shellBox.height);
  834 |   await page.getByRole("button", { name: "Show Legends" }).click();
  835 |   await expect(page.getByRole("button", { name: "Hide Legends" })).toBeVisible();
  836 |   await expect(trigger).toHaveAttribute("aria-expanded", "true");
  837 |   await page.keyboard.press("Escape");
  838 |   await expect(trigger).toHaveAttribute("aria-expanded", "false");
  839 |   await expect(menu).toHaveCount(0);
  840 |   await expect(responsive).toHaveCSS("pointer-events", "none");
  841 |   const overlayMenu = page.locator(".scene-overlay-menu");
  842 |   await expect(overlayMenu).toHaveCSS("pointer-events", "none");
  843 |   await expect(trigger).toHaveCSS("pointer-events", "auto");
  844 | 
  845 |   await page.setViewportSize({ width: 1920, height: 1000 });
  846 |   await expect(responsive).toHaveAttribute("data-overlay-presentation", "inline");
  847 |   await expect(page.getByTestId("scene-overlay-inline")).toBeVisible();
  848 |   await expect(page.getByRole("button", { name: "View overlays" })).toHaveCount(0);
  849 |   const inline = page.getByTestId("scene-overlay-inline");
  850 |   const inlineButtons = inline.getByRole("button");
  851 |   const firstBox = await inlineButtons.first().boundingBox();
  852 |   const lastBox = await inlineButtons.last().boundingBox();
  853 |   if (!firstBox || !lastBox) throw new Error("Inline overlay controls were not measurable");
  854 |   expect(Math.abs(firstBox.y - lastBox.y)).toBeLessThan(2);
  855 | });
  856 | 
  857 | const groundGlassLocators = (page: import("@playwright/test").Page) => {
  858 |   const viewport = page.getByLabel("GroundGlassViewport");
  859 |   return {
  860 |     viewport,
  861 |     stage: viewport.locator('[data-zoomed]'),
  862 |     transformedLayer: viewport.locator(".groundglass-stage"),
  863 |   };
  864 | };
  865 | 
  866 | const expectGroundGlassIdentity = async (
  867 |   stage: import("@playwright/test").Locator,
  868 |   transformedLayer: import("@playwright/test").Locator,
  869 | ) => {
  870 |   await expect(stage).toHaveAttribute("data-zoomed", "false");
  871 |   await expect(stage).toHaveAttribute("data-pan-x", "0");
  872 |   await expect(stage).toHaveAttribute("data-pan-y", "0");
  873 |   await expect(stage).toHaveAttribute("data-scale", "1");
  874 |   await expect.poll(async () => {
  875 |     const transform = await readStageTransform(transformedLayer);
  876 |     return (
  877 |       Math.abs(transform.translateX) <= 0.5 &&
  878 |       Math.abs(transform.translateY) <= 0.5 &&
  879 |       Math.abs(transform.scaleX - 1) <= 0.01 &&
  880 |       Math.abs(transform.scaleY - 1) <= 0.01
  881 |     );
> 882 |   }).toBe(true);
      |      ^ Error: Timeout 5000ms exceeded while waiting on the predicate
  883 | };
  884 | 
  885 | const zoomGroundGlassAt = async (
  886 |   page: import("@playwright/test").Page,
  887 |   stage: import("@playwright/test").Locator,
  888 |   xRatio = 0.25,
  889 |   yRatio = 0.25,
  890 | ) => {
  891 |   const bounds = await clickStageAt(page, stage, xRatio, yRatio);
  892 |   await expect(stage).toHaveAttribute("data-zoomed", "true");
  893 |   return bounds;
  894 | };
  895 | 
  896 | const boxesOverlap = (
  897 |   first: Awaited<ReturnType<typeof readFreshElementBounds>>,
  898 |   second: Awaited<ReturnType<typeof readFreshElementBounds>>,
  899 | ) => !(
  900 |   first.x + first.width <= second.x ||
  901 |   second.x + second.width <= first.x ||
  902 |   first.y + first.height <= second.y ||
  903 |   second.y + second.height <= first.y
  904 | );
  905 | 
  906 | test("Table Tilt Ground Glass zoom, pan, jitter, and reset stay deterministic", async ({ page }) => {
  907 |   test.setTimeout(150_000);
  908 |   await page.goto("/simulator/free/table-tilt");
  909 |   const { viewport, stage, transformedLayer } = groundGlassLocators(page);
  910 |   await expect(viewport.getByTestId("ground-glass-rtt")).toBeVisible();
  911 |   await expectGroundGlassIdentity(stage, transformedLayer);
  912 | 
  913 |   const bounds = await zoomGroundGlassAt(page, stage, 0.25, 0.25);
  914 |   await expect(stage).toHaveAttribute("data-focus-loupe-scale", "4");
  915 |   await expect(stage).toHaveAttribute("data-presentation-css-scale", "1");
  916 |   const centerX = bounds.x + bounds.width / 2;
  917 |   const centerY = bounds.y + bounds.height / 2;
  918 |   const inspectionPanBeforeDrag = {
  919 |     x: await stage.getAttribute("data-inspection-pan-x"),
  920 |     y: await stage.getAttribute("data-inspection-pan-y"),
  921 |   };
  922 |   await page.mouse.move(centerX, centerY);
  923 |   await page.mouse.down();
  924 |   await page.mouse.move(centerX + 30, centerY + 20, { steps: 4 });
  925 |   await page.mouse.up();
  926 |   await expect(stage).toHaveAttribute("data-zoomed", "true");
  927 |   const inspectionPanAfterDrag = {
  928 |     x: await stage.getAttribute("data-inspection-pan-x"),
  929 |     y: await stage.getAttribute("data-inspection-pan-y"),
  930 |   };
  931 |   expect(
  932 |     inspectionPanAfterDrag.x !== inspectionPanBeforeDrag.x ||
  933 |       inspectionPanAfterDrag.y !== inspectionPanBeforeDrag.y,
  934 |   ).toBe(true);
  935 | 
  936 |   const panBeforeShortPress = {
  937 |     x: await stage.getAttribute("data-inspection-pan-x"),
  938 |     y: await stage.getAttribute("data-inspection-pan-y"),
  939 |   };
  940 |   await page.mouse.move(centerX, centerY);
  941 |   await page.mouse.down();
  942 |   await page.mouse.move(centerX + 4, centerY + 3);
  943 |   await page.mouse.up();
  944 |   await expect(stage).toHaveAttribute("data-zoomed", "true");
  945 |   const panAfterShortPress = {
  946 |     x: await stage.getAttribute("data-inspection-pan-x"),
  947 |     y: await stage.getAttribute("data-inspection-pan-y"),
  948 |   };
  949 |   expect(panAfterShortPress).toEqual(panBeforeShortPress);
  950 | 
  951 |   await viewport.getByRole("button", { name: "Reset Ground Glass view" }).click();
  952 |   await expectGroundGlassIdentity(stage, transformedLayer);
  953 |   await zoomGroundGlassAt(page, stage, 0.8, 0.7);
  954 |   await expect
  955 |     .poll(async () => {
  956 |       const centerU = Number(await stage.getAttribute("data-focus-loupe-center-u"));
  957 |       const centerV = Number(await stage.getAttribute("data-focus-loupe-center-v"));
  958 |       return centerU > 0.5 && centerV > 0.5;
  959 |     })
  960 |     .toBe(true);
  961 |   const freshBounds = await readFreshElementBounds(stage);
  962 |   const freshCenterX = freshBounds.x + freshBounds.width / 2;
  963 |   const freshCenterY = freshBounds.y + freshBounds.height / 2;
  964 |   await page.mouse.move(freshCenterX, freshCenterY);
  965 |   await page.mouse.down();
  966 |   await page.mouse.move(freshCenterX - 35, freshCenterY + 20, { steps: 4 });
  967 |   await page.mouse.up();
  968 |   await page.getByRole("button", { name: "Reset Ground Glass view" }).click();
  969 |   await expectGroundGlassIdentity(stage, transformedLayer);
  970 | 
  971 |   await zoomGroundGlassAt(page, stage);
  972 |   await page.keyboard.press("Escape");
  973 |   await expectGroundGlassIdentity(stage, transformedLayer);
  974 | });
  975 | 
  976 | test("Table Tilt Ground Glass recovers from interrupted pointer gestures", async ({ page }) => {
  977 |   test.setTimeout(90_000);
  978 |   await page.goto("/simulator/free/table-tilt");
  979 |   const { stage, transformedLayer } = groundGlassLocators(page);
  980 | 
  981 |   for (const [index, terminalEvent] of ["pointercancel", "lostpointercapture"].entries()) {
  982 |     const bounds = index === 0 ? await zoomGroundGlassAt(page, stage) : await readFreshElementBounds(stage);
```