import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
import { expect, test, type Page } from "@playwright/test";
import { setRangeDirectOnGrid } from "./helpers/rangeInput";
import { setStepRangeInput } from "./helpers/stepRangeInput";
import { openLearningFeedback } from "./helpers/learningOverlay";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

const setReachableFocusValue = async (page: Page, target: number) => {
  const slider = page.getByRole("slider", { name: "Focus distance" });
  const [minimumText, maximumText, stepText] = await Promise.all([
    slider.getAttribute("min"),
    slider.getAttribute("max"),
    slider.getAttribute("step"),
  ]);
  const minimum = Number(minimumText);
  const maximum = Number(maximumText);
  const step = Number(stepText);
  const stepsFromMinimum = (target - minimum) / step;

  if (
    ![minimum, maximum, step, target].every(Number.isFinite) ||
    target < minimum ||
    target > maximum ||
    step <= 0 ||
    Math.abs(stepsFromMinimum - Math.round(stepsFromMinimum)) >= 1e-8
  ) {
    throw new Error(`Focus distance ${target} is not reachable on the public control grid`);
  }

  await slider.evaluate((element, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    if (!setter) throw new Error("Unable to set the native range input value");
    setter.call(element, String(nextValue));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, target);
  await expect(slider).toHaveValue(String(target));
};

test("Interior Corner free mode exposes public Swing + Focus wall alignment", async ({ page }) => {
  test.setTimeout(120_000);
  const measuredStage = <T>(name: string, operation: () => Promise<T>) =>
    test.step(name, operation);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (isKnownFiberClockDeprecation(message)) return;
    if (
      (message.type() === "error" || message.type() === "warning") &&
      !isAllowedEnvironmentConsoleMessage(message.text())
    ) {
      consoleProblems.push(message.text());
    }
  });

  await measuredStage("Route navigation and Camera Controls readiness", async () => {
    await page.goto("/simulator/free/interior-corner?rttDiagnostics=1");
    await expect(page).toHaveURL(/\/simulator\/free\/interior-corner\?rttDiagnostics=1$/);
  });

  const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  const rise = cameraControls.getByRole("slider", { name: "Rise" });
  const swing = cameraControls.getByRole("slider", { name: "Swing" });
  const focus = cameraControls.getByRole("slider", { name: "Focus distance" });
  const feedbackView = await measuredStage("Open Learning Feedback", () =>
    openLearningFeedback(page),
  );
  const compositionFeedback = feedbackView.getByTestId("interior-corner-rise-composition-feedback");
  const focusFeedback = feedbackView.getByTestId("interior-corner-focus-feedback");

  await measuredStage("Initial public movement values and focus feedback", async () => {
    await expect(rise).toHaveValue("0");
    await expect(swing).toHaveValue("0");
    await expect(focus).toHaveValue("8000");
    await expect(focusFeedback).toContainText("Focus alone cannot hold the near, middle, and far details together");
  });

  const rtt = page.getByTestId("ground-glass-rtt");
  await measuredStage("Ground Glass final-contentful readiness", async () => {
    await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
    await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  });

  await measuredStage("Rise 0 → 33", async () => {
    await setStepRangeInput(page, "Rise", 33);
    await expect(rise).toHaveValue("33");
    await expect(compositionFeedback).toContainText("upper architecture is now inside a safer frame");
  });

  await measuredStage("Swing 0 → +3.6", async () => {
    await setRangeDirectOnGrid(page, "Swing", 3.6);
    await expect(swing).toHaveValue("3.6");
    await expect(focusFeedback).toContainText("receding wall is not yet consistently sharp");
  });

  await measuredStage("Focus 8000 → 38140 and aligned-state feedback", async () => {
    await setReachableFocusValue(page, 38140);
    await expect(focus).toHaveValue("38140");
    await expect(focusFeedback).toContainText("near, middle, and far details on the receding side wall are acceptably sharp");
    await expect(compositionFeedback).toContainText("upper architecture is now inside a safer frame");
    await expect(swing).toBeEnabled();
  });

  await measuredStage("Swing +3.6 → −3.6 and reverse-state feedback", async () => {
    await setRangeDirectOnGrid(page, "Swing", -3.6);
    await expect(swing).toHaveValue("-3.6");
    await expect(focusFeedback).toContainText("Focus alone cannot hold the near, middle, and far details together");
    await expect(focusFeedback).not.toContainText("Refine receding-wall focus");
  });

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});

test("Interior Corner Swing keyboard steps update the public movement readout in both directions", async ({ page }) => {
  await page.goto("/simulator/free/interior-corner?rttDiagnostics=1");
  await expect(page).toHaveURL(/\/simulator\/free\/interior-corner\?rttDiagnostics=1$/);

  const swing = page.getByRole("region", { name: "Camera Controls" }).getByRole("slider", {
    name: "Swing",
  });
  await expect(swing).toBeEnabled();
  await expect(swing).toHaveValue("0");

  const [minimumText, maximumText, stepText] = await Promise.all([
    swing.getAttribute("min"),
    swing.getAttribute("max"),
    swing.getAttribute("step"),
  ]);
  const minimum = Number(minimumText);
  const maximum = Number(maximumText);
  const step = Number(stepText);
  const initial = Number(await swing.inputValue());
  const forward = initial + step;
  const forwardAgain = initial + 2 * step;
  expect([minimum, maximum, step, initial, forward, forwardAgain].every(Number.isFinite)).toBe(true);
  expect(step).toBeGreaterThan(0);
  expect(forwardAgain).toBeLessThanOrEqual(maximum);
  expect(initial).toBeGreaterThanOrEqual(minimum);

  const movementReadout = swing.locator("xpath=..").locator(".compact-range-row__value");
  const formattedValue = (value: number) => `${value.toFixed(1)}°`;
  await expect(movementReadout).toHaveText(formattedValue(initial));

  await swing.focus();
  await swing.press("ArrowRight");
  await expect(swing).toHaveValue(String(forward));
  await expect(movementReadout).toHaveText(formattedValue(forward));

  await swing.press("ArrowRight");
  await expect(swing).toHaveValue(String(forwardAgain));
  await expect(movementReadout).toHaveText(formattedValue(forwardAgain));

  await swing.press("ArrowLeft");
  await expect(swing).toHaveValue(String(forward));
  await expect(movementReadout).toHaveText(formattedValue(forward));
});

test("validated direct Swing input rejects inaccessible and off-grid targets", async ({ page }) => {
  await page.goto("/simulator/free/interior-corner?rttDiagnostics=1");
  const swing = page.getByRole("slider", { name: "Swing" });
  await expect(swing).toBeEnabled();
  await expect(swing).toHaveValue("0");

  await expect(setRangeDirectOnGrid(page, "Missing Swing", 0.1)).rejects.toThrow();
  await expect(setRangeDirectOnGrid(page, "Swing", 3.65)).rejects.toThrow(/public control grid/);
  await expect(setRangeDirectOnGrid(page, "Swing", 10.1)).rejects.toThrow(/public control grid/);
  await expect(setRangeDirectOnGrid(page, "Swing", Number.NaN)).rejects.toThrow(/public control grid/);
  await expect(swing).toHaveValue("0");

  await swing.evaluate((element) => {
    (element as HTMLInputElement).disabled = true;
  });
  await expect(setRangeDirectOnGrid(page, "Swing", 0.1)).rejects.toThrow();
  await expect(swing).toHaveValue("0");
});
