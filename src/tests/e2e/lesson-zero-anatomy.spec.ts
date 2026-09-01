import { expect, test } from "@playwright/test";

test("Lesson 0 presents the anatomy sequence and isolates its presentation state", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/simulator/free/view-camera-anatomy");

  const panel = page.locator(".anatomy-lesson-panel");
  const lessonHeading = panel.getByRole("heading", { level: 3 });
  const next = panel.getByRole("button", { name: "Next", exact: true });
  const rtt = page.getByTestId("ground-glass-rtt");

  await expect(panel).toBeVisible();
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "view-camera-anatomy");
  await expect(page.getByTestId("ground-glass-scene")).toHaveCount(0);
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 120_000 });
  await expect(lessonHeading).toHaveText("The complete camera");
  await expect(panel.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Camera Controls", exact: true })).toHaveCount(0);

  const steps = [
    "Front Standard",
    "Lens and Lens Board",
    "Aperture",
    "Bellows",
    "Rear Standard",
    "Ground Glass",
    "Film Holder",
    "Camera Support",
    "Recap",
  ];

  for (const title of steps) {
    await next.click();
    await expect(lessonHeading).toHaveText(title);

    if (title === "Aperture") {
      const apertureToggle = panel.getByRole("button", { name: "Show a smaller opening", exact: true });
      await apertureToggle.click();
      await expect(panel.getByRole("button", { name: "Show a wider opening", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
  }

  await next.click();
  await expect(lessonHeading).toHaveText("Now try the controls");

  await next.click();
  await expect(lessonHeading).toHaveText("Front Rise");
  const sceneCanvas = page.getByTestId("scene-canvas");
  await expect(sceneCanvas).toHaveAttribute("data-view-focus", "camera");
  const frontRiseOrbitTarget = await sceneCanvas.getAttribute("data-orbit-target");
  if (!frontRiseOrbitTarget) throw new Error("Lesson 0 Front Rise view has no orbit target");

  const frontRise = page.getByRole("slider", { name: "Front Rise", exact: true });
  await expect(frontRise).toBeEnabled();
  await expect(next).toBeDisabled();
  await expect(next).toHaveClass(/\bbtn--disabled\b/);
  await expect(panel.getByRole("status")).toHaveText("Move the control enough to make the physical change clear.");

  await frontRise.fill("3");
  await expect(frontRise).toHaveValue("3");
  await expect(next).toBeDisabled();
  await expect(next).toHaveClass(/\bbtn--disabled\b/);
  await expect(sceneCanvas).toHaveAttribute("data-orbit-target", frontRiseOrbitTarget);

  await frontRise.fill("12");
  await expect(next).toBeEnabled();
  await expect(next).not.toHaveClass(/\bbtn--disabled\b/);
  await expect(panel.getByRole("status")).toHaveText("Good — the physical change is now visible.");
  await expect(sceneCanvas).toHaveAttribute("data-orbit-target", frontRiseOrbitTarget);

  await next.click();
  await expect(lessonHeading).toHaveText("Front Shift");
  const frontShift = page.getByRole("slider", { name: "Front Shift", exact: true });
  const frontShiftOrbitTarget = await sceneCanvas.getAttribute("data-orbit-target");
  if (!frontShiftOrbitTarget) throw new Error("Lesson 0 Front Shift view has no orbit target");
  await frontShift.fill("12");
  await expect(next).toBeEnabled();
  await expect(sceneCanvas).toHaveAttribute("data-orbit-target", frontShiftOrbitTarget);

  await next.click();
  await expect(lessonHeading).toHaveText("Front Tilt");
  await page.getByRole("slider", { name: "Front Tilt", exact: true }).fill("3");

  await next.click();
  await expect(lessonHeading).toHaveText("Front Swing");
  await page.getByRole("slider", { name: "Front Swing", exact: true }).fill("3");

  await next.click();
  await expect(lessonHeading).toHaveText("Focus — Front Standard");
  await expect(page.getByRole("radio", { name: "Front standard", exact: true })).toBeChecked();
  await page.getByRole("slider", { name: "Focus distance", exact: true }).fill("2200");

  await next.click();
  await expect(lessonHeading).toHaveText("Focus — Rear Standard");
  await expect(page.getByRole("radio", { name: "Rear standard", exact: true })).toBeChecked();
  await page.getByRole("slider", { name: "Focus distance", exact: true }).fill("2200");

  await next.click();
  await expect(lessonHeading).toHaveText("Aperture control");
  await page.getByRole("combobox", { name: "Aperture", exact: true }).selectOption("5.6");

  await next.click();
  await expect(lessonHeading).toHaveText("Controls recap");
  await expect(next).toHaveCount(0);
  await expect(panel.getByRole("status")).toHaveText("Lesson complete");

  await panel.getByRole("button", { name: "Restart lesson", exact: true }).click();
  await expect(lessonHeading).toHaveText("The complete camera");
  await expect(panel.getByRole("status")).toHaveCount(0);

  await panel.getByRole("link", { name: "Back to Scenes", exact: true }).click();
  await expect(page).toHaveURL(/\/scenes$/);

  const architectureCard = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Architecture Rise", exact: true }) });
  await architectureCard.getByRole("link", { name: "Open Scene", exact: true }).click();
  await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  await expect(page.getByRole("heading", { name: "Camera Controls", exact: true })).toBeVisible();
  await expect(page.locator(".anatomy-lesson-panel")).toHaveCount(0);

  await page.getByRole("link", { name: "All Scenes", exact: true }).click();
  const anatomyCard = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Lesson 0 — Meet the View Camera", exact: true }) });
  await anatomyCard.getByRole("link", { name: "Start Lesson", exact: true }).click();
  await expect(page).toHaveURL(/\/simulator\/free\/view-camera-anatomy\?lesson=1$/);
  await expect(lessonHeading).toHaveText("The complete camera");
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute(
    "data-rtt-scene-id",
    "view-camera-anatomy",
  );
  await expect(page.getByTestId("ground-glass-scene")).toHaveCount(0);
});
