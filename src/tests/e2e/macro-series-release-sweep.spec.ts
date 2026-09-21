import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
import { setPublicRangeInput } from "./helpers/publicRangeInput";

const MACRO_SCENES = [
  {
    id: "macro-bellows-extension",
    title: "1:1 Flat Subject",
    thumbnail: "macro-bellows-extension.webp",
  },
  {
    id: "macro-depth-of-field",
    title: "Three-Dimensional Macro",
    thumbnail: "macro-depth-of-field.webp",
  },
  {
    id: "macro-oblique-plane",
    title: "Oblique Macro Plane",
    thumbnail: "macro-oblique-plane.webp",
  },
  {
    id: "macro-compound-movements",
    title: "Compound Macro Still Life",
    thumbnail: "macro-compound-movements.webp",
  },
] as const;

const TARGET_IDS_BY_SCENE = {
  "macro-depth-of-field": [
    "macro-depth-near",
    "macro-depth-middle",
    "macro-depth-far",
  ],
  "macro-oblique-plane": [
    "macro-oblique-near",
    "macro-oblique-middle",
    "macro-oblique-far",
  ],
  "macro-compound-movements": [
    "macro-compound-near-left",
    "macro-compound-centre",
    "macro-compound-far-right",
  ],
} as const;

const allowKnownConsoleMessage = (message: Pick<ConsoleMessage, "type" | "text">): boolean =>
  isKnownFiberClockDeprecation(message) || /GL Driver Message .*GPU stall due to ReadPixels/.test(message.text());

const macroGroup = (page: Page, title = "Macro Photography") =>
  page.locator("section").filter({
    has: page.getByRole("heading", { name: title, level: 2, exact: true }),
  });

const macroCard = (page: Page, sceneTitle: string, groupTitle = "Macro Photography") =>
  macroGroup(page, groupTitle)
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: sceneTitle, level: 3, exact: true }) });

const openSceneCard = async (page: Page, scene: (typeof MACRO_SCENES)[number]) => {
  await macroCard(page, scene.title).getByRole("link", { name: "Open Scene", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/simulator/free/${scene.id}$`));
  const sceneCanvas = page.getByTestId("scene-canvas");
  await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", scene.id);
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-scene-id", scene.id, {
    timeout: 60_000,
  });
};

const returnToScenes = async (page: Page) => {
  await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect(macroGroup(page)).toBeVisible();
};

const readTargetCell = async (page: Page, targetId: string) =>
  page.getByTestId("focus-distribution-panel").locator(`[data-focus-target-id="${targetId}"]`).evaluate((element) => {
    const cell = element.closest("td");
    const row = cell?.closest("tr");
    if (!cell || !row) throw new Error(`Target ${targetId} is not in a focus-distribution cell`);
    return {
      rowIndex: Array.from(row.parentElement?.children ?? []).indexOf(row),
      columnIndex: Array.from(row.children).indexOf(cell),
      label: element.getAttribute("aria-label"),
    };
  });

const assertRawUprightComplement = async (page: Page, targetIds: readonly string[]) => {
  const panel = page.getByTestId("focus-distribution-panel");
  const rawCells = await Promise.all(targetIds.map((targetId) => readTargetCell(page, targetId)));
  await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Raw");

  await page.getByRole("radio", { name: "Upright Assist" }).check();
  await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Upright");
  const uprightCells = await Promise.all(targetIds.map((targetId) => readTargetCell(page, targetId)));
  uprightCells.forEach((cell, index) => {
    expect(cell.rowIndex).toBe(2 - rawCells[index].rowIndex);
    expect(cell.columnIndex).toBe(2 - rawCells[index].columnIndex);
    expect(cell.label?.match(/\d+%/)?.[0]).toBe(rawCells[index].label?.match(/\d+%/)?.[0]);
  });

  await page.getByRole("radio", { name: "Raw Ground Glass" }).check();
  await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Raw");
  await expect(panel).toBeVisible();
};

const assertTargetIds = async (page: Page, targetIds: readonly string[]) => {
  const panel = page.getByTestId("focus-distribution-panel");
  await expect(panel.locator("[data-focus-target-id]")).toHaveCount(targetIds.length);
  for (const targetId of targetIds) {
    await expect(panel.locator(`[data-focus-target-id="${targetId}"]`)).toBeVisible();
  }
};

test("Macro Photography cards, route initialization, and state isolation survive ordered SPA navigation", async ({ page }) => {
  test.setTimeout(300_000);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if ((message.type() === "error" || message.type() === "warning") && !allowKnownConsoleMessage(message)) {
      consoleProblems.push(message.text());
    }
  });

  await page.addInitScript(() => {
    (window as Window & { __macroSweepDocumentToken?: string }).__macroSweepDocumentToken =
      `${Date.now()}-${Math.random()}`;
  });
  await page.goto("/scenes");
  const documentToken = await page.evaluate(
    () => (window as Window & { __macroSweepDocumentToken?: string }).__macroSweepDocumentToken,
  );
  expect(documentToken).toBeTruthy();

  const group = macroGroup(page);
  await expect(group.getByRole("article")).toHaveCount(MACRO_SCENES.length);
  await expect(group.getByRole("heading", { level: 3 }).allTextContents()).resolves.toEqual(
    MACRO_SCENES.map(({ title }) => title),
  );
  for (const scene of MACRO_SCENES) {
    const card = macroCard(page, scene.title);
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator("img")).toHaveAttribute("src", new RegExp(scene.thumbnail));
    await expect
      .poll(() => card.locator("img").evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(card.getByRole("link", { name: "Open Scene", exact: true })).toHaveAttribute(
      "href",
      `/simulator/free/${scene.id}`,
    );
    await expect(card.getByRole("link", { name: /guided/i })).toHaveCount(0);
    await expect(card.getByText("In development", { exact: true })).toHaveCount(0);
  }

  await openSceneCard(page, MACRO_SCENES[0]);
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("900");
  const sceneOneAperture = page.getByRole("radiogroup", { name: "Aperture" });
  await expect(sceneOneAperture).toHaveAttribute("data-selected-aperture", "5.6");
  await expect(sceneOneAperture).toBeEnabled();
  await setPublicRangeInput(page.getByRole("slider", { name: "Focus distance" }), 300);
  await sceneOneAperture.getByRole("radio", { name: "f/22" }).check();
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("300");
  await expect(sceneOneAperture).toHaveAttribute("data-selected-aperture", "22");
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __macroSweepDocumentToken?: string }).__macroSweepDocumentToken))
    .toBe(documentToken);

  await returnToScenes(page);
  await openSceneCard(page, MACRO_SCENES[1]);
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("400");
  const sceneTwoAperture = page.getByRole("radiogroup", { name: "Aperture" });
  await expect(sceneTwoAperture).toHaveAttribute("data-selected-aperture", "5.6");
  await expect(sceneTwoAperture).toBeEnabled();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  await assertTargetIds(page, TARGET_IDS_BY_SCENE["macro-depth-of-field"]);
  await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  await expect(page.getByTestId("macro-depth-teaching")).toHaveAttribute("data-stage", "wide-open");
  await sceneTwoAperture.getByRole("radio", { name: "f/32" }).check();
  await expect(sceneTwoAperture).toHaveAttribute("data-selected-aperture", "32");

  await returnToScenes(page);
  await openSceneCard(page, MACRO_SCENES[2]);
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("400");
  const sceneThreeTilt = page.getByRole("slider", { name: "Front Tilt" });
  const sceneThreeAperture = page.getByRole("radiogroup", { name: "Aperture" });
  await expect(sceneThreeTilt).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Shift" })).toHaveCount(0);
  await expect(sceneThreeAperture).toHaveAttribute("data-selected-aperture", "5.6");
  await expect(sceneThreeAperture).toHaveAttribute("aria-disabled", "true");
  await assertTargetIds(page, TARGET_IDS_BY_SCENE["macro-oblique-plane"]);
  await assertRawUprightComplement(page, TARGET_IDS_BY_SCENE["macro-oblique-plane"]);
  await setPublicRangeInput(page.getByRole("slider", { name: "Front Tilt" }), 6.3);
  await expect(sceneThreeTilt).toHaveValue("6.3");

  await returnToScenes(page);
  await openSceneCard(page, MACRO_SCENES[3]);
  const sceneFourFocus = page.getByRole("slider", { name: "Focus distance" });
  const sceneFourTilt = page.getByRole("slider", { name: "Tilt" });
  const sceneFourSwing = page.getByRole("slider", { name: "Swing" });
  const sceneFourAperture = page.getByRole("radiogroup", { name: "Aperture" });
  await expect(sceneFourFocus).toHaveValue("500");
  await expect(sceneFourFocus).toHaveAttribute("min", "450");
  await expect(sceneFourFocus).toHaveAttribute("max", "540");
  await expect(sceneFourTilt).toHaveValue("0");
  await expect(sceneFourSwing).toHaveValue("0");
  await expect(sceneFourTilt).toBeEnabled();
  await expect(sceneFourSwing).toBeEnabled();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Shift" })).toHaveCount(0);
  await expect(sceneFourAperture).toHaveAttribute("data-selected-aperture", "5.6");
  await expect(sceneFourAperture).toHaveAttribute("aria-disabled", "true");
  await assertTargetIds(page, TARGET_IDS_BY_SCENE["macro-compound-movements"]);
  await assertRawUprightComplement(page, TARGET_IDS_BY_SCENE["macro-compound-movements"]);
  await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  await expect(page.getByTestId("macro-compound-teaching")).toHaveAttribute("data-stage", "focus-exploration");

  await returnToScenes(page);
  const language = page.getByRole("combobox", { name: "Language" });
  await language.selectOption("zh-HK");
  const zhGroup = macroGroup(page, "微距攝影");
  await expect(zhGroup.getByRole("article")).toHaveCount(MACRO_SCENES.length);
  await expect(zhGroup.getByRole("heading", { level: 3 }).allTextContents()).resolves.toEqual([
    "1:1 平面主體",
    "立體微距攝影",
    "傾斜微距平面",
    "複合微距靜物",
  ]);
  await expect(zhGroup.getByRole("link", { name: "開啟場景", exact: true })).toHaveCount(4);
  await page.getByRole("combobox", { name: "語言" }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Macro Photography", level: 2, exact: true })).toBeVisible();

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Unexpected browser console output: ${consoleProblems.join("\n")}`).toEqual([]);
});
