import { expect, test } from "@playwright/test";

test("Lesson 0 shows the same film-relative coverage model for Image Circle, Rise, and Shift", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/simulator/free/view-camera-anatomy");

  const panel = page.locator(".anatomy-lesson-panel");
  const heading = panel.getByRole("heading", { level: 3 });
  const next = panel.getByRole("button", { name: "Next", exact: true });
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(panel).toBeVisible();
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });

  const stepsBeforeImageCircle = [
    "Front Standard",
    "Lens and Lens Board",
    "Aperture",
    "Bellows",
    "Rear Standard",
    "Ground Glass",
    "Film Holder",
    "Camera Support",
    "Recap",
    "Now try the controls",
  ];
  for (const title of stepsBeforeImageCircle) {
    await next.click();
    await expect(heading).toHaveText(title);
  }

  await next.click();
  await expect(heading).toHaveText("Understanding the Image Circle");
  await expect(scene).toHaveAttribute("data-conceptual-image-circle-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "false");
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await page.screenshot({ path: testInfo.outputPath("lesson-zero-step12-image-circle.png") });

  await next.click();
  await expect(heading).toHaveText("Front Rise");
  await expect(scene).toHaveAttribute("data-conceptual-image-circle-visible", "false");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "parallel-circle");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");

  const frontRise = page.getByRole("slider", { name: "Front Rise", exact: true });
  await frontRise.fill("40");
  await expect(next).toBeEnabled();
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect.poll(async () => {
    const sceneOffset = Number(await scene.getAttribute("data-image-circle-offset-y-mm"));
    const rawOffset = Number(await rtt.getAttribute("data-rtt-coverage-offset-y-mm"));
    return Number.isFinite(sceneOffset) && Math.abs(sceneOffset) > 1e-5 &&
      Number.isFinite(rawOffset) && Math.abs(sceneOffset - rawOffset) < 1e-5;
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("lesson-zero-step13-front-rise-coverage.png") });

  await next.click();
  await expect(heading).toHaveText("Front Shift");
  await expect(scene).toHaveAttribute("data-image-circle-visible", "true");
  await expect(scene).toHaveAttribute("data-lens-coverage-kind", "parallel-circle");
  await expect(scene).toHaveAttribute("data-lens-coverage-visible", "true");
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");

  const frontShift = page.getByRole("slider", { name: "Front Shift", exact: true });
  await frontShift.fill("60");
  await expect(next).toBeEnabled();
  await expect(rtt).toHaveAttribute("data-rtt-coverage-enabled", "true");
  await expect.poll(async () => {
    const sceneOffset = Number(await scene.getAttribute("data-image-circle-offset-x-mm"));
    const rawOffset = Number(await rtt.getAttribute("data-rtt-coverage-offset-x-mm"));
    return Number.isFinite(sceneOffset) && Math.abs(sceneOffset) > 1e-5 &&
      Number.isFinite(rawOffset) && Math.abs(sceneOffset - rawOffset) < 1e-5;
  }).toBe(true);
  await expect.poll(async () => {
    const sceneRadius = Number(await scene.getAttribute("data-image-circle-radius-mm"));
    const glassRadius = Number(await rtt.getAttribute("data-rtt-coverage-radius-mm"));
    const sceneOffset = Number(await scene.getAttribute("data-image-circle-offset-x-mm"));
    const glassOffset = Number(await rtt.getAttribute("data-rtt-coverage-offset-x-mm"));
    return Number.isFinite(sceneRadius) && Number.isFinite(glassRadius) &&
      Math.abs(sceneRadius - glassRadius) < 1e-5 && Math.abs(sceneOffset - glassOffset) < 1e-5;
  }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("lesson-zero-step14-front-shift-coverage.png") });
});
