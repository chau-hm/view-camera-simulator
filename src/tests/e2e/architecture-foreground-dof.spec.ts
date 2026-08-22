import { expect, test } from "@playwright/test";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

test("Architecture + Foreground Free Practice exposes Aperture after Rise, Tilt, and Focus", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");

  const controls = page.getByRole("region", { name: "Camera Controls" });
  await expect(controls.getByRole("slider", { name: "Rise" })).toBeEnabled();
  await expect(controls.getByRole("slider", { name: "Tilt" })).toBeEnabled();
  await expect(page.getByLabel("Focus distance")).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeEnabled();
  await expect(controls.getByRole("slider", { name: "Swing" })).toBeDisabled();

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  const aperture = page.getByRole("combobox", { name: "Aperture" });
  await expect(aperture).toHaveValue("11");
  await aperture.selectOption("22");
  await expect(aperture).toHaveValue("22");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
});

test("Architecture + Foreground DOF task starts solved through PR7C and completes with Aperture only", async ({ page }) => {
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
    "/simulator/guided/architecture-foreground/architecture-foreground-dof-01?rttDiagnostics=1",
  );
  await expect(page).toHaveURL(
    /\/simulator\/guided\/architecture-foreground\/architecture-foreground-dof-01\?rttDiagnostics=1$/,
  );
  await expect(page.getByRole("heading", { name: "Extend the Depth of Field" })).toBeVisible();
  await expect(
    page.getByText(
      "Stop down the Aperture until the foreground and building are acceptably sharp while keeping the existing composition and focus-plane alignment.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();

  const controls = page.getByRole("region", { name: "Camera Controls" });
  const rise = controls.getByRole("slider", { name: "Rise" });
  const tilt = controls.getByRole("slider", { name: "Tilt" });
  const focus = page.getByLabel("Focus distance");
  const aperture = page.getByRole("combobox", { name: "Aperture" });
  await expect(rise).toBeDisabled();
  await expect(rise).toHaveValue("20");
  await expect(tilt).toBeDisabled();
  await expect(tilt).toHaveValue("2");
  await expect(focus).toBeDisabled();
  await expect(focus).toHaveValue("6830");
  await expect(aperture).toBeEnabled();
  await expect(aperture).toHaveValue("11");
  await expect(controls.getByRole("slider", { name: "Swing" })).toBeDisabled();

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "derived-planes");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await aperture.selectOption("22");
  await expect(aperture).toHaveValue("22");
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/focus plane was already aligned; stopping down has now expanded usable depth/i),
  ).toBeVisible();

  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(rise).toHaveValue("20");
  await expect(tilt).toHaveValue("2");
  await expect(focus).toHaveValue("6830");
  await expect(aperture).toHaveValue("11");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
