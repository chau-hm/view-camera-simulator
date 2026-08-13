import { expect, test } from "@playwright/test";

test("Mirror Shift guided task teaches camera movement followed by opposite Front Shift", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/guided/mirror-shift/mirror-shift-01?rttDiagnostics=1");

  const position = page.getByRole("slider", { name: "Camera Position" });
  const frontShift = page.getByRole("slider", { name: "Front Shift" });
  const rtt = page.getByTestId("ground-glass-rtt").first();

  await expect(page).toHaveURL(/\/simulator\/guided\/mirror-shift\/mirror-shift-01/);
  await expect(page.getByText("Hide the camera with shift")).toBeVisible();
  await expect(
    page.getByText(
      "Move the camera sideways to remove its reflection, then use opposite Front Shift to restore the mirror framing.",
    ),
  ).toBeVisible();
  await expect(position).toHaveValue("0");
  await expect(frontShift).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  await expect(page.getByLabel("Focus distance")).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Aperture" })).toBeDisabled();
  await expect(page.getByText("Move the whole camera sideways until its reflection is completely outside the mirror.")).toBeVisible();
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  const resourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  expect(resourceGeneration).toBeTruthy();

  await position.fill("2000");
  await expect(position).toHaveValue("2000");
  await expect(page.getByText("Keep the camera in place and shift the front standard in the opposite direction to restore the mirror framing.")).toBeVisible();
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);

  await frontShift.fill("-55");
  await expect(frontShift).toHaveValue("-55");
  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await expect(page.getByText("The reflected props still differ from Neutral because the viewpoint changed.")).toBeVisible();
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);

  await page.getByRole("button", { name: "Open 2D Geometry" }).click();
  const geometry = page.getByTestId("mirror-shift-teaching-svg");
  await expect(geometry).toBeVisible();
  await expect(geometry).toHaveAttribute("data-current-film-x-mm", "2000");
  await expect(geometry).toHaveAttribute("data-current-lens-x-mm", "1945");
  await page.getByRole("button", { name: "Close 2D Geometry" }).click();

  await page.getByRole("button", { name: "Restart task" }).click();
  await expect(position).toHaveValue("0");
  await expect(frontShift).toHaveValue("0");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();
  await expect(page.getByText("Move the whole camera sideways until its reflection is completely outside the mirror.")).toBeVisible();
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
});
