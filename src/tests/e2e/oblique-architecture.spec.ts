import { expect, test } from "@playwright/test";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

test("Oblique Architecture mounts the level static problem through the shared RTT subject", async ({ page }) => {
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

  await page.goto("/simulator/free/oblique-architecture?rttDiagnostics=1");
  await expect(page).toHaveURL(/\/simulator\/free\/oblique-architecture\?rttDiagnostics=1$/);
  await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible();

  const sceneCanvas = page.getByTestId("scene-canvas");
  await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", "oblique-architecture");
  await expect(sceneCanvas).toHaveAttribute("data-optics-fallback-applied", "false");
  await expect(sceneCanvas.locator("canvas")).toHaveCount(1);

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "oblique-architecture");
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-depth-available", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "parallel-thin-lens");
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  expect(Number(await rtt.getAttribute("data-rtt-final-variance"))).toBeGreaterThan(4);
  expect(Number(await rtt.getAttribute("data-rtt-final-non-background"))).toBeGreaterThan(0);
  await expect(rtt.locator("canvas")).toBeVisible();

  const nearSharpness = page.getByRole("progressbar", { name: "facade-near sharpness" });
  const middleSharpness = page.getByRole("progressbar", { name: "facade-middle sharpness" });
  const farSharpness = page.getByRole("progressbar", { name: "facade-far sharpness" });
  await expect(nearSharpness).toHaveCount(1);
  await expect(middleSharpness).toHaveCount(1);
  await expect(farSharpness).toHaveCount(1);
  expect(Number(await nearSharpness.getAttribute("aria-valuenow"))).toBeLessThan(
    Number(await middleSharpness.getAttribute("aria-valuenow")),
  );
  expect(Number(await farSharpness.getAttribute("aria-valuenow"))).toBeLessThan(
    Number(await middleSharpness.getAttribute("aria-valuenow")),
  );

  // The static slice exposes observation-only controls: no movement or reset
  // control is offered, while focus and aperture stay visibly locked.
  const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  await expect(cameraControls.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  await expect(cameraControls.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  await expect(cameraControls.getByRole("button", { name: /Reset Movements/ })).toHaveCount(0);
  await expect(page.getByText("Focus is fixed for this lesson", { exact: true })).toBeVisible();
  await expect(page.getByText("Aperture is fixed for this lesson", { exact: true })).toBeVisible();

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
