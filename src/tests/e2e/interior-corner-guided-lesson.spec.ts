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

const expectGroundGlassMounted = async (page: Page) => {
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  await expect(rtt.locator("canvas")).toBeVisible();
};

const expectGroundGlassReady = async (page: Page) => {
  const rtt = page.getByTestId("ground-glass-rtt");
  await expectGroundGlassMounted(page);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
};

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

test("Interior Corner completes the public Compose → Swing → Refine → Aperture lesson", async ({
  page,
}) => {
  test.setTimeout(360_000);
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
  await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
    "href",
    "/simulator/free/interior-corner",
  );
  await expect(card.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
    "href",
    "/simulator/free/interior-corner?lesson=1",
  );
  // Keep the catalog link contract above, then opt into the existing RTT
  // diagnostics marker for the public lesson route.
  await page.goto("/simulator/free/interior-corner?lesson=1&rttDiagnostics=1");

  await expect(page).toHaveURL(/\/simulator\/free\/interior-corner\?lesson=1&rttDiagnostics=1$/);
  await expectLessonStage(page, "Step 1 of 5", "Observe");
  await expect(page.getByRole("heading", { name: "Observe the Problem" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("8000");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("5.6");
  await expectGroundGlassReady(page);

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(
    /\/simulator\/guided\/interior-corner\/interior-corner-compose-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 2 of 5", "Compose");
  await expect(page.getByRole("heading", { name: "Compose the Interior Corner with Rise" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toBeEnabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByLabel("Focus distance")).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await setStepRangeInput(page, "Rise", 33);
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(
    /\/simulator\/guided\/interior-corner\/interior-corner-swing-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 3 of 5", "Front Swing");
  await expect(page.getByRole("heading", { name: "Turn the Focus Plane with Swing" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Swing" })).toBeEnabled();
  await expect(page.getByLabel("Focus distance")).toHaveValue("8000");
  await expect(page.getByLabel("Focus distance")).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await setStepRangeInput(page, "Swing", 3.6);
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(
    /\/simulator\/guided\/interior-corner\/interior-corner-refine-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 4 of 5", "Refine Focus");
  await expect(page.getByRole("heading", { name: "Place the Focus Plane on the Wall" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveValue("3.6");
  await expect(page.getByLabel("Focus distance")).toHaveValue("8000");
  await expect(page.getByLabel("Focus distance")).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await expect(completedHeading(page)).not.toBeVisible();
  // Focus is still changed through the rendered public range input. The
  // shared helper dispatches the native input event once instead of sending
  // thousands of slow key events through the WebGL render loop.
  await setRangeDirect(page, "Focus distance", 38140);
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(
    /\/simulator\/guided\/interior-corner\/interior-corner-aperture-01\?lesson=1$/,
  );
  await expectLessonStage(page, "Step 5 of 5", "Aperture");
  await expect(page.getByRole("heading", { name: "Add Depth around the Aligned Plane" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Rise" })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByLabel("Focus distance")).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("5.6");
  await expect(page.getByText("Lesson complete", { exact: true })).not.toBeVisible();
  await expectGroundGlassMounted(page);

  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");
  await expect(page.getByText("Lesson complete", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
