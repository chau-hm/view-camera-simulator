# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-tilt.spec.ts >> 3D overlay controls switch responsively without wrapping or blocking the scene
- Location: src/tests/e2e/table-tilt.spec.ts:814:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('.scene-overlay-responsive').first()
Expected: "inline"
Received: "collapsed"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for locator('.scene-overlay-responsive').first()
    3 × locator resolved to <div class="scene-overlay-responsive" data-overlay-presentation="collapsed">…</div>
      - unexpected value "collapsed"

```

```yaml
- button "View overlays"
```

# Test source

```ts
  746 |   }
  747 |
  748 |   await fitConstructionButton.click();
  749 |   await topButton.click();
  750 |   await expect(topButton).toHaveAttribute("aria-pressed", "true");
  751 |   await expect(geometryPanel).toHaveAttribute("data-geometry-view", "top");
  752 |   await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  753 |   await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");
  754 |   for (const targetId of ["near-cup", "mid-notebook", "far-book"]) {
  755 |     await expect(page.getByTestId(`geometry-target-${targetId}`)).toBeVisible();
  756 |   }
  757 |
  758 |   await sectionButton.click();
  759 |   await expect(geometryPanel).toHaveAttribute("data-geometry-view", "scheimpflug");
  760 |   await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  761 |   await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");
  762 |
  763 |   await fitConstructionButton.click();
  764 |   await fitSceneButton.click();
  765 |   await expect(sideButton).toHaveAttribute("aria-pressed", "true");
  766 |   await expect(geometryPanel).toHaveAttribute("data-geometry-view", "side");
  767 |   await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  768 |   const restoredSideSvg = page.getByTestId("geometry-svg-side");
  769 |   await expect(restoredSideSvg.getByText("Near card", { exact: true })).toBeVisible();
  770 |   await expect(restoredSideSvg.getByText("Middle notebook", { exact: true })).toBeVisible();
  771 |   await expect(restoredSideSvg.getByText("Far chart", { exact: true })).toBeVisible();
  772 |
  773 |   await fitConstructionButton.click();
  774 |   await expect(geometryPanel).toHaveAttribute("data-construction-layout", "split");
  775 |   await setRangeDirect(page, "Tilt", 0);
  776 |   await expect(geometryPanel).toHaveAttribute("data-construction-layout", "single");
  777 |   await expect(geometryPanel).toHaveAttribute("data-geometry-view", "side");
  778 |   await expect(geometryPanel).toHaveAttribute("data-geometry-fit", "scene");
  779 |   await expect(fitSceneButton).toHaveAttribute("aria-pressed", "true");
  780 |   const fallbackFocusLine = page
  781 |     .getByTestId("geometry-svg-side")
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
> 846 |   await expect(responsive).toHaveAttribute("data-overlay-presentation", "inline");
      |                            ^ Error: expect(locator).toHaveAttribute(expected) failed
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
  882 |   }).toBe(true);
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
```