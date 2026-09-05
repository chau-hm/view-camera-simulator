import { expect, test, type Page } from "@playwright/test";
import { setRangeDirect } from "./helpers/rangeInput";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const completedHeading = (page: Page) =>
  page.getByRole("heading", { name: "Task completed" });

const expectLessonStage = async (page: Page, step: string, label: string) => {
  const progress = page.getByRole("region", { name: "Guided lesson progress" });
  await expect(progress).toBeVisible();
  await expect(progress).toContainText(step);
  await expect(page.locator('[aria-current="step"]')).toHaveText(new RegExp(label));
};

const expectGroundGlass = async (page: Page) => {
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "oblique-tabletop");
  await expect(rtt.locator("canvas")).toBeVisible();
};

test("Oblique Tabletop completes the public Focus → Tilt → Swing → Focus → Aperture lesson", async ({
  page,
}) => {
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
    .filter({ has: page.getByRole("heading", { name: "Oblique Tabletop" }) });
  await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
    "href",
    "/simulator/free/oblique-tabletop",
  );
  await expect(card.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
    "href",
    "/simulator/free/oblique-tabletop?lesson=1",
  );
  await card.getByRole("link", { name: "Guided Lesson" }).click();

  await expect(page).toHaveURL(/\/simulator\/free\/oblique-tabletop\?lesson=1$/);
  await expectLessonStage(page, "Step 1 of 6", "Observe");
  await expect(page.getByRole("heading", { name: "Observe the Problem" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("4570");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await expectGroundGlass(page);

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(
    /\/simulator\/guided\/oblique-tabletop\/oblique-tabletop-focus-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 2 of 6", "Focus");
  await expect(page.getByRole("heading", { name: "Focus the tabletop centre" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Tilt" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await expect(page.getByLabel("Focus distance")).toHaveValue("4770");
  await setRangeDirect(page, "Focus distance", 4570);
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(
    /\/simulator\/guided\/oblique-tabletop\/oblique-tabletop-tilt-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 3 of 6", "Front Tilt");
  await expect(page.getByRole("heading", { name: "Improve near-to-far focus" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await setStepRangeInput(page, "Tilt", -4.9);
  await setRangeDirect(page, "Focus distance", 3310);
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(
    /\/simulator\/guided\/oblique-tabletop\/oblique-tabletop-swing-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 4 of 6", "Front Swing");
  await expect(page.getByRole("heading", { name: "Add the lateral component" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("-4.9");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("3310");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await setStepRangeInput(page, "Tilt", -7.4);
  await setStepRangeInput(page, "Swing", -1.4);
  await setRangeDirect(page, "Focus distance", 2630);
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(
    /\/simulator\/guided\/oblique-tabletop\/oblique-tabletop-refine-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 5 of 6", "Refine Focus");
  await expect(page.getByRole("heading", { name: "Place the compound focus plane" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveValue("-7.4");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("-1.4");
  await expect(page.getByLabel("Focus distance")).toHaveValue("2630");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await setRangeDirect(page, "Focus distance", 2580);
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(
    /\/simulator\/guided\/oblique-tabletop\/oblique-tabletop-aperture-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 6 of 6", "Aperture");
  await expect(page.getByRole("heading", { name: "Add depth around the plane" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Tilt" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByLabel("Focus distance")).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeEnabled();
  await expect(page.getByText("Lesson complete", { exact: true })).not.toBeVisible();
  await expectGroundGlass(page);

  await page.getByRole("combobox", { name: "Aperture" }).selectOption("22");
  await expect(page.getByText("Lesson complete", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText(/You used Tilt and Swing to orient one three-dimensional focus plane/),
  ).toBeVisible();

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
