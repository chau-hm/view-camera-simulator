import { expect, test, type Page } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const completedHeading = (page: Page) => page.getByRole("heading", { name: "Task completed" });

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

test("Architecture + Foreground Free Practice exposes cumulative Rise, Tilt, Focus, and Aperture controls", async ({ page }) => {
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

  await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-foreground\?rttDiagnostics=1$/);
  await expect(page.getByRole("region", { name: "Guided lesson progress" })).not.toBeVisible();

  const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  const rise = cameraControls.getByRole("slider", { name: "Rise" });
  await expect(rise).toBeEnabled();
  await expect(rise).toHaveValue("0");
  await expect(cameraControls.getByRole("slider", { name: "Tilt" })).toBeEnabled();
  await expect(cameraControls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByLabel("Focus distance")).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeEnabled();

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await page.getByLabel("Focus assist").check();
  const nearSharpness = page.getByRole("progressbar", { name: "foreground-near sharpness" });
  const buildingSharpness = page.getByRole("progressbar", { name: "building-middle sharpness" });
  await expect(nearSharpness).toBeVisible();
  await expect(buildingSharpness).toBeVisible();

  await setStepRangeInput(page, "Rise", 20);
  await expect(rise).toHaveValue("20");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  expect(Number(await nearSharpness.getAttribute("aria-valuenow"))).toBeLessThan(
    Number(await buildingSharpness.getAttribute("aria-valuenow")),
  );

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});

test("Architecture + Foreground Rise guided task is observable, reachable, and restartable", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(
    "/simulator/guided/architecture-foreground/architecture-foreground-rise-01?rttDiagnostics=1",
  );
  await expect(page).toHaveURL(
    /\/simulator\/guided\/architecture-foreground\/architecture-foreground-rise-01\?rttDiagnostics=1$/,
  );
  await expect(page.getByRole("heading", { name: "Frame the Building" })).toBeVisible();
  await expect(
    page.getByText(
      "Use Front Rise to include the required roof region while keeping the building base in frame and the camera level.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Guided lesson progress" })).not.toBeVisible();
  await expect(completedHeading(page)).not.toBeVisible();

  const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  const rise = cameraControls.getByRole("slider", { name: "Rise" });
  await expect(rise).toBeEnabled();
  await expect(rise).toHaveValue("0");
  await expect(cameraControls.getByRole("slider", { name: "Tilt" })).toBeDisabled();
  await expect(cameraControls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByLabel("Focus distance")).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await setStepRangeInput(page, "Rise", 10);
  await expect(rise).toHaveValue("10");
  await expect(completedHeading(page)).toBeVisible();
  await expect(
    page.getByText(/foreground sharpness problem remains for a later lesson/i),
  ).toBeVisible();

  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(completedHeading(page)).not.toBeVisible();
  await expect(rise).toHaveValue("0");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
});
