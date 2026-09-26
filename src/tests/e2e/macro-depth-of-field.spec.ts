import { expect, test } from "@playwright/test";
import { readFocusDistributionScores } from "./helpers/focusDistribution";
import { setPublicRangeInput } from "./helpers/publicRangeInput";

const TARGET_IDS = [
  "macro-depth-near",
  "macro-depth-middle",
  "macro-depth-far",
] as const;

test("Macro 2 teaches shallow physical depth of field across a 3D subject", async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/simulator/free/architecture-rise");
  await expect(page.getByRole("button", { name: "Infinity Reset" })).toBeVisible();
  await page.getByRole("button", { name: "Infinity Reset" }).click();
  await expect(page.getByText(/Focus: ∞/)).toBeVisible();

  // Preserve the previous scene's Infinity state while using the public SPA
  // navigation path into the finite-only Macro scene.
  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await page.locator('a[href="/simulator/free/macro-depth-of-field"]').click();
  await expect(page).toHaveURL(/\/simulator\/free\/macro-depth-of-field$/);

  const sceneCanvas = page.getByTestId("scene-canvas");
  await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".groundglass-renderer-host canvas")).toHaveCount(1);
  await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-depth-of-field");

  const focus = page.getByRole("slider", { name: "Focus distance" });
  const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  const groundGlassRtt = page.getByTestId("ground-glass-rtt");
  const readout = page.getByRole("region", { name: "Macro focus" });
  await expect(focus).toHaveValue("400");
  await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  await expect(aperture).toBeEnabled();
  await expect(readout).toContainText("240.0 mm");
  await expect(readout).toContainText("0.60×");
  await expect(page.getByText("Movement", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Infinity Reset" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /focal length/i })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Focus standard" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  const teaching = page.getByTestId("macro-depth-teaching");
  const taskView = page.getByTestId("learning-overlay-task-view");
  await expect(teaching).toHaveAttribute("data-stage", "wide-open");
  await expect(teaching).toHaveAttribute("data-focused-region", "middle");
  await expect(taskView).toContainText("three-dimensional subject");
  await expect(taskView).toContainText("Refocusing moves");
  await expect(taskView).not.toContainText("bellows travel");

  const readGroundGlassGain = async () =>
    Number(await groundGlassRtt.getAttribute("data-rtt-ground-glass-illuminance-gain"));
  await expect.poll(readGroundGlassGain).toBeGreaterThan(0);
  const wideApertureGroundGlassGain = await readGroundGlassGain();

  const panel = page.getByTestId("focus-distribution-panel");
  await expect(panel.locator("[data-focus-target-id]")).toHaveCount(3);
  for (const targetId of TARGET_IDS) {
    await expect(panel.locator(`[data-focus-target-id="${targetId}"]`)).toBeVisible();
  }

  const wideScores = await readFocusDistributionScores(page, TARGET_IDS);
  expect(wideScores["macro-depth-middle"]).toBeGreaterThan(wideScores["macro-depth-near"]);
  expect(wideScores["macro-depth-middle"]).toBeGreaterThan(wideScores["macro-depth-far"]);
  expect(
    await panel.locator('[data-focus-target-id="macro-depth-middle"]').getAttribute("aria-label"),
  ).toMatch(/Sharp/);
  expect(
    await panel.locator('[data-focus-target-id="macro-depth-near"]').getAttribute("aria-label"),
  ).toMatch(/Soft/);
  expect(
    await panel.locator('[data-focus-target-id="macro-depth-far"]').getAttribute("aria-label"),
  ).toMatch(/Soft/);

  await aperture.getByRole("radio", { name: "f/32" }).check();
  await expect(aperture).toHaveAttribute("data-selected-aperture", "32");
  await expect(teaching).toHaveAttribute("data-stage", "minimum-aperture");
  await expect(taskView).toContainText("remain Soft");
  await expect(taskView).toContainText("aperture alone cannot always cover");
  await expect.poll(readGroundGlassGain).toBeLessThan(wideApertureGroundGlassGain);
  await expect.poll(async () => {
    const scores = await readFocusDistributionScores(page, ["macro-depth-near", "macro-depth-far"]);
    return scores["macro-depth-near"] + scores["macro-depth-far"];
  }).toBeGreaterThan(wideScores["macro-depth-near"] + wideScores["macro-depth-far"]);
  const stoppedDownLabels = await Promise.all(
    TARGET_IDS.map((targetId) =>
      panel.locator(`[data-focus-target-id="${targetId}"]`).getAttribute("aria-label"),
    ),
  );
  expect(stoppedDownLabels.some((label) => label?.includes("Soft"))).toBe(true);

  await aperture.getByRole("radio", { name: "f/5.6" }).check();
  await setPublicRangeInput(focus, 390);
  await expect(teaching).toHaveAttribute("data-stage", "wide-open");
  await expect(teaching).toHaveAttribute("data-focused-region", "near");
  const nearFocusScores = await readFocusDistributionScores(page, TARGET_IDS);
  expect(nearFocusScores["macro-depth-near"]).toBeGreaterThan(nearFocusScores["macro-depth-middle"]);
  expect(nearFocusScores["macro-depth-near"]).toBeGreaterThan(nearFocusScores["macro-depth-far"]);

  await setPublicRangeInput(focus, 410);
  await expect(teaching).toHaveAttribute("data-focused-region", "far");
  const farFocusScores = await readFocusDistributionScores(page, TARGET_IDS);
  expect(farFocusScores["macro-depth-far"]).toBeGreaterThan(farFocusScores["macro-depth-near"]);
  expect(farFocusScores["macro-depth-far"]).toBeGreaterThan(farFocusScores["macro-depth-middle"]);

  await setPublicRangeInput(focus, 360);
  await expect(teaching).toHaveAttribute("data-focused-region", "near");
  await expect(taskView).toContainText("Near detail is currently strongest");

  await setPublicRangeInput(focus, 440);
  await expect(teaching).toHaveAttribute("data-focused-region", "far");
  await expect(taskView).toContainText("Far detail is currently strongest");

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
