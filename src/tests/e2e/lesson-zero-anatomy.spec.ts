import { expect, test } from "@playwright/test";

test("Lesson 0 presents the anatomy sequence and isolates its presentation state", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/simulator/free/view-camera-anatomy?lesson=1");

  const panel = page.locator(".anatomy-lesson-panel");
  const lessonHeading = panel.getByRole("heading", { level: 3 });
  const next = panel.getByRole("button", { name: "Next", exact: true });

  await expect(panel).toBeVisible();
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

  await expect(next).toBeDisabled();
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
});
