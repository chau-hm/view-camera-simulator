import { expect, test, type Locator } from "@playwright/test";
import { readFocusDistributionScores } from "./helpers/focusDistribution";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const TARGET_IDS = [
  "macro-compound-near-left",
  "macro-compound-centre",
  "macro-compound-far-right",
] as const;

const setPublicRangeValue = async (slider: Locator, target: number): Promise<void> => {
  await slider.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Range input value setter unavailable");
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, target);
  await expect(slider).toHaveValue(String(target));
};

test("Macro 4 teaches compound Tilt + Swing + Focus through the public route", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/simulator/free/macro-compound-movements");

  const sceneCanvas = page.getByTestId("scene-canvas");
  await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".groundglass-renderer-host canvas")).toHaveCount(1);
  await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "macro-compound-movements");

  const movement = page.locator('.movement-controls[data-standard="front"]');
  const focus = page.getByRole("slider", { name: "Focus distance" });
  const tilt = page.getByRole("slider", { name: "Tilt" });
  const swing = page.getByRole("slider", { name: "Swing" });
  const aperture = page.getByRole("radiogroup", { name: "Aperture" });
  const readout = page.getByRole("region", { name: "Macro focus" });
  const panel = page.getByTestId("focus-distribution-panel");

  await expect(movement).toContainText("Front standard");
  await expect(tilt).toBeEnabled();
  await expect(swing).toBeEnabled();
  await expect(focus).toHaveValue("500");
  await expect(focus).toHaveAttribute("min", "450");
  await expect(focus).toHaveAttribute("max", "540");
  await expect(focus).toHaveAttribute("step", "10");
  await expect(tilt).toHaveValue("0");
  await expect(swing).toHaveValue("0");
  await expect(aperture).toHaveAttribute("data-selected-aperture", "5.6");
  await expect(aperture).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Infinity Reset" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /focal length/i })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Focus standard" })).toHaveCount(0);
  await expect(readout).toBeVisible();
  await expect(readout).toContainText("0.43×");
  await expect(panel.locator("[data-focus-target-id]")).toHaveCount(3);
  for (const targetId of TARGET_IDS) {
    await expect(panel.locator(`[data-focus-target-id="${targetId}"]`)).toBeVisible();
  }
  await expect(page.getByTestId("focus-distribution-orientation")).toHaveText("Raw");

  await page.getByRole("button", { name: "Top", exact: true }).click();
  await expect(page.locator("section.geometry-viewport")).toHaveAttribute("data-geometry-view", "top");
  await page.getByRole("button", { name: "Scheimpflug Section", exact: true }).click();
  await expect(page.locator("section.geometry-viewport")).toHaveAttribute("data-geometry-view", "scheimpflug");
  await page.getByRole("button", { name: "Side", exact: true }).click();
  await expect(page.locator("section.geometry-viewport")).toHaveAttribute("data-geometry-view", "side");

  await page.getByRole("button", { name: "Open Task and Feedback" }).click();
  const teaching = page.getByTestId("macro-compound-teaching");
  const taskView = page.getByTestId("learning-overlay-task-view");
  await expect(teaching).toHaveAttribute("data-stage", "focus-exploration");
  await expect(teaching).toHaveAttribute("data-strongest-region", "centre");
  await expect(taskView).toContainText("both movements neutral");
  await expect(taskView).toContainText("Near-left");
  await expect(taskView).toContainText("Far-right");

  await setStepRangeInput(page, "Tilt", 2);
  await expect(teaching).toHaveAttribute("data-stage", "tilt-only");
  await expect(taskView).toContainText("one orientation component");

  await setStepRangeInput(page, "Tilt", 0);
  await setStepRangeInput(page, "Swing", -2);
  await expect(teaching).toHaveAttribute("data-stage", "swing-only");
  await expect(taskView).toContainText("lateral orientation component");

  await setStepRangeInput(page, "Tilt", 2);
  await setStepRangeInput(page, "Focus distance", 490);
  await expect(teaching).toHaveAttribute("data-stage", "compound-alignment");
  await expect(teaching).toHaveAttribute("data-tilt-neutral", "false");
  await expect(teaching).toHaveAttribute("data-swing-neutral", "false");

  await setStepRangeInput(page, "Tilt", 3.3);
  await setStepRangeInput(page, "Swing", -2.7);
  await expect(teaching).toHaveAttribute("data-stage", "refine-compound");
  await expect(teaching).toHaveAttribute("data-sharp-count", "2");
  await expect(taskView).toContainText("public 0.1° Tilt and Swing steps");

  await setStepRangeInput(page, "Tilt", 3.4);
  await setStepRangeInput(page, "Swing", -2.8);
  await expect(teaching).toHaveAttribute("data-stage", "aligned");
  await expect(teaching).toHaveAttribute("data-sharp-count", "3");
  await expect(teaching).toHaveAttribute("data-all-sharp", "true");
  await expect(taskView).toContainText("all three critical faces");

  const alignedScores = await readFocusDistributionScores(page, TARGET_IDS);
  for (const targetId of TARGET_IDS) {
    expect(alignedScores[targetId]).toBe(100);
    await expect(panel.locator(`[data-focus-target-id="${targetId}"]`)).toHaveAttribute(
      "aria-label",
      /Sharp/,
    );
  }

  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  const feedback = page.getByTestId("macro-compound-feedback");
  await expect(feedback).toHaveAttribute("data-stage", "aligned");
  await expect(feedback).toContainText("all Sharp");
  await expect(feedback).toContainText("Front Tilt +3.4°");
  await expect(feedback).toContainText("Front Swing -2.8°");
  await expect(feedback).toContainText("Focus Distance 490 mm");
  await expect(page.getByTestId("macro-compound-feedback")).toHaveCount(1);

  await setPublicRangeValue(tilt, 3.9);
  await expect(feedback).toHaveAttribute("data-all-sharp", "false");
  await expect(feedback).not.toHaveAttribute("data-stage", "aligned");

  await page.getByRole("button", { name: "Reset movements" }).click();
  await expect(tilt).toHaveValue("0");
  await expect(swing).toHaveValue("0");
  await expect(focus).toHaveValue("500");
  await expect(feedback).toHaveAttribute("data-stage", "focus-exploration");

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
