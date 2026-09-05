import { expect, test, type Page } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

const expectLessonStage = async (page: Page, step: string, label: string) => {
  const progress = page.getByRole("region", { name: "Guided lesson progress" });
  await expect(progress).toBeVisible();
  await expect(progress).toContainText(step);
  await expect(page.locator('[aria-current="step"]')).toHaveText(new RegExp(label));
};

const expectGroundGlass = async (page: Page) => {
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
  await expect(rtt.locator("canvas")).toBeVisible();
  const finalContentful = await rtt.getAttribute("data-rtt-final-contentful");
  if (finalContentful !== null) expect(finalContentful).toBe("true");
};

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
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Unable to set the native range input value");
    setter.call(element, String(nextValue));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, target);
  await expect(slider).toHaveValue(String(target));
};

test("Interior Corner guided lesson preserves the photographic sequence", async ({ page }) => {
  test.setTimeout(240_000);
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

  await page.goto("/scenes");
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Interior Corner — Rise + Swing" }) });
  await expect(card.locator("img")).toHaveAttribute("src", "/assets/interior-corner.png");
  await expect(card.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
    "href",
    "/simulator/free/interior-corner?lesson=1",
  );

  await page.goto("/simulator/free/interior-corner?lesson=1&rttDiagnostics=1");
  await expect(page).toHaveURL(/\/simulator\/free\/interior-corner\?lesson=1&rttDiagnostics=1$/);
  await expectLessonStage(page, "Step 1 of 4", "Observe");
  await expect(page.getByRole("heading", { name: "Observe the Problem" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Focus distance" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("8000");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("5.6");
  await expectGroundGlass(page);

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(
    /\/simulator\/guided\/interior-corner\/interior-corner-compose-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 2 of 4", "Compose");
  await expect(page.getByRole("heading", { name: "Compose the Interior Corner with Rise" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toBeEnabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Focus distance" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await setStepRangeInput(page, "Rise", 33);
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  await expect(page).toHaveURL(
    /\/simulator\/guided\/interior-corner\/interior-corner-align-focus-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 3 of 4", "Align Focus");
  await expect(page.getByRole("heading", { name: "Align the Receding-Wall Focus" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("33");
  await expect(page.getByRole("slider", { name: "Rise" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toBeEnabled();
  await expect(page.getByRole("slider", { name: "Focus distance" })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();

  await setStepRangeInput(page, "Swing", -3.6);
  await setReachableFocusValue(page, 38140);
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(page.getByText("The focus plane is not yet turning toward the receding wall.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

  await setStepRangeInput(page, "Swing", 3.6);
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  await expect(page).toHaveURL(
    /\/simulator\/guided\/interior-corner\/interior-corner-depth-of-field-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 4 of 4", "Depth of Field");
  await expect(page.getByRole("heading", { name: "Add Usable Depth with Aperture" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("33");
  await expect(page.getByRole("slider", { name: "Rise" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("3.6");
  await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("38140");
  await expect(page.getByRole("slider", { name: "Focus distance" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("5.6");
  await expect(page.getByText("Complete this stage to finish the lesson.", { exact: true })).toBeVisible();
  await expectGroundGlass(page);

  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");
  await expect(page.getByText("Lesson complete", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Restart lesson" })).toHaveAttribute(
    "href",
    "/simulator/free/interior-corner?lesson=1",
  );
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("33");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("3.6");
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("38140");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await expectGroundGlass(page);

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});

test("Interior Corner guided lesson restart returns to neutral Observe", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/guided/interior-corner/interior-corner-depth-of-field-01?lesson=1");
  await expectLessonStage(page, "Step 4 of 4", "Depth of Field");
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("8000");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("5.6");
  await page.getByRole("link", { name: "Restart lesson" }).click();
  await expect(page).toHaveURL(/\/simulator\/free\/interior-corner\?lesson=1$/);
  await expectLessonStage(page, "Step 1 of 4", "Observe");
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Focus distance" })).toHaveValue("8000");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("5.6");
});
