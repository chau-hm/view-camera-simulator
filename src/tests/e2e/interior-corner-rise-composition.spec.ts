import { expect, test } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

test("Interior Corner free mode exposes reachable Rise composition feedback", async ({ page }) => {
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
  await expect(rise).toBeEnabled();
  await expect(rise).toHaveValue("0");

  const feedback = page.getByTestId("interior-corner-rise-composition-feedback");
  await expect(feedback).toContainText("upper architecture is still too close to the top edge");

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await setStepRangeInput(page, "Rise", 33);
  await expect(rise).toHaveValue("33");
  await expect(feedback).toContainText("upper architecture is now inside a safer frame");
  await expect(cameraControls.getByRole("slider", { name: "Swing" })).toBeEnabled();

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
