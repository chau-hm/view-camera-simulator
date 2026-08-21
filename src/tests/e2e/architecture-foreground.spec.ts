import { expect, test } from "@playwright/test";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

test("Architecture + Foreground exposes the cumulative photographic problem in Free Practice", async ({ page }) => {
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
  await expect(
    page.getByText(
      "Explore the cumulative Architecture + Foreground problem: correct the framing with Front Rise, then compare focus-plane alignment across depth.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Guided lesson progress" })).not.toBeVisible();

  const sceneCanvas = page.getByTestId("scene-canvas");
  await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "architecture-foreground");
  await expect(sceneCanvas).toHaveAttribute("data-optics-fallback-applied", "false");
  await expect(sceneCanvas.locator("canvas")).toHaveCount(1);

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-depth-available", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "parallel-thin-lens");
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  expect(Number(await rtt.getAttribute("data-rtt-final-variance"))).toBeGreaterThan(4);
  expect(Number(await rtt.getAttribute("data-rtt-final-non-background"))).toBeGreaterThan(0);
  await expect(rtt.locator("canvas")).toBeVisible();

  const focusAssist = page.getByLabel("Focus assist");
  await expect(focusAssist).toBeEnabled();
  if (!(await focusAssist.isChecked())) await focusAssist.check();

  const sharpness = await Promise.all(
    ["foreground-near", "foreground-middle", "building-base", "building-middle"].map(async (id) => {
      const progress = page.getByRole("progressbar", { name: `${id} sharpness` });
      await expect(progress).toBeVisible();
      return Number(await progress.getAttribute("aria-valuenow"));
    }),
  );
  expect(sharpness[0]).toBeLessThan(sharpness[3]);
  expect(sharpness[1]).toBeGreaterThan(sharpness[0]);
  expect(sharpness[3]).toBeGreaterThanOrEqual(80);

  const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  await expect(cameraControls.getByRole("slider", { name: "Rise" })).toBeEnabled();
  await expect(cameraControls.getByRole("slider", { name: "Rise" })).toHaveValue("0");
  await expect(cameraControls.getByRole("slider", { name: "Tilt" })).toBeEnabled();
  await expect(cameraControls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByLabel("Focus distance")).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeEnabled();

  await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  await expect(page.locator("section[data-geometry-fit]")).toHaveAttribute("data-geometry-view", "side");
  await expect(page.getByTestId("geometry-svg-side")).toBeVisible();
  await expect(page.getByTestId("architecture-foreground-ground-guide").first()).toBeVisible();
  await expect(page.getByTestId("architecture-foreground-building-guide").first()).toBeVisible();

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
