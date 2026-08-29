import { expect, test } from "@playwright/test";
import { setRangeDirect } from "./helpers/rangeInput";

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
      "Explore the cumulative Architecture + Foreground problem: use Rise for framing, Tilt and Focus for focus-plane alignment, and Aperture for usable depth across the full photograph.",
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

test("Architecture + Foreground focus propagates to the physical film plane and processed RTT", async ({ page }) => {
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
  const sceneCanvas = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  const focus = page.getByLabel("Focus distance");
  const aperture = page.getByRole("combobox", { name: "Aperture" });

  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await aperture.selectOption("5.6");
  await setRangeDirect(page, "Focus distance", 3920);
  await expect(focus).toHaveValue("3920");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  const lensAtNear = await sceneCanvas.getAttribute("data-camera-lens-center-world");
  const filmAtNear = await sceneCanvas.getAttribute("data-camera-film-center-world");
  const varianceAtNear = Number(await rtt.getAttribute("data-rtt-final-variance"));
  expect(lensAtNear).toBeTruthy();
  expect(filmAtNear).toBeTruthy();
  expect(Number.isFinite(varianceAtNear)).toBe(true);

  await setRangeDirect(page, "Focus distance", 9450);
  await expect(focus).toHaveValue("9450");
  await expect.poll(() => sceneCanvas.getAttribute("data-camera-film-center-world")).not.toBe(filmAtNear);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  const lensAtFar = await sceneCanvas.getAttribute("data-camera-lens-center-world");
  const filmAtFar = await sceneCanvas.getAttribute("data-camera-film-center-world");
  const varianceAtFar = Number(await rtt.getAttribute("data-rtt-final-variance"));
  expect(lensAtFar).toBe(lensAtNear);
  expect(filmAtFar).not.toBe(filmAtNear);
  expect(Number.isFinite(varianceAtFar)).toBe(true);
  expect(Math.abs(varianceAtFar - varianceAtNear)).toBeGreaterThan(0.01);
  await expect(page.locator("body")).not.toContainText(/NaN|Infinity/);

  const rawToggle = page.getByLabel("Raw RTT — bypass DOF");
  await rawToggle.check();
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await rawToggle.uncheck();
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
