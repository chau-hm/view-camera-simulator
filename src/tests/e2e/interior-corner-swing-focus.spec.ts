import { expect, test, type Page } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

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
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (
      (message.type() === "error" || message.type() === "warning") &&
      !isAllowedEnvironmentConsoleMessage(message.text())
    ) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto("/simulator/free/interior-corner?rttDiagnostics=1");
  await expect(page).toHaveURL(/\/simulator\/free\/interior-corner\?rttDiagnostics=1$/);

  const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  const rise = cameraControls.getByRole("slider", { name: "Rise" });
  const swing = cameraControls.getByRole("slider", { name: "Swing" });
  const focus = cameraControls.getByRole("slider", { name: "Focus distance" });
  const compositionFeedback = page.getByTestId("interior-corner-rise-composition-feedback");
  const focusFeedback = page.getByTestId("interior-corner-focus-feedback");

  await expect(rise).toHaveValue("0");
  await expect(swing).toHaveValue("0");
  await expect(focus).toHaveValue("8000");
  await expect(focusFeedback).toContainText("Focus alone cannot hold the near, middle, and far details together");

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await setStepRangeInput(page, "Rise", 33);
  await expect(rise).toHaveValue("33");
  await expect(compositionFeedback).toContainText("upper architecture is now inside a safer frame");

  await setStepRangeInput(page, "Swing", 3.6);
  await expect(swing).toHaveValue("3.6");
  await expect(focusFeedback).toContainText("receding wall is not yet consistently sharp");

  await setReachableFocusValue(page, 38140);
  await expect(focus).toHaveValue("38140");
  await expect(focusFeedback).toContainText("near, middle, and far details on the receding side wall are acceptably sharp");
  await expect(compositionFeedback).toContainText("upper architecture is now inside a safer frame");
  await expect(swing).toBeEnabled();

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
