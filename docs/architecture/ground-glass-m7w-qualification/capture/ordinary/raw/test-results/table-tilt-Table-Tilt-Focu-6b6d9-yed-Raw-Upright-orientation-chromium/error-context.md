# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: table-tilt.spec.ts >> Table Tilt Focus Distribution follows the displayed Raw/Upright orientation
- Location: src/tests/e2e/table-tilt.spec.ts:102:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('focus-distribution-panel')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('focus-distribution-panel')

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  6   | } from "./helpers/groundGlass";
  7   | import { readFocusDistributionScores } from "./helpers/focusDistribution";
  8   | import {
  9   |   expectLearningFeedbackCompleted,
  10  |   expectLearningFeedbackNotCompleted,
  11  |   openLearningDrawer,
  12  |   openLearningFeedback,
  13  | } from "./helpers/learningOverlay";
  14  | import { setRangeDirect } from "./helpers/rangeInput";
  15  | import { setStepRangeInput } from "./helpers/stepRangeInput";
  16  |
  17  | const tableTiltCard = (page: import("@playwright/test").Page) =>
  18  |   page
  19  |     .getByRole("article")
  20  |     .filter({ has: page.getByRole("heading", { name: "Table Tilt" }) });
  21  |
  22  | const readPointScores = (page: import("@playwright/test").Page) =>
  23  |   readFocusDistributionScores(page, ["near-cup", "mid-notebook", "far-book"]);
  24  |
  25  | type ProjectedLine = { x1: number; y1: number; x2: number; y2: number };
  26  |
  27  | const readProjectedLine = async (
  28  |   line: import("@playwright/test").Locator,
  29  | ): Promise<ProjectedLine> =>
  30  |   line.evaluate((element) => {
  31  |     const coordinates = {
  32  |       x1: Number(element.getAttribute("x1")),
  33  |       y1: Number(element.getAttribute("y1")),
  34  |       x2: Number(element.getAttribute("x2")),
  35  |       y2: Number(element.getAttribute("y2")),
  36  |     };
  37  |     if (!Object.values(coordinates).every(Number.isFinite)) {
  38  |       throw new Error("Projected line contains non-finite coordinates");
  39  |     }
  40  |     return coordinates;
  41  |   });
  42  |
  43  | const projectedSlope = (line: ProjectedLine) =>
  44  |   (line.y2 - line.y1) / (line.x2 - line.x1 || Number.EPSILON);
  45  |
  46  | const expectProjectedCollinearity = async (
  47  |   physical: import("@playwright/test").Locator,
  48  |   trace: import("@playwright/test").Locator,
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
> 106 |   await expect(panel).toBeVisible();
      |                       ^ Error: expect(locator).toBeVisible() failed
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
  149 |   await expect(panel.locator(".focus-distribution-cell--stacked")).toHaveCount(1);
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
```