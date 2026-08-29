import { expect, test, type Page } from "@playwright/test";
import { setRangeDirect } from "./helpers/rangeInput";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const completedHeading = (page: Page) => page.getByRole("heading", { name: "Task completed" });

const assertFiniteGroundGlass = async (page: Page) => {
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  await expect(rtt.locator("canvas")).toBeVisible();
  const finalContentful = await rtt.getAttribute("data-rtt-final-contentful");
  if (finalContentful !== null) expect(finalContentful).toBe("true");

  expect(await page.locator("body").innerText()).not.toMatch(/NaN|Infinity/);
  for (const targetId of ["foreground-near", "foreground-middle", "building-base", "building-middle"]) {
    const progress = page.getByRole("progressbar", { name: `${targetId} sharpness` });
    await expect(progress).toBeVisible();
    expect(Number.isFinite(Number(await progress.getAttribute("aria-valuenow")))).toBe(true);
  }
  expect(await page.locator("body").innerText()).not.toMatch(/NaN|Infinity/);
};

const expectLessonStage = async (page: Page, step: string, label: string) => {
  const progress = page.getByRole("region", { name: "Guided lesson progress" });
  await expect(progress).toBeVisible();
  await expect(progress).toContainText(step);
  await expect(page.locator('[aria-current="step"]')).toHaveText(new RegExp(label));
};

test("Architecture + Foreground completes its five-stage Guided Lesson from the Scenes page", async ({ page }) => {
  test.setTimeout(360_000);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      if (!/GL Driver Message .*GPU stall due to ReadPixels/.test(message.text())) {
        consoleProblems.push(message.text());
      }
    }
  });

  await page.goto("/scenes");
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Architecture + Foreground" }) });
  await expect(card.locator("img")).toHaveAttribute("src", "/assets/architecture-foreground.png");
  await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
    "href",
    "/simulator/free/architecture-foreground",
  );
  await expect(card.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
    "href",
    "/simulator/free/architecture-foreground?lesson=1",
  );
  await card.getByRole("link", { name: "Guided Lesson" }).click();

  await expect(page).toHaveURL(/\/simulator\/free\/architecture-foreground\?lesson=1$/);
  await expectLessonStage(page, "Step 1 of 5", "Observe");
  await expect(page.getByText("Architecture + Foreground Guided Lesson", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Observe the Problem" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("9490");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await assertFiniteGroundGlass(page);

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/simulator\/guided\/architecture-foreground\/architecture-foreground-rise-01\?lesson=1$/);
  await expectLessonStage(page, "Step 2 of 5", "Compose");
  await expect(page.getByRole("heading", { name: "Frame the Building" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await setStepRangeInput(page, "Rise", 20);
  await expect(completedHeading(page)).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue" })).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/simulator\/guided\/architecture-foreground\/architecture-foreground-tilt-focus-01\?lesson=1$/);
  await expectLessonStage(page, "Step 3 of 5", "Align Focus");
  await expect(page.getByRole("heading", { name: "Align the Focus Plane" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("20");
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("9490");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await assertFiniteGroundGlass(page);
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await setStepRangeInput(page, "Tilt", 2);
  await setRangeDirect(page, "Focus distance", 6830);
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/simulator\/guided\/architecture-foreground\/architecture-foreground-dof-01\?lesson=1$/);
  await expectLessonStage(page, "Step 4 of 5", "Depth of Field");
  await expect(page.getByRole("heading", { name: "Extend the Depth of Field" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Tilt" })).toBeDisabled();
  await expect(page.getByLabel("Focus distance")).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

  // Previous uses the shared lesson href and re-enters the task's own initial state.
  await page.getByRole("link", { name: "Previous" }).click();
  await expect(page).toHaveURL(/\/simulator\/guided\/architecture-foreground\/architecture-foreground-tilt-focus-01\?lesson=1$/);
  await expectLessonStage(page, "Step 3 of 5", "Align Focus");
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("20");
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("9490");
  await setStepRangeInput(page, "Tilt", 2);
  await setRangeDirect(page, "Focus distance", 6830);
  await page.getByRole("link", { name: "Continue" }).click();
  await expectLessonStage(page, "Step 4 of 5", "Depth of Field");

  await assertFiniteGroundGlass(page);
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("32");
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/simulator\/guided\/architecture-foreground\/architecture-foreground-compound-01\?lesson=1$/);
  await expectLessonStage(page, "Step 5 of 5", "Final Challenge");
  await expect(page.getByRole("heading", { name: "Complete the Photograph" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("9490");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await expect(page.getByText("Lesson complete", { exact: true })).not.toBeVisible();
  await assertFiniteGroundGlass(page);

  // Restart remains on the lesson stage and restores the compound task's neutral state.
  await setStepRangeInput(page, "Rise", 20);
  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(page).toHaveURL(/\/simulator\/guided\/architecture-foreground\/architecture-foreground-compound-01\?lesson=1$/);
  await expectLessonStage(page, "Step 5 of 5", "Final Challenge");
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("9490");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await expect(page.getByText("Lesson complete", { exact: true })).not.toBeVisible();

  await setStepRangeInput(page, "Rise", 20);
  await setStepRangeInput(page, "Tilt", 2);
  await setRangeDirect(page, "Focus distance", 6830);
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("32");
  await expect(page.getByText("Lesson complete", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/You corrected the framing with Rise/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Scenes" })).toBeVisible();
  await assertFiniteGroundGlass(page);

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});

test("Architecture + Foreground lesson entry resets after Free Practice and direct task routes stay standalone", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/simulator/free/architecture-foreground");
  await setStepRangeInput(page, "Rise", 20);
  await setStepRangeInput(page, "Tilt", 2);
  await setRangeDirect(page, "Focus distance", 6830);
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("22");
  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);

  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Architecture + Foreground" }) });
  await card.getByRole("link", { name: "Guided Lesson" }).click();
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-foreground\?lesson=1$/);
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("9490");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");

  await page.goto("/simulator/guided/architecture-foreground/architecture-foreground-dof-01");
  await expect(page.getByRole("region", { name: "Guided lesson progress" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Extend the Depth of Field" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("32");
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });
});
