import { expect, test, type Page } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

const assertSharedObliqueRendering = async (page: Page) => {
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

  const sharpness = await Promise.all(
    ["facade-near", "facade-middle", "facade-far"].map(async (id) =>
      Number(await page.getByRole("progressbar", { name: `${id} sharpness` }).getAttribute("aria-valuenow")),
    ),
  );
  expect(sharpness[1]).toBeGreaterThan(sharpness[0]);
  expect(sharpness[1]).toBeGreaterThan(sharpness[2]);

  return { rtt, sceneCanvas };
};

const assertRiseTaskControls = async (page: Page) => {
  const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  const rise = cameraControls.getByRole("slider", { name: "Rise" });
  await expect(rise).toBeVisible();
  await expect(rise).toBeEnabled();
  await expect(cameraControls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(cameraControls.getByRole("slider", { name: "Tilt" })).toBeDisabled();
  await expect(page.getByLabel("Focus distance")).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reset movements" })).toBeVisible();
  return rise;
};

const assertFreeControls = async (page: Page) => {
  const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  const rise = cameraControls.getByRole("slider", { name: "Rise" });
  const swing = cameraControls.getByRole("slider", { name: "Swing" });
  const tilt = cameraControls.getByRole("slider", { name: "Tilt" });
  const focus = page.getByLabel("Focus distance");
  await expect(rise).toBeEnabled();
  await expect(swing).toBeEnabled();
  await expect(tilt).toBeDisabled();
  await expect(focus).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reset movements" })).toBeVisible();
  return { rise, swing, focus, rtt: page.getByTestId("ground-glass-rtt") };
};

test("Oblique Architecture free practice exposes Rise, Swing, and Focus", async ({ page }) => {
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
  await assertSharedObliqueRendering(page);
  const { rise, swing, focus, rtt } = await assertFreeControls(page);
  await expect(rise).toHaveValue("0");
  await expect(page.getByText("Aperture is fixed for this lesson", { exact: true })).toBeVisible();
  await expect(swing).toHaveValue("0");

  const currentSettings = page.getByTestId("current-settings-readout");
  await setStepRangeInput(page, "Rise", 20);
  await setStepRangeInput(page, "Swing", 5);
  await expect(currentSettings).toContainText("Front Rise: 20.0 mm");
  await expect(currentSettings).toContainText("Front Swing: 5.0°");

  const focusBefore = await focus.inputValue();

  const neutralSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  await setStepRangeInput(page, "Swing", 1);
  await expect(swing).toHaveValue("1");
  await setStepRangeInput(page, "Focus distance", Number(focusBefore) - 100);
  await expect(focus).not.toHaveValue(focusBefore);
  await expect.poll(async () => rtt.getAttribute("data-rtt-sanity-state")).not.toBe(neutralSanityState);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await page.getByRole("button", { name: "Reset movements" }).click();
  await expect(rise).toHaveValue("0");
  await expect(swing).toHaveValue("0");
  await expect(focus).toHaveValue(focusBefore);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});

test("Oblique Architecture guided Rise task solves observable framing and restarts to neutral", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/guided/oblique-architecture/oblique-rise-01?rttDiagnostics=1");
  await expect(page).toHaveURL(/\/simulator\/guided\/oblique-architecture\/oblique-rise-01\?rttDiagnostics=1$/);
  await expect(page.getByText("Frame the Building", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Use Front Rise to include the full building while keeping the camera level and the verticals parallel.",
      { exact: true },
    ),
  ).toBeVisible();

  const { rtt } = await assertSharedObliqueRendering(page);
  const rise = await assertRiseTaskControls(page);
  await expect(rise).toHaveValue("0");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Restart task" })).toBeVisible();

  const neutralSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  await setStepRangeInput(page, "Rise", 20);
  await expect(rise).toHaveValue("20");
  await expect.poll(async () => rtt.getAttribute("data-rtt-sanity-state")).not.toBe(neutralSanityState);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Task requirements completed" })).toHaveAttribute(
    "aria-valuenow",
    "4",
  );

  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(rise).toHaveValue("0");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Restart task" })).toBeVisible();
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
});

test("Oblique Architecture guided Swing + Focus task starts from solved Rise and restarts deterministically", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/guided/oblique-architecture/oblique-swing-focus-01?rttDiagnostics=1");
  await expect(page).toHaveURL(/\/simulator\/guided\/oblique-architecture\/oblique-swing-focus-01\?rttDiagnostics=1$/);
  await expect(page.getByText("Align the Façade Focus", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Use Front Swing and Focus to keep the receding façade sharp from near to far while preserving the architectural framing.",
      { exact: true },
    ),
  ).toBeVisible();

  const { rtt } = await assertSharedObliqueRendering(page);
  const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  const rise = cameraControls.getByRole("slider", { name: "Rise" });
  const swing = cameraControls.getByRole("slider", { name: "Swing" });
  const tilt = cameraControls.getByRole("slider", { name: "Tilt" });
  const focus = page.getByLabel("Focus distance");

  await expect(rise).toHaveValue("20");
  await expect(rise).toBeDisabled();
  await expect(swing).toHaveValue("0");
  await expect(swing).toBeEnabled();
  await expect(tilt).toBeDisabled();
  await expect(focus).toHaveValue("13200");
  await expect(focus).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();

  const neutralSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  await setStepRangeInput(page, "Swing", 9.7);
  await setStepRangeInput(page, "Focus distance", 5260);
  await expect.poll(async () => rtt.getAttribute("data-rtt-sanity-state")).not.toBe(neutralSanityState);
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Task requirements completed" })).toHaveAttribute(
    "aria-valuenow",
    "6",
  );
  const currentSettings = page.getByTestId("current-settings-readout");
  await expect(currentSettings).toContainText("Front Rise: 20.0 mm");
  await expect(currentSettings).toContainText("Front Swing: 9.7°");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(rise).toHaveValue("20");
  await expect(swing).toHaveValue("0");
  await expect(focus).toHaveValue("13200");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
});
