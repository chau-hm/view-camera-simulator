import { expect, test } from "@playwright/test";
import { setRangeDirect } from "./helpers/rangeInput";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

test("Architecture + Foreground compound task solves the photograph from neutral", async ({ page }) => {
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

  await page.goto(
    "/simulator/guided/architecture-foreground/architecture-foreground-compound-01?rttDiagnostics=1",
  );
  await expect(page).toHaveURL(
    /\/simulator\/guided\/architecture-foreground\/architecture-foreground-compound-01\?rttDiagnostics=1$/,
  );
  await expect(page.getByRole("heading", { name: "Complete the Photograph" })).toBeVisible();
  await expect(
    page.getByText(
      "Correct the framing, align and place the focus plane, then use Aperture to produce an acceptably sharp architectural photograph from foreground to building while preserving parallel verticals.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();

  const controls = page.getByRole("region", { name: "Camera Controls" });
  const rise = controls.getByRole("slider", { name: "Rise" });
  const tilt = controls.getByRole("slider", { name: "Tilt" });
  const focus = page.getByLabel("Focus distance");
  const aperture = page.getByRole("combobox", { name: "Aperture" });
  await expect(rise).toBeEnabled();
  await expect(rise).toHaveValue("0");
  await expect(tilt).toBeEnabled();
  await expect(tilt).toHaveValue("0");
  await expect(focus).toBeEnabled();
  await expect(focus).toHaveValue("9490");
  await expect(aperture).toBeEnabled();
  await expect(aperture).toHaveValue("11");
  await expect(controls.getByRole("slider", { name: "Swing" })).toBeDisabled();

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  // A physically plausible stopped-down result cannot complete the compound
  // lesson without the required Tilt operation.
  await setStepRangeInput(page, "Rise", 20);
  await setRangeDirect(page, "Focus distance", 6200);
  await expect(focus).toHaveValue("6200");
  await aperture.selectOption("22");
  await expect(aperture).toHaveValue("22");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await aperture.selectOption("32");
  await expect(aperture).toHaveValue("32");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();

  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(rise).toHaveValue("0");
  await expect(tilt).toHaveValue("0");
  await expect(focus).toHaveValue("9490");
  await expect(aperture).toHaveValue("11");

  await setStepRangeInput(page, "Rise", 20);
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await setStepRangeInput(page, "Tilt", 2);
  await setRangeDirect(page, "Focus distance", 6830);
  await expect(focus).toHaveValue("6830");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "derived-planes");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await aperture.selectOption("32");
  await expect(aperture).toHaveValue("32");
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/Rise corrected framing, Tilt and Focus aligned the focus plane/i),
  ).toBeVisible();

  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(rise).toHaveValue("0");
  await expect(tilt).toHaveValue("0");
  await expect(focus).toHaveValue("9490");
  await expect(aperture).toHaveValue("11");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
