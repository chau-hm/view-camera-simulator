import { expect, test } from "@playwright/test";
import { readFocusDistributionScores } from "./helpers/focusDistribution";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const TARGET_IDS = [
  "macro-oblique-near",
  "macro-oblique-middle",
  "macro-oblique-far",
] as const;

test("Macro 3 aligns the oblique planar subject with Front Tilt and Focus", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/simulator/free/macro-oblique-plane");

  const sceneCanvas = page.getByTestId("scene-canvas");
  await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".groundglass-renderer-host canvas")).toHaveCount(1);
  await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-oblique-plane");

  const focus = page.getByRole("slider", { name: "Focus distance" });
  const tilt = page.getByRole("slider", { name: "Front Tilt" });
  const readout = page.getByRole("region", { name: "Macro focus" });
  const panel = page.getByTestId("focus-distribution-panel");

  await expect(focus).toHaveValue("400");
  await expect(tilt).toHaveValue("0");
  await expect(page.getByRole("radiogroup", { name: "Aperture" })).toHaveAttribute(
    "data-selected-aperture",
    "5.6",
  );
  await expect(tilt).toBeEnabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Shift" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Infinity Reset" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /focal length/i })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Focus standard" })).toHaveCount(0);
  await expect(panel.locator("[data-focus-target-id]")).toHaveCount(3);
  for (const targetId of TARGET_IDS) {
    await expect(panel.locator(`[data-focus-target-id="${targetId}"]`)).toBeVisible();
  }
  await expect(readout).toContainText("240.0 mm");

  const neutralScores = await readFocusDistributionScores(page, TARGET_IDS);
  expect(neutralScores["macro-oblique-middle"]).toBeGreaterThan(
    neutralScores["macro-oblique-near"],
  );
  expect(neutralScores["macro-oblique-middle"]).toBeGreaterThan(
    neutralScores["macro-oblique-far"],
  );
  expect(
    await panel.locator('[data-focus-target-id="macro-oblique-middle"]').getAttribute("aria-label"),
  ).toMatch(/Sharp/);
  expect(
    await panel.locator('[data-focus-target-id="macro-oblique-near"]').getAttribute("aria-label"),
  ).toMatch(/Soft/);
  expect(
    await panel.locator('[data-focus-target-id="macro-oblique-far"]').getAttribute("aria-label"),
  ).toMatch(/Soft/);

  await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  const teaching = page.getByTestId("macro-oblique-teaching");
  await expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");
  await expect(teaching).toHaveAttribute("data-sharp-count", "1");
  await expect(teaching).toHaveAttribute("data-strongest-region", "middle");

  await setStepRangeInput(page, "Front Tilt", -2);
  await expect(teaching).toHaveAttribute("data-stage", "tilt-and-focus");
  await expect(teaching).not.toContainText("rotating toward the PCB");
  await expect(teaching).toContainText("changed the orientation of the sharp-focus plane");

  await setStepRangeInput(page, "Front Tilt", 0);
  await expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");

  await setStepRangeInput(page, "Focus distance", 380);
  await expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");
  await expect(teaching).toHaveAttribute("data-strongest-region", "near");

  await setStepRangeInput(page, "Focus distance", 420);
  await expect(teaching).toHaveAttribute("data-stage", "parallel-exploration");
  await expect(teaching).toHaveAttribute("data-strongest-region", "far");

  await setStepRangeInput(page, "Front Tilt", 2);
  await expect(teaching).toHaveAttribute("data-stage", "tilt-and-focus");
  await expect(teaching).toContainText("changed the orientation of the sharp-focus plane");
  await expect(teaching).toContainText("positive direction first");

  await setStepRangeInput(page, "Front Tilt", 6.2);
  await setStepRangeInput(page, "Focus distance", 390);
  await expect(teaching).toHaveAttribute("data-stage", "refine-alignment");
  await expect(teaching).toHaveAttribute("data-sharp-count", "2");

  await setStepRangeInput(page, "Front Tilt", 6.3);
  await expect(teaching).toHaveAttribute("data-stage", "aligned");
  await expect(teaching).toHaveAttribute("data-sharp-count", "3");
  await expect(teaching).toHaveAttribute("data-all-sharp", "true");

  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  const feedback = page.getByTestId("macro-oblique-feedback");
  await expect(feedback).toHaveAttribute("data-stage", "aligned");
  await expect(feedback).toContainText("all Sharp");
  await expect(tilt).toHaveValue("6.3");
  await expect(focus).toHaveValue("390");
  await expect(readout).toContainText("243.8 mm");

  const alignedScores = await readFocusDistributionScores(page, TARGET_IDS);
  TARGET_IDS.forEach((targetId) => {
    expect(alignedScores[targetId]).toBeGreaterThanOrEqual(80);
    expect(alignedScores[targetId]).toBe(100);
  });
  for (const targetId of TARGET_IDS) {
    await expect(panel.locator(`[data-focus-target-id="${targetId}"]`)).toHaveAttribute(
      "aria-label",
      /Sharp/,
    );
  }

  await tilt.evaluate((element) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Range input value setter unavailable");
    setter.call(input, "0");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(tilt).toHaveValue("0");
  await expect(feedback).toHaveAttribute("data-stage", "parallel-exploration");
  const dealignedScores = await readFocusDistributionScores(page, TARGET_IDS);
  expect(dealignedScores["macro-oblique-near"] < 100 || dealignedScores["macro-oblique-far"] < 100).toBe(true);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
