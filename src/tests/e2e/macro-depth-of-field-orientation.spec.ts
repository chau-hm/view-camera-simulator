import { expect, test, type Page } from "@playwright/test";

const TARGET_COLUMNS = {
  raw: {
    "macro-depth-near": 0,
    "macro-depth-middle": 1,
    "macro-depth-far": 2,
  },
  upright: {
    "macro-depth-near": 2,
    "macro-depth-middle": 1,
    "macro-depth-far": 0,
  },
} as const;

const TARGET_IDS = [
  "macro-depth-near",
  "macro-depth-middle",
  "macro-depth-far",
] as const;

const readTargetCell = async (page: Page, targetId: string) =>
  page.getByTestId("focus-distribution-panel").locator(`[data-focus-target-id="${targetId}"]`)
    .evaluate((element) => {
      const cell = element.closest("td");
      const row = cell?.closest("tr");
      if (!cell || !row) throw new Error(`Target ${targetId} is not placed in the Focus Distribution grid`);
      return {
        rowIndex: Array.from(row.parentElement?.children ?? []).indexOf(row),
        columnIndex: Array.from(row.children).indexOf(cell),
      };
    });

const readTargetMarkerOffset = async (page: Page, targetId: string) =>
  page.getByTestId("focus-distribution-panel")
    .locator(`[data-focus-target-id="${targetId}"]`)
    .evaluate((element) => ({
      x: (element as HTMLElement).style.getPropertyValue("--focus-distribution-target-marker-x"),
      y: (element as HTMLElement).style.getPropertyValue("--focus-distribution-target-marker-y"),
    }));

test("Macro depth targets, Focus Distribution, and Raw/Upright raster stay aligned", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/macro-depth-of-field");

  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  const distribution = page.getByTestId("focus-distribution-panel");
  await expect(scene.locator("canvas")).toHaveCount(1);
  await expect(rtt.locator("canvas")).toHaveCount(1);
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", /\d+/, { timeout: 60_000 });
  await expect(distribution.locator("[data-focus-target-id]")).toHaveCount(3);

  const rawMarkerOffsets = new Map<string, { x: string; y: string }>();
  for (const targetId of TARGET_IDS) {
    await expect.poll(() => readTargetCell(page, targetId)).toEqual({
      rowIndex: 1,
      columnIndex: TARGET_COLUMNS.raw[targetId],
    });
    rawMarkerOffsets.set(targetId, await readTargetMarkerOffset(page, targetId));
  }
  await page.screenshot({ path: testInfo.outputPath("macro-depth-of-field-raw.png") });

  await page.getByRole("radio", { name: "Upright Assist" }).check();
  await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Upright");
  for (const targetId of TARGET_IDS) {
    await expect.poll(() => readTargetCell(page, targetId)).toEqual({
      rowIndex: 1,
      columnIndex: TARGET_COLUMNS.upright[targetId],
    });
    const rawOffset = rawMarkerOffsets.get(targetId);
    const uprightOffset = await readTargetMarkerOffset(page, targetId);
    expect(rawOffset).toBeDefined();
    expect(uprightOffset.x).toBe(rawOffset?.x === "-3px" ? "3px" : rawOffset?.x === "3px" ? "-3px" : "0px");
    expect(uprightOffset.y).toBe(rawOffset?.y === "-3px" ? "3px" : rawOffset?.y === "3px" ? "-3px" : "0px");
  }
  await page.screenshot({ path: testInfo.outputPath("macro-depth-of-field-upright.png") });
});
