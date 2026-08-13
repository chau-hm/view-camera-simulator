import { expect, test } from "@playwright/test";

test("Mirror Shift moves the canonical rig while keeping its RTT mounted", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/simulator/free/mirror-shift?rttDiagnostics=1");

  const scene = page.locator('[data-testid="scene-canvas"]');
  const rtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  const position = page.getByRole("slider", { name: "Camera Position" });

  await expect(position).toHaveValue("0");
  await expect(page.getByRole("slider", { name: "Rise" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Tilt" })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Swing" })).toHaveCount(0);
  await expect(scene).toHaveAttribute(
    "data-camera-rig-origin",
    "0.000000,0.000000,0.000000",
  );
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });

  const sceneElement = await scene.elementHandle();
  const rttElement = await rtt.elementHandle();
  const resourceGeneration = await rtt.getAttribute("data-rtt-resource-generation");
  expect(resourceGeneration).toBeTruthy();

  await position.fill("1800");
  await expect(position).toHaveValue("1800");
  await expect(scene).toHaveAttribute(
    "data-camera-rig-origin",
    "1800.000000,0.000000,0.000000",
  );
  await expect(scene).toHaveAttribute("data-camera-lens-center-world", "1800.000000,0.000000,0.000000");
  const movedFilmCenter = await scene.getAttribute("data-camera-film-center-world");
  expect(movedFilmCenter?.split(",")[0]).toBe("1800.000000");
  await expect(rtt).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 30_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 30_000 });
  await expect(rtt).toHaveAttribute("data-rtt-resource-generation", resourceGeneration!);
  await expect.poll(() => page.evaluate((node) => node?.isConnected, sceneElement)).toBe(true);
  await expect.poll(() => page.evaluate((node) => node?.isConnected, rttElement)).toBe(true);

  await page.getByRole("button", { name: "Reset movements" }).click();
  await expect(position).toHaveValue("0");
  await expect(scene).toHaveAttribute(
    "data-camera-rig-origin",
    "0.000000,0.000000,0.000000",
  );
});
