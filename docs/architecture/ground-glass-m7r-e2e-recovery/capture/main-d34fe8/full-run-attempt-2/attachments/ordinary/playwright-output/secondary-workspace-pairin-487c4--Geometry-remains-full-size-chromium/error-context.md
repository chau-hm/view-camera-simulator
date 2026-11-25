# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: secondary-workspace-pairing.spec.ts >> normal Geometry uses a compact diagram height while expanded Geometry remains full-size
- Location: src/tests/e2e/secondary-workspace-pairing.spec.ts:118:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Expand 2D Geometry' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: 'Expand 2D Geometry' })

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  67  | test("a scene without Focus Distribution keeps Geometry in the left secondary slot", async ({ page }) => {
  68  |   await page.setViewportSize({ width: 1440, height: 1000 });
  69  |   await page.goto("/simulator/free/understanding-camera-movements");
  70  | 
  71  |   const scene = page.locator('[data-workspace-slot="scene"]');
  72  |   const geometry = page.locator('[data-workspace-slot="geometry"]');
  73  |   await expect(scene).toBeVisible();
  74  |   await expect(geometry).toBeVisible();
  75  |   await expect(page.locator('[data-workspace-slot="focus-distribution"]')).toHaveCount(0);
  76  | 
  77  |   const [sceneBounds, geometryBounds] = await Promise.all([
  78  |     requireBounds(scene, "Scene workspace slot"),
  79  |     requireBounds(geometry, "Geometry workspace slot"),
  80  |   ]);
  81  |   expectColumnAligned(sceneBounds, geometryBounds);
  82  |   expect(geometryBounds.y).toBeGreaterThanOrEqual(bottom(sceneBounds) - 1);
  83  | });
  84  | 
  85  | test("Geometry owns expansion and restores focus to its normal-workspace trigger", async ({ page }) => {
  86  |   await page.setViewportSize({ width: 1280, height: 900 });
  87  |   await page.goto("/simulator/free/architecture-rise");
  88  | 
  89  |   const trigger = page.getByRole("button", { name: "Expand 2D Geometry" });
  90  |   await expect(trigger).toBeVisible();
  91  |   await expect(trigger.locator(".material-symbols-outlined")).toHaveText("open_in_new");
  92  | 
  93  |   const secondaryGeometryDetails = page.locator(
  94  |     ".geometry-viewport:not(.geometry-viewport--expanded) .geometry-viewport__secondary",
  95  |   );
  96  |   await expect(secondaryGeometryDetails.first()).toBeHidden();
  97  | 
  98  |   await trigger.click();
  99  | 
  100 |   const restore = page.getByRole("button", { name: "Restore 2D Geometry" });
  101 |   await expect(restore).toBeFocused();
  102 |   await expect(page.getByRole("heading", { name: "3D Scene" })).toHaveCount(0);
  103 |   await expect(page.getByRole("heading", { name: "Ground Glass" })).toHaveCount(0);
  104 |   await expect(page.getByTestId("focus-distribution-panel")).toHaveCount(0);
  105 |   await expect(page.locator('[data-workspace-slot="geometry"]')).toHaveCount(1);
  106 |   await expect(page.locator("section.geometry-viewport")).toBeVisible();
  107 |   await expect(page.locator(".geometry-viewport--expanded .geometry-viewport__secondary").first()).toBeVisible();
  108 |   await expect(restore.locator(".material-symbols-outlined")).toHaveText("close_fullscreen");
  109 | 
  110 |   await restore.click();
  111 |   await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();
  112 |   await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible();
  113 |   await expect(page.getByRole("button", { name: "Expand 2D Geometry" })).toBeFocused();
  114 |   await expect(page.getByTestId("focus-distribution-panel")).toBeVisible();
  115 |   await expect(secondaryGeometryDetails.first()).toBeHidden();
  116 | });
  117 | 
  118 | test("normal Geometry uses a compact diagram height while expanded Geometry remains full-size", async ({ page }) => {
  119 |   test.setTimeout(120_000);
  120 |   const viewports = [
  121 |     { width: 1440, height: 900 },
  122 |     { width: 1280, height: 800 },
  123 |     { width: 1133, height: 800 },
  124 |     { width: 1024, height: 768 },
  125 |   ];
  126 | 
  127 |   const readGeometryLayout = () => page.evaluate(() => {
  128 |     const geometry = document.querySelector<HTMLElement>("section.geometry-viewport");
  129 |     const diagram = document.querySelector<HTMLElement>(".geometry-diagram-container");
  130 |     const svg = diagram?.querySelector<SVGElement>(":scope > svg");
  131 |     const geometrySlot = document.querySelector<HTMLElement>('[data-workspace-slot="geometry"]');
  132 |     const focusDistributionSlot = document.querySelector<HTMLElement>('[data-workspace-slot="focus-distribution"]');
  133 |     if (!geometry || !diagram || !svg || !geometrySlot) throw new Error("Geometry layout is incomplete");
  134 |     const geometryBounds = geometry.getBoundingClientRect();
  135 |     const diagramBounds = diagram.getBoundingClientRect();
  136 |     const svgBounds = svg.getBoundingClientRect();
  137 |     const geometrySlotBounds = geometrySlot.getBoundingClientRect();
  138 |     const focusDistributionSlotBounds = focusDistributionSlot?.getBoundingClientRect();
  139 |     const controlsWithinGeometry = Array.from(geometry.querySelectorAll("button")).every((button) => {
  140 |       const buttonBounds = button.getBoundingClientRect();
  141 |       return buttonBounds.left >= geometryBounds.left - 1 && buttonBounds.right <= geometryBounds.right + 1;
  142 |     });
  143 |     return {
  144 |       geometryHeight: geometryBounds.height,
  145 |       geometryCardHeight: geometrySlotBounds.height,
  146 |       focusDistributionCardHeight: focusDistributionSlotBounds?.height ?? null,
  147 |       diagramHeight: diagramBounds.height,
  148 |       svgHeight: svgBounds.height,
  149 |       diagramClientHeight: diagram.clientHeight,
  150 |       diagramScrollHeight: diagram.scrollHeight,
  151 |       diagramClientWidth: diagram.clientWidth,
  152 |       diagramScrollWidth: diagram.scrollWidth,
  153 |       controlsWithinGeometry,
  154 |       svgWithinDiagram: svgBounds.top >= diagramBounds.top - 1 &&
  155 |         svgBounds.bottom <= diagramBounds.bottom + 1 &&
  156 |         svgBounds.left >= diagramBounds.left - 1 &&
  157 |         svgBounds.right <= diagramBounds.right + 1,
  158 |       horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  159 |     };
  160 |   });
  161 | 
  162 |   for (const viewport of viewports) {
  163 |     await page.setViewportSize(viewport);
  164 |     await page.goto("/simulator/free/macro-depth-of-field");
  165 | 
  166 |     const expand = page.getByRole("button", { name: "Expand 2D Geometry" });
> 167 |     await expect(expand).toBeVisible();
      |                          ^ Error: expect(locator).toBeVisible() failed
  168 |     await expect(page.getByTestId("focus-distribution-panel")).toBeVisible();
  169 |     const normal = await readGeometryLayout();
  170 |     expect(normal.focusDistributionCardHeight).not.toBeNull();
  171 |     const focusDistributionCardHeight = normal.focusDistributionCardHeight ?? 0;
  172 |     expect(normal.geometryCardHeight).toBeGreaterThanOrEqual(focusDistributionCardHeight * 0.8);
  173 |     expect(normal.geometryCardHeight).toBeLessThanOrEqual(focusDistributionCardHeight * 1.4);
  174 |     expect(normal.diagramHeight).toBeLessThan(viewport.height * 0.35);
  175 |     expect(normal.diagramHeight).toBeLessThan(normal.geometryHeight);
  176 |     expect(normal.diagramScrollHeight).toBeLessThanOrEqual(normal.diagramClientHeight + 2);
  177 |     expect(normal.diagramScrollWidth).toBeLessThanOrEqual(normal.diagramClientWidth + 2);
  178 |     expect(normal.svgHeight).toBeGreaterThan(0);
  179 |     expect(normal.svgWithinDiagram).toBe(true);
  180 |     expect(normal.controlsWithinGeometry).toBe(true);
  181 |     expect(normal.horizontalOverflow).toBeLessThanOrEqual(2);
  182 | 
  183 |     await expand.click();
  184 |     await expect(page.getByRole("button", { name: "Restore 2D Geometry" })).toBeVisible();
  185 |     const expanded = await readGeometryLayout();
  186 |     expect(expanded.geometryCardHeight).toBeGreaterThan(normal.geometryCardHeight * 2);
  187 |     expect(expanded.diagramHeight).toBeGreaterThan(normal.diagramHeight * 2);
  188 |     expect(expanded.diagramHeight).toBeGreaterThan(normal.diagramHeight + 80);
  189 |     expect(expanded.svgHeight).toBeGreaterThan(normal.svgHeight);
  190 |     expect(expanded.controlsWithinGeometry).toBe(true);
  191 |     expect(expanded.horizontalOverflow).toBeLessThanOrEqual(2);
  192 | 
  193 |     await page.getByRole("button", { name: "Restore 2D Geometry" }).click();
  194 |     await expect(expand).toBeVisible();
  195 |     const restored = await readGeometryLayout();
  196 |     expect(Math.abs(restored.diagramHeight - normal.diagramHeight)).toBeLessThanOrEqual(2);
  197 |   }
  198 | });
  199 | 
  200 | test("narrow normal workspace flows Scene, Ground Glass, Geometry, and Focus Distribution in one column", async ({ page }) => {
  201 |   await page.setViewportSize({ width: 700, height: 900 });
  202 |   await page.goto("/simulator/guided/table-tilt/tilt-01");
  203 | 
  204 |   const scene = page.locator('[data-workspace-slot="scene"]');
  205 |   const groundGlass = page.locator('[data-workspace-slot="ground-glass"]');
  206 |   const geometry = page.locator('[data-workspace-slot="geometry"]');
  207 |   const focusDistribution = page.locator('[data-workspace-slot="focus-distribution"]');
  208 |   await expect(scene).toBeVisible();
  209 |   await expect(groundGlass).toBeVisible();
  210 |   await expect(geometry).toBeVisible();
  211 |   await expect(focusDistribution).toBeVisible();
  212 |   await expect(page.getByTestId("learning-overlay-panel")).toHaveAttribute("data-drawer-state", "flow");
  213 | 
  214 |   const [sceneBounds, groundGlassBounds, geometryBounds, focusBounds] = await Promise.all([
  215 |     requireBounds(scene, "Narrow Scene workspace slot"),
  216 |     requireBounds(groundGlass, "Narrow Ground Glass workspace slot"),
  217 |     requireBounds(geometry, "Narrow Geometry workspace slot"),
  218 |     requireBounds(focusDistribution, "Narrow Focus Distribution workspace slot"),
  219 |   ]);
  220 |   expectColumnAligned(sceneBounds, groundGlassBounds);
  221 |   expectColumnAligned(sceneBounds, geometryBounds);
  222 |   expectColumnAligned(sceneBounds, focusBounds);
  223 |   expect(groundGlassBounds.y).toBeGreaterThanOrEqual(bottom(sceneBounds) - 1);
  224 |   expect(geometryBounds.y).toBeGreaterThanOrEqual(bottom(groundGlassBounds) - 1);
  225 |   expect(focusBounds.y).toBeGreaterThanOrEqual(bottom(geometryBounds) - 1);
  226 | 
  227 |   const horizontalOverflow = await page.evaluate(
  228 |     () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  229 |   );
  230 |   expect(horizontalOverflow).toBeLessThanOrEqual(2);
  231 | });
  232 | 
```