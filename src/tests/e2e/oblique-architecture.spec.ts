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

const assertRiseOnlyControls = async (page: Page) => {
  const cameraControls = page.getByRole("region", { name: "Camera Controls" });
  const rise = cameraControls.getByRole("slider", { name: "Front Rise" });
  await expect(rise).toBeVisible();
  await expect(rise).toBeEnabled();
  await expect(cameraControls.getByRole("radio", { name: "Front Rise" })).toBeChecked();
  await expect(cameraControls.getByRole("slider", { name: "Front Swing" })).toHaveCount(0);
  await expect(cameraControls.getByRole("slider", { name: "Front Tilt" })).toHaveCount(0);
  await expect(cameraControls.getByRole("radio", { name: "Front Swing" })).toHaveCount(0);
  await expect(cameraControls.getByRole("radio", { name: "Front Tilt" })).toHaveCount(0);
  await expect(page.getByLabel("Focus distance")).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  return rise;
};

test("Oblique Architecture free practice keeps the shared level subject and exposes Front Rise only", async ({ page }) => {
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
  const { rtt } = await assertSharedObliqueRendering(page);
  const rise = await assertRiseOnlyControls(page);
  await expect(rise).toHaveValue("0");
  await expect(page.getByText("Focus is fixed for this lesson", { exact: true })).toBeVisible();
  await expect(page.getByText("Aperture is fixed for this lesson", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset movements" })).toBeVisible();

  const neutralSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  await setStepRangeInput(page, "Front Rise", 20);
  await expect(rise).toHaveValue("20");
  await expect.poll(async () => rtt.getAttribute("data-rtt-sanity-state")).not.toBe(neutralSanityState);
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await page.getByRole("button", { name: "Reset movements" }).click();
  await expect(rise).toHaveValue("0");
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
  const rise = await assertRiseOnlyControls(page);
  await expect(rise).toHaveValue("0");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Restart task" })).toBeVisible();

  const neutralSanityState = await rtt.getAttribute("data-rtt-sanity-state");
  await setStepRangeInput(page, "Front Rise", 20);
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
