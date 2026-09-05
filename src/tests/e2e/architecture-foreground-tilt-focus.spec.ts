import { expect, test, type Page } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const completedHeading = (page: Page) => page.getByRole("heading", { name: "Task completed" });

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

test("Architecture + Foreground is discoverable from the Scenes page", async ({ page }) => {
  await page.goto("/scenes");

  const heading = page.getByRole("heading", { name: "Architecture + Foreground", level: 2 });
  await expect(heading).toBeVisible();
  const card = heading.locator("xpath=ancestor::article");
  await expect(card.locator("img")).toHaveAttribute("src", "/assets/architecture-foreground.png");
  await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
    "href",
    "/simulator/free/architecture-foreground",
  );
  await expect(card.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
    "href",
    "/simulator/free/architecture-foreground?lesson=1",
  );

  const sceneHeadings = await page.getByRole("heading", { level: 2 }).allTextContents();
  expect(sceneHeadings.at(-3)).toBe("Oblique Architecture");
  expect(sceneHeadings.at(-2)).toBe("Architecture + Foreground");
  expect(sceneHeadings.at(-1)).toBe("Interior Corner — Rise + Swing");

  await card.getByRole("link", { name: "Open Scene" }).click();
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-foreground$/);
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
    "data-scene-subject-id",
    "architecture-foreground",
  );
});

test("Architecture + Foreground Free Practice exposes Rise, Tilt, Focus, and Aperture", async ({ page }) => {
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
  const controls = page.getByRole("region", { name: "Camera Controls" });
  const rise = controls.getByRole("slider", { name: "Rise" });
  const tilt = controls.getByRole("slider", { name: "Tilt" });
  const focus = page.getByLabel("Focus distance");

  await expect(rise).toBeEnabled();
  await expect(tilt).toBeEnabled();
  await expect(controls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(focus).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeEnabled();

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  const nearSharpness = page.getByRole("progressbar", { name: "foreground-near sharpness" });
  const buildingSharpness = page.getByRole("progressbar", { name: "building-middle sharpness" });
  await expect(nearSharpness).toBeVisible();
  await expect(buildingSharpness).toBeVisible();
  const initialBuildingSharpness = Number(await buildingSharpness.getAttribute("aria-valuenow"));

  await setStepRangeInput(page, "Rise", 20);
  await setStepRangeInput(page, "Tilt", 2);
  await expect(rtt).toHaveAttribute("data-rtt-dof-mode", "derived-planes");
  const tiltedBuildingSharpness = Number(await buildingSharpness.getAttribute("aria-valuenow"));
  expect(tiltedBuildingSharpness).not.toBe(initialBuildingSharpness);

  await setStepRangeInput(page, "Focus distance", 6830);
  await expect.poll(async () => Number(await nearSharpness.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(70);
  await expect.poll(async () => Number(await buildingSharpness.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(70);

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});

test("Architecture + Foreground Tilt + Focus guided task starts composed and is restartable", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(
    "/simulator/guided/architecture-foreground/architecture-foreground-tilt-focus-01?rttDiagnostics=1",
  );
  await expect(page).toHaveURL(
    /\/simulator\/guided\/architecture-foreground\/architecture-foreground-tilt-focus-01\?rttDiagnostics=1$/,
  );
  await expect(page.getByRole("heading", { name: "Align the Focus Plane" })).toBeVisible();
  await expect(
    page.getByText(
      "Use Front Tilt and Focus to make the near foreground and the building usefully sharp while preserving the corrected architectural framing.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(completedHeading(page)).not.toBeVisible();

  const controls = page.getByRole("region", { name: "Camera Controls" });
  const rise = controls.getByRole("slider", { name: "Rise" });
  const tilt = controls.getByRole("slider", { name: "Tilt" });
  const focus = page.getByLabel("Focus distance");
  await expect(rise).toBeDisabled();
  await expect(rise).toHaveValue("20");
  await expect(tilt).toBeEnabled();
  await expect(focus).toBeEnabled();
  await expect(controls.getByRole("slider", { name: "Swing" })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });

  await setStepRangeInput(page, "Tilt", 2);
  await expect(completedHeading(page)).not.toBeVisible();
  await setStepRangeInput(page, "Focus distance", 6830);
  await expect(completedHeading(page)).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/Aperture will address the remaining depth-of-field limitation later/i),
  ).toBeVisible();

  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(completedHeading(page)).not.toBeVisible();
  await expect(rise).toHaveValue("20");
  await expect(tilt).toHaveValue("0");
  await expect(focus).toHaveValue("9490");
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
});
